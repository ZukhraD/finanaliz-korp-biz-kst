"use strict";
/* ================================================================ Экспресс-анализ: расчёты, проблемы, вердикт.
   Пороговые значения собраны здесь, чтобы их легко было поменять под методику банка. */
const NORM = {
  dscr_ok: 1.25, dscr_min: 1.0,            // покрытие платежей
  lev_ok: 3.5, lev_max: 5,                 // долг / EBITDA (с новым кредитом)
  liq_ok: 1.0, liq_min: 0.7,               // текущая ликвидность
  eq_ok: 0.2, eq_min: 0.1,                 // доля собственного капитала
  rev_drop_chk: -0.1, rev_drop_risk: -0.2, // падение выручки
  wc_term: 36,                             // макс. срок для пополнения оборотных средств, мес.
  wc_share: 0.5,                           // сумма кредита к годовой выручке — проверить, если больше
  diff_pct: 0.1, diff_abs: 1000,           // расхождение: больше 10 % и больше 1 000 тыс. тг
};
const SEVW = { crit: 4, risk: 3, chk: 2, nd: 1, ok: 0 };
const SEVT = { crit: "Стоп-фактор", risk: "Риск", chk: "Проверить", nd: "Нет данных", ok: "Норма" };

/* ---------------------------------------------------------------- платёж по новому кредиту */
// цель «пополнение оборотных средств» (не овердрафт) — платёжная нагрузка считается только по процентам
const isWC = (c = X.card) => c.product !== "Овердрафт" && /оборотн/i.test(c.purpose || "");
function loanPay(c = X.card) {
  const A = N(c.amount), n = Math.max(1, N(c.term) - N(c.grace)), r = N(c.rate) / 100 / 12;
  if (!A || !N(c.term)) return null;
  if (c.product === "Кредитная линия" || c.product === "Овердрафт") {
    // линия: считаем как кредит на срок (консервативно); овердрафт — только проценты
    if (c.product === "Овердрафт") return { pay: A * r, first: A * r, grace: 0, note: "только проценты (овердрафт гасится оборотами)" };
  }
  // пополнение оборотных средств: нагрузка — только проценты (сумма × ставка в год)
  if (isWC(c)) return { pay: A * r, first: A * r, grace: A * r, year: A * r * 12, wc: true, note: `только проценты: ${fmt(A * r * 12)} тыс. тг в год` };
  if (c.sched === "end") return { pay: A * r, first: A * r, grace: A * r, balloon: A, note: "ежемесячно только проценты, долг — одной суммой в конце срока" };
  if (c.sched === "diff") return { pay: A / n + A * r, first: A / n + A * r, grace: A * r, note: "первый платёж самый большой, потом уменьшается" };
  const p = r ? A * r / (1 - Math.pow(1 + r, -n)) : A / n;
  return { pay: p, first: p, grace: A * r, note: "равными платежами" };
}
// какую сумму можно обслуживать при заданном ежемесячном платеже (те же условия)
function amountForPay(pay, c = X.card) {
  if (!(pay > 0)) return 0;
  const n = Math.max(1, N(c.term) - N(c.grace)), r = N(c.rate) / 100 / 12;
  if (c.product === "Овердрафт" || isWC(c) || c.sched === "end") return r ? pay / r : 0;
  if (c.sched === "diff") return pay / (1 / n + r);
  return r ? pay * (1 - Math.pow(1 + r, -n)) / r : pay * n;
}
const monthsBetween = (iso, ref = new Date()) => { const d = new Date(iso); if (!iso || isNaN(d)) return null; return (ref.getFullYear() - d.getFullYear()) * 12 + ref.getMonth() - d.getMonth(); };

