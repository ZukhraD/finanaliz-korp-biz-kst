"use strict";
/* ================================================================ Экспресс-анализ для КМ: данные, хранение, загрузка файлов.
   Все суммы на экране — тыс. тг. Декларации хранятся в тенге (как в документе) и делятся на 1000 при показе.
   Данные — только в этом браузере (localStorage), регистрация не нужна. */
const S = window.SPEC;
var C = { settings: { variant: 0 }, custom: {} };   // нужно разборщику форм основного сайта (app2.js)

/* ---------------------------------------------------------------- числа */
const isNum = v => typeof v === "number" && isFinite(v);
const N = v => (isNum(v) ? v : 0);
function parseNum(s) {
  if (s === null || s === undefined) return null;
  if (typeof s === "number") return isFinite(s) ? s : null;
  let t = String(s).trim().replace(/[   \s']/g, "");
  if (t === "" || t === "-" || t === "—") return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.startsWith("−") || t.startsWith("-")) { neg = !neg; t = t.slice(1); }
  const seps = (t.match(/[.,]/g) || []).length;
  if (seps > 1) {
    const p = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
    t = (t.length - p - 1 === 3) ? t.replace(/[.,]/g, "") : t.slice(0, p).replace(/[.,]/g, "") + "." + t.slice(p + 1);
  } else t = t.replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const v = parseFloat(t);
  return isFinite(v) ? (neg ? -v : v) : null;
}
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfd2 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });   // до сотых: 19,25 · 19,5 · 20
function fmt(v, kind = "m") {
  if (!isNum(v)) return "";
  const s = kind === "d2" ? nfd2.format(Math.round(v * 100) / 100) : kind === "x" ? nf2.format(v) : kind === "p" ? nf1.format(v * 100) + " %" : kind === "1" ? nf1.format(v) : nf0.format(Math.round(v));
  return s.replace("-", "−");
}
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const sum = a => a.reduce((x, y) => x + N(y), 0);

/* ---------------------------------------------------------------- справочники */
const PRODUCTS = ["Кредит", "Кредитная линия", "Овердрафт", "Банковская гарантия"];
const PURPOSES = ["Пополнение оборотных средств", "Приобретение основных средств / инвестиции", "Рефинансирование", "Исполнение контракта", "Другое"];
const PROGRAMS = ["Собственная программа банка", "Гос. программа: субсидирование ставки", "Гос. программа: гарантия фонда", "Гос. программа: субсидирование + гарантия", "Программа институтов развития (БРК, ЕАБР и др.)", "Другая"];
const SCHED = { ann: "Аннуитет (равными платежами)", diff: "Дифференцированный (долг равными долями)", end: "В конце срока (ежемесячно только %)" };
const COLL = { "Недвижимость коммерческая": 30, "Недвижимость жилая": 25, "Земельный участок": 40, "Транспорт": 40, "Спецтехника / оборудование": 45, "Товары в обороте": 50, "Деньги (депозит)": 0, "Права требования / контракт": 50, "Другое": 50 };
const OVERDUE = { no: "нет", past: "были, сейчас нет", now: "есть сейчас" };

/* компактные строки отчётности: ключ → [название, подпись простым языком, ключи основного сайта] */
const FL = {
  bal: [
    ["sec", "Что есть у компании (активы)"],
    ["cash", "Деньги", "касса, счета, краткосрочные депозиты", ["cash", "stinv"]],
    ["ar", "Дебиторская задолженность", "сколько компании должны покупатели и другие", ["ar", "oar"]],
    ["inv", "Запасы", "товары, сырьё, материалы на складе", ["inv"]],
    ["oca", "Прочие текущие активы", "НДС к возмещению, предоплата налогов и т.п.", ["taxa", "oca"]],
    ["fa", "Основные средства и долгосрочные активы", "здания, техника, оборудование, вложения", ["ppe", "intang", "ltinv", "olta"]],
    ["ta", "ИТОГО АКТИВЫ", "", null, "calc"],
    ["sec", "Откуда деньги (обязательства и капитал)"],
    ["ap", "Кредиторская задолженность и авансы", "сколько компания должна поставщикам; авансы покупателей", ["ap", "adv"]],
    ["debt_st", "Кредиты и займы до 1 года", "включая текущую часть долгосрочных и лизинг", ["stloan", "cpltd"]],
    ["debt_lt", "Кредиты, займы и лизинг свыше 1 года", "", ["ltloan", "lease"]],
    ["ol", "Прочие обязательства", "налоги, зарплата, прочие долги", ["taxl", "ocl", "oltl"]],
    ["eq", "Собственный капитал", "уставный капитал + накопленная прибыль + резервы", ["sc", "re", "oeq"]],
    ["re", "в т.ч. нераспределённая прибыль", "накопленная прибыль прошлых лет", ["re"], "sub"],
    ["tle", "ИТОГО ПАССИВЫ", "", null, "calc"],
    ["ta_rep", "Итого активы по отчётности", "для сверки — как в документе", ["ta_rep"], "opt"],
  ],
  pl: [
    ["sec", "Доходы и расходы за период"],
    ["rev", "Выручка", "доход от продажи товаров и услуг, без НДС", ["rev"]],
    ["cogs", "Себестоимость", "закупка товара, сырьё, производство", ["cogs"]],
    ["opex", "Расходы периода", "административные + расходы по реализации", ["selling", "admin"]],
    ["oth", "Прочие доходы минус прочие расходы", "если расходов больше — со знаком минус", null, "oth"],
    ["int", "Проценты по кредитам", "расходы по финансированию", ["int"]],
    ["cit", "Подоходный налог (КПН)", "", ["cit"]],
    ["fam", "Расходы вне бизнеса (семья) минус доходы вне бизнеса", "для ИП и бизнеса без бухгалтерии: сколько уходит на семью", [], "opt"],
    ["ni", "ЧИСТАЯ ПРИБЫЛЬ (расчёт)", "", null, "calc"],
    ["ni_rep", "Чистая прибыль по отчётности", "для сверки — как в документе", ["ni_rep"], "opt"],
    ["da", "Амортизация", "необязательно: из пояснений или ДДС; если не знаете — оставьте пустым", [], "opt"],
  ],
  cf: [
    ["sec", "Движение денег (если есть ДДС)"],
    ["ocf", "Чистый поток от основной деятельности", "поступления от покупателей минус оплаты поставщикам, зарплата, налоги", null, "ocf"],
    ["cf_in", "Получено кредитов и займов (и др. финансирование)", "", null, "cfin"],
    ["cf_out", "Погашено кредитов и займов (и др. выплаты)", "", null, "cfout"],
  ],
};
const LINEDEF = {}; for (const b of Object.keys(FL)) for (const l of FL[b]) if (l[0] !== "sec") LINEDEF[l[0]] = { key: l[0], label: l[1], hint: l[2], src: l[3], typ: l[4] || "in", block: b };

