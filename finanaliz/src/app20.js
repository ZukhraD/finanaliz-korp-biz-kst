"use strict";
/* ---------------------------------------------------------------- Передача из Экспресс-анализа и «Паспорт данных» для Кредитной фабрики */
// Экспресс → Финансовый анализ: ключ строки экспресса → ключ(и) основного сайта (значения в тыс. тг, как и там)
function pickupHandoff() {
  if (LOCK.on && !LOCK.key) return;   // сначала ПИН-код
  const HANDOFF_KEY = "finkz.handoff.v1";
  const HANDOFF_MAP = { cash: "cash", ar: "ar", inv: "inv", oca: "oca", fa: "ppe", ap: "ap", debt_st: "stloan", debt_lt: "ltloan", ol: "ocl", rev: "rev", cogs: "cogs", opex: "admin", int: "int", cit: "cit", da: "da", ni_rep: "ni_rep" };
  let raw = null; try { raw = localStorage.getItem(HANDOFF_KEY); } catch (e) { return; }
  if (!raw) return;
  try { localStorage.removeItem(HANDOFF_KEY); } catch (e) { /* не страшно */ }
  let h; try { h = JSON.parse(raw); } catch (e) { return; }
  if (!h || h.v !== 1 || !h.card || (Date.now() - (h.t || 0)) > 36e5) return;   // старше часа не берём
  const k = h.card, c = newClient(k.name || "Клиент из Экспресса");
  if (S.lists.product.includes(k.product)) c.card.product = k.product;
  if (S.lists.fpurpose.includes(k.purpose)) c.card.purpose = k.purpose;
  if (k.fintype === "ВКЛ" || k.fintype === "НКЛ") c.card.fintype = k.fintype;
  if (isNum(k.amount)) c.card.amount = k.amount;
  c.fc = JSON.parse(JSON.stringify(S.fc_default));
  const R = c.fc.req;
  if (isNum(k.amount)) R.amt = k.amount;
  if (isNum(k.term)) R.term = k.term;
  if (isNum(k.rate)) R.rate = k.rate / 100;
  if (isNum(k.grace)) R.grace = k.grace;
  R.scheme = { ann: "Аннуитет", diff: "Дифференцированный", end: "В конце срока" }[k.sched] || R.scheme;
  const per = Array.isArray(h.per) ? h.per.filter(p => p && p.id && p.date) : [];
  if (per.length) c.periods = per.map(p => { const y = p.date.slice(0, 4), m = isNum(p.months) ? p.months : 12; const full = m === 12 && p.date.slice(5, 7) === "12"; return { id: p.id, label: full ? y : `${m} мес. ${y}`, date: p.date, basis: full ? "Годовой" : "Нарастающим итогом", months: m }; });
  const d = (c.data["1"] = c.data["1"] || {}), put = (key, pid, v) => { (d[key] = d[key] || {})[pid] = v; };
  let cells = 0;
  for (const p of c.periods) {
    const g = key => { const v = h.fin?.[key]?.[p.id]; return isNum(v) ? v : null; };
    for (const [ek, fk] of Object.entries(HANDOFF_MAP)) { const v = g(ek); if (v !== null) { put(fk, p.id, v); cells++; } }
    const eq = g("eq"), re = g("re"), oth = g("oth");
    if (eq !== null) { if (re !== null) { put("re", p.id, re); put("sc", p.id, eq - re); cells += 2; } else { put("sc", p.id, eq); cells++; } }
    // итоги баланса считаются только при заполненных статьях: недостающие из Экспресса принимаем за 0
    const hasBal = ["cash", "ar", "inv", "oca", "ppe", "ap", "stloan", "ltloan", "ocl"].some(x => d[x] && isNum(d[x][p.id]));
    if (hasBal) for (const x of ["cash", "stinv", "ar", "oar", "inv", "taxa", "oca", "ppe", "intang", "ltinv", "olta", "stloan", "cpltd", "ap", "adv", "taxl", "ocl", "ltloan", "lease", "oltl", "sc", "re", "oeq"]) if (!(d[x] && isNum(d[x][p.id]))) put(x, p.id, 0);
    if (oth !== null) { if (oth >= 0) put("ooi", p.id, oth); else put("ooe", p.id, -oth); cells++; }
  }
  c.log.unshift({ t: new Date().toISOString(), file: "Экспресс-анализ", comp: "", per: "", kind: "Передача", note: `перенесены карточка и ${cells} значений отчётности; декларации, выписки и кредитный отчёт загрузите заново` });
  CLIENTS.push(c); C = c; PAGE = "card"; saveAll(true);
  setTimeout(() => toast(tr("Клиент передан из Экспресс-анализа: проверьте карточку, загрузите выписки, декларации и кредитный отчёт")), 300);
}
/* Паспорт данных: короткая таблица ключевых цифр для ручного ввода в Кредитную фабрику (CSV, открывается в Excel) */
function passportRows() {
  ensureDocs(); ensureCredit();
  const obj = C.obj, L = lastPid(), P = prevPid(L), c = C.card, pers = C.periods, lab = p => pers[perIdx(p)]?.label || "";
  const rq = reqPay(), cv = collCover(), b = forecast(obj, 0), s = forecast(obj, 1), rs = riskSummary(obj);
  const R = [["Раздел", "Показатель", "Значение", "Единица"]], add = (a, b2, v, u = "") => R.push([a, b2, v === null || v === undefined || (typeof v === "number" && !isFinite(v)) ? "" : v, u]);
  add("Клиент", "Наименование", c.name); add("Клиент", "БИН", c.bin || ""); add("Клиент", "Вид деятельности", c.activity || ""); add("Клиент", "Объект анализа", objName(obj));
  add("Запрос", "Продукт", c.product); add("Запрос", "Тип финансирования", c.fintype || ""); add("Запрос", "Цель", c.purpose || ""); add("Запрос", "Сумма", isNum(c.amount) ? c.amount : null, "тыс. тг");
  if (rq) { add("Запрос", "Срок", rq.term, "мес."); add("Запрос", "Ставка", C.fc?.req?.rate !== undefined ? C.fc.req.rate * 100 : null, "% годовых"); add("Запрос", "Первый платёж", Math.round(rq.first), "тыс. тг/мес."); add("Запрос", "Платежи за год", Math.round(rq.year), "тыс. тг"); }
  const lines = [["Выручка", "rev", false, "тыс. тг"], ["Чистая прибыль", "ni", false, "тыс. тг"], ["Итого активы", "ta", false, "тыс. тг"], ["Капитал", "eq", false, "тыс. тг"], ["EBITDA (годовая)", "ebitda_ann", true, "тыс. тг"], ["Общий долг", "debt", true, "тыс. тг"],
    ["Текущая ликвидность", "liq_cur", true, "раз"], ["Долг / EBITDA", "debt_ebitda", true, "раз"], ["Коэффициент автономии", "eq_ratio", true, "раз"], ["Покрытие процентов (EBIT)", "icr", true, "раз"], ["DSCR (история)", "dscr_hist", true, "раз"]];
  for (const [t, key, isR, u] of lines) for (const p of [P, L]) if (p) { const v = isR ? ratio(obj, key, p) : val(obj, key, p); add("Финансы, " + lab(p), t, isNum(v) ? Math.round(v * 100) / 100 : null, u); }
  if (!b.err) { add("Прогноз", "DSCR с новым кредитом, база", Math.round(N(b.dscr_h_post) * 100) / 100, "раз"); add("Прогноз", "DSCR с новым кредитом, стресс", Math.round(N(s.dscr_h_post) * 100) / 100, "раз"); }
  if (cv) { add("Обеспечение", "Залоговая стоимость", Math.round(cv.coll), "тыс. тг"); add("Обеспечение", "Покрытие запроса", isNum(cv.cover) ? Math.round(cv.cover * 1000) / 10 : null, "%"); add("Обеспечение", "LTV", isNum(cv.ltv) ? Math.round(cv.ltv * 1000) / 10 : null, "%"); }
  add("Итог", "Автоиндикатор рисков", rs.ind[1]); add("Итог", "Рекомендация кредитного менеджера", C.concl.decision || ""); add("Итог", "Статус заключения", C.concl.status || "");
  for (const [n, st, nt] of govRows()) add("Госпрограммы", n, st + (nt ? "; " + nt : ""));
  add("Служебно", "Сформировано", `${siteVer()}, ${new Date().toLocaleDateString("ru-RU")}`); add("Служебно", "Нормативы", ratnId().replace("нормативы: ", ""));
  return R;
}
function exportPassport() {
  try {
    const q = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = "﻿" + passportRows().map(r => r.map(q).join(";")).join("\r\n");
    download(`Паспорт_данных_${safeName(C.card.name)}.csv`, csv, "text/csv");
    toast(tr("Паспорт данных сохранён: цифры можно вносить в модули Кредитной фабрики"));
  } catch (e) { toast("Не удалось собрать паспорт: " + e.message); }
}