/* ---------------------------------------------------------------- основной расчёт */
function analyze() {
  const c = X.card, P = X.per;
  const withRev = P.filter(p => isNum(fv("rev", p.id)));
  const withBal = P.filter(p => isNum(val("ta", p.id)));
  const pl = withRev[withRev.length - 1] || null, bal = withBal[withBal.length - 1] || null;
  const fulls = withRev.filter(p => N(p.months) === 12);
  const yr = fulls[fulls.length - 1] || null, yr0 = fulls[fulls.length - 2] || null;
  const k = pl ? 12 / (N(pl.months) || 12) : 1;             // перевод в годовое выражение
  const m = { pl, bal, yr, yr0, k };
  if (pl) {
    m.rev = fv("rev", pl.id) * k; m.ni = val("ni", pl.id) * k; m.ebit = val("ebit", pl.id) * k;
    m.da = fv("da", pl.id); m.daKnown = isNum(m.da); m.ebitda = val("ebitda", pl.id) * k;
    m.cit = N(fv("cit", pl.id)) * k; m.int = N(fv("int", pl.id)) * k;
    m.gm = m.rev ? (m.rev - N(fv("cogs", pl.id)) * k) / m.rev : null;
    m.nm = m.rev ? m.ni / m.rev : null;
    m.fam = N(fv("fam", pl.id)) * k;                        // у ИП: деньги, которые уходят на семью
    m.cashYear = m.ebitda - m.cit - m.fam;                 // деньги, которые бизнес зарабатывает за год до платежей по кредитам
    m.cashMonth = m.cashYear / 12;
    m.ocf = fv("ocf", pl.id); if (isNum(m.ocf)) m.ocf *= k;
  }
  if (yr && yr0) { const a = fv("rev", yr0.id), b = fv("rev", yr.id); m.revGr = a ? b / a - 1 : null; }
  if (bal) {
    m.ta = val("ta", bal.id); m.eq = fv("eq", bal.id); m.debt = N(val("debt", bal.id));
    m.ca = val("ca", bal.id); m.cl = val("cl", bal.id);
    m.liq = m.cl ? m.ca / m.cl : null; m.eqr = m.ta ? N(m.eq) / m.ta : null;
  }
  // кредиты
  m.payKnown = isNum(c.payExist) || (c.loans || []).length > 0;
  m.payExist = isNum(c.payExist) ? c.payExist : sum((c.loans || []).filter(l => !l.refin).map(l => l.pay));
  m.newPay = loanPay();
  m.payTotal = m.payExist + (m.newPay ? m.newPay.pay : 0);
  if (isNum(m.cashMonth)) {
    m.dscr = m.payTotal > 0 ? m.cashMonth / m.payTotal : null;
    m.payFree = m.cashMonth / NORM.dscr_ok - m.payExist;    // сколько ещё можно платить в месяц с запасом 25 %
    m.maxAmt = Math.max(0, amountForPay(m.payFree));
  }
  m.debtNew = m.debt + N(c.amount);
  if (isNum(m.ebitda) && m.ebitda > 0) m.lev = m.debtNew / m.ebitda;
  return m;
}

