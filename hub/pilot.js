(function () {
  var $ = function (s) { return document.querySelector(s); };
  var MAIL = "zukhra.dostanova@berekebank.kz", VER = "__VER__";
  var rep = $("#rep");
  rep.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent("Финансовый анализ (пилот): замечание") + "&body=" + encodeURIComponent("Какой инструмент и раздел:\n\nЧто делали:\n\nЧто ожидали:\n\nЧто получилось:\n\nВерсия: " + VER + "\nБраузер: " + navigator.userAgent + "\n\nНе прикладывайте данные клиентов: только описание и скриншот без персональных данных.");
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]"); if (!b) return;
    var d = document.getElementById(b.getAttribute("data-open")); if (!d) return;
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
    if (d.id === "time") tpaint();
  });
  document.addEventListener("click", function (e) { if (e.target.classList && e.target.classList.contains("dlg")) e.target.close(); });
  /* замер времени */
  var KEY = "finkz.pilot.time.v1", st = { e: [], run: null };
  try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.e) st = s; } catch (x) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (x) {} }
  var tick = 0;
  function clock() {
    if (!st.run) { $("#t-clock").textContent = "00:00"; return; }
    var sec = Math.floor((Date.now() - st.run.t) / 1000), m = Math.floor(sec / 60), r = sec % 60;
    $("#t-clock").textContent = (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }
  function tpaint() {
    $("#t-start").hidden = !!st.run; $("#t-stop").hidden = !st.run;
    if (st.run) { $("#t-tool").value = st.run.tool; clearInterval(tick); tick = setInterval(clock, 1000); } else clearInterval(tick);
    clock();
    var by = {};
    st.e.forEach(function (x) { var o = by[x.tool] = by[x.tool] || { n: 0, m: 0, s: 0 }; o.n++; o.m += x.man; o.s += x.site; });
    var h = "";
    Object.keys(by).forEach(function (k) { var o = by[k], sv = o.m ? Math.round((1 - o.s / o.m) * 100) : 0; h += "<div><b>" + k + "</b>: оценок " + o.n + ", вручную в среднем " + Math.round(o.m / o.n) + " мин, на сайте " + Math.round(o.s / o.n) + " мин, экономия " + sv + " %</div>"; });
    $("#t-sum").innerHTML = h || "<div>Записей пока нет.</div>";
    var t = "<tr><th>Дата</th><th>Инструмент</th><th>Клиент</th><th>Вручную</th><th>На сайте</th><th></th></tr>";
    st.e.slice().reverse().forEach(function (x, i) { t += "<tr><td>" + x.d + "</td><td>" + x.tool + "</td><td>" + x.c.replace(/[<>&]/g, "") + "</td><td>" + x.man + "</td><td>" + x.site + "</td><td><button type=button class='del' data-i='" + (st.e.length - 1 - i) + "' aria-label='Удалить'>×</button></td></tr>"; });
    $("#t-tab").innerHTML = st.e.length ? t : "";
  }
  $("#t-start").addEventListener("click", function () { st.run = { t: Date.now(), tool: $("#t-tool").value }; save(); tpaint(); });
  $("#t-stop").addEventListener("click", function () {
    if (!st.run) return; var m = Math.max(1, Math.round((Date.now() - st.run.t) / 60000)); st.run = null; save(); $("#t-site").value = m; tpaint();
  });
  $("#t-add").addEventListener("click", function () {
    var man = parseInt($("#t-man").value, 10), site = parseInt($("#t-site").value, 10);
    if (!(man > 0) || !(site > 0)) { $("#t-man").focus(); return; }
    st.e.push({ d: new Date().toISOString().slice(0, 10), tool: $("#t-tool").value, c: $("#t-case").value || "—", man: man, site: site });
    save(); $("#t-case").value = $("#t-man").value = $("#t-site").value = ""; tpaint();
  });
  $("#t-tab").addEventListener("click", function (e) { var b = e.target.closest(".del"); if (!b) return; st.e.splice(+b.getAttribute("data-i"), 1); save(); tpaint(); });
  $("#t-clear").addEventListener("click", function () { if (this.dataset.s) { st.e = []; st.run = null; save(); this.dataset.s = ""; this.textContent = "Очистить"; tpaint(); } else { this.dataset.s = "1"; this.textContent = "Нажмите ещё раз"; } });
  $("#t-csv").addEventListener("click", function () {
    var c = "﻿Дата;Инструмент;Клиент;Вручную, мин;На сайте, мин\n" + st.e.map(function (x) { return [x.d, x.tool, x.c, x.man, x.site].join(";"); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([c], { type: "text/csv" })); a.download = "замер_времени.csv"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
})();
