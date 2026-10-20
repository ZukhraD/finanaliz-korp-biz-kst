# -*- coding: utf-8 -*-
"""Собирает главную страницу (/index.html): две кнопки — «Финансовый анализ» и «Экспресс анализ».
Шрифты Roboto и Jost встроены (без внешних ссылок). Запуск из корня проекта: python3 hub/build.py"""
import base64, re, json
F = [("Roboto", 400, "roboto-400"), ("Roboto", 700, "roboto-700"), ("Jost", 500, "jost-500")]
fonts = "".join(f'@font-face{{font-family:"{fam}";font-weight:{w};font-style:normal;font-display:swap;src:url(data:font/woff;base64,{base64.b64encode(open(f"express/src/fonts/{n}.woff","rb").read()).decode()}) format("woff");}}' for fam, w, n in F)
css = fonts + open("hub/hub.css", encoding="utf-8").read()
KZ = {
  "title": "Корпоративтік клиенттерді қаржылық талдау. Қостанай",
  "h1": "Құралды таңдаңыз",
  "lead": "Клиентпен жұмыстың екі кезеңіне арналған екі құрал: алғашқы өтініш кезіндегі жылдам алдын ала бағалау және кредиттік шешімге арналған толық талдау.",
  "n1": "1 · клиенттік менеджер үшін", "t1": "Экспресс-талдау",
  "p1": "Клиент алғаш хабарласқанда ең аз құжатпен толық топтаманы жинаудың қажеттігін шешу. Тіркелусіз.",
  "a1": "Есептілікті жүктеу: Excel, PDF, скандар", "b1": "Табыс бойынша соманы және овердрафт лимитін есептеу", "c1": "Қарапайым тілмен түсіндірмелер, дайын қорытынды",
  "n2": "2 · кредиттік менеджер үшін", "t2": "Қаржылық талдау",
  "p2": "Заңды тұлғалар мен компаниялар топтарын толық талдау: есептілік, салықтар, банк, несиелік тарих, болжам, қорытынды.",
  "a2": "Баланс, ПЗЕ, АҚҚ, коэффициенттер және DSCR", "b2": "Банк үзінділері, БКБ, кепіл және кепілгерлер", "c2": "Кредиттік комитетке арналған қорытынды",
  "go": "Ашу", "foot": "© 2026 Жасаған: ОФКК Қостанай", "lang": "Тіл",
}
kzjs = json.dumps(KZ, ensure_ascii=False)
html = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#023DFF">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>Финансовый анализ корпоративных клиентов. Костанай</title>
<style>{css}</style></head>
<body>
<div class="wrap">
<header><div class="mark" aria-hidden="true"></div><div><b data-t="title">Финансовый анализ корпоративных клиентов. Костанай</b></div>
<div class="tools"><span class="lang" role="group" aria-label="Язык" data-tl="lang"><button type="button" data-lang="ru" class="on">RUS</button><button type="button" data-lang="kz">KAZ</button></span></div></header>
<main>
<h1 data-t="h1">Выберите инструмент</h1>
<p class="lead" data-t="lead">Два инструмента для двух этапов работы с клиентом: быстрая предварительная оценка при первом обращении и полный анализ для кредитного решения.</p>
<div class="cards">
<a class="card" href="/express/"><div class="ctop"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg></span><span class="num" data-t="n1">1 · для клиентского менеджера</span></div><h2 data-t="t1">Экспресс анализ</h2>
<p data-t="p1">При первом обращении клиента, по минимуму документов, решить, стоит ли собирать полный пакет. Без регистрации.</p>
<ul class="feat"><li data-t="a1">Загрузка отчётности: Excel, PDF, сканы</li><li data-t="b1">Расчёт суммы по доходам и лимита овердрафта</li><li data-t="c1">Пояснения простым языком, готовое заключение</li></ul>
<span class="go"><span data-t="go">Открыть</span><i aria-hidden="true">→</i></span></a>
<a class="card alt" href="/finanaliz/"><div class="ctop"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V11M11 20V4M17 20v-6M3 20h18"/></svg></span><span class="num" data-t="n2">2 · для кредитного менеджера</span></div><h2 data-t="t2">Финансовый анализ</h2>
<p data-t="p2">Полный анализ юридических лиц и групп компаний: отчётность, налоги, банк, кредитная история, прогноз, заключение.</p>
<ul class="feat"><li data-t="a2">Баланс, ОПиУ, ДДС, коэффициенты и DSCR</li><li data-t="b2">Выписки банков, ПКБ, залог и гаранты</li><li data-t="c2">Заключение для кредитного комитета</li></ul>
<span class="go"><span data-t="go">Открыть</span><i aria-hidden="true">→</i></span></a>
</div>
</main>
</div>
<footer data-t="foot">© 2026 Создан ОФКК Костанай</footer>
<script>
(function () {{
  var KZ = {kzjs}, K = "finkz.lang", L = "ru";
  try {{ L = localStorage.getItem(K) === "kz" ? "kz" : "ru"; }} catch (e) {{}}
  var els = document.querySelectorAll("[data-t]"), RU = {{}};
  for (var i = 0; i < els.length; i++) RU[els[i].getAttribute("data-t")] = els[i].textContent;
  function paint() {{
    for (var i = 0; i < els.length; i++) {{ var k = els[i].getAttribute("data-t"); els[i].textContent = L === "kz" ? KZ[k] : RU[k]; }}
    document.documentElement.lang = L === "kz" ? "kk" : "ru";
    document.title = L === "kz" ? KZ.title : RU.title;
    var g = document.querySelector(".lang"); g.setAttribute("aria-label", L === "kz" ? KZ.lang : "Язык");
    var b = g.querySelectorAll("button"); for (var j = 0; j < b.length; j++) b[j].className = b[j].getAttribute("data-lang") === L ? "on" : "";
  }}
  document.querySelector(".lang").addEventListener("click", function (e) {{
    var t = e.target.closest("button"); if (!t) return;
    L = t.getAttribute("data-lang") === "kz" ? "kz" : "ru";
    try {{ localStorage.setItem(K, L); }} catch (e2) {{}}
    paint();
  }});
  paint();
}})();
</script>
</body></html>"""
assert not re.search(r"https?://", html), "внешние ссылки"
open("index.html", "w", encoding="utf-8").write(html)
print(len(html))