/* ---------------------------------------------------------------- проблемы и расхождения */
function problems(m = analyze()) {
  const c = X.card, out = [];
  const add = (sev, area, title, why, todo) => out.push({ sev, area, title, why, todo });
  const T = v => fmt(v) + " тыс. тг";
  // полнота
  if (!c.name) add("nd", "Карточка", "Не указано наименование клиента", "Без названия заключение будет неполным.", "Заполните «Карточку клиента».");
  if (!N(c.amount) || !N(c.term)) add("nd", "Карточка", "Не указаны сумма или срок кредита", "Без суммы и срока нельзя посчитать будущий платёж и хватит ли на него денег.", "Укажите сумму, срок и ставку в «Карточке клиента».");
  if (!m.pl) add("nd", "Отчётность", "Нет данных о выручке и прибыли (ОПиУ)", "Без отчёта о прибылях и убытках нельзя понять, зарабатывает ли бизнес.", "Загрузите ОПиУ или внесите цифры вручную в «Финансовой отчётности».");
  if (!m.bal) add("nd", "Отчётность", "Нет баланса", "Без баланса не видно долгов, собственных средств и имущества компании.", "Загрузите баланс или внесите цифры вручную.");
  // стоп-факторы
  if (m.bal && isNum(m.eq) && m.eq < 0) add("crit", "Капитал", "Отрицательный собственный капитал", `Долгов у компании больше, чем всего имущества: капитал ${T(m.eq)}. Накопленные убытки «съели» собственные средства.`, "Обычно это стоп-фактор. Уточнить у риск-менеджера, возможно ли финансирование при докапитализации учредителем.");
  // овердрафт: условия продукта
  if (isOD(c)) for (const k of odChecks()) if (k.sev !== "ok") add(k.sev, "Овердрафт", k.t, `Факт: ${k.fact.replace(/\.$/, "")}.`, k.todo);
  // платёжеспособность
  if (!isOD(c) && isNum(m.dscr)) {
    if (m.dscr < NORM.dscr_min) add("crit", "Платёжеспособность", "Денег не хватает на платежи по кредитам", `Бизнес зарабатывает ~${T(m.cashMonth)} в месяц, а платить по всем кредитам (вместе с новым) нужно ~${T(m.payTotal)}. Покрытие ${fmt(m.dscr, "x")} — меньше 1.`, m.maxAmt > 0 ? `Снизить сумму до ~${T(Math.floor(m.maxAmt / 100) * 100)} или увеличить срок; проверить, нет ли неучтённых доходов (обороты по счетам).` : "При текущих доходах новый кредит не обслуживается. Проверить обороты по счетам и возможность рефинансирования.");
    else if (m.dscr < NORM.dscr_ok) add("chk", "Платёжеспособность", "Запас по платежам маленький", `Покрытие платежей ${fmt(m.dscr, "x")}: денег хватает впритык, нужно не меньше ${fmt(NORM.dscr_ok, "x")}.`, `Рассмотреть сумму до ~${T(Math.floor(m.maxAmt / 100) * 100)} или больший срок; подтвердить выручку выписками.`);
  } else if (!isOD(c) && m.pl && m.payTotal > 0 && m.cashMonth <= 0) add("crit", "Платёжеспособность", "Бизнес не зарабатывает денег на платежи", "Операционный результат отрицательный — платить по кредитам не из чего.", "Без подтверждённого источника погашения заявку не вести.");
  if (m.pl && !m.daKnown) add("nd", "Отчётность", "Не указана амортизация", "Без неё денежный поток считается по прибыли — это осторожная (заниженная) оценка.", "Если есть ДДС или пояснения к отчётности — внесите амортизацию в ОПиУ.");
  if (isNum(m.lev)) {
    if (m.lev > NORM.lev_max) add("risk", "Долговая нагрузка", "Слишком много долгов относительно заработка", `Все долги с новым кредитом (${T(m.debtNew)}) в ${fmt(m.lev, "1")} раза больше годового заработка (EBITDA ${T(m.ebitda)}). Норма — до ${fmt(NORM.lev_ok, "1")}.`, "Снизить сумму или рассмотреть рефинансирование действующих долгов.");
    else if (m.lev > NORM.lev_ok) add("chk", "Долговая нагрузка", "Долговая нагрузка повышенная", `Долги в ${fmt(m.lev, "1")} раза больше годового заработка (норма до ${fmt(NORM.lev_ok, "1")}).`, "Учесть в заключении; проверить, на что пойдёт кредит и даст ли он рост выручки.");
  } else if (m.pl && m.ebitda <= 0 && (m.debtNew > 0)) add("risk", "Долговая нагрузка", "Заработка нет, а долги есть", "Операционный результат отрицательный, поэтому долги обслуживать не из чего.", "Выяснить причины убытка и источник погашения.");
  // прибыль и выручка
  if (m.pl && m.ni < 0) add("risk", "Прибыль", "Компания работает в убыток", `Чистый убыток ${T(m.ni)} за ${perLabel(m.pl)}${m.k !== 1 ? " (в годовом выражении)" : ""}.`, "Узнать причину (разовые расходы, сезонность, рост затрат) и есть ли улучшение в текущем году.");
  if (isNum(m.revGr)) {
    if (m.revGr <= NORM.rev_drop_risk) add("risk", "Выручка", "Выручка сильно упала", `За ${perLabel(m.yr)} выручка снизилась на ${fmt(-m.revGr, "p")} к ${perLabel(m.yr0)}.`, "Узнать причину; запросить выручку за текущий год (выписки, декларации).");
    else if (m.revGr <= NORM.rev_drop_chk) add("chk", "Выручка", "Выручка снизилась", `Снижение на ${fmt(-m.revGr, "p")} к прошлому году.`, "Уточнить причину у клиента.");
  }
  if (isNum(m.ocf) && m.ocf < 0) add("risk", "Деньги", "Отрицательный денежный поток от основной деятельности", `По ДДС бизнес за год потратил на основную деятельность больше, чем получил: ${T(m.ocf)}. Прибыль «на бумаге» может не превращаться в деньги.`, "Проверить рост дебиторки и запасов; подтвердить поступления выписками.");
  // баланс
  if (isNum(m.liq)) {
    if (m.liq < NORM.liq_min) add("risk", "Ликвидность", "Текущих долгов намного больше, чем быстрых активов", `Коэффициент текущей ликвидности ${fmt(m.liq, "x")}: на 1 тенге долгов до года приходится ${fmt(m.liq, "x")} тенге денег, дебиторки и запасов.`, "Проверить, не придётся ли гасить краткосрочные долги за счёт нового кредита.");
    else if (m.liq < NORM.liq_ok) add("chk", "Ликвидность", "Ликвидность ниже нормы", `Коэффициент ${fmt(m.liq, "x")} (норма от ${fmt(NORM.liq_ok, "x")}).`, "Учесть в заключении.");
  }
  if (isNum(m.eqr) && N(m.eq) >= 0) {
    if (m.eqr < NORM.eq_min) add("risk", "Капитал", "Почти всё имущество куплено на заёмные деньги", `Собственный капитал — только ${fmt(m.eqr, "p")} от активов (норма от ${fmt(NORM.eq_ok, "p")}).`, "Уточнить возможность вложений учредителя.");
    else if (m.eqr < NORM.eq_ok) add("chk", "Капитал", "Мало собственного капитала", `Капитал ${fmt(m.eqr, "p")} от активов (норма от ${fmt(NORM.eq_ok, "p")}).`, "Учесть в заключении.");
  }
  // условия
  if (!isOD(c) && c.purpose === PURPOSES[0] && N(c.term) > NORM.wc_term) add("chk", "Условия", "Длинный срок для пополнения оборотки", `Срок ${c.term} мес.; для оборотных средств обычно не больше ${NORM.wc_term}.`, "Уточнить срок по программе.");
  if (!isOD(c) && m.pl && N(c.amount) && c.purpose === PURPOSES[0] && N(c.amount) > m.rev * NORM.wc_share) add("chk", "Условия", "Сумма велика для оборота компании", `Запрашивают ${T(c.amount)} — это ${fmt(N(c.amount) / m.rev, "p")} годовой выручки.`, "Попросить клиента обосновать потребность (контракты, план закупок).");
  if (c.sched === "end" && !isWC(c) && N(c.amount) && c.product === "Кредит") add("chk", "Условия", "Погашение долга одной суммой в конце", `В конце срока нужно будет вернуть сразу ${T(c.amount)}.`, "Понять, из каких денег будет погашение (контракт, сезон, рефинансирование).");

  /* --- расхождения (сверки) */
  const big = (a, b) => isNum(a) && isNum(b) && Math.abs(a - b) > NORM.diff_abs && Math.abs(a - b) > NORM.diff_pct * Math.max(Math.abs(a), Math.abs(b));
  for (const p of X.per) {
    const ta = val("ta", p.id), tle = val("tle", p.id), L = perLabel(p);
    if (isNum(ta) && isNum(tle) && Math.abs(ta - tle) > Math.max(5, 0.005 * ta)) add("chk", "Расхождения", `Баланс не сходится (${L})`, `Активы ${T(ta)}, а пассивы ${T(tle)} — разница ${T(ta - tle)}. Скорее всего, ошибка при вводе или загрузке.`, "Сверить строки с документом.");
    const tr = fv("ta_rep", p.id);
    if (isNum(ta) && isNum(tr) && Math.abs(ta - tr) > Math.max(5, 0.005 * tr)) add("chk", "Расхождения", `Итог активов не совпадает с отчётностью (${L})`, `По строкам ${T(ta)}, в документе ${T(tr)}.`, "Проверить, все ли строки баланса заполнены.");
    const ni = val("ni", p.id), nr = fv("ni_rep", p.id);
    if (isNum(ni) && isNum(nr) && Math.abs(ni - nr) > Math.max(5, 0.02 * Math.abs(nr))) add("chk", "Расхождения", `Чистая прибыль не совпадает с отчётностью (${L})`, `По строкам ${T(ni)}, в документе ${T(nr)}.`, "Проверить прочие доходы/расходы и налог.");
  }
  // долг по балансу и взнос по кредитам
  if (m.bal && !m.payKnown && m.debt > NORM.diff_abs) add("chk", "Платёжеспособность", "Не указан взнос по действующим кредитам", `В балансе кредитов и займов на ${T(m.debt)}, а ежемесячный взнос по ним не указан — платёжеспособность получится завышенной.`, "Узнать у клиента примерную сумму платежей в месяц и внести в «Запрашиваемые условия».");
  if (m.bal && m.payKnown && m.payExist === 0 && m.debt > NORM.diff_abs) add("chk", "Расхождения", "Кредиты в балансе есть, а взнос указан нулевой", `В балансе кредитов и займов на ${T(m.debt)}.`, "Уточнить у клиента: возможно, это заём учредителя без графика или кредит уже погашен.");
  if (!X.mgmt && m.pl && m.debt > NORM.diff_abs && !m.int) add("chk", "Расхождения", "Есть кредиты, но нет расходов на проценты", "В балансе есть займы, а в ОПиУ проценты не отражены.", "Уточнить: беспроцентный заём учредителя или ошибка в отчётности.");
  // нераспределённая прибыль vs чистая прибыль
  if (m.yr && m.yr0) {
    const d = N(fv("re", m.yr.id)) - N(fv("re", m.yr0.id)), ni = val("ni", m.yr.id);
    if (isNum(fv("re", m.yr.id)) && isNum(fv("re", m.yr0.id)) && big(d, ni)) add("chk", "Расхождения", "Прибыль не «дошла» до капитала", `Чистая прибыль за ${perLabel(m.yr)} — ${T(ni)}, а нераспределённая прибыль изменилась на ${T(d)}.`, d < ni ? "Возможно, выплачены дивиденды — уточнить сумму (это деньги, ушедшие из бизнеса)." : "Возможны корректировки прошлых лет — уточнить у бухгалтера.");
    // дебиторка растёт быстрее выручки
    const a0 = fv("ar", m.yr0.id), a1 = fv("ar", m.yr.id);
    if (isNum(a0) && isNum(a1) && a0 > 0 && isNum(m.revGr) && a1 / a0 - 1 > m.revGr + 0.3) add("chk", "Расхождения", "Дебиторская задолженность растёт быстрее выручки", `Дебиторка выросла на ${fmt(a1 / a0 - 1, "p")}, а выручка — на ${fmt(m.revGr, "p")}. Покупатели стали дольше платить или часть продаж «на бумаге».`, "Запросить расшифровку дебиторки: крупные должники и сроки.");
  }
  // декларации vs ОПиУ
  for (const s of declYears()) {
    const p = X.per.find(pp => N(pp.months) === 12 && pp.date && pp.date.startsWith(String(s.year)) && isNum(fv("rev", pp.id)));
    if (!p) continue;
    const r = fv("rev", p.id);
    if (isNum(s.rev) && big(r, s.rev)) add("chk", "Расхождения", `Выручка в отчётности не совпадает с декларацией (${s.year})`, `В ОПиУ ${T(r)}, в декларации (${s.forms}) ${T(s.rev)} — разница ${fmt(Math.abs(r / s.rev - 1), "p")}.`, r > s.rev ? "Выручка в отчётности больше, чем показано налоговой — уточнить причину; верить меньшей цифре." : "В декларации доход больше — проверить, полная ли отчётность (может быть другая деятельность).");
    if (isNum(s.vat) && s.vat > 0 && r > s.vat * (1 + NORM.diff_pct) && r - s.vat > NORM.diff_abs) add("chk", "Расхождения", `Оборот по НДС меньше выручки (${s.year})`, `Оборот по декларациям НДС ${T(s.vat)}, выручка ${T(r)}.`, "Проверить, все ли кварталы 300.00 загружены.");
  }
  return out.sort((a, b) => SEVW[b.sev] - SEVW[a.sev]);
}
// декларации по годам (тыс. тг)
function declYears() {
  const by = {};
  for (const d of X.decl || []) {
    if (!d.year) continue;
    const y = by[d.year] = by[d.year] || { year: d.year, rev: null, vat: null, parts: {}, forms: new Set() };
    const v = d.vals || {};
    if (isNum(v.rev) && ["100", "110", "910", "220", "150", "913"].includes(d.form)) { const key = d.form + d.part; if (!y.parts[key]) { y.parts[key] = 1; y.rev = N(y.rev) + v.rev / 1000; y.forms.add(d.form + ".00"); } }
    if (d.form === "300" && (isNum(v.vat_turn) || isNum(v.vat_ex))) { y.vat = N(y.vat) + (N(v.vat_turn) + N(v.vat_ex)) / 1000; }
  }
  return Object.values(by).map(y => ({ ...y, forms: [...y.forms].join(", ") })).sort((a, b) => a.year - b.year);
}

