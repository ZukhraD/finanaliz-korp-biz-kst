"use strict";
/* ================================================================ Экспресс-анализ: события, пример, запуск */
const NUMF = new Set(["payExist", "amount", "term", "rate", "grace", "guarPct", "balance", "pay", "value", "disc", "months", "year", "rev", "vat_turn"]);
// подтверждение внутри страницы (системные окна в некоторых браузерах и превью заблокированы)
function ask(msg, yes = "Да", no = "Отмена") {
  return new Promise(res => {
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true"><h3>Подтвердите</h3><p>${esc(msg)}</p><div class="row"><button class="btn" data-q="0">${esc(no)}</button><button class="btn primary" data-q="1">${esc(yes)}</button></div></div>`;
    m.addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (!b && e.target !== m) return; e.stopPropagation(); m.remove(); res(!!(b && b.dataset.q === "1")); });
    document.body.appendChild(m); m.querySelector('[data-q="1"]').focus();
  });
}
function openClient(c, page = "card") { X = c; PAGE = page; UPL = { pid: null, units: "auto", log: [], files: {} }; OD_LOG = []; OD_SHOW = "ex"; OD_OPEN = false; renderClient(); window.scrollTo(0, 0); }

function onChange(el) {
  const k = el.dataset.k; if (!k) return false;
  const parts = k.split("."), raw = el.type === "checkbox" ? el.checked : el.value;
  const nval = () => { const v = parseNum(raw); return isNum(v) && PCT_KEYS.test(k) ? Math.round(v * 100) / 100 : v; };   // проценты и курс — до сотых
  if (parts[0] === "c") { const f = parts[1]; X.card[f] = NUMF.has(f) ? nval() : raw; }
  else if (parts[0] === "a") {
    const [, arr, i, f] = parts, o = X.card[arr][+i];
    if (f === "refin") o.refin = !!raw;
    else o[f] = NUMF.has(f) ? nval() : raw;
    if (arr === "coll" && f === "type") o.disc = COLL[raw] ?? o.disc;
  }
  else if (parts[0] === "f") { setFv(parts[1], parts[2], nval()); }
  else if (parts[0] === "od") { const o = odCfg(), f = parts[1]; o[f] = ["exp", "buyers", "topShare", "otherBanks"].includes(f) ? nval() : f === "tranche" ? +raw : raw; }
  else if (parts[0] === "ost") { const x = odCfg().st[+parts[1]]; if (parts[2] === "rate") x.rate = nval(); else x[parts[2]] = raw; }
  else if (parts[0] === "otx") { const t = odCfg().st[+parts[1]].txs[+parts[2]]; delete t.ov; const auto = odCat(t, odOwn(odCfg())) || "inc"; if (raw !== auto) t.ov = raw; }
  else if (parts[0] === "odm") { const o = odCfg(), ym = parts[1]; o.m[ym] = o.m[ym] || {}; const v = nval(); if (isNum(v)) o.m[ym][parts[2]] = v; else delete o.m[ym][parts[2]]; }
  else if (parts[0] === "p") { const p = X.per[+parts[1]]; if (parts[2] === "months") { const v = nval(); p.months = isNum(v) && v >= 1 && v <= 12 ? Math.round(v) : 12; } else p.date = raw; }
  else if (parts[0] === "d") {
    const d = X.decl[+parts[1]], f = parts[2];
    if (f === "rev" || f === "vat_turn") { const v = nval(); d.vals = d.vals || {}; if (isNum(v)) d.vals[f] = v * 1000; else delete d.vals[f]; }
    else if (f === "year") d.year = nval();
    else { d[f] = raw; if (f === "form") d.formName = { "100": "КПН (ф. 100.00)", "910": "Упрощённая декларация (ф. 910.00)", "300": "НДС (ф. 300.00)", "200": "ИПН и социальный налог (ф. 200.00)", "220": "ИПН (ф. 220.00)" }[raw] || raw; }
  }
  touch(); return true;
}
async function handleStmts(files) {
  if (!files || !files.length) return;
  const where = odCfg().stWhere || "our";
  for (const f of files) {
    toast(`Читаю выписку ${f.name}…`);
    let r; try { r = await odImportStmt(f, where, (i, n) => toast(`Распознаю скан: страница ${i} из ${n}…`)); } catch (e) { r = { err: "ошибка разбора: " + e.message }; }
    OD_LOG.unshift({ file: f.name, ...r });
  }
  OD_LOG = OD_LOG.slice(0, 10);
  touch(); saveAll(true); rerender(); toast("Выписки разобраны — проверьте исключения");
}
async function handleFiles(files) {
  if (!files || !files.length) return;
  toast("Читаю файлы…");
  for (const f of files) {
    let rep;
    UPL.files = UPL.files || {}; UPL.files[f.name] = f;
    try { rep = await importFile(f, null, UPL.units, (i, n) => toast(`Распознаю скан «${f.name}»: страница ${i} из ${n}…`)); } catch (e) { rep = [{ err: "ошибка разбора: " + e.message }]; }
    for (const r of rep) UPL.log.unshift({ file: f.name, ...r });
  }
  UPL.log = UPL.log.slice(0, 12);
  // периоды без единой цифры (например, заготовки «2024», «2025») убираем, если данные легли в другие
  const hasData = p => Object.keys(X.fin).some(k => isNum(X.fin[k][p.id]));
  if (X.per.some(hasData) && X.per.length > 1) X.per = X.per.filter(hasData);
  touch(); saveAll(true); rerender();
  toast(UPL.log.some(r => r.ask) ? "Для документа без даты выберите период" : "Готово — проверьте цифры в таблицах");
}