/* ---------------------------------------------------------------- хранение */
const STORE = "finkz.express.v1";
let CLIENTS = (() => { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { return []; } })();
let X = null;          // открытый клиент
let saveT = 0;
function saveAll(now) {
  clearTimeout(saveT);
  const go = () => { try { localStorage.setItem(STORE, JSON.stringify(CLIENTS)); } catch (e) { toast("Не удалось сохранить: в браузере закончилось место"); } };
  if (now) go(); else saveT = setTimeout(go, 400);
}
function touch() { if (X) { X.updated = Date.now(); X.concl = X.concl || {}; if (!X.concl.edited) X.concl.text = ""; } saveAll(); }
function download(name, text, type = "application/json") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function defPeriods() {
  const y = new Date().getFullYear();
  return [{ id: uid(), date: `${y - 2}-12-31`, months: 12 }, { id: uid(), date: `${y - 1}-12-31`, months: 12 }];
}
function newClient() {
  return {
    id: uid(), created: Date.now(), updated: Date.now(),
    card: { name: "", product: "Кредит", purpose: PURPOSES[0], amount: null, term: null, rate: null, sched: "ann", grace: 0, payExist: null },
    per: defPeriods(), fin: {}, files: [], decl: [], concl: { text: "", edited: false },
  };
}
const perLabel = p => { if (!p || !p.date) return "период"; const [y, m] = p.date.split("-"); const mm = N(p.months) || 12; return mm === 12 && m === "12" ? y : `${mm} мес. ${y}`; };
const perIdx = pid => X.per.findIndex(p => p.id === pid);
const fv = (key, pid) => { const v = X.fin?.[key]?.[pid]; return isNum(v) ? v : null; };
function setFv(key, pid, v) { X.fin[key] = X.fin[key] || {}; if (v === null) delete X.fin[key][pid]; else X.fin[key][pid] = v; }

/* значения с расчётными строками */
function val(key, pid) {
  const d = LINEDEF[key];
  if (key === "ta") { const a = ["cash", "ar", "inv", "oca", "fa"].map(k => fv(k, pid)); return a.some(isNum) ? sum(a) : null; }
  if (key === "tle") { const a = ["ap", "debt_st", "debt_lt", "ol", "eq"].map(k => fv(k, pid)); return a.some(isNum) ? sum(a) : null; }
  if (key === "ni") { const r = fv("rev", pid); if (!isNum(r)) return null; return r - N(fv("cogs", pid)) - N(fv("opex", pid)) + N(fv("oth", pid)) - N(fv("int", pid)) - N(fv("cit", pid)) - N(fv("fam", pid)); }
  if (key === "debt") { const a = [fv("debt_st", pid), fv("debt_lt", pid)]; return a.some(isNum) ? sum(a) : null; }
  if (key === "ca") { const a = ["cash", "ar", "inv", "oca"].map(k => fv(k, pid)); return a.some(isNum) ? sum(a) : null; }
  if (key === "cl") { const a = ["ap", "debt_st", "ol"].map(k => fv(k, pid)); return a.some(isNum) ? sum(a) : null; }
  if (key === "ebit") { const r = fv("rev", pid); if (!isNum(r)) return null; return r - N(fv("cogs", pid)) - N(fv("opex", pid)); }
  if (key === "ebitda") { const e = val("ebit", pid); return isNum(e) ? e + N(fv("da", pid)) : null; }
  return d ? fv(key, pid) : null;
}