/* ---------------------------------------------------------------- вердикт */
function verdict(probs) {
  const has = s => probs.some(p => p.sev === s), n = s => probs.filter(p => p.sev === s).length;
  const ess = probs.filter(p => p.sev === "nd" && /ОПиУ|баланса|сумма или срок|Поступления за период/.test(p.title));
  if (ess.length) return { sev: "nd", icon: "?", title: "Недостаточно данных для вывода", text: "Заполните недостающее: " + ess.map(p => p.title.toLowerCase()).join("; ") + "." };
  if (has("crit")) return { sev: "crit", icon: "✕", title: "Предварительно не подходит", text: "Есть стоп-фактор(ы). Без их устранения заявку дальше не вести." };
  if (n("risk") >= 2) return { sev: "risk", icon: "!", title: "Сомнительно — нужна доработка", text: "Несколько серьёзных рисков. Возможна заявка на других условиях: меньше сумма, больше срок, дополнительное обеспечение." };
  if (has("risk")) return { sev: "chk", icon: "!", title: "Подходит с условиями", text: "Есть один серьёзный риск — его нужно закрыть до подачи заявки." };
  if (has("chk")) return { sev: "chk", icon: "✓", title: "Предварительно подходит, нужны уточнения", text: "Критичных проблем нет, но есть вопросы, которые надо прояснить с клиентом." };
  return { sev: "ok", icon: "✓", title: "Предварительно подходит", text: "Критичных проблем и расхождений не найдено. Можно собирать полный пакет документов." };
}