window.__finReady = true;
{ const had = !!C; pickupHandoff(); if (C && !had) render(); }   // все файлы загружены: можно принять клиента из Экспресса

/* ---------------------------------------------------------------- Режим проверки (для Блока андеррайтинга и Департамента безопасности):
   клиент открывается только для просмотра, ничего не сохраняется, замечания выгружаются отдельным файлом */
const REVIEW = { on: false, notes: [] };
{
  const _save = saveAll, _render = render;
  saveAll = function (now) { if (REVIEW.on) return; return _save(now); };
  const lockUi = () => {
    if (!REVIEW.on) return;
    document.querySelectorAll("input,select,textarea").forEach(el => { if (!el.closest("#rvPanel") && el.type !== "button") el.disabled = true; });
    document.querySelectorAll("[data-act]").forEach(el => { if (!/^(word|print|passport|aipdf|review)$/.test(el.dataset.act)) el.disabled = true; });
  };
  render = function () { const r = _render.apply(this, arguments); mount(); lockUi(); return r; };
  const css = document.createElement("style");
  css.textContent = `#rvBtn{position:fixed;right:16px;bottom:16px;z-index:50;font:700 13px Roboto,Arial,sans-serif;padding:10px 16px;border-radius:999px;border:0;background:#272727;color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  #rvBtn.on{background:#00BB00;color:#272727}
  #rvBar{position:fixed;left:0;right:0;top:0;z-index:60;background:#023DFF;color:#fff;font:13px Roboto,Arial,sans-serif;padding:6px 14px;text-align:center}
  #rvPanel{position:fixed;right:16px;bottom:64px;z-index:55;width:340px;max-width:calc(100vw - 32px);max-height:60vh;overflow:auto;background:#fff;border:2px solid #023DFF;border-radius:16px 16px 16px 0;padding:14px;font:13px Roboto,Arial,sans-serif;color:#272727;box-shadow:0 8px 30px rgba(0,0,0,.25)}
  #rvPanel textarea{width:100%;min-height:70px;box-sizing:border-box;margin:6px 0;font:13px Roboto,Arial,sans-serif}
  #rvPanel button{font:700 12px Roboto,Arial,sans-serif;padding:7px 12px;border-radius:999px;border:1px solid #023DFF;background:#fff;color:#023DFF;cursor:pointer;margin-right:6px}
  #rvPanel button.p{background:#023DFF;color:#fff}
  #rvPanel li{margin:6px 0;border-bottom:1px solid #E5E4E2;padding-bottom:4px}
  @media print{#rvBtn,#rvBar,#rvPanel{display:none}}`;
  document.head.appendChild(css);
  const btn = document.createElement("button"); btn.id = "rvBtn"; btn.type = "button"; btn.textContent = "Режим проверки";
  const bar = document.createElement("div"); bar.id = "rvBar"; bar.textContent = "Режим проверки: данные клиента только для просмотра, изменения не сохраняются";
  const mount = () => { document.body.appendChild(btn); if (REVIEW.on) { document.body.appendChild(bar); panel(); } };
  mount();
  const esc2 = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  function panel() {
    let p = document.getElementById("rvPanel");
    if (!REVIEW.on) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement("div"); p.id = "rvPanel"; document.body.appendChild(p); }
    const keep = p.querySelector("#rvTxt")?.value || "";
    p.innerHTML = `<b>Замечания по клиенту${C ? ": " + esc2(C.card.name || "") : ""}</b>
      <textarea id="rvTxt" placeholder="Раздел и замечание (без лишних персональных данных)"></textarea>
      <button class="p" id="rvAdd" type="button">Добавить</button><button id="rvExp" type="button">Выгрузить (.txt)</button>
      <ol>${REVIEW.notes.map(n => `<li>${esc2(n.t)} <small>(${esc2(n.w)})</small></li>`).join("")}</ol>`;
    p.querySelector("#rvTxt").value = keep;
    p.querySelector("#rvAdd").onclick = () => { const t = p.querySelector("#rvTxt").value.trim(); if (!t) return; REVIEW.notes.push({ t, w: (document.querySelector(".tabs .on,.nav .on,[aria-current]")?.textContent || PAGE || "").trim().slice(0, 40) }); panel(); };
    p.querySelector("#rvExp").onclick = () => {
      const who = prompt("Ваши ФИО / подразделение для файла замечаний:") || "";
      const lines = [`Замечания по клиенту: ${C?.card?.name || ""}`, `Проверяющий: ${who}`, `Дата: ${new Date().toLocaleString("ru-RU")}`, `${siteVer()}; ${ratnId()}`, "", ...REVIEW.notes.map((n, i) => `${i + 1}. [${n.w}] ${n.t}`)];
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/plain;charset=utf-8" }));
      a.download = "Замечания_" + (C?.card?.name || "клиент").replace(/[\\/:*?"<>|]/g, " ").slice(0, 60) + ".txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
  }
  btn.onclick = () => {
    if (REVIEW.on) {
      if (REVIEW.notes.length && !confirm("Выйти из режима проверки? Невыгруженные замечания будут потеряны.")) return;
      location.reload(); return;   // перечитываем данные из хранилища: возможные изменения в памяти отбрасываются
    }
    REVIEW.on = true; btn.classList.add("on"); btn.textContent = "Выйти из проверки";
    render();
  };
}

/* ---------------------------------------------------------------- Госпрограммы: флаги и примечания (условия программ не зашиты — актуальные условия сверяет кредитный менеджер) */
function govList() { return ["Субсидирование ставки", "Гарантирование по кредиту", "Другая госпрограмма"]; }
function govSt() { return ["Не применимо", "Рассматривается", "Подходит по условиям", "Не подходит"]; }
function govGet() { if (!C.gov) C.gov = {}; return C.gov; }
function govRows() { const g = C?.gov || {}; return govList().map((n, i) => { const r = g[i] || {}; return [r.name && i === 2 ? r.name : n, r.st || govSt()[0], r.note || ""]; }).filter(r => r[1] !== govSt()[0] || r[2]); }
function govPanel() {
  const g = govGet();
  const rows = govList().map((n, i) => { const r = g[i] || {}; return `<tr><td class="lab">${i === 2 ? `<input class="inp" data-gov="${i}" data-f="name" value="${esc(r.name || "")}" placeholder="${n}: название">` : esc(n)}</td>
    <td><select class="inp" data-gov="${i}" data-f="st">${govSt().map(s => `<option${(r.st || govSt()[0]) === s ? " selected" : ""}>${s}</option>`).join("")}</select></td>
    <td><input class="inp" data-gov="${i}" data-f="note" value="${esc(r.note || "")}" placeholder="Условие, лимит, чего не хватает"></td></tr>`; }).join("");
  return `<section class="panel"><h2>Госпрограммы</h2><p class="hint">Флаг помогает не забыть про участие в программе. Условия программ в сайт не зашиты: сверяйте с действующим положением на дату заявки. Отметки попадают в заключение и в паспорт данных.</p>
  <div class="tablewrap" style="max-height:none"><table class="data form"><thead><tr><th class="lab" style="text-align:left">Программа</th><th style="text-align:left">Статус</th><th style="text-align:left">Примечание</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function govHtml() {
  const r = govRows(); if (!r.length) return "";
  return `<h2>Госпрограммы</h2><ul>${r.map(([n, st, nt]) => `<li><b>${esc(n)}:</b> ${esc(st)}${nt ? " — " + esc(nt) : ""}</li>`).join("")}</ul>`;
}
document.addEventListener("change", e => {
  const t = e.target; if (!t.matches || !t.matches("[data-gov]") || !C || REVIEW.on) return;
  const g = govGet(), i = t.dataset.gov; (g[i] = g[i] || {})[t.dataset.f] = t.value; touch();
});