/* ---------------------------------------------------------------- загрузка файлов */
// подсказки единиц: шапка формы и доля сумм с тиынами (как на основном сайте)
function unitHints(sheets) {
  let head = "", n = 0, fr = 0;
  for (const sh of sheets) {
    for (const row of sh.rows.slice(0, 25)) if (row) for (const v of row) if (typeof v === "string") head += " " + v.toLowerCase();
    for (const row of sh.rows) if (row) for (const v of row) if (typeof v === "number" && Math.abs(v) >= 1000) { n++; if (Math.abs(v - Math.round(v)) > 0.004) fr++; }
  }
  const u = /млн\.?\s*(тенге|тг)|миллион\S*\s+тенге/.test(head) ? "m" : /(тыс\S*|тысяч\S*)\s*(\.\s*)?(казахстанских\s+)?(тенге|тг)|в\s+тысячах/.test(head) ? "k" : /(в|единица\s+измерения:?)\s+тенге|,\s*тенге|\(тенге\)/.test(head) ? "t" : "";
  return { head: u, frac: n ? fr / n : 0 };
}
function autoFactor(mx, h) {
  // по уже введённым данным клиента — тот же масштаб
  const ref = []; for (const p of X.per) for (const k of ["rev"]) { const v = fv(k, p.id); if (isNum(v) && v > 0) ref.push(v); }
  for (const p of X.per) { const v = val("ta", p.id); if (isNum(v) && v > 0) ref.push(v); }
  if (ref.length && mx > 0) {
    const r = Math.max(...ref), best = [0.001, 1, 1000].map(f => [f, Math.abs(Math.log10(mx * f / r))]).sort((a, b) => a[1] - b[1])[0];
    if (best[1] < 1.5) return [best[0], "по масштабу уже введённых цифр"];
  }
  if (h.frac >= 0.3) return [0.001, "суммы с тиынами — значит, в тенге"];
  if (h.head === "m") return [1000, "в шапке указано «млн тенге»"];
  if (h.head === "k") return mx >= 1e9 ? [0.001, "в шапке «тыс. тенге», но числа слишком большие — тенге"] : [1, "в шапке указано «тыс. тенге»"];
  if (h.head === "t") return [0.001, "в шапке указано «тенге»"];
  if (mx >= 5e7) return [0.001, "по величине чисел — тенге"];
  return [1, "по величине чисел — тыс. тенге"];
}
const KIND_TXT = { B: "Баланс", P: "ОПиУ", C: "ДДС" };
const CF_IN = ["cf011", "cf012", "cf013", "cf014", "cf015", "cf016"], CF_OUT = ["cf021", "cf022", "cf023", "cf024", "cf025", "cf026", "cf027"];
const CF_FIN_IN = ["cf091", "cf092", "cf093", "cf094"], CF_FIN_OUT = ["cf101", "cf102", "cf103", "cf104", "cf105"];
// значения одной колонки формы → компактные строки
function formToLines(kind, f, prof, w) {
  const raw = {}, found = {};
  for (const m of S.mapping) {
    if (m[0] !== kind) continue;
    const spec = prof === 4 ? (m[6] || "") : m[prof === 1 ? 2 : 3];
    const r = evalSpec(spec, f, w);
    if (r.found) { raw[m[1]] = r.v; found[m[1]] = true; }
  }
  const out = {};
  const pick = keys => keys.some(k => found[k]) ? sum(keys.map(k => raw[k])) : null;
  for (const key of Object.keys(LINEDEF)) {
    const d = LINEDEF[key]; if (d.typ === "calc") continue;
    if ((kind === "B" && d.block !== "bal") || (kind === "P" && d.block !== "pl") || (kind === "C" && d.block !== "cf")) continue;
    let v = null;
    if (d.typ === "oth") { const p = ["ooi", "ooe", "fin_inc", "onoi_in", "onoi_out"]; if (p.some(k => found[k])) v = N(raw.ooi) - N(raw.ooe) + N(raw.fin_inc) + N(raw.onoi_in) - N(raw.onoi_out); }
    else if (d.typ === "ocf") { if ([...CF_IN, ...CF_OUT].some(k => found[k])) v = sum(CF_IN.map(k => raw[k])) - sum(CF_OUT.map(k => raw[k])); }
    else if (d.typ === "cfin") v = pick(CF_FIN_IN);
    else if (d.typ === "cfout") v = pick(CF_FIN_OUT);
    else if (d.src && d.src.length) v = pick(d.src);
    if (v !== null) out[key] = v;
  }
  return out;
}
async function readAnyFile(file, onProg) {
  if (/\.(jpe?g|png)$/i.test(file.name)) { const pdf = await OCR.image(file, onProg); return { pdf, sheets: pdfToSheets(pdf), ocr: pdf }; }
  const buf = await file.arrayBuffer();
  if (/\.pdf$/i.test(file.name)) {
    let pdf = await PdfReader.read(buf);
    if (pdf.noText) pdf = await OCR.pdf(buf, onProg);     // скан — распознаём
    return { pdf, sheets: pdfToSheets(pdf), ocr: pdf.ocr ? pdf : null };
  }
  return { pdf: null, sheets: await readWorkbook(buf) };
}

/* ---------------------------------------------------------------- отчётный период — по датам в шапке документа
   «на 31 декабря 2025 г.», «по состоянию на 30.09.2026», «за 2025 год», «за 9 месяцев 2026 г.»,
   «за период с 01.01.2026 по 30.09.2026», «1 квартал», «полугодие», казахские названия месяцев. */
