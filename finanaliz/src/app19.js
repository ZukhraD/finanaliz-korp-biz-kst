"use strict";
/* ---------------------------------------------------------------- Продукты «Бизнес Успех» и «Start up», тип финансирования ВКЛ / НКЛ,
   ежемесячный платёж, учредители ТОО, СК Банка на карточке.
   ВКЛ (возобновляемая линия): в долговую нагрузку идут только проценты за год; НКЛ (невозобновляемая): весь платёж за год. */
const PRODS = ["Кредит", "Овердрафт", "Бизнес Успех", "Start up", "Кредит под залог денег"];
const PURPS = ["Пополнение оборотных средств", "Инвестиции", "Рефинансирование", "Смешанное"];
const FINTYPES = ["ВКЛ", "НКЛ"];
const isBU = () => !!(C && C.card && C.card.product === "Бизнес Успех");
const isSU = () => !!(C && C.card && C.card.product === "Start up");
const finType = () => { const ft = C && C.card && C.card.fintype; return ft === "ВКЛ" || ft === "НКЛ" ? ft : (/оборотн/i.test((C && C.card && C.card.purpose) || "") ? "ВКЛ" : "НКЛ"); };
const withCur = (list, cur) => (cur && !list.includes(cur) ? [...list, cur] : list);
// характер цели: ПОС / инвестиционная (для рефинансирования и смешанной цели выбирается вручную, по умолчанию — ПОС: более строгий срок)
const purposeMixed = () => !/оборотн|инвест/i.test((C.card.purpose) || "");
const purposeCls = () => { const p = C.card.purpose || ""; return /оборотн/i.test(p) ? "ПОС" : /инвест/i.test(p) ? "Инв" : (C.card.pbase === "Инв" ? "Инв" : "ПОС"); };
const prodLim = () => { const pos = purposeCls() === "ПОС"; return isBU() ? { term: pos ? 37 : 60, avail: pos ? 6 : 12 } : isSU() ? { term: pos ? 36 : 60, avail: 12 } : null; };

/* ---------- ежемесячный платёж и годовая нагрузка */
function reqPay() {
  const f = fcParams(), R = f.req, ft = finType(), od = isOD();
  const amt = N(R.amt) > 0 ? N(R.amt) : N(C.card.amount), rate = N(R.rate);
  const term = od ? Math.max(1, N(odCfg().line)) : Math.max(1, N(R.term)), grace = od ? 0 : N(R.grace);
  if (!(amt > 0) || !(rate >= 0)) return null;
  if (ft === "ВКЛ") { const m = amt * rate / 12; return { ft, amt, first: m, year: m * 12, grace, term, diff: false }; }
  const H = Math.min(60, Math.max(14, grace + 14)), [I, P] = amort(amt, rate, term, grace, SCH[R.scheme] || 1, null, null, H);
  const t0 = Math.min(H, grace + 1); let year = 0;
  for (let t = 1; t <= 12; t++) year += I[t] + P[t];
  return { ft, amt, first: I[t0] + P[t0], year, grace, term, diff: (SCH[R.scheme] || 1) === 1 };
}
// проценты по ВКЛ: на всю сумму весь срок (основной долг возобновляется)
function wcInterest(R, rate, H) {
  const out = new Array(H + 1).fill(0), dm = Math.max(1, N(R.month)), term = Math.max(1, N(R.term));
  for (let t = dm + 1; t <= Math.min(H, dm + term); t++) out[t] = N(R.amt) * rate / 12;
  return out;
}
function reqFactsHTML() {
  const p = reqPay();
  if (!p) return `<p class="hint">Укажите сумму, срок и ставку — рассчитаю ежемесячный платёж.</p>`;
  return `<div class="facts sm"><div><span>Ежемесячный платёж, тыс. тг</span><b>${fmt(p.first)}</b></div><div><span>${p.ft === "ВКЛ" ? "Проценты за год (долговая нагрузка)" : "Платёж за год (долговая нагрузка)"}, тыс. тг</span><b>${fmt(p.year)}</b></div></div>
  <p class="hint" style="margin-top:6px">${p.ft === "ВКЛ" ? "ВКЛ: в долговой нагрузке учитываются только проценты за год — основной долг возобновляется." : "НКЛ: в долговой нагрузке учитывается весь платёж за год — основной долг и проценты."}${p.ft === "НКЛ" && p.grace > 0 ? ` Льготный период по основному долгу — ${fmt(p.grace, "d")} мес.: платёж показан после его окончания.` : ""}${p.ft === "НКЛ" && p.diff ? " При дифференцированной схеме показан первый платёж, далее он уменьшается." : ""}</p>`;
}
function reqSentence() {
  const p = reqPay(), f = fcParams().req;
  return `Тип финансирования — ${finType()}${isOD() ? "" : `, срок ${fmt(f.term, "d")} мес., ставка ${isNum(f.rate) ? fmt(f.rate * 100, "m1") : "—"} %`}${p ? `; ежемесячный платёж ${fmt(p.first)} тыс. тг, ${finType() === "ВКЛ" ? "проценты" : "платёж"} за год (долговая нагрузка) — ${fmt(p.year)} тыс. тг` : ""}.`;
}

