# -*- coding: utf-8 -*-
"""Собирает главную страницу (/index.html): две кнопки — «Финансовый анализ» и «Экспресс анализ».
Шрифты Roboto и Jost встроены (без внешних ссылок). Запуск из корня проекта: python3 hub/build.py"""
import base64, re
F = [("Roboto", 400, "roboto-400"), ("Roboto", 700, "roboto-700"), ("Jost", 500, "jost-500")]
fonts = "".join(f'@font-face{{font-family:"{fam}";font-weight:{w};font-style:normal;font-display:swap;src:url(data:font/woff;base64,{base64.b64encode(open(f"express/src/fonts/{n}.woff","rb").read()).decode()}) format("woff");}}' for fam, w, n in F)
css = fonts + open("hub/hub.css", encoding="utf-8").read()
html = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#023DFF">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>Финансовый анализ — ОФКК Костанай</title>
<style>{css}</style></head>
<body>
<div class="wrap">
<header><div class="mark" aria-hidden="true"></div><div><b>Финансовый анализ</b><span>ОФКК Костанай</span></div></header>
<main>
<h1>Выберите инструмент</h1>
<p class="lead">Два инструмента для двух этапов работы с клиентом: быстрая предварительная оценка при первом обращении и полный анализ для кредитного решения.</p>
<div class="cards">
<a class="card" href="/finanaliz/"><span class="num">1 · для кредитного менеджера</span><h2>Финансовый анализ</h2>
<p>Полный анализ юридических лиц и групп компаний: отчётность, налоги, банк, кредитная история, прогноз, заключение.</p>
<ul><li>Баланс, ОПиУ, ДДС, коэффициенты и DSCR</li><li>Выписки банков, ПКБ, залог и гаранты</li><li>Заключение для кредитного комитета</li></ul>
<span class="go">Открыть</span></a>
<a class="card alt" href="/express/"><span class="num">2 · для клиентского менеджера</span><h2>Экспресс анализ</h2>
<p>При первом обращении клиента, по минимуму документов, решить, стоит ли собирать полный пакет. Без регистрации.</p>
<ul><li>Загрузка отчётности: Excel, PDF, сканы</li><li>Расчёт суммы по доходам и лимита овердрафта</li><li>Пояснения простым языком, готовое заключение</li></ul>
<span class="go">Открыть</span></a>
</div>
</main>
</div>
<footer>© 2026 Создан ОФКК Костанай</footer>
</body></html>"""
assert not re.search(r"https?://", html), "внешние ссылки"
open("index.html", "w", encoding="utf-8").write(html)
print(len(html))