document.addEventListener("click", async e => {
  if (e.target.closest(".modal")) return;
  const t = e.target.closest("button, [data-open], .citem"); if (!t) return;
  const d = t.dataset;
  if (d.del) { e.stopPropagation(); const c = CLIENTS.find(x => x.id === d.del); if (c && await ask(`Удалить клиента «${c.card.name || "без названия"}»? Это нельзя отменить.`, "Удалить")) { CLIENTS = CLIENTS.filter(x => x.id !== d.del); saveAll(true); renderHome(); } return; }
  if (d.open) { const c = CLIENTS.find(x => x.id === d.open); if (c) openClient(c, c.demo ? "an" : "card"); return; }
  if (d.page) { PAGE = d.page; renderClient(); window.scrollTo(0, 0); return; }
  if (d.add) { const arr = X.card[d.add] = X.card[d.add] || []; arr.push(d.add === "loans" ? { bank: "", kind: "Кредит", balance: null, pay: null, end: "", overdue: "no", refin: false } : d.add === "coll" ? { type: "Недвижимость коммерческая", desc: "", owner: "", value: null, disc: COLL["Недвижимость коммерческая"] } : { name: "", type: "Физическое лицо", rel: "", note: "" }); touch(); rerender(); return; }
  if (d.rm) { const [arr, i] = d.rm.split("."); X.card[arr].splice(+i, 1); touch(); rerender(); return; }
  if (d.rmper !== undefined) { const i = +d.rmper, p = X.per[i]; if (!(await ask(`Удалить период «${perLabel(p)}» и все его цифры?`, "Удалить"))) return; for (const k of Object.keys(X.fin)) delete X.fin[k][p.id]; X.per.splice(i, 1); touch(); rerender(); return; }
  if (d.loadto) {
    const [li, pid] = d.loadto.split("|"), r = UPL.log[+li], f = r && UPL.files && UPL.files[r.file]; if (!f) return;
    toast("Загружаю…");
    let rep; try { rep = await importFile(f, pid, UPL.units); } catch (e) { rep = [{ err: "ошибка разбора: " + e.message }]; }
    UPL.log.splice(+li, 1, ...rep.map(x => ({ file: f.name, ...x })));
    touch(); saveAll(true); rerender(); return;
  }
  if (d.rmst !== undefined) { if (!(await ask("Удалить выписку из расчёта?", "Удалить"))) return; odCfg().st.splice(+d.rmst, 1); touch(); rerender(); return; }
  if (d.odshow) { OD_SHOW = d.odshow; OD_OPEN = true; rerender(); return; }
  if (d.rmdecl !== undefined) { X.decl.splice(+d.rmdecl, 1); touch(); rerender(); return; }
  switch (d.act) {
    case "new": { const c = newClient(); CLIENTS.push(c); saveAll(true); openClient(c); break; }
    case "demo": { let c = CLIENTS.find(x => x.demo); if (!c) { c = demoClient(); CLIENTS.push(c); saveAll(true); } openClient(c, "card"); toast("Это вымышленная компания — можно менять цифры и смотреть, как меняется вывод"); break; }
    case "openfile": $("#ofile").click(); break;
    case "home": saveAll(true); renderHome(); window.scrollTo(0, 0); break;
    case "save": download(`Экспресс_${(X.card.name || "клиент").replace(/[^\wА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі -]+/g, "").trim() || "клиент"}_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "finkz-express", v: 1, client: X }, null, 1)); toast("Файл сохранён в «Загрузки»"); break;
    case "addper": { if (X.per.length >= MAX_PER) break; const last = X.per[X.per.length - 1], y = last && last.date ? +last.date.slice(0, 4) + 1 : new Date().getFullYear(); X.per.push({ id: uid(), date: `${y}-${N(last?.months) === 12 ? "09-30" : "12-31"}`, months: N(last?.months) === 12 ? 9 : 12 }); touch(); rerender(); break; }
    case "pick": $("#ufile").click(); break;
    case "pickst": $("#stfile").click(); break;
    case "adddecl": X.decl.push({ id: uid(), file: "", form: "100", formName: "КПН (ф. 100.00)", year: new Date().getFullYear() - 1, part: "Y", vals: {} }); touch(); rerender(); break;
    case "copy": { const txt = docText(buildConclusion(problems(), verdict(problems()))); try { await navigator.clipboard.writeText(txt); toast("Текст заключения скопирован"); } catch (err) { const r = document.createRange(); r.selectNodeContents($(".doc")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Текст выделен — нажмите Ctrl+C"); } break; }
    case "print": window.print(); break;
    case "share": { const txt = docText(buildConclusion(problems(), verdict(problems()))); try { await navigator.share({ title: "Экспресс-анализ: " + (X.card.name || "клиент"), text: txt }); } catch (err) { /* отменено */ } break; }
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "ofile") { const f = el.files[0]; if (!f) return; f.text().then(txt => { try { const o = JSON.parse(txt), c = o.client || o; if (!c.card || !c.per) throw new Error(); c.id = uid(); c.demo = false; CLIENTS.push(c); saveAll(true); openClient(c); toast("Клиент открыт из файла"); } catch (err) { toast("Это не файл экспресс-анализа"); } }); return; }
  if (el.id === "ufile") { handleFiles([...el.files]); el.value = ""; return; }
  if (el.id === "stfile") { handleStmts([...el.files]); el.value = ""; return; }
  if (el.dataset.upl) { UPL[el.dataset.upl] = el.value; return; }
  if (onChange(el)) { PENDING = true; if (!PD) setTimeout(flush, 0); }
});
function flush() { if (PENDING && X && !PD) { PENDING = false; rerender(); } }
// если поле теряет фокус из-за нажатия кнопки — перерисовываем после клика, чтобы клик не потерялся
let PD = false, PENDING = false;
document.addEventListener("pointerdown", () => { PD = true; }, true);
document.addEventListener("pointerup", () => { PD = false; setTimeout(flush, 0); }, true);
document.addEventListener("input", e => { if (e.target.matches && e.target.matches("input.num")) negInput(e.target); });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("input.inp")) e.target.blur(); });
document.addEventListener("focusin", e => { if (e.target.matches("input.num")) { const v = parseNum(e.target.value); if (isNum(v)) e.target.value = String(Math.round(v * 100) / 100).replace(".", ","); e.target.select(); } });
document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches("details.ops")) OD_OPEN = e.target.open; }, true);
document.addEventListener("dragover", e => { const d = e.target.closest?.("#drop, #sdrop"); if (d) { e.preventDefault(); d.classList.add("on"); } });
document.addEventListener("dragleave", e => { const d = e.target.closest?.("#drop, #sdrop"); if (d) d.classList.remove("on"); });
document.addEventListener("drop", e => { const d = e.target.closest?.("#drop, #sdrop"); if (!d) return; e.preventDefault(); d.classList.remove("on"); (d.id === "sdrop" ? handleStmts : handleFiles)([...e.dataTransfer.files]); });
window.addEventListener("beforeunload", () => saveAll(true));

/* ---------------------------------------------------------------- пример: вымышленная компания */
function demoClient() {
  const c = newClient(), y = new Date().getFullYear();
  c.demo = true;
  c.per = [{ id: "p1", date: `${y - 2}-12-31`, months: 12 }, { id: "p2", date: `${y - 1}-12-31`, months: 12 }];
  Object.assign(c.card, {
    name: "ТОО «Пример-Трейд» (вымышленная компания)",
    product: "Кредит", purpose: "Пополнение оборотных средств",
    amount: 40000, term: 36, rate: 19.5, sched: "ann", grace: 0, payExist: 2520,
  });
  // данные для овердрафта (если в примере выбрать продукт «Овердрафт»)
  const od = odCfg(c.card); od.appMonth = ymNow(); od.exp = 120; od.buyers = 14; od.topShare = 22; od.otherBanks = 1;
  const ours = [31200, 28700, 34500, 36100, 29800, 33400], others = [9800, 11200, 10400, 12100, 9300, 10900];
  odWindow(od).forEach((ym, i) => { od.m[ym] = { our: ours[i], other: others[i] }; });
  const F = {
    cash: [18400, 22700], ar: [61300, 92400], inv: [88700, 96200], oca: [7900, 8400], fa: [54600, 69260],
    ap: [52100, 63800], debt_st: [38000, 46000], debt_lt: [42500, 49300], ol: [9800, 10560], eq: [88500, 119300], re: [78500, 109300],
    ta_rep: [230900, 288960],
    rev: [412500, 468900], cogs: [331000, 365000], opex: [46200, 52700], oth: [-1200, -900], int: [9400, 11800], cit: [4940, 7700],
    ni_rep: [19760, 30800], da: [6800, 7400],
    ocf: [null, 21300], cf_in: [null, 60000], cf_out: [null, 52700],
  };
  for (const [k, [a, b]] of Object.entries(F)) { c.fin[k] = {}; if (isNum(a)) c.fin[k].p1 = a; if (isNum(b)) c.fin[k].p2 = b; }
  c.decl = [
    { id: uid(), file: "пример", form: "100", formName: "КПН (ф. 100.00)", year: y - 2, part: "Y", vals: { rev: 412500000 } },
    { id: uid(), file: "пример", form: "100", formName: "КПН (ф. 100.00)", year: y - 1, part: "Y", vals: { rev: 401700000 } },
  ];
  return c;
}

// поворот экрана или изменение окна — перестраиваем интерфейс под устройство
let RZ = 0;
window.addEventListener("resize", () => { clearTimeout(RZ); RZ = setTimeout(() => { if (!applyDevice()) return; const a = document.activeElement; if (a && a.matches && a.matches("input, textarea, select")) return; X ? rerender() : renderHome(); }, 200); });
renderHome();