/* ================================================================ Овердрафт (сокращённо, по правилам основного сайта):
   лимит = 40 % среднемесячных очищенных кредитовых оборотов за 6 (при сезонности 12) полных месяцев до месяца заявки —
   отдельно по оборотам в нашем банке и в других банках (не более 2); при транше до 90 дней — не более 100 млн тг;
   доля одного покупателя больше 60 % — его поступления берутся не более 60 %. */
const OD_CAP = 100000;   // тыс. тг
const isOD = (c = X.card) => c.product === "Овердрафт";
function odCfg(c = X.card) { c.od = Object.assign({ tranche: 30, seasonal: "Нет", appMonth: "", exp: null, buyers: null, topShare: null, otherBanks: null, banned: "Нет", m: {}, st: [], stWhere: "our" }, c.od || {}); c.od.m = c.od.m || {}; c.od.st = c.od.st || []; return c.od; }
const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const ymLabel = ym => { const [y, m] = ym.split("-"); return `${MON[+m - 1]} ${y}`; };
function odWindow(o = odCfg()) {
  const [y, m] = (o.appMonth || ymNow()).split("-").map(Number), n = o.seasonal === "Да" ? 12 : 6, out = [];
  for (let i = n; i >= 1; i--) { const d = new Date(y, m - 1 - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  return out;
}
function odCalc() {
  const o = odCfg(), win = odWindow(o), n = win.length, S = odStatements(o, win);
  // по каждой группе: если есть выписки — суммы из выписок, иначе — внесённые вручную
  const val = (ym, w) => S[w].has ? (S[w].months[ym].covered ? S[w].months[ym].net : null) : (o.m[ym]?.[w] ?? null);
  const rows = win.map(ym => ({ ym, our: val(ym, "our"), other: val(ym, "other"), nOps: S.our.has || S.other.has ? N(S.our.months[ym].n) + N(S.other.months[ym].n) : null }));
  const filled = rows.filter(r => isNum(r.our) || isNum(r.other)).length;
  const sOur = sum(rows.map(r => r.our)), sOther = sum(rows.map(r => r.other));
  // покупатели: по выпискам — сами; иначе — со слов клиента
  const auto = S.our.has || S.other.has;
  const allCp = new Map(); for (const w of ["our", "other"]) for (const [k, x] of S[w].cps) { const y = allCp.get(k) || { name: x.name, v: 0 }; y.v += x.v; allCp.set(k, y); }
  const cpl = [...allCp.values()].sort((a, b) => b.v - a.v), cpTot = sum(cpl.map(x => x.v));
  const buyers = auto ? cpl.length : o.buyers, topShare = auto ? (cpTot ? cpl[0].v / cpTot * 100 : null) : o.topShare;
  const otherBanks = S.other.has ? S.other.banks.size : o.otherBanks;
  const share = isNum(topShare) ? topShare / 100 : 0, adj = share > 0.6 ? 1 - 0.4 * share : 1;
  const grpAvg = (w, s) => S[w].has ? Math.max(0, s - S[w].cut) / n : s * adj / n;
  const avgOur = grpAvg("our", sOur), avgOther = N(otherBanks) > 2 ? 0 : grpAvg("other", sOther);
  const limOur = 0.4 * avgOur, limOther = 0.4 * avgOther, lim = limOur + limOther;
  const limit = +o.tranche === 90 ? Math.min(lim, OD_CAP) : lim;
  const tot = rows.map(r => N(r.our) + N(r.other)), avgAll = sum(tot) / n;
  const cutAny = S.our.cut + S.other.cut > 0 || (!auto && adj < 1);
  return { o, win, n, rows, filled, sOur, sOther, adj, share, avgOur, avgOther, limOur, limOther, lim, limit, capHit: +o.tranche === 90 && lim > OD_CAP, tot, avgAll,
    zero: tot.filter(v => v <= 0).length, low: tot.filter(v => v > 0 && v < 0.3 * avgAll).length, needExp: o.seasonal === "Да" || +o.tranche === 90 ? 12 : 6,
    S, auto, cpl, cpTot, buyers, topShare, otherBanks, cutAny,
    uncovered: rows.filter(r => (S.our.has && r.our === null) || (S.other.has && r.other === null)).length,
    fewOps: auto ? rows.filter(r => r.nOps < 3).length : null };
}
// проверки по условиям овердрафта: [статус, условие, факт, что сделать]
function odChecks(d = odCalc()) {
  const o = d.o, c = X.card, out = [], add = (sev, t, fact, todo) => out.push({ sev, t, fact, todo });
  if (!d.filled) { add("nd", "Поступления за период", `нет поступлений за ${d.n} мес.`, "Загрузите выписки по счетам или внесите очищенные поступления по месяцам в «Карточке клиента»."); return out; }
  add(isNum(o.exp) ? (o.exp >= d.needExp ? "ok" : "crit") : "nd", `Срок деятельности не менее ${d.needExp} мес.`, isNum(o.exp) ? `${o.exp} мес.` : "не указан", `Нужно не меньше ${d.needExp} мес.${d.needExp === 12 ? " (сезонный бизнес или транш до 90 дней)" : ""}.`);
  add(d.zero ? "crit" : d.low ? "chk" : "ok", "Стабильные поступления каждый месяц", d.zero ? `месяцев без поступлений: ${d.zero}` : d.low ? `месяцев с очень малыми поступлениями: ${d.low}` : "поступления есть каждый месяц", d.zero ? "При сезонном бизнесе отметьте «Сезонный бизнес: Да» (период 12 мес.); проверьте, все ли счета учтены." : "Уточнить причину провала поступлений.");
  if (d.auto && d.uncovered) add("chk", "Выписки за все месяцы периода", `нет выписки за месяцев: ${d.uncovered}`, "Загрузите выписки за весь период — месяцы без выписки в расчёт не попали.");
  if (d.auto && d.S.our.noRate.length + d.S.other.noRate.length) add("chk", "Курс для валютных счетов", "не указан курс — валютная выписка не учтена", "Укажите курс к тенге у валютной выписки.");
  if (d.auto) add(d.fewOps > (d.n === 12 ? 2 : 1) ? "crit" : d.fewOps ? "chk" : "ok", "Поступления не реже 3 раз в месяц", d.fewOps ? `месяцев с менее чем 3 поступлениями: ${d.fewOps}` : "в каждом месяце 3 и больше", "Допускается 1 такой месяц из 6 (2 из 12).");
  add(isNum(d.buyers) ? (d.buyers >= 3 ? "ok" : "crit") : "nd", "Не менее 3 покупателей", isNum(d.buyers) ? `${d.buyers}${d.auto ? " (по выпискам)" : ""}` : "не указано", "Нужно минимум 3 покупателя за период.");
  if (isNum(d.topShare)) add(d.topShare > 60 ? "chk" : "ok", "Доля одного покупателя не более 60 %", `${fmt(d.topShare, "d2")} %${d.auto && d.cpl[0] ? " — " + d.cpl[0].name : ""}`, "Лимит уже рассчитан с ограничением: от этого покупателя учтено не более 60 % поступлений.");
  if (d.sOther > 0) add(N(d.otherBanks) > 2 ? "crit" : isNum(d.otherBanks) ? "ok" : "nd", "Обороты в других банках — не более 2 банков", isNum(d.otherBanks) ? `банков: ${d.otherBanks}` : "не указано", "Учитываются обороты не более чем в 2 других банках; условие — перевод 90 % оборотов в наш банк в течение 3 месяцев.");
  if (+o.tranche === 90) add(o.banned === "Да" ? "crit" : "ok", "Транш до 90 дней не для строительства и сельского хозяйства", o.banned === "Да" ? "отрасль — строительство / сельское хозяйство" : "отрасль подходит", "Для этих отраслей — только транш до 30 дней.");
  add(N(c.term) > 0 ? (N(c.term) <= 36 ? "ok" : "crit") : "nd", "Срок кредитной линии не более 36 мес.", N(c.term) ? `${c.term} мес.` : "не указан", "Уменьшите срок линии до 36 мес.");
  add(!N(c.amount) ? "nd" : N(c.amount) <= d.limit + 0.5 ? "ok" : "crit", `Сумма не больше расчётного лимита${+o.tranche === 90 ? " и 100 млн тг" : ""}`, `запрос ${N(c.amount) ? fmt(c.amount) : "—"}, лимит ${fmt(d.limit)} тыс. тг`, `Снизить сумму до ${fmt(Math.floor(d.limit / 100) * 100)} тыс. тг.`);
  return out;
}

/* ================================================================ Овердрафт: выписки по счетам → очищенные кредитовые обороты.
   Из поступлений исключаются (8 пунктов методики):
   1) выдача кредитов; 2) конвертация — продажа валюты с валютных счетов; 3) поступления с других счетов клиента;
   4) возврат платёжных документов; 5) финансовая помощь от связанных компаний; 6) кредиты (займы) от учредителей;
   7) взносы наличными — кроме инкассации, банкоматов Cash-in и POS-терминалов; 8) государственные субсидии.
   Штрафы, пени, вознаграждение и страховые выплаты не исключаются. Распознавание — по назначению платежа, КНП и БИН. */
const OD_EX = {
  loan: "1. Выдача кредитов", conv: "2. Конвертация (продажа валюты)", own: "3. С других счетов клиента", ret: "4. Возврат платёжных документов",
  aid: "5. Финансовая помощь связанных компаний", founder: "6. Кредиты (займы) от учредителей", cash: "7. Взносы наличными", subs: "8. Государственные субсидии",
};
const FOUNDER = /учредител|участник\S*\s+(тоо|товарищ)|(^|\s)участник|акционер|собственник/;
function odCat(t, own) {
  if (t.ov) return t.ov === "inc" ? null : t.ov;            // ручной выбор
  const c = DocParse.classify(t, own); if (!c) return null;
  const [cat, why] = c, p = `${t.purp || ""} ${t.op || ""}`.toLowerCase();
  const CASHOK = /банкомат|atm|cash\s*-?\s*in|кэш[-\s]?ин|(^|\s)pos|пос[-\s]?терминал|терминал|инкасс/;
  if (cat === "own" && (/взнос\S*\s+(\S+\s+)?наличн|наличными|внесени\S*\s+(\S+\s+)?наличн/.test(p) || t.knp === "331")) return CASHOK.test(p) ? null : "cash";
  if (cat === "loan") return FOUNDER.test(p) ? "founder" : "loan";
  if (cat === "aid") { if (/субсид/.test(why)) return "subs"; if (/финансов/.test(why)) return FOUNDER.test(p) ? "founder" : "aid"; return null; }
  if (cat === "cash") return CASHOK.test(p) ? null : "cash";
  if (cat === "grp") return /помощ|займ|заем|заём|кредит|возврат/.test(p) ? (FOUNDER.test(p) ? "founder" : "aid") : null;
  return OD_EX[cat] ? cat : null;
}
const dmy = s => { const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
function odOwn(o) {
  const bins = [...new Set((o.st || []).map(s => s.bin).filter(Boolean))];
  return { bins, names: [DocParse.clean(X.card.name || "")].filter(n => n.length > 3), grp: [] };
}
// сводка по выпискам за окно расчёта; суммы — тыс. тг
function odStatements(o, win) {
  const res = {}, ws = new Set(win), own = odOwn(o);
  for (const w of ["our", "other"]) {
    const sts = (o.st || []).filter(s => s.where === w);
    const months = Object.fromEntries(win.map(ym => [ym, { net: 0, gross: 0, n: 0, covered: false }]));
    const ex = Object.fromEntries(Object.keys(OD_EX).map(k => [k, { v: 0, n: 0 }]));
    const cps = new Map(), banks = new Set(), seen = new Set(), noRate = [];
    for (const s of sts) {
      if (s.bank) banks.add(DocParse.clean(s.bank));
      const from = dmy(s.from) || (s.txs[0] && s.txs[0].d) || "", to = dmy(s.to) || (s.txs.length && s.txs[s.txs.length - 1].d) || "";
      for (const ym of win) if (from && to && from.slice(0, 7) <= ym && to.slice(0, 7) >= ym) months[ym].covered = true;
      const k = s.cur && s.cur !== "KZT" ? (isNum(s.rate) && s.rate > 0 ? s.rate : null) : 1;
      if (k === null) { noRate.push(s); continue; }
      for (const t of s.txs) {
        const ym = (t.d || "").slice(0, 7); if (!ws.has(ym)) continue;
        const key = `${t.d}|${t.cr}|${t.doc || ""}|${t.cp}`; if (seen.has(key)) continue; seen.add(key);
        const v = (isNum(t.eq) && t.eq > 0 ? t.eq : t.cr * k) / 1000;
        months[ym].gross += v; months[ym].covered = true;
        const cat = odCat(t, own);
        if (cat) { ex[cat].v += v; ex[cat].n++; continue; }
        months[ym].net += v; months[ym].n++;
        if (/инкасс|банкомат|atm|cash\s*-?\s*in|(^|\s)pos|терминал|вознагражден\S*\s+(\S+\s+){0,2}(остат|депозит|вклад|сч[её]т)/.test(`${t.purp} ${t.op}`.toLowerCase())) continue;
        const ck = t.bin || DocParse.clean(t.cp) || "без названия";
        const x = cps.get(ck) || { name: t.cp || ck, v: 0 }; x.v += v; cps.set(ck, x);
      }
    }
    const net = sum(Object.values(months).map(m => m.net));
    let cut = 0; for (const [, x] of cps) if (net > 0 && x.v / net > 0.6) cut += 0.4 * x.v;
    res[w] = { has: sts.length > 0, months, ex, cps, net, cut, banks, noRate, gross: sum(Object.values(months).map(m => m.gross)) };
  }
  return res;
}

/* загрузка выписки: PDF (текст или скан) или Excel → только поступления, в тенге как в документе */
async function odImportStmt(file, where, onProg) {
  if (!/\.(pdf|xlsx|xlsm|xls)$/i.test(file.name)) return { err: "нужна выписка в PDF или Excel" };
  let r;
  try {
    const buf = await file.arrayBuffer();
    if (/\.pdf$/i.test(file.name)) { let pdf = await PdfReader.read(buf); if (pdf.noText) pdf = await OCR.pdf(buf, onProg); r = DocParse.readLines(pdf); r.ocr = pdf.ocr; }
    else r = DocParse.readSheets(await readWorkbook(buf));
  } catch (e) { return { err: "не удалось прочитать: " + e.message }; }
  if (r.kind === "bank") return { err: "это справка об оборотах — в ней нет отдельных операций, исключения посчитать нельзя. Нужна выписка по счёту" };
  if (r.kind !== "stmt" || !r.stmt || !r.stmt.txs.length) return { err: "не похоже на выписку по счёту: не найдена таблица операций (дата, сумма, назначение)" };
  const st = r.stmt, txs = st.txs.filter(t => t.cr > 0).map(t => ({ d: t.d, doc: t.doc || "", cp: t.cp || "", bin: t.bin || "", knp: t.knp || "", purp: (t.purp || "").slice(0, 300), op: (t.op || "").slice(0, 80), cr: t.cr, eq: isNum(t.eq) ? t.eq : null }))
    .sort((a, b) => a.d.localeCompare(b.d));
  if (!txs.length) return { err: "в выписке нет поступлений" };
  const o = odCfg();
  // та же выписка повторно — заменяем
  o.st = o.st.filter(x => !(x.acc && x.acc === st.acc && x.from === st.from && x.to === st.to));
  o.st.push({ id: uid(), file: file.name, bank: st.bank, acc: st.acc, cur: st.cur || "KZT", rate: null, where, from: st.from, to: st.to || "", bin: st.bin, txs });
  return { ok: true, txt: `${st.bank || "банк не определён"}${st.acc ? ", счёт " + st.acc : ""}${st.from ? `, ${st.from}–${st.to}` : ""}: поступлений ${txs.length}${st.cur && st.cur !== "KZT" ? `; валюта ${st.cur} — укажите курс` : ""}.${r.ocr ? " Распознано со скана — проверьте операции." : ""}` };
}