const MONTHS_RE = [["январ", "қаңтар"], ["феврал", "ақпан"], ["март", "наурыз"], ["апрел", "сәуір"], ["ма[йя]", "мамыр"], ["июн", "маусым"], ["июл", "шілде"], ["август", "тамыз"], ["сентябр", "қыркүйек"], ["октябр", "қазан"], ["ноябр", "қараша"], ["декабр", "желтоқсан"]];
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const isoD = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function headText(sheets) {
  let t = "";
  for (const sh of sheets) { t += " " + (sh.name || ""); for (const row of sh.rows.slice(0, 30)) if (row) for (const v of row) if (typeof v === "string") t += " " + v; }
  return t.toLowerCase().replace(/ё/g, "е").replace(/[  ]/g, " ").replace(/\s+/g, " ");
}
function findDates(t) {
  const out = [];
  let m; const re1 = /(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2})/g;
  while ((m = re1.exec(t))) { const d = +m[1], mo = +m[2], y = +m[3]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.push({ i: m.index, iso: isoD(y, mo, d), y, mo, d }); }
  MONTHS_RE.forEach(([ru, kz], k) => {
    const re2 = new RegExp(`(\\d{1,2})\\s*[«"]?\\s*(?:${ru})\\S*\\s+(20\\d{2})`, "g"), re3 = new RegExp(`(20\\d{2})\\s*(?:ж\\.?|жыл\\S*)?\\s*(\\d{1,2})\\s*(?:${kz})`, "g");
    while ((m = re2.exec(t))) out.push({ i: m.index, iso: isoD(+m[2], k + 1, +m[1]), y: +m[2], mo: k + 1, d: +m[1] });
    while ((m = re3.exec(t))) out.push({ i: m.index, iso: isoD(+m[1], k + 1, +m[2]), y: +m[1], mo: k + 1, d: +m[2] });
  });
  return out.sort((a, b) => a.i - b.i);
}
// → { date, months, how } или null
function detectPeriod(sheets, kind) {
  const t = headText(sheets), ds = findDates(t);
  const near = (re, after = 40) => { let m; const r = new RegExp(re, "g"); while ((m = r.exec(t))) { const d = ds.find(x => x.i >= m.index && x.i - m.index <= after + m[0].length); if (d) return d; } return null; };
  // за период с … по …
  let m = /(?:период\S*|с)\s+(\d{1,2}[.\/]\d{1,2}[.\/]20\d{2}|\d{1,2}\s*\S+\s+20\d{2})\s*(?:г\.?|года)?\s*(?:по|-|–|—)\s*(\d{1,2}[.\/]\d{1,2}[.\/]20\d{2}|\d{1,2}\s*\S+\s+20\d{2})/.exec(t);
  if (m) { const a = findDates(m[1])[0], b = findDates(m[2])[0]; if (a && b && b.iso >= a.iso) return { date: isoD(b.y, b.mo, lastDay(b.y, b.mo)), months: Math.min(12, (b.y - a.y) * 12 + b.mo - a.mo + 1), how: `«с ${a.d}.${a.mo}.${a.y} по ${b.d}.${b.mo}.${b.y}»` }; }
  // за N месяцев / квартал / полугодие YYYY
  m = /за\s+(\d{1,2})\s*(?:месяц|мес\.?|ай)\S*\s+(?:\S+\s+){0,2}?(20\d{2})/.exec(t);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { date: isoD(+m[2], +m[1], lastDay(+m[2], +m[1])), months: +m[1], how: `«за ${m[1]} месяцев ${m[2]}»` };
  m = /(?:за\s+)?([1-4])\s*-?\s*(?:й|ый|ой|ий)?\s*квартал\S*\s+(?:\S+\s+){0,2}?(20\d{2})/.exec(t);
  if (m) return { date: isoD(+m[2], +m[1] * 3, lastDay(+m[2], +m[1] * 3)), months: +m[1] * 3, how: `«${m[1]} квартал ${m[2]}»` };
  m = /(?:за\s+)?(?:[1i]\s*-?\s*(?:е|ое)?\s*)?полугоди\S*\s+(?:\S+\s+){0,2}?(20\d{2})/.exec(t);
  if (m) return { date: isoD(+m[1], 6, 30), months: 6, how: `«полугодие ${m[1]}»` };
  // на дату / по состоянию на
  const dn = near("(?:по\\s+состоянию\\s+)?на\\s|жағдай|состоянию|отчетн\\S*\\s+дат", 30);
  if (dn) { const eom = dn.d === lastDay(dn.y, dn.mo); return { date: eom ? dn.iso : isoD(dn.y, dn.mo, lastDay(dn.y, dn.mo)), months: kind === "B" ? (dn.mo === 12 ? 12 : dn.mo) : (dn.mo === 12 ? 12 : dn.mo), how: `«на ${dn.d}.${String(dn.mo).padStart(2, "0")}.${dn.y}»` }; }
  // за YYYY год
  m = /(?:за|по\s+итогам)\s+(20\d{2})\s*(?:г\.?|год|года|жыл)/.exec(t) || /(20\d{2})\s*(?:жылғы|жыл)\s+/.exec(t);
  if (m) return { date: isoD(+m[1], 12, 31), months: 12, how: `«за ${m[1]} год»` };
  // любая дата конца месяца в шапке
  const eomAny = ds.filter(x => x.d === lastDay(x.y, x.mo));
  if (eomAny.length) { const x = eomAny[0]; return { date: x.iso, months: x.mo === 12 ? 12 : x.mo, how: `дата в шапке ${x.d}.${String(x.mo).padStart(2, "0")}.${x.y}` }; }
  return null;
}
const MAX_PER = 4;
// найти период с этой датой или создать новый (по порядку дат)
function periodFor(date, months, kind) {
  let p = X.per.find(x => x.date === date);
  if (p) { if (kind !== "B" && isNum(months) && !isNum(fv("rev", p.id))) p.months = months; return { p, created: false }; }
  if (X.per.length >= MAX_PER) {
    const empty = X.per.find(x => !Object.keys(X.fin).some(k => isNum(X.fin[k][x.id])));
    if (!empty) return { p: null };
    X.per = X.per.filter(x => x !== empty);
  }
  p = { id: uid(), date, months: isNum(months) ? months : (+date.slice(5, 7) === 12 ? 12 : +date.slice(5, 7)) };
  X.per.push(p); X.per.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return { p, created: true };
}

