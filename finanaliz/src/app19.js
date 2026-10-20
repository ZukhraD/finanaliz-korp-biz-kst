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
  <div class="grid2">${num("avail", "Период доступности, мес.")}${sel("zone", "Зона проблемности", ["Нет", "Жёлтая", "Красная", "Чёрная"])}
  ${isBU() ? sel("nok", "Отчёт НОК — партнёр Банка", ["Не известно", "Да", "Нет"]) : (purposeCls() === "Инв" ? num("projCost", "Стоимость инвестиционного проекта, тыс. тг") : "")}</div>
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
  add("avail", `Период доступности не более ${lim.avail} мес.`, isNum(c.avail) ? `${fmt(c.avail, "d")} мес.` : "не указан", !isNum(c.avail) ? "nd" : N(c.avail) <= lim.avail ? "ok" : "crit", "Укажите период доступности в блоке «Условия продукта».");
  if (bu) {
    add("grace", "Погашение основного долга ежемесячно, без отсрочки и льготного периода", `льготный период ${fmt(R.grace, "d")} мес.`, N(R.grace) > 0 ? "crit" : "ok", "Уберите льготный период по основному долгу.");
    add("max", "Сумма финансирования не более 75 млн тг", hasAmt ? `${fmt(amt)} тыс. тг` : "сумма не указана", !hasAmt ? "nd" : amt <= 75000 ? "ok" : "crit", "Уменьшите сумму до 75 000 тыс. тг.");
    const re = sumT("Недвижимость"), ltv = re > 0 && hasAmt ? amt / re : null, ltvR = ltv === null ? null : Math.round(ltv * 10) / 10;
    add("re", "Залог — недвижимость (жилая или коммерческая вне жилого фонда; не земля, не подвал, не объект без коммуникаций)", re > 0 ? `рыночная стоимость недвижимости ${fmt(re)} тыс. тг` : "недвижимость в залоге не указана", !hasAmt ? "nd" : re > 0 ? "chk" : "crit", "Добавьте недвижимость на странице «Кредитная история» (раздел залога) и проверьте вид объекта.");
    add("ltv", "Сумма не более 70 % оценочной стоимости недвижимости (LTV до 0,7 с округлением до десятых)", ltv === null ? "нет данных" : `LTV ${pctFmt(ltv)} (округлённо ${nf1.format(ltvR)})`, ltv === null ? "nd" : ltvR <= 0.7 ? "ok" : "crit", "Уменьшите сумму или увеличьте оценочную стоимость залога. При совокупном залоге учитывайте все обязательства под него.");
    if (ltvR !== null && ltvR > 0.5) {
      const ta = c2 ? fv(c2, "ta") : null, rv = c2 ? fv(c2, "rev") : null, ann = isNum(rv) && c2 ? rv * 12 / (N(c2.months) || 12) : null;
      add("ta", "При LTV свыше 0,5: сумма не более 100 % валюты баланса", isNum(ta) ? `валюта баланса ${fmt(ta)}` : "нет данных", !isNum(ta) ? "nd" : amt <= ta ? "ok" : "crit", "Сумма превышает валюту баланса на последнюю дату.");
      add("rev", "При LTV свыше 0,5: сумма не более 100 % годовой выручки", isNum(ann) ? `годовая выручка ${fmt(ann)}` : "нет данных", !isNum(ann) ? "nd" : amt <= ann ? "ok" : "crit", "Сумма превышает годовую выручку.");
    }
    const need = ltvR !== null && ltvR > 0.5 ? 12 : 6, exp = odExperience(k);
    add("exp", `Срок ведения деятельности не менее ${need} мес.`, exp === null ? "дата регистрации неизвестна — «Подтянуть по БИН» или страница «Благонадёжность»" : `${exp} мес.`, exp === null ? "nd" : exp >= need ? "ok" : "crit", "Укажите дату регистрации.");
    add("nok", "Отчёт НОК — партнёра Банка (иначе финансирование невозможно)", c.nok === "Да" ? "партнёр Банка" : c.nok === "Нет" ? "не партнёр" : "не известно", c.nok === "Да" ? "ok" : c.nok === "Нет" ? "crit" : "chk", "Выберите в блоке «Условия продукта».");
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
  if (bu) add("eq", "Положительный собственный капитал на последнюю отчётную дату", isNum(eq2) ? fmt(eq2) : "нет данных", !isNum(eq2) ? "nd" : eq2 > 0 ? "ok" : "crit", "Капитал должен быть положительным.");
  if (bu) for (const col of [c1, c2].filter(Boolean)) { const ni = fv(col, "ni"); add("ni" + col.id, `Положительная чистая прибыль: ${col.label}`, isNum(ni) ? fmt(ni) : "нет данных", !isNum(ni) ? "nd" : ni > 0 ? "ok" : "crit", "Чистая прибыль должна быть положительной за последний год и текущую дату."); }
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
  return { out };
}
function prodProblems(add) {
  for (const x of prodChecks().out) if (x.st !== "ok") add(x.st === "nd" ? "nd" : x.st === "crit" ? "crit" : "chk", "card", `${C.card.product}: ${x.title}`, x.fact, x.fix);
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
