"use strict";
/* ================================================================ Экспресс-анализ: интерфейс */
const $ = (s, el = document) => el.querySelector(s);
let PAGE = "card", UPL = { pid: null, units: "auto", log: [] };
/* ---------------------------------------------------------------- устройство: телефон / планшет / компьютер.
   Учитываются ширина экрана, сенсорное управление и сам аппарат (iPad в новых iOS выдаёт себя за компьютер).
   Результат — атрибут data-device на <html>; при повороте экрана и изменении окна определяется заново. */
const DEVICE_TXT = { phone: "телефон", tablet: "планшет", desktop: "компьютер" };
function detectDevice() {
  const ua = navigator.userAgent || "", w = window.innerWidth, h = window.innerHeight;
  const touch = (navigator.maxTouchPoints || 0) > 0 || matchMedia("(pointer: coarse)").matches;
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const phoneUA = /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile Safari(?!.*iPad)/i.test(ua) && !ipad;
  const tabletUA = ipad || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet|Silk|Kindle/i.test(ua);
  const short = Math.min(w, h);
  let d;
  if (phoneUA || w < 600) d = "phone";
  else if (tabletUA || (touch && short <= 1100 && w <= 1366)) d = w >= 1200 && !touch ? "desktop" : "tablet";
  else d = w < 900 ? "tablet" : "desktop";
  return { d, touch };
}
let DEV = "desktop", TOUCH = false;
function applyDevice() {
  const { d, touch } = detectDevice(), changed = d !== DEV || touch !== TOUCH;
  DEV = d; TOUCH = touch;
  document.documentElement.dataset.device = d;
  document.documentElement.dataset.touch = touch ? "1" : "0";
  return changed;
}
applyDevice();
const ICONS = {
  card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h6M7 14h10"/></svg>',
  fin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  an: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  concl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4L19 6"/><rect x="2" y="2" width="20" height="20" rx="5"/></svg>',
};
const PAGES = [["card", "Карточка клиента"], ["fin", "Финансовая отчётность"], ["an", "Анализ"], ["concl", "Заключение"]];
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2800); }
const tip = t => `<span class="tip" title="${esc(t)}">?</span>`;
const T = v => isNum(v) ? fmt(v) : "—";
// числа в полях: суммы — целые (дробные до сотых), проценты и курс — до сотых (19,25)
const PCT_KEYS = /(^c\.rate$|^od\.topShare$|^ost\.\d+\.rate$|^c\.guarPct$)/;
const num = (v, key, extra = "") => `<input class="inp num" inputmode="decimal" data-k="${key}" value="${isNum(v) ? fmt(v, PCT_KEYS.test(key) || (Math.abs(v) < 100 && v % 1) ? "d2" : "m") : ""}" ${extra}>`;
const fld = (label, inner, cls = "") => `<label class="fld ${cls}"><span>${label}</span>${inner}</label>`;
const opts = (list, cur) => list.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(t)}</option>`; }).join("");

/* ---------------------------------------------------------------- отрицательные значения — красным (таблицы, поля, плашки, текст) */
const NEG_RE = /[−-]\s?\d[\d\u00a0\u202f ]*(?:,\d+)?(?:\s?%)?/g;
const NEG_SKIP = ".verdict, .dverdict, .odres > div:first-child, .maxsum > div:last-child, .tabbar, .rail, script, style, textarea, select, option, .tag";
function markNeg(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && !n.parentElement.closest(NEG_SKIP + ", .negv") && /[−-]\s?\d/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const t = n.nodeValue; NEG_RE.lastIndex = 0; let m, last = 0; const frag = document.createDocumentFragment();
    while ((m = NEG_RE.exec(t))) {
      // «1 − 2» (знак между числами) и даты/телефоны — не отрицательные
      const before = t.slice(0, m.index); if (/[\d)]\s*$/.test(before) && !/\(\s*$/.test(before)) continue;
      frag.append(t.slice(last, m.index)); const sp = document.createElement("span"); sp.className = "negv"; sp.textContent = m[0]; frag.append(sp); last = m.index + m[0].length;
    }
    if (!last) continue; frag.append(t.slice(last)); n.replaceWith(frag);
  }
  for (const el of root.querySelectorAll("input.num")) negInput(el);
}
const negInput = el => el.classList.toggle("negin", /^\s*[−-]\s?\d|^\(\s*\d/.test(el.value));

/* ---------------------------------------------------------------- главная */
function renderHome() {
  X = null;
  const list = CLIENTS.slice().sort((a, b) => b.updated - a.updated);
  document.body.innerHTML = `<div class="home">
    <div class="topbar"><a class="tohub" href="/">← На главную</a>${langSwitch()}</div>
    <div class="hero"><h1>Экспресс-анализ для КМ</h1>
      <p>Быстро понять, подходит ли клиент для финансирования, ещё до сбора полного пакета документов. Внесите данные клиента и запрос, загрузите баланс и ОПиУ — сайт сам посчитает показатели, подсветит проблемы и расхождения и напишет заключение простым языком.</p>
      <div class="row"><button class="btn primary big" data-act="new">+ Новый клиент</button><button class="btn alt big" data-act="demo">Пример для заполнения</button><button class="btn alt2 big" data-act="openfile">Открыть файл клиента</button></div></div>
    <div class="how">${PAGES.map(([, t], i) => `<div><b><em>${i + 1}</em>${t}</b><span>${["запрос клиента; для овердрафта — поступления по месяцам", "Excel, PDF или скан; декларации", "ключевые показатели и сколько можно дать", "готовый итог — скопировать или распечатать"][i]}</span></div>`).join("")}</div>
    <h2 style="margin-bottom:10px">Клиенты</h2>
    ${list.length ? `<div class="clist">${list.map(c => { const v = clientVerdict(c); return `<div class="citem" data-open="${c.id}"><div class="nm"><b${c.card.name ? " data-nt" : ""}>${esc(c.card.name || "Без названия")}${c.demo ? ' <span class="tag nd">пример</span>' : ""}</b><span class="small muted">${esc([c.card.bin, c.card.product, isNum(c.card.amount) ? fmt(c.card.amount) + " тыс. тг" : ""].filter(Boolean).join(" · "))} · изменён ${new Date(c.updated).toLocaleDateString("ru-RU")}</span></div><span class="tag ${v.sev}">${esc(v.title)}</span><button class="xbtn" title="Удалить" data-del="${c.id}">×</button></div>`; }).join("")}</div>`
      : `<div class="empty">Пока нет клиентов. Нажмите «Новый клиент» или посмотрите «Пример для заполнения».</div>`}
    <p class="small muted" style="margin-top:24px">Данные хранятся только в этом браузере на этом компьютере и никуда не отправляются. Регистрация не нужна. Чтобы перенести клиента на другой компьютер — кнопка «Сохранить в файл» внутри клиента. Все суммы — в тыс. тенге.</p>
    <footer class="homefoot"><span>© 2026 Создан ОФКК Костанай · ${siteVer()} · пилот · ${reportLink("Экспресс-анализ")}</span><span class="dev">Интерфейс: ${DEVICE_TXT[DEV]}</span></footer>
  </div><div id="toast"></div><input type="file" id="ofile" accept=".json" class="hidden">`;
}
function clientVerdict(c) { const keep = X; X = c; let v; try { v = verdict(problems()); } catch (e) { v = { sev: "nd", title: "—" }; } X = keep; return v; }

/* ---------------------------------------------------------------- оболочка клиента */
function renderClient() {
  const pr = problems(), v = verdict(pr);
  const dots = { card: X.card.name && N(X.card.amount) ? "ok" : "nd", fin: X.per.some(p => isNum(fv("rev", p.id))) ? "ok" : "nd", an: v.sev, concl: v.sev };
  if (PAGE === "prob") PAGE = "an";
  const body = { card: pageCard, fin: pageFin, an: pageAn, concl: pageConcl }[PAGE](pr, v);
  document.body.innerHTML = `<div class="app"><nav class="rail">
    <div class="brand"><span>Экспресс-анализ<small>для клиентского менеджера</small></span>${langSwitch()}</div>
    <a class="tohub" href="/">← На главную</a>
    <div class="client"><b${X.card.name ? " data-nt" : ""}>${esc(X.card.name || "Новый клиент")}</b><button data-act="home">← ко всем клиентам</button></div>
    <ol class="steps">${PAGES.map(([id, t]) => `<li><button data-page="${id}"${PAGE === id ? ' aria-current="page"' : ""}>${t}<span class="dot ${dots[id]}"></span></button></li>`).join("")}</ol>
    <div class="foot"><div class="foot-save"><button class="btn ghost" style="padding-left:0" data-act="save">Сохранить в файл</button><br>Все суммы — тыс. тг. Данные только в этом браузере.</div><div class="copy">© 2026 Создан ОФКК Костанай</div></div>
  </nav><main class="main">${body}<footer class="mfoot"><button class="btn ghost" data-act="save">Сохранить в файл</button><span>Все суммы — тыс. тг. Данные только в этом браузере.</span><span class="copy">© 2026 Создан ОФКК Костанай</span></footer></main></div>
  <nav class="tabbar" aria-label="Разделы">${PAGES.map(([id, t]) => `<button data-page="${id}"${PAGE === id ? ' aria-current="page"' : ""}>${ICONS[id]}<span>${t.replace("Финансовая отчётность", "Отчётность").replace("Карточка клиента", "Карточка")}</span><i class="dot ${dots[id]}"></i></button>`).join("")}</nav><div id="toast"></div><input type="file" id="ufile" multiple accept=".xlsx,.xlsm,.xls,.pdf,.jpg,.jpeg,.png,image/*" class="hidden"><input type="file" id="stfile" multiple accept=".pdf,.xlsx,.xlsm,.xls" class="hidden">`;
  markNeg(document.querySelector(".main"));
  const cur = document.querySelector('.steps [aria-current="page"]'); if (cur && DEV !== "desktop") cur.scrollIntoView({ inline: "center", block: "nearest" });
}
// перерисовка с сохранением фокуса и прокрутки
function rerender() {
  const a = document.activeElement, key = a && a.dataset ? a.dataset.k : null, y = window.scrollY, ms = $(".main")?.scrollTop;
  renderClient();
  window.scrollTo(0, y); if ($(".main") && ms) $(".main").scrollTop = ms;
  if (key) { const el = document.querySelector(`[data-k="${CSS.escape(key)}"]`); if (el) { el.focus(); if (el.matches("input.num")) el.select(); else if (el.tagName === "INPUT" && /text|search/.test(el.type) && el.setSelectionRange) { const n = el.value.length; el.setSelectionRange(n, n); } } }
}

/* ---------------------------------------------------------------- 1. Карточка: запрашиваемые условия (+ овердрафт) */
function pageCard() {
  const c = X.card, m = analyze(), lp = m.newPay, od = isOD(c);
  const cnum = (f, ph = "") => num(c[f], "c." + f, ph ? `placeholder="${esc(ph)}"` : "");
  const csel = (f, list) => `<select class="inp" data-k="c.${f}">${opts(c[f] && list.every(o => !Array.isArray(o)) && !list.includes(c[f]) ? [...list, c[f]] : list, c[f])}</select>`;
  const pe = isNum(c.payExist) ? c.payExist : ((c.loans || []).length ? m.payExist : null);
  const box = (txt, note) => `<div class="calcbox">${txt}</div>${note ? `<span class="fnote">${note}</span>` : ""}`;
  return `<div class="pagehead"><div class="lead"><h1>Карточка клиента</h1><p>Что просит клиент. Серые поля заполняете вы; суммы — в тыс. тенге.</p></div></div>
  <section class="panel"><h2>Запрашиваемые условия</h2><p class="hint">Взнос по действующим кредитам — примерная сумма всех платежей клиента в месяц по кредитам, займам и лизингу (со слов клиента, если справки ПКБ нет).</p>
    <div class="grid g3">
      ${fld("Клиент", `<input class="inp" data-k="c.name" value="${esc(c.name || "")}" placeholder="ТОО «…» / ИП …">`, "wide")}
      ${fld("Продукт", csel("product", PRODUCTS))}
      ${fld("Цель", csel("purpose", PURPOSES))}
      ${fld("Тип финансирования", `<select class="inp" data-k="c.fintype">${opts(FINTYPES, finType(c))}</select>`)}
      ${od ? fld("Срок транша", `<select class="inp" data-k="od.tranche">${opts([["30", "до 30 дней"], ["90", "до 90 дней"]], String(odCfg().tranche))}</select>`) : isWC(c) ? fld("Платёжная нагрузка", `<div class="calcbox">только проценты</div>`) : fld("Погашение", csel("sched", Object.entries(SCHED)))}
      ${fld(od ? "Сумма (лимит), тыс. тг" : "Сумма займа, тыс. тг", cnum("amount"))}
      ${fld(od ? "Срок кредитной линии, мес." : "Срок, мес.", cnum("term"))}
      ${fld("Ставка, % годовых", cnum("rate", "например, 19,25"))}
      ${od || isWC(c) ? "" : fld("Льготный период, мес.", cnum("grace", "0"))}
      ${fld("Взнос по действующим кредитам, тыс. тг/мес.", num(pe, "c.payExist", `placeholder="0 — если кредитов нет"`))}
      ${od || isWC(c) ? "" : `<div class="fld"></div>`}
      ${lp && lp.year ? fld(od || isWC(c) ? "Проценты за год (нагрузка)" : "Платёж за год (нагрузка)", box(fmt(lp.year) + " тыс. тг", od || isWC(c) ? "ВКЛ: только проценты" : "НКЛ: весь платёж за год")) : ""}
      ${isBU(c) ? fld("Недвижимость в залоге, тыс. тг", cnum("realty", "рыночная стоимость")) + fld("Срок деятельности, мес.", cnum("expm")) : ""}
      ${isSU(c) ? fld("Гарантия «Даму», % суммы", cnum("guarPct", "60–85")) + fld("Остальной залог (деньги, недвижимость), тыс. тг", cnum("collat")) + (purCls(c) === "Инв" ? fld("Стоимость проекта, тыс. тг", cnum("projCost")) : "") : ""}
      ${fld(od ? "Проценты по овердрафту в месяц" : isWC(c) ? "Проценты в месяц" : "Платёж по новому кредиту в месяц", box(lp ? fmt(lp.pay) + " тыс. тг" : "— укажите сумму, срок и ставку", lp ? (od ? "при полном использовании лимита" : lp.wc ? "ВКЛ — в нагрузке только проценты" : lp.note + (N(c.grace) ? `; в льготный период ~${fmt(lp.grace)} тыс. тг` : "")) : ""))}
      ${fld("Все платежи в месяц", box(lp || N(pe) ? fmt(N(pe) + (lp ? lp.pay : 0)) + " тыс. тг" : "—", "действующие + новый"))}
      ${od ? fld("Расчётный лимит овердрафта", box(fmt(odCalc().limit) + " тыс. тг", "см. расчёт ниже")) : ""}
    </div></section>
  ${od ? odPanel() : ""}
  <div class="row noprint"><button class="btn primary" data-page="fin">Дальше: финансовая отчётность →</button></div>`;
}
let OD_SHOW = "ex";   // какие операции показывать: исключённые / все
function odPanel() {
  const d = odCalc(), o = d.o, S = d.S;
  const sel = (k, list) => `<select class="inp" data-k="od.${k}">${opts(list, String(o[k]))}</select>`;
  const onum = (k, ph = "") => num(o[k], "od." + k, ph ? `placeholder="${esc(ph)}"` : "");
  const autoBox = (v, unit = "") => `<div class="calcbox">${isNum(v) ? fmt(v, unit === "%" ? "d2" : "m") + (unit ? " " + unit : "") : "—"}</div><span class="fnote">по выпискам</span>`;
  const chk = odChecks(d);
  const cell = (r, w) => S[w].has ? `<td class="auto">${r[w] === null ? '<span class="muted small">нет выписки</span>' : T(r[w])}</td>` : `<td class="c">${num(r[w], `odm.${r.ym}.${w}`)}</td>`;
  return `<section class="panel"><h2>Овердрафт: расчёт лимита</h2>
    <p class="hint">Лимит = 40 % среднемесячных очищенных кредитовых оборотов за ${d.n} полных месяцев до месяца заявки — отдельно по нашему банку и по другим банкам (не более 2)${+o.tranche === 90 ? "; при транше до 90 дней — не более 100 млн тг" : ""}. Загрузите выписки — сайт сам уберёт из поступлений то, что не считается оборотом, и заполнит таблицу. Без выписок поступления можно внести вручную.</p>
    <div class="grid g3">
      ${fld("Месяц заявки", `<input class="inp" type="month" data-k="od.appMonth" value="${esc(o.appMonth || ymNow())}">`)}
      ${fld("Сезонный бизнес", sel("seasonal", ["Нет", "Да"]))}
      ${fld("Строительство или сельское хозяйство", sel("banned", ["Нет", "Да"]))}
      ${fld("Срок деятельности, мес.", onum("exp", `нужно от ${d.needExp}`))}
      ${fld("Покупателей за период", d.auto ? autoBox(d.buyers) : onum("buyers", "не менее 3"))}
      ${fld("Доля крупнейшего покупателя", d.auto ? autoBox(d.topShare, "%") : onum("topShare", "%, до 60"))}
      ${fld("Других банков с оборотами", S.other.has ? autoBox(d.otherBanks) : onum("otherBanks", "не более 2"))}
    </div>
  </section>
  <section class="panel"><h2>Выписки по счетам</h2>
    <p class="hint">PDF или Excel из интернет-банка, за ${d.n} месяцев до месяца заявки (${ymLabel(d.win[0])} — ${ymLabel(d.win[d.win.length - 1])}). Перед загрузкой выберите, где открыт счёт.</p>
    <div class="row" style="margin-bottom:10px">${fld("Счёт открыт", `<select class="inp" data-k="od.stWhere">${opts([["our", "в нашем банке"], ["other", "в другом банке"]], o.stWhere || "our")}</select>`)}</div>
    <div class="drop" id="sdrop">${TOUCH ? `<b>Загрузить выписки</b><button class="btn primary" data-act="pickst">Выбрать файлы</button>` : `<b>Перетащите выписки сюда</b>или <button class="btn" data-act="pickst">выберите на компьютере</button>`}<div class="small muted">Можно несколько файлов сразу: по каждому счёту и за разные месяцы.</div></div>
    ${OD_LOG.length ? `<div class="flist">${OD_LOG.map(r => `<div class="fitem ${r.ok ? "ok" : "err"}"><span class="ic">${r.ok ? "✓" : "!"}</span><div class="fn"><b>${esc(r.file)}</b><br>${esc(r.txt || r.err)}</div></div>`).join("")}</div>` : ""}
    ${o.st.length ? `<div class="tw" style="margin-top:14px"><table class="t"><thead><tr><th class="l">Банк, счёт</th><th class="l">Период</th><th class="l">Где открыт</th><th class="l">Валюта</th><th>Поступлений</th><th></th></tr></thead><tbody>
      ${o.st.map((x, i) => `<tr><td class="l">${esc(x.bank || "банк не определён")}<span class="note">${esc(x.acc || x.file)}</span></td><td class="l">${esc(x.from ? `${x.from} — ${x.to}` : "—")}</td>
        <td class="c"><select class="inp" data-k="ost.${i}.where">${opts([["our", "наш банк"], ["other", "другой банк"]], x.where)}</select></td>
        <td class="${x.cur !== "KZT" ? "c" : "l"}">${x.cur !== "KZT" ? num(x.rate, `ost.${i}.rate`, `placeholder="курс ${esc(x.cur)}"`) : "KZT"}</td><td>${x.txs.length}</td><td class="x"><button class="xbtn" data-rmst="${i}" title="Удалить выписку">×</button></td></tr>`).join("")}
    </tbody></table></div>` : ""}
    ${d.auto ? odExTable(d) : ""}
  </section>
  <section class="panel"><h2>Очищенные обороты по месяцам</h2>
    <div class="tw"><table class="t odt"><thead><tr><th class="l">Месяц</th><th>В нашем банке</th><th>В других банках</th><th>Итого</th>${d.auto ? "<th>Поступлений, шт.</th>" : ""}</tr></thead><tbody>
    ${d.rows.map((r, i) => `<tr><td class="l">${ymLabel(r.ym)}</td>${cell(r, "our")}${cell(r, "other")}<td class="${d.tot[i] <= 0 && d.filled ? "neg" : ""}">${T(isNum(r.our) || isNum(r.other) ? d.tot[i] : null)}</td>${d.auto ? `<td class="${r.nOps < 3 ? "neg" : ""}">${r.nOps}</td>` : ""}</tr>`).join("")}
    <tr class="tot"><td class="l">Всего за ${d.n} мес.</td><td>${T(d.sOur)}</td><td>${T(d.sOther)}</td><td>${T(d.sOur + d.sOther)}</td>${d.auto ? "<td></td>" : ""}</tr>
    <tr><td class="l">Среднемесячно${d.cutAny ? " (с ограничением крупного покупателя 60 %)" : ""}</td><td>${T(d.avgOur)}</td><td>${T(d.avgOther)}</td><td>${T(d.avgOur + d.avgOther)}</td>${d.auto ? "<td></td>" : ""}</tr>
    <tr class="tot"><td class="l">Лимит — 40 % от среднемесячных</td><td>${T(d.limOur)}</td><td>${T(d.limOther)}</td><td>${T(d.lim)}</td>${d.auto ? "<td></td>" : ""}</tr>
    </tbody></table></div>
    <div class="odres"><div><span>Расчётный лимит</span><b>${fmt(d.limit)} тыс. тг</b>${d.capHit ? `<i>ограничен 100 млн тг (транш до 90 дней)</i>` : ""}</div><div><span>Запрашивают</span><b>${N(X.card.amount) ? fmt(X.card.amount) + " тыс. тг" : "—"}</b>${N(X.card.amount) ? `<i>${N(X.card.amount) <= d.limit + 0.5 ? "укладывается в лимит" : "больше лимита"}</i>` : ""}</div></div>
    <h3 style="margin:18px 0 8px">Условия овердрафта</h3>
    <div class="odchk">${chk.map(k => `<div class="${k.sev}"><span class="tag ${k.sev}">${SEVT[k.sev]}</span><b>${esc(k.t)}</b><em>${esc(k.fact)}</em></div>`).join("")}</div>
  </section>`;
}
let OD_LOG = [];
// исключения по 8 пунктам + крупнейшие отправители + список операций
function odExTable(d) {
  const S = d.S, o = d.o, ws = new Set(d.win), own = odOwn(o);
  const rows = Object.entries(OD_EX).map(([k, t]) => { const v = S.our.ex[k].v + S.other.ex[k].v, n = S.our.ex[k].n + S.other.ex[k].n; return `<tr${n ? "" : ' class="zero"'}><td class="l">${t}</td><td>${n || "—"}</td><td>${n ? T(v) : "—"}</td></tr>`; }).join("");
  const exTot = sum(Object.keys(OD_EX).map(k => S.our.ex[k].v + S.other.ex[k].v)), gross = S.our.gross + S.other.gross;
  const ops = [];
  o.st.forEach((x, si) => x.txs.forEach((t, ti) => { if (!ws.has((t.d || "").slice(0, 7))) return; const cat = odCat(t, own); if (OD_SHOW === "ex" && !cat) return; ops.push({ t, si, ti, cat, w: x.where }); }));
  ops.sort((a, b) => a.t.d.localeCompare(b.t.d));
  const catOpts = [["inc", "учитывается"], ...Object.entries(OD_EX)];
  return `<h3 style="margin:18px 0 8px">Что исключено из поступлений</h3>
    <div class="tw"><table class="t odex"><thead><tr><th class="l">Вид поступления (по методике)</th><th>Операций</th><th>Сумма, тыс. тг</th></tr></thead><tbody>${rows}
      <tr class="tot"><td class="l">Всего поступлений за период</td><td></td><td>${T(gross)}</td></tr>
      <tr class="tot"><td class="l">Исключено</td><td></td><td>${T(exTot)}</td></tr>
      <tr class="tot"><td class="l">Очищенные обороты</td><td></td><td>${T(gross - exTot)}</td></tr></tbody></table></div>
    ${d.cpl.length ? `<h3 style="margin:18px 0 8px">Крупнейшие покупатели</h3><div class="tw"><table class="t"><thead><tr><th class="l">Отправитель</th><th>Сумма, тыс. тг</th><th>Доля</th></tr></thead><tbody>${d.cpl.slice(0, 5).map(x => `<tr><td class="l">${esc(x.name)}</td><td>${T(x.v)}</td><td class="${x.v / d.cpTot > 0.6 ? "neg" : ""}">${fmt(x.v / d.cpTot, "p")}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <details class="ops"${OD_OPEN ? " open" : ""}><summary>Операции за период: ${OD_SHOW === "ex" ? "исключённые" : "все"} (${ops.length}) — проверить и при необходимости изменить</summary>
      <div class="row" style="margin:10px 0"><button class="btn${OD_SHOW === "ex" ? " primary" : ""}" data-odshow="ex">Только исключённые</button><button class="btn${OD_SHOW === "all" ? " primary" : ""}" data-odshow="all">Все поступления</button></div>
      <div class="tw"><table class="t ops"><thead><tr><th class="l">Дата</th><th class="l">Отправитель</th><th class="l">Назначение платежа</th><th>Сумма, тг</th><th class="l">В расчёте</th></tr></thead><tbody>
      ${ops.slice(0, 400).map(x => `<tr${x.t.ov ? ' class="man"' : ""}><td class="l">${x.t.d.split("-").reverse().join(".")}</td><td class="l">${esc(x.t.cp || "—")}${x.t.bin ? `<span class="note">${x.t.bin}</span>` : ""}</td><td class="l purp">${esc(x.t.purp || x.t.op || "—")}${x.t.knp ? `<span class="note">КНП ${x.t.knp}</span>` : ""}</td><td>${fmt(x.t.cr)}</td>
        <td class="c"><select class="inp" data-k="otx.${x.si}.${x.ti}">${opts(catOpts, x.cat || "inc")}</select></td></tr>`).join("") || `<tr><td colspan="5" class="l muted">Нет операций.</td></tr>`}
      </tbody></table></div>${ops.length > 400 ? `<p class="small muted">Показаны первые 400 операций.</p>` : ""}
    </details>`;
}
let OD_OPEN = false;

/* ---------------------------------------------------------------- 2. Финансовая отчётность */
function pageFin() {
  if (!UPL.pid || perIdx(UPL.pid) < 0) UPL.pid = X.per[X.per.length - 1].id;
  const P = X.per, dy = declYears();
  // Овердрафт и Бизнес Успех: только строки, нужные для проверки условий продукта
  const lite = isOD() || isBU(), LITE = { bal: [["ta_rep", "Итого активы (валюта баланса)"], ...(isOD() ? [["ar", "Дебиторская задолженность"]] : []), ["eq", "Собственный капитал"]], pl: [["rev", "Выручка"], ["ni_rep", "Чистая прибыль (убыток) за период"]] };
  const rows = blk => lite && LITE[blk] ? LITE[blk].map(([k, lab]) => { const d = LINEDEF[k];
    return `<tr><td class="l">${esc(lab)}${d.hint && k !== "ta_rep" && k !== "ni_rep" ? `<span class="note">${esc(d.hint)}</span>` : ""}</td>${P.map(p => `<td class="c">${num(fv(k, p.id), `f.${k}.${p.id}`)}</td>`).join("")}</tr>`; }).join("") : FL[blk].map(l => {
    if (l[0] === "sec") return `<tr class="sec"><td colspan="${P.length + 1}">${esc(l[1])}</td></tr>`;
    const d = LINEDEF[l[0]];
    const cells = P.map(p => d.typ === "calc" ? `<td>${T(val(d.key, p.id))}</td>` : `<td class="c">${num(fv(d.key, p.id), `f.${d.key}.${p.id}`)}</td>`).join("");
    return `<tr class="${d.typ === "calc" ? "tot" : ""}"><td class="l"${d.typ === "sub" ? ' style="padding-left:24px"' : ""}>${esc(d.label)}${d.hint ? `<span class="note">${esc(d.hint)}</span>` : ""}</td>${cells}</tr>`;
  }).join("");
  const head = `<thead><tr><th class="l" style="min-width:280px">Строка, тыс. тг</th>${P.map(p => `<th>${esc(perLabel(p))}</th>`).join("")}</tr></thead>`;
  return `<div class="pagehead"><div class="lead"><h1>Финансовая отчётность</h1><p>Загрузите баланс, ОПиУ и (если есть) ДДС в Excel или PDF — сайт сам найдёт нужные строки и разложит цифры по периодам. Можно и вручную: просто впишите суммы в таблицу. Налоговые декларации (100.00, 910.00, 300.00) загружаются туда же — сайт сверит их с выручкой.</p></div></div>
  <section class="panel"><h2>Периоды</h2><p class="hint">Периоды добавляются сами по датам в загруженных документах. Можно и вручную: обычно два последних года. Если есть отчётность за текущий год (например, 9 месяцев) — добавьте третий период: показатели будут пересчитаны в годовые.</p>
    <div class="tw"><table class="t" style="width:auto"><thead><tr><th class="l">Период</th><th class="l">Отчётная дата</th><th>Месяцев</th><th></th></tr></thead><tbody>
    ${P.map((p, i) => `<tr><td class="l"><b>${esc(perLabel(p))}</b></td><td class="c"><input class="inp txt" type="date" data-k="p.${i}.date" value="${esc(p.date || "")}"></td><td class="c" style="width:90px">${num(p.months, `p.${i}.months`)}</td><td class="x">${P.length > 1 ? `<button class="xbtn" data-rmper="${i}" title="Удалить период и его цифры">×</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>${P.length < MAX_PER ? `<div class="row" style="margin-top:10px"><button class="btn" data-act="addper">+ Период</button></div>` : ""}</section>
  <section class="panel noprint"><h2>Загрузить документы</h2>
    <div class="row" style="margin-bottom:10px">${fld("Единицы в файле", `<select class="inp" data-upl="units">${opts([["auto", "определить сами"], ["t", "тенге"], ["k", "тыс. тенге"], ["m", "млн тенге"]], UPL.units)}</select>`)}</div>
    <div class="drop" id="drop">${TOUCH ? `<b>Загрузить документ</b><button class="btn primary" data-act="pick">Выбрать файл или сфотографировать</button>` : `<b>Перетащите файлы сюда</b>или <button class="btn" data-act="pick">выберите на компьютере</button>`}<div class="small muted" style="margin-top:6px">Excel, PDF (в том числе скан) или фото. Период сайт определит сам по датам в документе; колонка «на начало года» / «за предыдущий год» попадёт в прошлый год.</div></div>
    ${UPL.log.length ? `<div class="flist">${UPL.log.map((r, li) => `<div class="fitem ${r.ok ? "ok" : r.ask ? "warn" : "err"}"><span class="ic">${r.ok ? "✓" : r.ask ? "?" : "!"}</span><div class="fn"><b>${esc(r.file)}</b><br>${esc(r.txt || r.err)}${r.ask && UPL.files[r.file] ? `<div class="row askper">${X.per.map(p => `<button class="btn" data-loadto="${li}|${p.id}">${esc(perLabel(p))}</button>`).join("")}</div>` : ""}</div></div>`).join("")}</div><p class="small muted" style="margin-top:8px">Проверьте цифры в таблице ниже — особенно итоги: «Итого активы» должны совпасть с документом.</p>` : ""}
  </section>
  <section class="panel"><h2>Баланс</h2>${lite ? `<p class="hint">Для продукта «${esc(X.card.product)}» нужны только четыре показателя: итог активов, собственный капитал, выручка и чистая прибыль. Остальные строки скрыты — если загрузить документ, они всё равно заполнятся.</p>` : ""}<div class="tw"><table class="t">${head}<tbody>${rows("bal")}</tbody></table></div></section>
  <section class="panel"><h2>Отчёт о прибылях и убытках (ОПиУ)</h2><p class="hint">Расходы — положительными числами. Для неполного года — цифры с начала года (как в отчётности).</p><div class="tw"><table class="t">${head}<tbody>${rows("pl")}</tbody></table></div></section>
  ${lite ? "" : `<section class="panel"><h2>Движение денежных средств (ДДС)</h2><p class="hint">Необязательно. Если ДДС нет — пропустите.</p><div class="tw"><table class="t">${head}<tbody>${rows("cf")}</tbody></table></div></section>`}
  <section class="panel"><h2>Налоговые декларации</h2><p class="hint">Загружаются в окно выше. Или внесите доход вручную. Суммы — в тыс. тг.</p>
    <div class="tw"><table class="t"><thead><tr><th class="l">Форма</th><th class="l">Год</th><th class="l">Период</th><th>Доход</th><th>Оборот по НДС</th><th class="l">Файл</th><th></th></tr></thead><tbody>
    ${(X.decl || []).slice().sort((a, b) => (a.year - b.year) || String(a.form).localeCompare(b.form) || String(a.part).localeCompare(b.part)).map(d => { const i = X.decl.indexOf(d); return `<tr><td class="c"><select class="inp" data-k="d.${i}.form">${opts([["100", "100.00 КПН"], ["910", "910.00 упрощённая"], ["300", "300.00 НДС"], ["200", "200.00 ИПН/СН"], ["220", "220.00 ИПН"]].concat(["100", "910", "300", "200", "220"].includes(d.form) ? [] : [[d.form, d.formName || d.form]]), d.form)}</select></td>
      <td class="c" style="width:90px">${num(d.year, `d.${i}.year`)}</td>
      <td class="c"><select class="inp" data-k="d.${i}.part">${opts(Object.entries(PART_TXT), d.part)}</select></td>
      <td class="c">${num(isNum(d.vals?.rev) ? d.vals.rev / 1000 : null, `d.${i}.rev`)}</td>
      <td class="c">${num(isNum(d.vals?.vat_turn) ? d.vals.vat_turn / 1000 : null, `d.${i}.vat_turn`)}</td>
      <td class="l small muted">${esc(d.file || "вручную")}</td><td class="x"><button class="xbtn" data-rmdecl="${i}">×</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="l muted">Деклараций нет.</td></tr>`}
    </tbody></table></div><div class="row" style="margin-top:10px"><button class="btn" data-act="adddecl">+ Декларация вручную</button></div>
    ${dy.length ? `<p class="small" style="margin-top:10px">Итого по годам: ${dy.map(y => `<b>${y.year}</b> — доход ${isNum(y.rev) ? fmt(y.rev) : "—"}${isNum(y.vat) ? `, оборот НДС ${fmt(y.vat)}` : ""}`).join("; ")} тыс. тг.</p>` : ""}
  </section>
  ${X.files.length ? `<p class="small muted">Загружено файлов: ${X.files.length}. Последние: ${X.files.slice(0, 5).map(f => esc(f.name)).join(", ")}.</p>` : ""}
  <div class="row noprint"><button class="btn primary" data-page="an">Дальше: анализ →</button></div>`;
}

/* ---------------------------------------------------------------- 3. Анализ */
function kpi(sev, title, value, unit, explain, note, hint) {
  return `<div class="kpi ${sev}"><div class="k"><span>${esc(title)} ${hint ? tip(hint) : ""}</span><span class="tag ${sev}">${SEVT[sev]}</span></div><div class="v">${value}${unit ? ` <small>${unit}</small>` : ""}</div><div class="e">${explain}</div>${note ? `<div class="n">${note}</div>` : ""}</div>`;
}
function sevBy(v, ok, min, higherBetter = true) { if (!isNum(v)) return "nd"; return higherBetter ? (v >= ok ? "ok" : v >= min ? "chk" : "risk") : (v <= ok ? "ok" : v <= min ? "chk" : "risk"); }
function pageAn(pr, v) {
  const m = analyze(), c = X.card;
  if (!m.pl && !m.bal) return `<div class="pagehead"><div class="lead"><h1>Анализ</h1></div></div><div class="verdict nd"><div class="vicon">?</div><div><div class="big">Нет финансовых данных</div><p>Загрузите или внесите баланс и ОПиУ на странице «Финансовая отчётность».</p></div></div><button class="btn primary" data-page="fin">Перейти к отчётности</button>`;
  const ann = m.k !== 1 ? ` (${perLabel(m.pl)} → в годовом выражении)` : "";
  const dscrSev = !isNum(m.dscr) ? "nd" : m.dscr >= NORM.dscr_ok ? "ok" : m.dscr >= NORM.dscr_min ? "chk" : "crit";
  const k = [
    kpi(m.rev > 0 ? (isNum(m.revGr) ? sevBy(m.revGr, NORM.rev_drop_chk, NORM.rev_drop_risk) : "ok") : "nd", "Выручка за год", T(m.rev), "тыс. тг", `Сколько компания продаёт за год${ann}.`, isNum(m.revGr) ? `Изменение к прошлому году: <b>${m.revGr >= 0 ? "+" : ""}${fmt(m.revGr, "p")}</b>` : "Динамику посчитать нельзя — нужен ещё один полный год."),
    kpi(!m.pl ? "nd" : m.ni > 0 ? "ok" : "risk", "Чистая прибыль", T(m.ni), "тыс. тг", m.ni > 0 ? `Компания зарабатывает: из каждых 100 тенге выручки остаётся ${fmt(m.nm * 100, "1")} тенге прибыли.` : "Компания работает в убыток.", isNum(m.gm) ? `Наценка (валовая маржа): ${fmt(m.gm, "p")}` : ""),
    isOD(c) ? "" : kpi(dscrSev, "Хватает ли денег на платежи", isNum(m.dscr) ? fmt(m.dscr, "x") : "—", "", isNum(m.dscr) ? `Бизнес зарабатывает ~${T(m.cashMonth)} тыс. тг в месяц, а платить по всем кредитам нужно ~${T(m.payTotal)}. Нужно не меньше ${fmt(NORM.dscr_ok, "x")}: т.е. на каждый тенге платежа — ${fmt(NORM.dscr_ok, "x")} тенге дохода.` : "Нет данных о платежах или о прибыли.", m.daKnown ? "" : "Амортизация не указана — оценка осторожная.", "DSCR = (EBITDA − КПН) / 12 ÷ платежи по всем кредитам в месяц"),
    kpi(sevBy(m.lev, NORM.lev_ok, NORM.lev_max, false), "Долговая нагрузка", isNum(m.lev) ? fmt(m.lev, "1") : "—", "лет", isNum(m.lev) ? `За сколько лет компания могла бы погасить все долги (с новым кредитом — ${T(m.debtNew)} тыс. тг), если бы весь заработок шёл на это. Норма — до ${fmt(NORM.lev_ok, "1")}.` : "Нет данных о долгах или EBITDA.", "", "Долг / EBITDA. EBITDA — прибыль до процентов, налогов и амортизации"),
    kpi(sevBy(m.liq, NORM.liq_ok, NORM.liq_min), "Ликвидность", isNum(m.liq) ? fmt(m.liq, "x") : "—", "", "Хватает ли денег, дебиторки и запасов, чтобы закрыть долги до года. Норма — от 1.", "", "Текущие активы / текущие обязательства"),
    kpi(!isNum(m.eqr) ? "nd" : N(m.eq) < 0 ? "crit" : sevBy(m.eqr, NORM.eq_ok, NORM.eq_min), "Собственные средства", isNum(m.eqr) ? fmt(m.eqr, "p") : "—", "", "Какая часть имущества компании принадлежит ей самой, а не куплена в долг. Норма — от 20 %.", isNum(m.eq) ? `Капитал: ${T(m.eq)} тыс. тг` : ""),
  ];
  const keyRows = [["Выручка", p => fv("rev", p.id)], ["Чистая прибыль", p => val("ni", p.id)], ["EBITDA (заработок до процентов и налогов)", p => val("ebitda", p.id)], ["Активы", p => val("ta", p.id)], ["Собственный капитал", p => fv("eq", p.id)], ["Кредиты и займы", p => val("debt", p.id)], ["Дебиторская задолженность", p => fv("ar", p.id)], ["Запасы", p => fv("inv", p.id)]];
  return `<div class="pagehead"><div class="lead"><h1>Анализ</h1><p class="one">Самое главное о бизнесе клиента. Цвет плашки: зелёный — норма, жёлтый — проверить, красный — риск.</p></div></div>
  <div class="verdict ${v.sev}"><div class="vicon">${v.icon}</div><div><div class="big">${esc(v.title)}</div><p>${esc(v.text)}</p></div></div>
  <div class="kpis">${k.join("")}</div>
  ${isOD(c) ? odAnPanel() : `<section class="panel"><h2>Сколько можно дать</h2><p class="hint">Расчёт по текущему заработку бизнеса и платежам по действующим кредитам, с запасом ${Math.round((NORM.dscr_ok - 1) * 100)} % на непредвиденное — при тех же сроке, ставке и способе погашения.</p>
    <div class="maxsum">
      <div><span class="small muted">Запрашивают</span><div class="v">${T(c.amount)} <small class="muted">тыс. тг</small></div><span class="small">платёж ~${m.newPay ? fmt(m.newPay.pay) : "—"} в месяц</span></div>
      <div><span class="small muted">Свободно для нового платежа</span><div class="v">${isNum(m.payFree) ? T(Math.max(0, m.payFree)) : "—"} <small class="muted">тыс. тг / мес.</small></div><span class="small">заработок ${T(m.cashMonth)} − платежи ${T(m.payExist)}, с запасом</span></div>
      <div><span class="small muted">Максимальная сумма по доходам</span><div class="v">${isNum(m.maxAmt) ? T(Math.floor(m.maxAmt / 100) * 100) : "—"} <small class="muted">тыс. тг</small></div><span class="small">${isNum(m.maxAmt) && N(c.amount) ? (m.maxAmt >= N(c.amount) ? "запрос укладывается" : "запрос больше — " + (m.maxAmt > 0 ? "снизить сумму или увеличить срок" : "доходов не хватает")) : ""}</span></div>
    </div></section>`}
  <section class="panel"><h2>Ключевые цифры</h2><p class="hint">Тыс. тг, как в отчётности (неполный год — с начала года, без пересчёта).</p>
    <div class="tw"><table class="t"><thead><tr><th class="l">Показатель</th>${X.per.map(p => `<th>${esc(perLabel(p))}</th>`).join("")}</tr></thead><tbody>
    ${keyRows.map(([t, f]) => `<tr><td class="l">${t}</td>${X.per.map(p => { const x = f(p); return `<td class="${isNum(x) && x < 0 ? "neg" : ""}">${T(x)}</td>`; }).join("")}</tr>`).join("")}
    </tbody></table></div></section>
  <section class="panel"><h2>Платежи в месяц</h2>
    <div class="tw"><table class="t" style="max-width:640px"><tbody>
      <tr><td class="l">Заработок бизнеса в месяц (EBITDA − КПН${m.fam ? " − расходы на семью" : ""}) / 12</td><td>${T(m.cashMonth)}</td></tr>
      <tr><td class="l">— взнос по действующим кредитам</td><td>${m.payKnown ? T(m.payExist) : "не указан"}</td></tr>
      <tr><td class="l">— новый кредит</td><td>${m.newPay ? T(m.newPay.pay) : "—"}</td></tr>
      <tr class="tot"><td class="l">Все платежи</td><td>${T(m.payTotal)}</td></tr>
      <tr class="tot"><td class="l">Остаётся после платежей</td><td class="${m.cashMonth - m.payTotal < 0 ? "neg" : ""}">${isNum(m.cashMonth) ? T(m.cashMonth - m.payTotal) : "—"}</td></tr>
    </tbody></table></div>${isNum(m.ocf) ? `<p class="small muted" style="margin-top:8px">По ДДС поток от основной деятельности — ${T(m.ocf)} тыс. тг в год (${T(m.ocf / 12)} в месяц).</p>` : ""}</section>
  <div class="row noprint"><button class="btn primary" data-page="concl">Дальше: заключение →</button></div>`;
}

function odAnPanel() {
  const d = odCalc(), a = N(X.card.amount);
  return `<section class="panel"><h2>Лимит овердрафта</h2><p class="hint">40 % среднемесячных очищенных поступлений за ${d.n} мес. до месяца заявки${d.adj < 1 ? "; поступления крупнейшего покупателя учтены не более 60 %" : ""}. Подробный расчёт — в «Карточке клиента».</p>
    <div class="maxsum">
      <div><span class="small muted">Запрашивают</span><div class="v">${T(a)} <small class="muted">тыс. тг</small></div><span class="small">${odCfg().tranche == 90 ? "транш до 90 дней" : "транш до 30 дней"}</span></div>
      <div><span class="small muted">Среднемесячные поступления</span><div class="v">${T(d.avgOur + d.avgOther)} <small class="muted">тыс. тг</small></div><span class="small">наш банк ${T(d.avgOur)} · другие ${T(d.avgOther)}</span></div>
      <div><span class="small muted">Расчётный лимит</span><div class="v">${T(Math.floor(d.limit / 100) * 100)} <small class="muted">тыс. тг</small></div><span class="small">${!a ? "" : a <= d.limit + 0.5 ? "запрос укладывается" : "запрос больше лимита — снизить сумму"}</span></div>
    </div></section>`;
}

/* ---------------------------------------------------------------- 5. Заключение: готовый документ, без редактирования */
function pageConcl(pr, v) {
  const doc = buildConclusion(pr, v);
  return `<div class="pagehead"><div class="lead"><h1>Заключение</h1><p class="one">Готовое заключение по всем данным клиента. Оно обновляется само, когда вы меняете цифры.</p></div>
    <div class="row noprint actions">${navigator.share ? `<button class="btn" data-act="share">Поделиться</button>` : ""}<button class="btn" data-act="copy">Копировать текст</button><button class="btn" data-act="handoff">Передать в Финансовый анализ</button><button class="btn primary" data-act="print">Печать / PDF</button></div></div>
  <article class="doc">${docHtml(doc)}</article>`;
}
const docText = doc => doc.map((b, i) => b.title ? b.title.toUpperCase() : b.h ? "\n" + b.h.toUpperCase() : b.li ? "– " + b.li : b.v ? `\nВЫВОД: ${b.v.title.toUpperCase()}\n${b.v.text}` : b.meta ? (i === doc.length - 1 ? "\n" + b.meta : b.meta) : b.p).join("\n").trim();
function docHtml(doc) {
  let out = "", ul = false;
  for (const b of doc) {
    if (b.li && !ul) { out += "<ul>"; ul = true; } else if (!b.li && ul) { out += "</ul>"; ul = false; }
    if (b.title) out += `<h2 class="dt">${esc(b.title)}</h2>`;
    else if (b.meta) out += `<p class="dmeta">${esc(b.meta)}</p>`;
    else if (b.v) out += `<div class="dverdict ${b.v.sev}"><span>Вывод</span><b>${esc(b.v.title)}</b><p>${esc(b.v.text)}</p></div>`;
    else if (b.h) out += `<h3>${esc(b.h)}</h3>`;
    else if (b.li) out += `<li>${b.sev ? `<span class="tag ${b.sev}">${SEVT[b.sev]}</span> ` : ""}${esc(b.li)}</li>`;
    else out += `<p>${esc(b.p)}</p>`;
  }
  return out + (ul ? "</ul>" : "");
}
function buildConclusion(pr, v) {
  const c = X.card, m = analyze(), D = [], t = x => isNum(x) ? fmt(x) + " тыс. тг" : "нет данных";
  const P = p => D.push({ p }), H = h => D.push({ h }), LI = (li, sev) => D.push({ li, sev });
  D.push({ title: "Экспресс-анализ клиента" });
  D.push({ meta: `${c.name || "Клиент"} · ${new Date().toLocaleDateString("ru-RU")} · предварительная оценка` });
  D.push({ v });
  H("1. Запрос клиента");
  P(`${c.product || "Кредит"} на сумму ${t(c.amount)}, срок ${isOD(c) ? "кредитной линии " : ""}${c.term || "—"} мес., ставка ${isNum(c.rate) ? fmt(c.rate, "d2") + " %" : "—"}. Цель — ${(c.purpose || "").toLowerCase()}.`);
  if (m.newPay) P(isOD(c) ? `Проценты при полном использовании лимита — около ${t(m.newPay.pay)} в месяц.` : m.newPay.wc ? `Тип финансирования — ВКЛ, поэтому в платёжную нагрузку включены только проценты: ${t(m.newPay.year)} в год (около ${t(m.newPay.pay)} в месяц).` : `Ежемесячный платёж по новому кредиту — около ${t(m.newPay.pay)} (${m.newPay.note}); за год — около ${t(m.newPay.year)}.`);
  if (isBU(c) || isSU(c)) { P(`Условия продукта «${c.product}»:`); for (const k of prodChecksX(m)) LI(`${k.t}: ${k.fact.replace(/\.$/, "")}.`, k.sev); }
  H("2. Финансовое положение");
  if (m.pl) {
    P(`Выручка за ${perLabel(m.pl)} — ${t(fv("rev", m.pl.id))}${m.k !== 1 ? ` (в пересчёте на год около ${t(m.rev)})` : ""}${isNum(m.revGr) ? `; ${m.revGr >= 0 ? "рост" : "снижение"} на ${fmt(Math.abs(m.revGr), "p")} к прошлому году` : ""}.`);
    P(m.ni >= 0 ? `Бизнес прибыльный: чистая прибыль ${t(val("ni", m.pl.id))}, из каждых 100 тенге выручки остаётся ${fmt(m.nm * 100, "1")} тенге.` : `Бизнес убыточный: чистый убыток ${t(val("ni", m.pl.id))}.`);
    P(`Заработок до процентов, налогов и амортизации (EBITDA) — ${t(m.ebitda)} в год${m.daKnown ? "" : " (без амортизации — оценка осторожная)"}.`);
    if (m.fam > 0) P(`На семью (расходы вне бизнеса за вычетом доходов вне бизнеса) уходит около ${t(m.fam)} в год — это учтено при расчёте денег на платежи.`);
  } else P("Данных о выручке и прибыли нет.");
  if (m.bal) {
    P(`На ${new Date(m.bal.date).toLocaleDateString("ru-RU")}: активы ${t(m.ta)}, собственный капитал ${t(m.eq)} (${isNum(m.eqr) ? fmt(m.eqr, "p") : "—"} от активов), кредиты и займы ${t(m.debt)}.`);
    if (isNum(m.liq)) P(`Ликвидность ${fmt(m.liq, "x")} — ${m.liq >= NORM.liq_ok ? "текущих активов хватает на погашение долгов до года" : "текущих активов не хватает на погашение долгов до года"}.`);
  }
  if (isNum(m.ocf)) P(`По отчёту о движении денег поток от основной деятельности — ${t(m.ocf)} в год.`);
  if (isOD(c)) {
    const d = odCalc();
    H("3. Лимит овердрафта");
    P(`Очищенные поступления за ${d.n} мес. до месяца заявки${d.auto ? " (по выпискам)" : ""}: в нашем банке ${t(d.sOur)}, в других банках ${t(d.sOther)}; среднемесячно ${t(d.avgOur + d.avgOther)}${d.cutAny ? " (поступления крупнейшего покупателя учтены не более 60 %)" : ""}.`);
    if (d.auto) {
      const exs = Object.entries(OD_EX).map(([k, nm]) => [nm.replace(/^\d+\.\s*/, "").toLowerCase(), d.S.our.ex[k].v + d.S.other.ex[k].v]).filter(x => x[1] > 0);
      P(`Всего поступлений по выпискам — ${t(d.S.our.gross + d.S.other.gross)}${exs.length ? `; исключено ${t(sum(exs.map(x => x[1])))}: ${exs.map(([nm, v]) => `${nm} — ${t(v)}`).join("; ")}` : "; исключений нет"}.`);
    }
    P(`Расчётный лимит — ${t(Math.floor(d.limit / 100) * 100)}${d.capHit ? " (ограничен 100 млн тг при транше до 90 дней)" : ""}. ${N(c.amount) ? (N(c.amount) <= d.limit + 0.5 ? "Запрошенная сумма укладывается в лимит." : `Запрошено ${t(c.amount)} — больше лимита.`) : ""}`);
    P(`Транш до ${odCfg().tranche} дней, срок кредитной линии ${c.term || "—"} мес. ${m.payKnown ? `Взнос по действующим кредитам — около ${t(m.payExist)} в месяц.` : ""}`);
    P("Условия овердрафта:");
    for (const k of odChecks(d)) LI(`${k.t}: ${k.fact.replace(/\.$/, "")}.`, k.sev);
  } else {
    H("3. Платёжеспособность");
    P(m.payKnown ? `Взнос по действующим кредитам — около ${t(m.payExist)} в месяц.` : "Взнос по действующим кредитам не указан.");
    if (isNum(m.dscr)) {
      P(`Бизнес зарабатывает около ${t(m.cashMonth)} в месяц; со всеми платежами, включая новый кредит, нужно платить ${t(m.payTotal)} в месяц. Покрытие платежей ${fmt(m.dscr, "x")} (норма от ${fmt(NORM.dscr_ok, "x")}) — ${m.dscr >= NORM.dscr_ok ? "денег хватает с запасом" : m.dscr >= 1 ? "денег хватает впритык" : "денег не хватает"}.`);
      if (isNum(m.maxAmt) && N(c.amount)) P(m.maxAmt >= N(c.amount) ? `Запрошенная сумма укладывается в возможности клиента (по доходам — до ${t(Math.floor(m.maxAmt / 100) * 100)}).` : m.maxAmt > 0 ? `По доходам клиент может обслуживать кредит примерно до ${t(Math.floor(m.maxAmt / 100) * 100)} на тех же условиях — это меньше запрошенного.` : "При текущих доходах новый кредит клиенту не по силам.");
    }
    if (isNum(m.lev)) P(`Все долги с новым кредитом — ${t(m.debtNew)}, это ${fmt(m.lev, "1")} годового заработка (норма до ${fmt(NORM.lev_ok, "1")}).`);
  }
  H("4. Замечания");
  const serious = pr.filter(p => p.sev !== "ok");
  if (serious.length) serious.forEach(p => LI(`${p.title}. ${p.why}`, p.sev));
  else P("Существенных проблем и расхождений не выявлено.");
  H("5. Рекомендация");
  if (v.sev === "crit") P("Заявку дальше не вести до устранения стоп-факторов. Сообщить клиенту о причинах.");
  else if (v.sev === "nd") P("Дособрать данные и повторить экспресс-анализ.");
  else if (v.sev === "ok") P("Клиент предварительно соответствует требованиям. Запросить полный пакет документов и передать на анализ.");
  else if (isOD(c)) { const d = odCalc(); P(`Клиента можно рассматривать при условии: ${N(c.amount) > d.limit + 0.5 && d.limit > 0 ? `лимит не более ${t(Math.floor(d.limit / 100) * 100)}` : "закрытие вопросов ниже"}.`); }
  else P(`Клиента можно рассматривать при условии: ${isNum(m.maxAmt) && N(c.amount) > m.maxAmt && m.maxAmt > 0 ? `снижение суммы до ${t(Math.floor(m.maxAmt / 100) * 100)} или увеличение срока` : "закрытие вопросов ниже"}.`);
  const todos = [...new Set(pr.filter(p => p.todo && p.sev !== "ok").map(p => p.todo))];
  if (todos.length) { P("Что запросить или уточнить у клиента:"); todos.forEach(x => LI(x)); }
  D.push({ meta: "Экспресс-анализ предварительный и не заменяет полного анализа и решения кредитного комитета. Суммы — в тыс. тенге." });
  D.push({ meta: `Сформировано сайтом «Экспресс-анализ», ${siteVer()}, пилотная эксплуатация.` });
  return D;
}