/* ---------------------------------------------------------------- управленческая отчётность (шаблон банка для ИП и бизнеса без бухгалтерии):
   листы «Баланс ГГГГ» (АКТИВ / ПАССИВ на две даты) и «ОПиУ ГГГГ» (по месяцам), суммы в тенге. Кодов строк нет — строки по названиям. */
// дата в ячейке: число Excel, «01.10.2026», «на 01.10.2026 г.», «Январь 2026», «янв.26», «январь» (год — из шапки листа)
const MON_SHORT = ["янв", "фев", "мар", "апр", "ма[йя]", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const xlDate = (v, yearHint) => {
  if (typeof v === "number" && v > 36000 && v < 60000) return new Date(Math.round((v - 25569) * 864e5));
  if (typeof v !== "string") return null;
  const t = v.toLowerCase().replace(/ё/g, "е").trim();
  let m = /^(?:на|по\s+состоянию\s+на)?\s*(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2}|\d{2})\s*(г\.?|года?)?\s*$/.exec(t);
  if (m && +m[2] >= 1 && +m[2] <= 12) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); }
  if (t.length > 22) return null;
  for (let i = 0; i < 12; i++) {
    m = new RegExp(`^(?:за\\s+)?${MON_SHORT[i]}\\S*\\.?\\s*[-'’]?\\s*(20\\d{2}|\\d{2})?\\s*(г\\.?|года?)?$`).exec(t);
    if (m) { const y = m[1] ? (+m[1] < 100 ? 2000 + +m[1] : +m[1]) : yearHint; if (y) return new Date(y, i, 1); }
  }
  return null;
};
const sheetYear = sh => { const t = (sh.name || "") + " " + sh.rows.slice(0, 6).map(r => (r || []).filter(v => typeof v === "string").join(" ")).join(" "); const m = /(20\d{2})/.exec(t); return m ? +m[1] : null; };
const cellNum = v => (typeof v === "number" ? v : typeof v === "string" && /\d/.test(v) ? parseNum(v.replace(/тг|тенге|₸/gi, "")) : null);
const lab = (row, cols) => normTxt(cols.map(c => (typeof row?.[c] === "string" && !/^\s*[\d.,\s-]+$/.test(row[c]) ? row[c] : "")).join(" "));
function mgmtBal(sh) {
  const R = Math.min(sh.rows.length - 1, 60);
  for (let r = 1; r <= Math.min(R, 15); r++) {
    const row = sh.rows[r] || []; let aC = 0, pC = 0;
    row.forEach((v, c) => { if (typeof v === "string") { const t = normTxt(v); if (/^актив/.test(t)) aC = c; if (/^пассив/.test(t)) pC = c; } });
    if (!aC || !pC) continue;
    const yh = sheetYear(sh), dcols = []; row.forEach((v, c) => { const d = xlDate(v, yh); if (d) dcols.push({ c, d }); });
    let aD = dcols.filter(x => x.c > aC && x.c < pC), pD = dcols.filter(x => x.c > pC);
    if (!aD.length) {   // дат нет — колонка сумм справа от названий (дату возьмём у ОПиУ этого файла)
      const numCol = (from, to) => { for (let c = from + 1; c < to; c++) { let n = 0; for (let rr = r + 1; rr <= Math.min(R, r + 20); rr++) if (cellNum(sh.rows[rr]?.[c]) !== null) n++; if (n >= 3) return c; } return 0; };
      const ac = numCol(aC, pC), pc = numCol(pC, pC + 6); if (!ac) continue;
      aD = [{ c: ac, d: null }]; pD = pc ? [{ c: pc, d: null }] : [];
    }
    return { r, aC, pC, aD, pD, R };
  }
  return null;
}
const REV_RE = /выручк|доход\S* от реализац|^доходы?($|\s|,)|продаж\S* (товар|услуг)|^продажи|^оборот/;
function mgmtPL(sh) {
  for (let r = 1; r <= Math.min(sh.rows.length - 1, 15); r++) {
    const yh = sheetYear(sh), row = sh.rows[r] || [], dc = []; row.forEach((v, c) => { const d = xlDate(v, yh); if (d && d.getDate() === 1) dc.push({ c, d }); });
    if (dc.length >= 3 && sh.rows.slice(r, r + 30).some(x => x && REV_RE.test(lab(x, [1, 2, 3, 4])))) return { r, dc };
  }
  return null;
}
const endOf = d => { const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); return isoD(e.getFullYear(), e.getMonth() + 1, e.getDate()); };
function importMgmt(sheets, fname) {
  const vis = sheets.filter(sh => !sh.hidden), use = vis.length ? vis : sheets;
  const bals = [], pls = [];
  for (const sh of use) { const b = mgmtBal(sh); if (b) bals.push({ sh, b }); else { const p = mgmtPL(sh); if (p) pls.push({ sh, p }); } }
  if (!bals.length && !pls.length) return null;
  const head = normTxt(use.map(sh => sh.rows.slice(0, 4).map(r => (r || []).filter(v => typeof v === "string").join(" ")).join(" ")).join(" "));
  const f = /тыс/.test(head) ? 1 : /млн/.test(head) ? 1000 : 0.001;      // по умолчанию — тенге
  const rep = [], num = v => (typeof v === "number" ? v : parseNum(v) || 0), plPeriods = [];
  // ОПиУ по месяцам → период (с начала года по последний заполненный месяц)
  for (const { sh, p } of pls) {
    const rows = sh.rows, L = {}, sub = {}, mcols = p.dc.map(x => x.c); let sect = null;
    const hasNums = r => mcols.some(c => cellNum(rows[r]?.[c]) !== null);
    for (let r = p.r + 1; r < Math.min(rows.length, p.r + 80); r++) {
      const t = lab(rows[r], [1, 2, 3, 4].filter(c => c < mcols[0]));
      if (/комментари/.test(t)) break;
      const k = /расходы вне бизнес|семейн\S* расход|расходы на семью|личные расходы/.test(t) ? "fam" : /доход\S* вне бизнес|прочие доходы семьи/.test(t) ? "inc" : /взнос\S*\s+(по\s+)?(действующ|текущ)|платеж\S* по (действующ|текущ)/.test(t) ? "pay" : /взнос\S* по предлага|предлагаем\S* кредит|чистый остаток|соотношени/.test(t) ? "skip"
        : REV_RE.test(t) && !/валов|чист/.test(t) ? "rev" : /себестоим/.test(t) ? "cogs" : /валов\S* (прибыль|доход)/.test(t) ? "gp" : /^(итого\s+)?(расходы|затраты)( по бизнес| бизнес|$|,| операцион)|^операционн\S* (расходы|затраты)|^расходы, в т/.test(t) ? "opex" : /прибыль от бизнес|операционн\S* прибыль/.test(t) ? "pb" : /^чистая прибыль|^чистый доход/.test(t) ? "ni" : null;
      if (k) { if (!(k in L)) L[k] = r; sect = ["rev", "cogs", "opex"].includes(k) ? k : null; continue; }
      if (sect && hasNums(r)) { (sub[sect] = sub[sect] || []).push(r); if (sect === "opex" && /закуп|себестоим|покупк\S* товар/.test(t)) L.buy = r; if (sect === "opex" && /амм?ортизац/.test(t)) L.da = r; }
    }
    if (!isNum(L.rev)) continue;
    const cell = (r, c) => N(cellNum(rows[r]?.[c]));
    const mval = (key, c) => { const r = L[key]; if (!isNum(r)) return 0; const v = cellNum(rows[r]?.[c]); if (v !== null && (v !== 0 || !(sub[key] || []).length)) return v; return (sub[key] || []).reduce((x, rr) => x + cell(rr, c), 0); };
    const filled = p.dc.filter(({ c }) => mval("rev", c) || mval("cogs", c) || mval("opex", c));
    if (!filled.length) { rep.push({ err: `${sh.name}: шаблон пустой — суммы по месяцам не заполнены` }); continue; }
    const last = filled[filled.length - 1], months = p.dc.indexOf(last) + 1;
    const cols = p.dc.slice(0, months).map(x => x.c), S = k => cols.reduce((x, c) => x + mval(k, c), 0), Sr = r => isNum(r) ? cols.reduce((x, c) => x + cell(r, c), 0) : 0;
    const date = endOf(new Date(last.d.getFullYear(), last.d.getMonth() + 1, 1));
    const r1 = periodFor(date, months, "P"); if (!r1.p) { rep.push({ err: `${sh.name}: все ${MAX_PER} периода заполнены — удалите лишний` }); continue; }
    const pid = r1.p.id, put = (k, v) => setFv(k, pid, Math.round(v * f * 10) / 10);
    // нет строки «Себестоимость», а закуп товара записан в расходах — переносим закуп в себестоимость
    let cogs = S("cogs"), opex = S("opex"), moved = "";
    if (!isNum(L.cogs) && isNum(L.buy) && Sr(L.buy) > 0) { cogs = Sr(L.buy); opex -= cogs; moved = "; строки «Себестоимость» нет — закуп из расходов перенесён в себестоимость"; }
    put("rev", S("rev")); put("cogs", cogs); put("opex", opex); put("fam", S("fam") - S("inc"));
    if (isNum(L.da)) { const d = Sr(L.da); if (d) put("da", d); }
    setFv("int", pid, null); setFv("cit", pid, null); setFv("oth", pid, null);
    if (isNum(L.ni) && cols.some(c => cellNum(rows[L.ni]?.[c]) !== null)) put("ni_rep", Sr(L.ni));
    let payTxt = "";
    if (isNum(L.pay)) { const pm = S("pay") / months * f; if (pm > 0) { if (!isNum(X.card.payExist)) { X.card.payExist = Math.round(pm * 10) / 10; payTxt = `; взнос по действующим кредитам ~${fmt(pm)} тыс. тг/мес. — перенесён в «Карточку»`; } else payTxt = `; взнос по кредитам в файле ~${fmt(pm)} тыс. тг/мес. (в «Карточке» оставлено ${fmt(X.card.payExist)})`; } }
    plPeriods.push(r1.p);
    rep.push({ ok: true, kind: "P", txt: `Управленческая ОПиУ (${sh.name}): ${months} мес. по ${last.d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })} → период «${perLabel(r1.p)}»${r1.created ? " (добавлен)" : ""}${moved}; расходы на семью — отдельной строкой${payTxt}. Суммы переведены в тыс. тг.` });
  }
  // баланс на даты (01.01.2026 = на конец 2025 года)
  for (const { sh, b } of bals) {
    const rows = sh.rows;
    for (const col of b.aD) {
      let date = col.d ? endOf(col.d) : (plPeriods[0] ? plPeriods[0].date : null);
      if (!date) { rep.push({ err: `${sh.name}: в балансе нет даты — укажите дату в шапке колонки (например, 01.10.2026)` }); continue; }
      const pcol = b.pD.find(x => +x.d === +col.d) || (b.pD.length === 1 && b.aD.length === 1 ? b.pD[0] : null);
      const A = {}, P = {}; let ta = null, short = true, any = false;
      for (let r = b.r + 1; r <= b.R; r++) {
        const at = lab(rows[r], [b.aC]), av = cellNum(rows[r]?.[col.c]);
        if (at && av !== null) {
          if (av) any = true;
          if (/валюта баланса|итого актив/.test(at)) ta = av;
          else if (!/итого/.test(at)) { const k = /касс|расчетн|сбережен|деньг|депозит/.test(at) ? "cash" : /дебитор/.test(at) ? "ar" : /тмз|товар|запас|сырь/.test(at) ? "inv" : /оборудован|транспорт|недвиж|нематер|инвестиц|основн|земл/.test(at) ? "fa" : "oca"; A[k] = (A[k] || 0) + av; }
        }
        const pt = lab(rows[r], [b.pC]), pv = pcol ? cellNum(rows[r]?.[pcol.c]) : null;
        if (pt && pv !== null) {
          if (pv) any = true;
          if (/итого краткоср/.test(pt)) { short = false; continue; }
          if (/итого|валюта/.test(pt)) continue;
          const k = /собственн\S*\s+капитал|^капитал/.test(pt) ? "eqd" : /уставн/.test(pt) ? "sc" : /нераспред/.test(pt) ? "re" : /товарн/.test(pt) ? "ap" : /кредит\S* банк|займ/.test(pt) ? (short ? "debt_st" : "debt_lt") : /кред\S*\s+зад/.test(pt) ? (short ? "ap" : "ol") : "ol";
          P[k] = (P[k] || 0) + pv;
        }
      }
      if (!any) continue;
      // баланс на начало месяца сразу после конца ОПиУ этого же файла (или за месяц до) — в тот же период
      const near = plPeriods.find(pp => Math.abs(new Date(pp.date) - new Date(date)) <= 32 * 864e5);
      let r1;
      if (near) r1 = { p: near, created: false }; else r1 = periodFor(date, null, "B");
      if (!r1.p) { rep.push({ err: `${sh.name}: все ${MAX_PER} периода заполнены — удалите лишний` }); continue; }
      const pid = r1.p.id, put = (k, v) => setFv(k, pid, Math.round(v * f * 10) / 10);
      for (const k of ["cash", "ar", "inv", "oca", "fa"]) put(k, A[k] || 0);
      for (const k of ["ap", "debt_st", "debt_lt", "ol"]) put(k, P[k] || 0);
      const assets = ["cash", "ar", "inv", "oca", "fa"].reduce((x, k) => x + (A[k] || 0), 0), liab = ["ap", "debt_st", "debt_lt", "ol"].reduce((x, k) => x + (P[k] || 0), 0);
      const eq = isNum(P.eqd) ? P.eqd : isNum(P.re) ? N(P.sc) + P.re : assets - liab;   // нераспределённая прибыль в шаблоне — формула-остаток
      put("eq", eq); if (isNum(P.re)) put("re", P.re);
      if (isNum(ta)) put("ta_rep", ta);
      rep.push({ ok: true, kind: "B", txt: `Управленческий баланс (${sh.name}) на ${date.split("-").reverse().join(".")} → период «${perLabel(r1.p)}»${r1.created ? " (добавлен)" : ""}${near && near.date !== date ? " (вместе с ОПиУ этого файла)" : ""}. Суммы переведены в тыс. тг.` });
    }
  }
  if (rep.some(x => x.ok)) X.mgmt = true;
  if (!rep.length) rep.push({ err: "это шаблон управленческой отчётности, но он не заполнен" });
  else X.files.unshift({ name: fname, t: Date.now(), what: "Управленческая отчётность", per: "" });
  return rep;
}
const FINKEYS_DECL = ["rev", "vat_turn", "vat_ex", "fot", "cit"];
/* один файл: финансовая отчётность (баланс/ОПиУ/ДДС) или налоговая декларация — определяется само */
async function importFile(file, pid, units, onProg) {
  if (!/\.(xlsx|xlsm|xls|pdf|jpe?g|png)$/i.test(file.name)) return [{ err: "формат не подходит — нужен Excel (.xlsx, .xls), PDF или фото (JPG, PNG)" }];
  let r; try { r = await readAnyFile(file, onProg); } catch (e) { return [{ err: "не удалось прочитать: " + e.message }]; }
  // управленческая отчётность (шаблон без кодов строк)?
  if (!r.pdf) { const mg = importMgmt(r.sheets, file.name); if (mg) return mg; }
  // налоговая декларация?
  let dres = null;
  try { dres = r.pdf ? (DocParse.isDecl(r.pdf) >= 3 ? { kind: "decl", decl: DocParse.parseDecl(r.pdf) } : null) : null; } catch (e) { dres = null; }
  // финансовые формы
  const parsed = []; let lastKind = null; const used = [];
  for (const sh of r.sheets) {
    if (sh.hidden && r.sheets.length > 1) continue;
    let kind = detectKind(sh);
    if (kind === "X") { lastKind = null; continue; }
    if (!kind && lastKind) { const mc = mapCodes(lastKind); let n = 0; for (const row of sh.rows) if (row) for (const v of row) if (mc.has(normCode(v))) n++; if (n >= 3) kind = lastKind; }
    if (!kind) continue;
    lastKind = kind;
    const f = parseForm(sh, kind);
    const same = parsed.find(p => p.kind === kind);
    if (same) { if (!f.err) { mergeForms(same.f, f); same.sheets.push(sh); } continue; }
    if (f.err) continue;
    used.push(sh); parsed.push({ kind, f, sheets: [sh] });
  }
  if (!parsed.length && !dres && !r.pdf) {
    try { const d = DocParse.readSheets(r.sheets); if (d.kind === "decl") dres = d; } catch (e) { /* не декларация */ }
  }
  const scanNote = r.ocr ? ` Распознано со скана (качество ~${Math.round(r.ocr.conf)} %) — сверьте цифры с документом.` : "";
  if (dres && dres.decl && (!parsed.length || (dres.decl.lines || []).length >= 10)) { const x = addDecl(dres.decl, file.name); x.txt += scanNote; return [x]; }
  if (!parsed.length) return [{ err: r.ocr ? `скан распознан (качество ~${Math.round(r.ocr.conf)} %), но баланс, ОПиУ или декларацию в нём найти не удалось — нужны видимые коды строк. Попробуйте скан получше (300 dpi, ровно) или введите цифры вручную` : "не нашёл ни баланса, ни ОПиУ, ни ДДС, ни декларации. Нужна стандартная форма с кодами строк — или введите цифры вручную" }];
  // единицы
  const mx = Math.max(...parsed.map(p => p.f.max));
  let factor, why;
  if (units && units !== "auto") { factor = { t: 0.001, k: 1, m: 1000 }[units]; why = "как указано при загрузке"; }
  else [factor, why] = autoFactor(mx, unitHints(used));
  const rep = []; let lastCur = null;
  // период формы: по дате в шапке; у соседних форм файла (без своей даты) — тот же; если указан вручную — он
  const det = parsed.map(x => pid ? null : detectPeriod(x.sheets, x.kind));
  const common = pid ? null : (det.find(Boolean) || detectPeriod(r.sheets, "P"));
  if (!pid && !common) return [{ ask: true, txt: `${parsed.map(x => KIND_TXT[x.kind]).join(" и ")}: в документе не нашёл отчётную дату. В какой период загрузить?` }];
  for (let j = 0; j < parsed.length; j++) {
    const { kind, f } = parsed[j], dp = det[j] || (common ? { ...common, how: common.how + " (из этого же файла)" } : null);
    let cur, prev = null, how;
    if (dp) {
      const r1 = periodFor(dp.date, dp.months, kind); cur = r1.p; how = `период — по документу: ${dp.how}${r1.created ? ", период добавлен" : ""}`;
      if (!cur) { rep.push({ err: `${KIND_TXT[kind]}: в документе период ${dp.how}, но периодов уже ${MAX_PER} и все заполнены — удалите лишний период и загрузите снова` }); continue; }
      // колонка «на начало» (баланс) / «за предыдущий год» (годовая ОПиУ, ДДС) — конец прошлого года
      const y = +cur.date.slice(0, 4) - 1;
      if (f.hasPrev && (kind === "B" || N(cur.months) === 12)) { const r2 = periodFor(`${y}-12-31`, 12, kind); prev = r2.p; }
    } else {
      cur = X.per[perIdx(pid)]; how = "период выбран вручную";
      const i = perIdx(cur.id); prev = i > 0 && kind === "B" ? X.per[i - 1] : null;
    }
    lastCur = cur;
    const prof = chooseProfile(f, kind);
    const cols = [[0, cur]]; if (prev && f.hasPrev) cols.push([1, prev]);
    let n = 0, nPrev = 0;
    for (const [w, p] of cols) {
      const lines = formToLines(kind, f, prof, w);
      for (const [key, v] of Object.entries(lines)) {
        if (w === 1 && isNum(fv(key, p.id))) continue;     // не затираем то, что уже есть
        setFv(key, p.id, Math.round(v * factor * 10) / 10);
        if (w === 0) n++; else nPrev++;
      }
    }
    const uTxt = factor < 0.5 ? "в файле тенге — переведено в тыс. тг" : factor > 2 ? "в файле млн тг — переведено в тыс. тг" : "в файле тыс. тг";
    rep.push({ ok: true, kind, txt: `${KIND_TXT[kind]}: ${n} строк за ${perLabel(cur)}${nPrev ? `, ${nPrev} — за ${perLabel(prev)}` : ""}; ${how}. ${uTxt} (${why}).${scanNote}` });
  }
  if (lastCur) X.files.unshift({ name: file.name, t: Date.now(), what: rep.filter(x => x.kind).map(x => KIND_TXT[x.kind]).join(", "), per: perLabel(lastCur) });
  return rep;
}
function addDecl(d, fname) {
  const keys = DocParse.pickKeys(d, {}), vals = {};
  for (const [key, code] of Object.entries(keys)) { const l = d.lines.find(x => x.code === code); if (l && l.vals.length) vals[key] = l.vals[0]; }
  const o = { id: uid(), file: fname, form: d.form, formName: d.formName, year: d.year, part: d.part, vals };
  // та же декларация повторно — заменяем
  X.decl = X.decl.filter(x => !(x.form === o.form && x.year === o.year && x.part === o.part));
  X.decl.push(o);
  X.files.unshift({ name: fname, t: Date.now(), what: "Декларация " + (d.formName || ""), per: String(d.year || "") });
  const r = vals.rev ?? vals.vat_turn;
  return { ok: true, kind: "D", txt: `${d.formName || "Декларация"} за ${d.year || "год не определён"}${PART_TXT[d.part] ? ", " + PART_TXT[d.part] : ""}${isNum(r) ? ": доход " + fmt(r / 1000) + " тыс. тг" : ": доход не найден — введите вручную"}.` };
}
const PART_TXT = { Y: "год", H1: "1 полугодие", H2: "2 полугодие", Q1: "1 квартал", Q2: "2 квартал", Q3: "3 квартал", Q4: "4 квартал" };