/* ---------- панели карточки */
function reqPanel() {
  const f = fcParams(), c = C.card, od = isOD();
  return `<section class="panel"><h2>Условия финансирования</h2><p class="hint">ВКЛ — возобновляемая кредитная линия: в долговой нагрузке только проценты за год. НКЛ — невозобновляемая: весь платёж за год. Данные те же, что в прогнозе («Запрашиваемый кредит»).</p>
  <div class="grid2"><label class="f"><span>Тип финансирования</span><select class="inp" data-card="fintype">${opts(FINTYPES, finType())}</select></label>
    ${purposeMixed() ? `<label class="f"><span>Характер цели (для лимитов срока)</span><select class="inp" data-card="pbase">${[["ПОС", "Пополнение оборотных средств"], ["Инв", "Инвестиционная"]].map(([v, t]) => `<option value="${v}"${purposeCls() === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>` : ""}
    ${od ? "" : `<label class="f"><span>Срок, мес.</span>${fcIn("req.term", f.req.term)}</label><label class="f"><span>Льготный период по ОД, мес.</span>${fcIn("req.grace", f.req.grace)}</label>`}
    <label class="f"><span>Ставка, %</span>${fcIn("req.rate", f.req.rate, true)}</label>
    ${od ? "" : `<label class="f"><span>Схема погашения</span><select class="inp" data-fc="req.scheme">${opts(Object.keys(SCH), f.req.scheme)}</select></label>`}</div>
  <div id="reqFacts">${reqFactsHTML()}</div></section>`;
}
function prodPanel() {
  if (!isBU() && !isSU()) return "";
  const c = C.card, lim = prodLim(), eq = odBankEq(), amt = N(c.amount);
  const num = (key, lab) => `<label class="f"><span>${lab}</span><input class="inp" data-card="${key}" data-num value="${esc(fmt(c[key]))}"></label>`;
  const sel = (key, lab, list) => `<label class="f"><span>${lab}</span><select class="inp" data-card="${key}">${list.map(v => `<option value="${esc(v)}"${String(c[key] || list[0]) === String(v) ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
  const thr = isNum(eq) && eq > 0 ? eq * 1000 * 0.0002 : null;
  return `<section class="panel"><h2>Условия продукта «${esc(c.product)}»</h2>
  <p class="hint">Продукт работает по принципу овердрафта (кредитная линия). Лимиты: срок финансирования до ${lim.term} мес., период доступности до ${lim.avail} мес., сумма${isBU() ? " до 75 млн тг и до 70 % оценочной стоимости недвижимости (LTV)" : " — по решению; при сумме свыше 100 млн тг нужна гарантия платёжеспособного юрлица"}.</p>
  <div class="facts sm"><div><span>Максимально возможный срок, мес.</span><b>${lim.term}</b><span>считается автоматически</span></div><div><span>Макс. период доступности, мес.</span><b>${lim.avail}</b><span>${isBU() ? "указывается для НКЛ" : ""}</span></div></div>
  <div class="grid2" style="margin-top:10px">${isSU() || finType() === "НКЛ" ? num("avail", "Период доступности, мес.") : ""}${isBU() ? num("tranche", "Максимальный срок транша, мес.") : ""}${sel("zone", "Зона проблемности", ["Нет", "Жёлтая", "Красная", "Чёрная"])}
  ${isSU() && purposeCls() === "Инв" ? num("projCost", "Стоимость инвестиционного проекта, тыс. тг") : ""}</div>
  <p class="hint" style="margin-top:8px">${thr === null ? "Укажите «СК Банка» в блоке «Клиент и запрос»: для проектов до 0,02 % от СК Банка заключения ЗС и ЮУ не требуются, оценка залога — силами КП." : amt <= thr ? `Сумма ${fmt(amt)} тыс. тг ≤ 0,02 % СК Банка (${fmt(thr)} тыс. тг): заключения ЗС и ЮУ не требуются, рыночную стоимость залога проверяет КП по ВНД Банка.` : `Сумма ${fmt(amt)} тыс. тг > 0,02 % СК Банка (${fmt(thr)} тыс. тг): заключения ЗС и ЮУ обязательны.`}</p>
  <details style="margin-top:6px"><summary class="small">Основные условия продукта</summary><div class="small" style="margin-top:6px">${prodTermsHTML()}</div></details></section>`;
}
function prodTermsHTML() {
  return isBU() ? `<ul><li>Сумма: не более 75 млн тг и не более 70 % оценочной стоимости недвижимости в залоге. При LTV свыше 0,5 до 0,7 — также не более 100 % валюты баланса и 100 % годовой выручки. LTV округляется до десятых.</li>
  <li>Цель: ПОС, инвестиции, рефинансирование. Срок: ПОС — до 37 мес., инвестиции — до 60 мес.; период доступности: ПОС — до 6 мес., инвестиции — до 12 мес.</li>
  <li>Залог: жилая недвижимость или коммерческие помещения вне жилого фонда в черте городов присутствия. Не принимаются земельные участки, объекты без коммуникаций и отделки, подвалы.</li>
  <li>Гарантии учредителей, руководителей, бенефициаров (ЮЛ); супруга/супруги (ИП).</li>
  <li>Погашение: ежемесячно, аннуитет или равные доли, без отсрочки и льготного периода; вознаграждение ежемесячно.</li>
  <li>Заёмщик: опыт от 6 мес. (LTV до 0,5) или от 12 мес. (LTV свыше 0,5 до 0,7); положительная кредитная история и благонадёжность; не красная и не чёрная зона; положительные капитал и чистая прибыль; нет триггеров обесценения.</li>
  <li>Проект: отчёт НОК — партнёра Банка; выдача после регистрации залога; выезд на место ведения бизнеса и осмотр залога; запрет на цели оплаты аффилированным лицам.</li></ul>`
    : `<ul><li>Цель: ПОС (срок до 36 мес.) или инвестиции (до 60 мес.); тип — ВКЛ или НКЛ; период доступности — до 12 мес.; отсрочка по основному долгу — до 12 мес.; в последние 6 мес. не более 15 % суммы основного долга.</li>
  <li>Залог: покрытие не менее 100 %: гарантия АО «ФРП «Даму» — 60–85 % (срок не меньше срока финансирования), остальное — деньги и/или недвижимость (не земля, не объекты без коммуникаций и отделки, не подвалы).</li>
  <li>Гарантии: ИП — супруг(а), залогодатель; ЮЛ — учредители, участники, акционеры, бенефициары. При сумме свыше 100 млн тг — ещё гарантия платёжеспособного юрлица (Debt/EBITDA ≤ 3, DSCR ≥ 1,3, опыт от 12 мес.).</li>
  <li>Собственное участие — не менее 20 % стоимости инвестпроекта (деньги в залоге — не менее 15 %).</li>
  <li>Заёмщик: положительная кредитная история (её отсутствие — не стоп-фактор), благонадёжность, не красная и не чёрная зона, приоритетные отрасли госпрограммы.</li>
  <li>Бизнес-план: инвестфаза до 12 мес., ввод в эксплуатацию до 3 мес. после неё, окупаемость = срок финансирования − 6 мес., чистая прибыль / взнос по кредиту не более 1,2.</li>
  <li>Не финансируются: строительство и покупка недвижимости для сдачи в аренду; такси при сроке более 3 лет.</li></ul>`;
}

/* ---------- проверки продуктов */
function prodChecks() {
  const out = [], c = C.card, bu = isBU(), su = isSU(); if (!bu && !su) return { out };
  const add = (id, title, fact, st, fix) => out.push({ grp: "p", id, title, fact, st, fix });
  const amt = N(c.amount), R = fcParams().req, lim = prodLim(), cls = purposeCls(), k = 1;
  const F = odFinVals(), c2 = F.p2, c1 = F.p1 !== F.p2 ? F.p1 : null, fv = (col, key) => F.v(col, key);
  const sumT = tp => C.coll.filter(x => x.type === tp).reduce((a, x) => a + N(x.market), 0);
  ensureCredit();
  const hasAmt = isNum(c.amount) && amt > 0;
  add("term", `Срок финансирования не более ${lim.term} мес. (${cls === "ПОС" ? "ПОС" : "инвестиционные цели"}${purposeMixed() ? ", по выбранному характеру цели" : ""})`, `${fmt(R.term, "d")} мес.`, N(R.term) > 0 && N(R.term) <= lim.term ? "ok" : "crit", `Уменьшите срок до ${lim.term} мес.`);
  if (!bu || finType() === "НКЛ") add("avail", `Период доступности не более ${lim.avail} мес.`, isNum(c.avail) ? `${fmt(c.avail, "d")} мес.` : "не указан", !isNum(c.avail) ? "nd" : N(c.avail) <= lim.avail ? "ok" : "crit", "Укажите период доступности в блоке «Условия продукта».");
  if (bu) {
    const Q = buCalc();
    add("grace", "Погашение основного долга ежемесячно, без отсрочки и льготного периода", `льготный период ${fmt(R.grace, "d")} мес.`, N(R.grace) > 0 ? "crit" : "ok", "Уберите льготный период по основному долгу.");
    add("tranche", "Максимальный срок транша — до конца срока финансирования", isNum(c.tranche) ? `${fmt(c.tranche, "d")} мес. при сроке ${fmt(R.term, "d")} мес.` : "не указан", !isNum(c.tranche) ? "nd" : N(c.tranche) <= N(R.term) ? "ok" : "crit", "Срок транша не может быть больше срока финансирования.");
    add("max", "Сумма финансирования не более 75 млн тг", hasAmt ? `${fmt(amt)} тыс. тг` : "сумма не указана", !hasAmt ? "nd" : amt <= 75000 ? "ok" : "crit", "Уменьшите сумму до 75 000 тыс. тг.");
    const objs = Q.objs;
    add("re", "Залог — недвижимость: жилые помещения или коммерческие помещения вне жилого фонда (не земля, не подвал, не объект без коммуникаций и отделки)", objs.length ? `объектов: ${objs.length}; ${objs.every(x => x.kind) ? "вид указан у всех" : "у части объектов не указан вид"}` : "объекты недвижимости не внесены", !hasAmt ? "nd" : !objs.length ? "crit" : objs.every(x => x.kind) ? "chk" : "nd", "Внесите объекты на странице «Залог и гаранты» и подтвердите отсутствие земли, подвалов и объектов без коммуникаций.");
    add("nok", "Отчёт НОК — от партнёра Банка (аккредитация в Банке)", !objs.length ? "нет объектов" : objs.some(x => x.nokAccr === "Нет") ? "есть НОК без аккредитации" : objs.every(x => x.nokAccr === "Да") ? "аккредитованы все" : "аккредитация не указана", !objs.length ? "nd" : objs.some(x => x.nokAccr === "Нет") ? "crit" : objs.every(x => x.nokAccr === "Да") ? "ok" : "nd", "Укажите аккредитацию НОК по каждому объекту; отчёт НОК не из списка партнёров — финансирование невозможно.");
    if (Q.thr !== null) add("urzi", "Свыше 0,02 % СК Банка — рыночная стоимость по заключению УРЗИ", Q.over ? (Q.urzi > 0 ? `УРЗИ ${fmt(Q.urzi)} тыс. тг` : "заключение не внесено") : `сумма не выше порога ${fmt(Q.thr)} тыс. тг — оценка по отчёту НОК`, !Q.over ? "ok" : Q.urzi > 0 ? "ok" : "nd", "Внесите рыночную стоимость по заключению УРЗИ.");
    add("ltv", "LTV не выше 0,7 (округление до десятых; совокупно с действующими лимитами под этот залог)", Q.ltv === null ? "нет данных (нужны сумма и стоимость залога)" : `LTV ${pctFmt(Q.ltv)} (округлённо ${nf1.format(Q.lr)})${Q.lim ? `; действующие лимиты ${fmt(Q.lim)} тыс. тг` : ""}`, Q.ltv === null ? "nd" : Q.lr <= 0.7 ? "ok" : "crit", "Уменьшите сумму или увеличьте стоимость залога.");
    if (Q.lr !== null && Q.lr > 0.5) {
      add("ta", "При LTV свыше 0,5: сумма займа не более 100 % валюты баланса", isNum(Q.ta) ? `валюта баланса ${fmt(Q.ta)}` : "нет данных", !isNum(Q.ta) ? "nd" : amt <= Q.ta ? "ok" : "crit", "Сумма превышает валюту баланса на последнюю дату.");
      add("rev", "При LTV свыше 0,5: сумма займа не более 100 % годовой выручки", isNum(Q.ann) ? `годовая выручка ${fmt(Q.ann)}` : "нет данных", !isNum(Q.ann) ? "nd" : amt <= Q.ann ? "ok" : "crit", "Сумма превышает годовую выручку.");
    }
    add("final", "Запрошенная сумма не больше итоговой суммы займа по расчёту", Q.final === null ? "нет данных" : `итоговая сумма ${fmt(Q.max)} тыс. тг, запрос ${fmt(amt)}`, Q.final === null ? "nd" : amt <= Q.max + 0.5 ? "ok" : "crit", "Уменьшите запрос до итоговой суммы или усильте обеспечение.");
    if (isNum(c.totLimit)) add("agg", "Совокупный лимит на заёмщика / ГСЗ не меньше запрошенной суммы", `${fmt(c.totLimit)} тыс. тг`, c.totLimit >= amt ? "ok" : "crit", "Лимит на заёмщика/ГСЗ должен включать запрошенный лимит.");
    const need = Q.lr !== null && Q.lr > 0.5 ? 12 : 6, exp = odExperience(k);
    add("exp", `Срок ведения деятельности не менее ${need} мес.`, exp === null ? "дата регистрации неизвестна — «Подтянуть по БИН» или страница «Благонадёжность»" : `${exp} мес.`, exp === null ? "nd" : exp >= need ? "ok" : "crit", "Укажите дату регистрации.");
    const eqq = c2 ? fv(c2, "eq") : null;
    add("eq", "Собственный капитал на последнюю отчётную дату положительный", isNum(eqq) ? fmt(eqq) : "нет данных", !isNum(eqq) ? "nd" : eqq > 0 ? "ok" : "crit", "Капитал должен быть положительным.");
    { const ni = c2 ? fv(c2, "ni") : null, rv = c2 ? fv(c2, "rev") : null, r = isNum(ni) && isNum(rv) && rv ? ni / rv : null;
      add("ni", "Рентабельность по чистой прибыли за последний анализируемый период положительная", r === null ? "нет данных" : pctFmt(r), r === null ? "nd" : r > 0 ? "ok" : "crit", "Нужна положительная чистая прибыль."); }
    if (c1) { const ni1 = fv(c1, "ni"); add("ni1", `Чистая прибыль за предыдущий год (${c1.label}) положительная`, isNum(ni1) ? fmt(ni1) : "нет данных", !isNum(ni1) ? "nd" : ni1 > 0 ? "ok" : "crit", "Нужна положительная чистая прибыль за последний отчётный год."); }
  } else {
    add("grace", "Отсрочка по основному долгу не более 12 мес.", `${fmt(R.grace, "d")} мес.`, N(R.grace) <= 12 ? "ok" : "crit", "Уменьшите льготный период до 12 мес.");
    const cc = collCover(), damu = sumT("Гарантия АО «ФРП «Даму»"), dsh = hasAmt ? damu / amt : null;
    add("cover", "Покрытие обязательств залогом не менее 100 %", cc && cc.cover !== null ? `покрытие ${pctFmt(cc.cover)}` : "залог не указан", !cc || cc.cover === null ? "nd" : cc.cover >= 1 ? "ok" : "crit", "Добавьте обеспечение (гарантия Даму, деньги, недвижимость).");
    add("damu", "Гарантия АО «ФРП «Даму» — от 60 % до 85 % суммы", dsh === null ? "нет данных" : damu > 0 ? `гарантия ${pctFmt(dsh)}` : "гарантия не указана", dsh === null ? "nd" : dsh >= 0.6 - 1e-9 && dsh <= 0.85 + 1e-9 ? "ok" : "crit", "Гарантия Даму должна покрывать 60–85 % обязательств; срок гарантии — не меньше срока финансирования.");
    if (cls === "Инв") {
      const pc = N(c.projCost), own = pc > 0 && hasAmt ? (pc - amt) / pc : null;
      add("own", "Собственное участие не менее 20 % стоимости инвестиционного проекта", own === null ? "укажите стоимость проекта" : `${pctFmt(own)} (${fmt(pc - amt)} тыс. тг)`, own === null ? "nd" : own >= 0.2 - 1e-9 ? "ok" : "crit", "Увеличьте собственное участие или уменьшите сумму.");
      add("plan", "Бизнес-план: инвестфаза до 12 мес., ввод до 3 мес., окупаемость = срок − 6 мес., чистая прибыль / взнос ≤ 1,2", "проверьте по бизнес-плану и разрешительным документам", "chk", "Подтвердите по бизнес-плану, проектно-сметной документации и разрешениям.");
    }
    if (amt > 100000) add("guar100", "При сумме свыше 100 млн тг — гарантия платёжеспособного юрлица (Debt/EBITDA ≤ 3, DSCR ≥ 1,3, опыт от 12 мес.)", sumT("Гарантия юридического лица") > 0 ? "гарантия юрлица указана — проверьте её показатели" : "гарантия юрлица не указана", sumT("Гарантия юридического лица") > 0 ? "chk" : "crit", "Добавьте гарантию юридического лица.");
  }
  // общие требования к заёмщику
  const eq2 = c2 ? fv(c2, "eq") : null;
  const cs = crSummary(k);
  add("credit", su ? "Положительная кредитная история (её отсутствие — не стоп-фактор)" : "Отсутствие отрицательной кредитной истории", !cs.any ? "кредитный отчёт не загружен" : cs.od > 0 ? `текущая просрочка ${cs.od} дн.` : cs.maxOd > 30 ? `в истории просрочка до ${cs.maxOd} дн.` : "просрочек нет", !cs.any ? "nd" : cs.od > 0 ? "crit" : cs.maxOd > 30 ? "chk" : "ok", "Загрузите отчёт ПКБ/ГКБ на странице «Кредитная история».");
  ensureTrust(); const ts = trustSummary(k);
  add("trust", "Отсутствие отрицательной благонадёжности", `стоп-факторы: ${ts.crit}, риски: ${ts.risk}, не проверено: ${ts.na}`, ts.crit + ts.risk > 0 ? "crit" : ts.na === TRUST.length ? "nd" : ts.na > 0 ? "chk" : "ok", "«Подтянуть по БИН» и заполните страницу «Благонадёжность».");
  add("zone", "Не относится к «красной» и «чёрной» зонам проблемности", `зона: ${c.zone || "Нет"}`, /Красн|Чёрн|Черн/.test(c.zone || "") ? "crit" : "ok", "Финансирование заёмщиков красной и чёрной зон не допускается.");
  // гарантии
  const b = C.companies[0] || {}, legal = b.form && b.form !== "ИП";
  if (legal) { const fs = (b.founders || []).filter(x => (x.name || "").trim()), noG = fs.filter(x => x.guar !== "Да");
    add("gfound", "Гарантии учредителей, участников, бенефициаров и руководителей на всю сумму обязательств", b.form === "ТОО" ? (fs.length ? (noG.length ? `без гарантии: ${noG.map(x => x.name).join(", ")}` : `гарантии у всех (${fs.length})`) : "учредители не внесены") : "проверьте состав участников", b.form === "ТОО" ? (!fs.length ? "nd" : noG.length ? "crit" : "ok") : "chk", "Внесите учредителей на карточке и отметьте гарантии.");
  } else add("gspouse", "Гарантия супруга/супруги (при наличии)" + (su ? " и залогодателя-третьего лица" : ""), "проверьте по анкете", "chk", "Получите гарантию супруга/супруги на всю сумму обязательств.");
  const PM = { re: "coll", nok: "coll", urzi: "coll", ltv: "coll", ta: "coll", rev: "coll", final: "coll", agg: "coll", gfound: "coll", gspouse: "coll", cover: "coll", damu: "coll", guar100: "coll", eq: "fin", ni: "fin", ni1: "fin", credit: "credit", trust: "trust" };
  out.forEach(x => { x.page = PM[x.id] || "card"; });
  return { out };
}
function prodProblems(add) {
  for (const x of prodChecks().out) if (x.st !== "ok") add(x.st === "nd" ? "nd" : x.st === "crit" ? "crit" : "chk", x.page || "card", `${C.card.product}: ${x.title}`, x.fact, x.fix);
}

/* ---------- блок для заключения */
function reqTermsHTML(forWord) {
  let h = `<p><b>Условия:</b> ${esc(reqSentence())}</p>`;
  if (isBU() || isSU()) {
    const ch = prodChecks().out, mk = s => ({ ok: "✓", chk: "⚠", crit: "✗", nd: "—" }[s]);
    h += `<p><b>Требования продукта «${esc(C.card.product)}»:</b></p><ul>${ch.map(x => `<li>${mk(x.st)} ${esc(x.title)} — ${esc(x.fact)}</li>`).join("")}</ul>`;
  }
  return h;
}

/* ---------- учредители ТОО */
const FND_ROLES = ["Учредитель", "Руководитель", "Учредитель и руководитель", "Бенефициарный собственник"];
function fndList(x) { if (!Array.isArray(x.founders) || !x.founders.length) x.founders = [{ name: "", iin: "", share: null, role: FND_ROLES[0], guar: "Да" }]; return x.founders; }
function foundersPanel() {
  const toos = C.companies.map((x, i) => [x, i]).filter(([x]) => x.form === "ТОО");
  if (!toos.length) return "";
  return `<section class="panel"><h2>Учредители компаний-ТОО</h2><p class="hint">Для каждого ТОО внесите всех учредителей, участников и бенефициаров: от одного до десятков человек. Отметьте, кто даёт гарантию. Сумма долей должна быть 100 %.</p>` + toos.map(([x, i]) => {
    const fs = fndList(x), sum = fs.reduce((a, f) => a + N(f.share), 0), filled = fs.some(f => isNum(f.share));
    return `<h3 style="margin:12px 0 6px">${esc(compName(i + 1) || "Компания " + (i + 1))}</h3><div class="tablewrap" style="max-height:none"><table class="data form"><thead><tr><th class="lab">№</th><th style="text-align:left">ФИО</th><th style="text-align:left">ИИН</th><th style="text-align:left">Доля, %</th><th style="text-align:left">Роль</th><th style="text-align:left">Гарантия</th><th></th></tr></thead><tbody>
    ${fs.map((f, j) => `<tr><td class="lab">${j + 1}</td>
      <td><input class="inp" data-fnd="${i}|${j}" data-f="name" value="${esc(f.name || "")}" placeholder="ФИО"></td>
      <td><input class="inp" data-fnd="${i}|${j}" data-f="iin" value="${esc(f.iin || "")}" placeholder="12 цифр" inputmode="numeric" style="max-width:150px"></td>
      <td><input class="inp" data-fnd="${i}|${j}" data-f="share" data-num value="${esc(isNum(f.share) ? fmt(f.share, "m1") : "")}" style="max-width:90px" inputmode="decimal"></td>
      <td><select class="inp" data-fnd="${i}|${j}" data-f="role">${opts(withCur(FND_ROLES, f.role), f.role)}</select></td>
      <td><select class="inp" data-fnd="${i}|${j}" data-f="guar">${opts(["Да", "Нет"], f.guar)}</select></td>
      <td>${fs.length > 1 ? `<button class="btn ghost danger" data-delfnd="${i}|${j}" aria-label="Удалить учредителя">Удалить</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div><p style="margin-top:8px"><button class="btn" data-act="addfounder" data-i="${i}">Добавить учредителя</button> <span class="small ${filled && Math.abs(sum - 100) > 0.05 ? "neg" : "muted"}">Сумма долей: ${fmt(sum, "m1")} %</span></p>`;
  }).join("") + `</section>`;
}
function foundersProblems(add) {
  C.companies.forEach((x, i) => {
    if (x.form !== "ТОО" || !Array.isArray(x.founders)) return;
    const fs = x.founders.filter(f => (f.name || "").trim() || isNum(f.share)); if (!fs.length) return;
    const sum = fs.reduce((a, f) => a + N(f.share), 0), nm = compName(i + 1);
    if (Math.abs(sum - 100) > 0.05) add("chk", "card", `${nm}: сумма долей учредителей ${fmt(sum, "m1")} %, а не 100 %`, fs.map(f => `${f.name || "—"} ${isNum(f.share) ? fmt(f.share, "m1") + " %" : "—"}`).join("; "), "Проверьте доли учредителей по справке о зарегистрированных юридических лицах.");
    const bad = fs.filter(f => f.iin && !/^\d{12}$/.test(String(f.iin).replace(/\s/g, "")));
    if (bad.length) add("chk", "card", `${nm}: ИИН учредителя должен содержать 12 цифр`, bad.map(f => f.name || f.iin).join("; "), "Исправьте ИИН.");
  });
}

/* ---------- события */
document.addEventListener("change", e => {
  const t = e.target, d = t.dataset; if (!C) return;
  if (d.fnd !== undefined) {
    const [i, j] = d.fnd.split("|").map(Number), f = C.companies[i] && fndList(C.companies[i])[j]; if (!f) return;
    if (d.f === "share") { const v = parseNum(t.value); f.share = v; render(); }
    else if (d.f === "iin") f.iin = t.value.replace(/\s/g, "");
    else f[d.f] = t.value;
    touch(); if (d.f !== "share") refreshCalc(); return;
  }
  if (d.card === "fintype" || d.card === "pbase" || d.card === "purpose") { render(); return; }
  if (d.card === "product" && t.value === "Овердрафт" && C.card.fintype !== "ВКЛ") { C.card.fintype = "ВКЛ"; touch(); render(); return; }
  if (["avail", "zone", "nok", "projCost"].includes(d.card)) { refreshCalc(); return; }
  if (d.card === "amount") { fcParams().req.amt = isNum(parseNum(t.value)) ? parseNum(t.value) : 0; touch(); refreshCalc(); }
});
document.addEventListener("click", e => {
  if (!C) return;
  const a = e.target.closest("[data-act='addfounder']");
  if (a) { const x = C.companies[+a.dataset.i]; if (x) { fndList(x).push({ name: "", iin: "", share: null, role: FND_ROLES[0], guar: "Да" }); touch(); render(); } return; }
  const dl = e.target.closest("[data-delfnd]");
  if (dl) { const [i, j] = dl.dataset.delfnd.split("|").map(Number), x = C.companies[i]; if (x && fndList(x).length > 1) { x.founders.splice(j, 1); touch(); render(); } }
});

/* ================================================================ «Бизнес Успех» по чек-листу: свои разделы, залог, расчёт LTV, заключение */
const isLite = () => isOD() || isBU();
const BU_KINDS = ["жилые помещения (квартиры, жилые дома)", "коммерческая недвижимость"];
const BU_STEPS = [["card", "Карточка клиента"], ["trust", "Благонадёжность"], ["fin", "Баланс + ОПиУ"], ["coll", "Залог и гаранты"], ["bank", "Банк"], ["credit", "Кредитная история"], ["an", "Анализ"], ["prob", "Проблемы"], ["concl", "Заключение"]];
const BU_PAGES = new Set(["card", "trust", "fin", "coll", "bank", "credit", "an", "prob", "concl", "map", "norms", "log", "bal", "odr", "ai"]);
const OD_ROWS_BU = [["ca", "Краткосрочные активы", "in"], ["lta", "Долгосрочные активы", "in"], ["ta", "Баланс (итого активы)", "calc"], ["cl", "Краткосрочные обязательства", "in"], ["ltl", "Долгосрочные обязательства", "in"], ["eq", "Собственный капитал", "calc"], ["rev", "Выручка", "in"], ["gp", "Валовая прибыль", "in"], ["ni", "Чистая прибыль", "in"], ["npm", "Рентабельность по чистой прибыли положительная", "calc"], ["eqpos", "Собственный капитал положительный", "calc"]];
const odRows = () => (isBU() ? OD_ROWS_BU : OD_ROWS);
function buFilter(list) { return list.filter(p => BU_PAGES.has(p.page) && !/^Прогноз|DSCR/.test(p.title)).map(p => (p.page === "bal" || p.page === "odr" ? { ...p, page: "fin" } : p)); }
const sumK = (arr, f) => arr.reduce((a, x) => a + N(x[f]), 0);
function buObjs() { return (C.coll || []).filter(x => x.type === "Недвижимость"); }
// итоговый расчёт по чек-листу: LTV, ограничения по балансу и выручке, итоговая сумма займа
function buCalc() {
  const c = C.card, amt = N(c.amount), lim = N(c.limits), objs = buObjs(), nok = sumK(objs, "nokv"), urzi = sumK(objs, "market");
  const eq = odBankEq(), thr = isNum(eq) && eq > 0 ? eq * 1000 * 0.0002 : null;   // 0,02 % СК Банка, тыс. тг
  const over = thr !== null ? amt > thr : urzi > 0;
  const base = over ? urzi : nok;
  const F = odFinVals(), c2 = F.p2, ta = c2 ? F.v(c2, "ta") : null, rv = c2 ? F.v(c2, "rev") : null, ann = isNum(rv) && c2 ? rv * 12 / (N(c2.months) || 12) : null;
  const ltv = base > 0 && amt > 0 ? (amt + lim) / base : null, lr = ltv === null ? null : Math.round(ltv * 10) / 10;
  let max = null, final = null;
  if (base > 0) {
    const cap50 = 0.5 * base - lim, cap70 = Math.min(0.7 * base - lim, isNum(ta) ? ta : Infinity, isNum(ann) ? ann : Infinity);
    max = Math.max(0, Math.min(75000, Math.max(cap50, cap70)));
    final = amt > 0 ? Math.min(amt, max) : max;
  }
  return { amt, lim, objs, nok, urzi, thr, over, base, ta, ann, ltv, lr, max, final };
}

/* ---------- страница «Залог и гаранты» */
function pageCollBU() {
  ensureCredit();
  const Q = buCalc(), c = C.card, ok = v => (v ? "✓" : "✗");
  const f = (i, key, lab, v, type = "text", extra = "") => `<label class="f"><span>${lab}</span><input class="inp" data-bco="${i}" data-f="${key}" type="${type}" value="${esc(v ?? "")}" ${extra}></label>`;
  const sel = (i, key, lab, list, cur) => `<label class="f"><span>${lab}</span><select class="inp" data-bco="${i}" data-f="${key}">${cur ? "" : '<option value="" selected disabled hidden>Выберите</option>'}${opts(list, cur)}</select></label>`;
  const idx = x => C.coll.indexOf(x);
  const objs = Q.objs.map((x, n) => { const i = idx(x), com = x.kind === BU_KINDS[1], third = x.pl === "Третье лицо";
    return `<section class="panel"><h2>Объект ${n + 1}</h2><div class="grid2">
      ${sel(i, "kind", "Тип недвижимого имущества", BU_KINDS, x.kind)}
      ${f(i, "desc", "Описание обеспечения (наименование, литер, площадь, площадь ЗУ, кадастровый номер, адрес)", x.desc)}
      ${com ? f(i, "purp", "Целевое назначение (для коммерческой недвижимости)", x.purp) : ""}
      ${f(i, "nokv", "Стоимость обеспечения согласно отчёту НОК, тыс. тг", fmt(x.nokv), "text", 'inputmode="numeric"')}
      ${f(i, "market", "Рыночная стоимость по заключению УРЗИ (свыше 0,02 % от СК Банка), тыс. тг", fmt(x.market), "text", 'inputmode="numeric"')}
      ${sel(i, "pl", "Залогодатель", ["Заёмщик", "Третье лицо"], x.pl || "Заёмщик")}
      ${third ? f(i, "plName", "Наименование залогодателя", x.plName) + f(i, "plBin", "БИН/ИИН залогодателя", x.plBin, "text", 'inputmode="numeric"') : ""}
      ${f(i, "nokName", "Наименование НОК", x.nokName)}${sel(i, "nokAccr", "Аккредитация НОК в Банке", ["Да", "Нет"], x.nokAccr)}
      ${f(i, "licNo", "№ лицензии", x.licNo)}${f(i, "licOrg", "Орган выдачи лицензии", x.licOrg)}${f(i, "licDate", "Дата выдачи лицензии", x.licDate, "date")}
    </div><p style="margin-top:8px"><button class="btn ghost danger" data-bcodel="${i}">Удалить объект</button></p></section>`; }).join("");
  const guars = (C.guar || []).map((x, i) => `<tr><td class="lab">${i + 1}</td><td class="cell"><input class="inp" data-guar="${i}" data-f="name" value="${esc(x.name || "")}" style="text-align:left"></td><td class="cell"><input class="inp" data-guar="${i}" data-f="iin" value="${esc(x.iin || "")}" inputmode="numeric"></td><td class="cell"><select class="inp" data-guar="${i}" data-f="kind">${opts(withCur(["Учредитель (физ. лицо)", "Руководитель", "Бенефициарный собственник", "Супруг/супруга", "Юридическое лицо", "Иное"], x.kind), x.kind)}</select></td><td><button class="btn ghost danger" data-delguar="${i}">Удалить</button></td></tr>`).join("");
  const cond = (t, v) => `<tr><td style="text-align:left">${t}</td><td>${v === null ? "—" : ok(v)}</td></tr>`;
  return `<div class="pagehead"><div class="lead"><h1>Залог и гаранты</h1><p>Обеспечение по продукту «Бизнес Успех»: недвижимость, гарантии и итоговый расчёт суммы займа (тыс. тг).</p></div>
    <div class="toolbar"><button class="btn primary" data-act="bucolladd">Добавить объект недвижимости</button></div></div>
  <div id="probBanner" data-page="coll">${bannerHTML("coll")}</div>
  <section class="panel"><h2>Обеспечение</h2><div class="facts sm"><div><span>Вид обеспечения</span><b>Недвижимость</b></div><div><span>Количество объектов</span><b>${Q.objs.length}</b></div><div><span>Сумма по отчёту НОК</span><b>${fmt(Q.nok)}</b></div><div><span>Сумма по заключению УРЗИ</span><b>${fmt(Q.urzi)}</b></div></div>
  <p class="hint" style="margin-top:8px">До 0,02 % от СК Банка расчёт ведётся по отчёту НОК, свыше — по рыночной стоимости, определённой Залоговой службой (УРЗИ). Не принимаются земельные участки, объекты без коммуникаций и внешней отделки, подвалы.${Q.thr === null ? " Укажите «СК Банка» в блоке «Клиент и запрос»." : ""}</p></section>
  ${objs || '<section class="panel"><p class="hint">Объекты не внесены. Нажмите «Добавить объект недвижимости».</p></section>'}
  <section class="panel"><h2>Дополнительное обеспечение — гаранты</h2><p class="hint">Для юридических лиц — гарантии учредителей, участников, акционеров, руководителей, бенефициаров на всю сумму обязательств; для ИП — гарантия супруга/супруги.</p>
  <div class="tablewrap" style="max-height:none"><table class="data form"><thead><tr><th class="lab">№</th><th style="text-align:left">Наименование гаранта</th><th style="text-align:left">ИИН/БИН</th><th style="text-align:left">Кто это</th><th></th></tr></thead><tbody>${guars}</tbody></table></div>
  <p style="margin-top:8px"><button class="btn" data-act="guaradd">Добавить гаранта</button></p></section>
  <section class="panel"><h2>Распространение залога</h2><p class="hint">При оформлении недвижимости, уже принятой в обеспечение по одобренному/выданному займу: сумма займа уменьшается на действующий лимит (для ВКЛ) или остаток долга (для займов и НКЛ).</p>
  <div class="grid2"><label class="f"><span>Действующие лимиты, тыс. тг</span><input class="inp" data-card="limits" data-num value="${esc(fmt(c.limits))}"></label></div></section>
  <section class="panel"><h2>Итоговый расчёт</h2>
  <div class="facts sm"><div><span>LTV</span><b>${Q.ltv === null ? "—" : pctFmt(Q.ltv)}</b><span>${Q.lr === null ? "" : "округлённо " + nf1.format(Q.lr)}</span></div><div><span>Итоговая сумма займа</span><b>${Q.final === null ? "—" : fmt(Q.final)}</b><span>${Q.max === null ? "укажите стоимость обеспечения" : "максимум " + fmt(Q.max)}</span></div></div>
  <div class="tablewrap" style="max-height:none;margin-top:10px"><table class="data"><thead><tr><th style="text-align:left">Условие</th><th>Выполнено</th></tr></thead><tbody>
    ${cond("LTV не выше 0,7", Q.lr === null ? null : Q.lr <= 0.7)}
    ${cond("Для LTV свыше 0,5: сумма не превышает 100 % валюты баланса", Q.lr === null || Q.lr <= 0.5 ? null : isNum(Q.ta) ? Q.amt <= Q.ta : null)}
    ${cond("Для LTV свыше 0,5: сумма не превышает 100 % годовой выручки", Q.lr === null || Q.lr <= 0.5 ? null : isNum(Q.ann) ? Q.amt <= Q.ann : null)}
    ${cond("Сумма не более 75 млн тг", Q.amt > 0 ? Q.amt <= 75000 : null)}</tbody></table></div>
  <div class="grid2" style="margin-top:10px"><label class="f"><span>Совокупный лимит на заёмщика/ГСЗ с учётом запрошенного, тыс. тг</span><input class="inp" data-card="totLimit" data-num value="${esc(fmt(c.totLimit))}"></label></div></section>`;
}

/* ---------- страница «Анализ» (сокращённая) */
function pageAnBU() {
  const F = odFinVals(), c2 = F.p2, c1 = F.p1 !== F.p2 ? F.p1 : null, v = (col, k) => (col ? F.v(col, k) : null), Q = buCalc();
  const obj = C.obj, L = lastPid(), cr = crAll(), p = reqPay();
  const rv = v(c2, "rev"), ni = v(c2, "ni"), eq = v(c2, "eq"), ta = v(c2, "ta"), ca = v(c2, "ca"), cl = v(c2, "cl");
  const ann = c2 && isNum(rv) ? rv * 12 / (N(c2.months) || 12) : null;
  const eb = ratio(obj, "ebitda_ann", L);
  const exist = cr.pay * 12, newY = p ? p.year : null, burden = isNum(newY) ? newY + exist : null;
  const cov = isNum(eb) && burden > 0 ? eb / burden : (isNum(ni) && burden > 0 ? ni * (12 / (N(c2?.months) || 12)) / burden : null);
  const fact = (lab, val, sub) => `<div><span>${lab}</span><b>${val}</b><span>${sub || ""}</span></div>`;
  const g = c1 && isNum(v(c1, "rev")) && v(c1, "rev") > 0 && isNum(rv) ? rv / v(c1, "rev") - 1 : null;
  return `<div class="pagehead"><div class="lead"><h1>Анализ</h1><p>Сокращённый анализ по продукту «Бизнес Успех»: ключевые показатели, нагрузка и обеспечение. Тыс. тг.</p></div></div>
  <div id="probBanner" data-page="an">${bannerHTML("an")}</div>
  <section class="panel"><h2>Финансовое положение${c2 ? ", " + esc(c2.label) : ""}</h2><div class="facts">
    ${fact("Выручка", isNum(rv) ? fmt(rv) : "н/д", isNum(g) ? (g >= 0 ? "рост " : "снижение ") + pctFmt(Math.abs(g)) : "")}
    ${fact("Чистая прибыль", isNum(ni) ? fmt(ni) : "н/д", isNum(ni) && isNum(rv) && rv ? "маржа " + pctFmt(ni / rv) : "")}
    ${fact("Собственный капитал", isNum(eq) ? fmt(eq) : "н/д", isNum(eq) && isNum(ta) && ta ? "доля в активах " + pctFmt(eq / ta) : "")}
    ${fact("Текущая ликвидность", isNum(ca) && isNum(cl) && cl ? fmt(ca / cl, "x") : "н/д", "краткосрочные активы / обязательства")}</div></section>
  <section class="panel"><h2>Запрос и долговая нагрузка</h2>
  <div class="facts sm">${fact("Сумма запроса", isNum(C.card.amount) ? fmt(C.card.amount) : "н/д", esc(finType()) + (isNum(C.fc?.req?.term) ? ", " + fmt(C.fc.req.term, "d") + " мес." : ""))}
    ${fact("Платёж по новому займу в месяц", p ? fmt(p.first) : "н/д", "")}
    ${fact(p && p.ft === "ВКЛ" ? "Проценты за год (нагрузка)" : "Платёж за год (нагрузка)", p ? fmt(p.year) : "н/д", "")}
    ${fact("Платежи по действующим кредитам за год", fmt(exist), "по кредитной истории")}
    ${fact("EBITDA / годовая нагрузка", isNum(cov) ? fmt(cov, "x") : "н/д", isNum(cov) ? (cov >= 1.2 ? "запас достаточный" : cov >= 1 ? "запас мал" : "денег не хватает") : "нужны отчётность и платёж")}</div>
  <p class="hint" style="margin-top:8px">Нагрузка по правилу типа финансирования: во ВКЛ — проценты за год, в НКЛ — весь платёж за год. Если EBITDA не посчитана, показано отношение чистой прибыли к нагрузке.</p></section>
  <section class="panel"><h2>Обеспечение</h2><div class="facts sm">${fact("LTV", Q.ltv === null ? "н/д" : pctFmt(Q.ltv), Q.lr === null ? "" : "округлённо " + nf1.format(Q.lr))}${fact("Итоговая сумма займа", Q.final === null ? "н/д" : fmt(Q.final), Q.max === null ? "" : "максимум " + fmt(Q.max))}${fact("Объектов в залоге", String(Q.objs.length), "")}</div></section>`;
}

/* ---------- заключение в формате чек-листа */
function buConclusionHTML(forWord) {
  ensureTrust(); ensureCredit();
  const c = C.card, R = prodChecks(), Q = buCalc(), F = odFinVals(), p = reqPay(), lim = prodLim();
  const T = forWord ? 'style="border-collapse:collapse;font-size:10pt;width:100%" border="1" cellpadding="4"' : 'class="data"';
  const th = forWord ? ' style="border:1px solid #E5E4E2;padding:4px 8px;background:#E5E4E2"' : "";
  const mark = s => ({ ok: "✓ соответствует", chk: "⚠ требует проверки", crit: "✗ не соответствует", nd: "— нет данных" }[s]);
  let n = 0; const H2 = t => `<h2 style="margin-top:16px">${++n}. ${t}</h2>`;
  const kv = (a, b) => `<tr><td style="text-align:left">${a}</td><td style="text-align:left">${b}</td></tr>`;
  const bad = R.out.filter(x => x.st === "crit"), warn = R.out.filter(x => x.st === "chk" || x.st === "nd");
  const t = C.trust[1] || {}, R1 = R.out.filter(x => ["term", "avail", "grace", "tranche", "max", "final", "agg"].includes(x.id)), R2 = R.out.filter(x => !R1.includes(x));
  const reqT = list => `<table ${T}><thead><tr><th${th} style="text-align:left">Требование</th><th${th} style="text-align:left">Факт</th><th${th} style="text-align:left">Результат</th></tr></thead><tbody>${list.map(x => `<tr><td style="text-align:left">${esc(x.title)}</td><td style="text-align:left">${esc(x.fact)}</td><td style="text-align:left">${mark(x.st)}</td></tr>`).join("")}</tbody></table>`;
  return `<h1>Заключение по продукту «Бизнес Успех»</h1>
  ${H2("Заёмщик")}<p><b>${esc(compName(1))}</b>${comp(1)?.bin ? ", БИН " + esc(comp(1).bin) : ""}. ${okedListText(C) ? "ОКЭД: " + esc(okedListText(C)) + ". " : ""}${t.regDate ? "Дата регистрации: " + esc(t.regDate) + "." : ""}</p>
  ${H2("Информация о запросе заёмщика")}<table ${T}><tbody>
    ${kv("Цель финансирования", esc(c.purpose || "—"))}${kv("Вид финансирования", esc(finType()))}${kv("Запрошенная сумма, тыс. тг", isNum(c.amount) ? fmt(c.amount) : "не указана")}
    ${kv("Максимально возможный срок, мес.", String(lim.term))}${kv("Запрошенный срок, мес.", fmt(fcParams().req.term, "d"))}${kv("Период доступности, мес.", finType() === "НКЛ" ? (isNum(c.avail) ? fmt(c.avail, "d") + " (максимум " + lim.avail + ")" : "не указан") : "для ВКЛ не требуется")}
    ${kv("Максимальный срок транша, мес.", isNum(c.tranche) ? fmt(c.tranche, "d") : "не указан")}${kv("Ставка вознаграждения", isNum(fcParams().req.rate) ? fmt(fcParams().req.rate * 100, "m1") + " %" : "—")}
    ${kv("Ежемесячный платёж / нагрузка за год, тыс. тг", p ? `${fmt(p.first)} / ${fmt(p.year)} (${p.ft === "ВКЛ" ? "только проценты" : "весь платёж"})` : "—")}</tbody></table>
  ${H2("Информация по анализу сделки, тыс. тг")}<table ${T}><thead><tr><th${th} style="text-align:left">Наименование</th>${F.cols.map(cl => `<th${th}>${esc(cl.label)}</th>`).join("")}</tr></thead><tbody>${OD_ROWS_BU.map(([key, lab]) => `<tr><td style="text-align:left">${esc(lab)}</td>${F.cols.map(cl => { const x = F.v(cl, key); return `<td>${key === "npm" ? (isNum(x) ? pctFmt(x) + (x > 0 ? " · да" : " · нет") : "—") : key === "eqpos" ? (isNum(x) ? (x > 0 ? "да" : "нет") : "—") : fmt(x)}</td>`; }).join("")}</tr>`).join("")}</tbody></table>
  ${H2("Обеспечение и итоговый расчёт")}<table ${T}><thead><tr><th${th} style="text-align:left">Тип</th><th${th} style="text-align:left">Описание</th><th${th}>НОК, тыс. тг</th><th${th}>УРЗИ, тыс. тг</th><th${th} style="text-align:left">Залогодатель</th><th${th} style="text-align:left">НОК (аккредитация)</th></tr></thead><tbody>
    ${Q.objs.length ? Q.objs.map(x => `<tr><td style="text-align:left">${esc(x.kind || "—")}</td><td style="text-align:left">${esc(x.desc || "—")}</td><td>${fmt(x.nokv)}</td><td>${fmt(x.market)}</td><td style="text-align:left">${esc(x.pl === "Третье лицо" ? (x.plName || "третье лицо") + (x.plBin ? ", " + x.plBin : "") : "Заёмщик")}</td><td style="text-align:left">${esc(x.nokName || "—")} (${esc(x.nokAccr || "не указана")})</td></tr>`).join("") : `<tr><td colspan="6" style="text-align:left">Объекты недвижимости не внесены</td></tr>`}
    <tr><td style="text-align:left"><b>Итого</b></td><td></td><td><b>${fmt(Q.nok)}</b></td><td><b>${fmt(Q.urzi)}</b></td><td></td><td></td></tr></tbody></table>
  <p>LTV: <b>${Q.ltv === null ? "—" : pctFmt(Q.ltv)}</b>${Q.lr === null ? "" : " (округлённо " + nf1.format(Q.lr) + ")"}. Действующие лимиты под залог: ${fmt(Q.lim)} тыс. тг. Итоговая сумма займа: <b>${Q.final === null ? "—" : fmt(Q.final) + " тыс. тг"}</b>${Q.max === null ? "" : " (максимум " + fmt(Q.max) + ")"}. Совокупный лимит на заёмщика/ГСЗ: ${isNum(c.totLimit) ? fmt(c.totLimit) + " тыс. тг" : "не указан"}.</p>
  <p>Гаранты: ${(C.guar || []).filter(x => x.name).map(x => esc(x.name) + (x.iin ? " (" + esc(x.iin) + ")" : "")).join("; ") || "не внесены"}.</p>
  ${H2("Условия продукта")}${reqT(R1)}
  ${H2("Требования к заёмщику и проекту")}${reqT(R2)}
  ${H2("Благонадёжность")}${typeof trustConclHTML === "function" ? trustConclHTML() : ""}
  ${H2("Кредитная история")}<p>${(() => { const s = crSummary(1); return !s.any ? "Кредитный отчёт не загружен." : `Действующих займов: ${s.n}, остаток долга ${fmt(s.debt)} тыс. тг, платежи в месяц ${fmt(s.pay)} тыс. тг, текущая просрочка ${s.od ? s.od + " дн." : "отсутствует"}.`; })()}</p>
  ${H2("Итог проверки")}<p>${bad.length ? `<b>Не соответствует условиям продукта:</b> ${esc(bad.map(x => x.title).join("; "))}.` : "Несоответствий условиям продукта не выявлено."}${warn.length ? ` Требуют проверки: ${esc(warn.map(x => x.title).join("; "))}.` : ""}</p>
  <p class="small muted">Запрещена выдача средств на оплату или перевод аффилированным и связанным лицам. Кредит выдаётся после регистрации залога; выезд на место ведения бизнеса и осмотр залога проводит КП.</p>
  ${H2("Выводы кредитного менеджера")}<p>${esc(C.concl.text || "—").replace(/\n/g, "<br>")}</p>${C.concl.conditions ? `<p><b>Условия:</b> ${esc(C.concl.conditions).replace(/\n/g, "<br>")}</p>` : ""}
  ${H2("Рекомендация")}<p><b>${esc(C.concl.decision || "не указана")}</b>${Q.final !== null ? `, сумма ${fmt(Q.final)} тыс. тг` : ""}. Статус: ${esc(C.concl.status || "Черновик")}.</p>
  <p class="small muted">Кредитный менеджер: ${esc(c.analyst || "")} · ${esc((c.date || "").split("-").reverse().join("."))}</p>`;
}
const concHTML = forWord => (isOD() ? odConclusionHTML(forWord) : isBU() ? buConclusionHTML(forWord) : conclusionHTML(forWord));

/* ---------- события Бизнес Успех */
document.addEventListener("change", e => {
  const t = e.target, d = t.dataset; if (!C) return;
  if (d.bco !== undefined) {
    const x = C.coll[+d.bco]; if (!x) return;
    if (d.f === "nokv" || d.f === "market") x[d.f] = parseNum(t.value); else x[d.f] = t.value;
    x.owner = x.pl === "Третье лицо" ? (x.plName || "") : pledgorDefault();
    touch(); render(); return;
  }
  if (["limits", "totLimit"].includes(d.card)) { render(); return; }
  if (d.card === "tranche") { refreshCalc(); return; }
});
document.addEventListener("click", e => {
  if (!C) return;
  if (e.target.closest("[data-act='bucolladd']")) { ensureCredit(); C.coll.push({ type: "Недвижимость", kind: "", desc: "", purp: "", nokv: null, market: null, disc: COLL_TYPES["Недвижимость"], pl: "Заёмщик", owner: pledgorDefault(), plName: "", plBin: "", nokName: "", nokAccr: "", licNo: "", licOrg: "", licDate: "" }); touch(); render(); return; }
  const d = e.target.closest("[data-bcodel]"); if (d) { C.coll.splice(+d.dataset.bcodel, 1); touch(); render(); return; }
  const g = e.target.closest("[data-delguar]"); if (g) { C.guar.splice(+g.dataset.delguar, 1); touch(); render(); }
});
PAGES.coll = (orig => () => (isBU() ? pageCollBU() : orig()))(PAGES.coll);
PAGES.an = (orig => () => (isBU() ? pageAnBU() : orig()))(PAGES.an);
