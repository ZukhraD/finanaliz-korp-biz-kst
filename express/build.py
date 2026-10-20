# -*- coding: utf-8 -*-
"""Собирает index.html — «Экспресс-анализ для КМ»: один офлайн-файл без внешних ссылок.
Читалки Excel/PDF и разбор деклараций (src/read_*.js) — из основного сайта finanaliz."""
import json, re, base64
spec = json.dumps(json.load(open("src/spec.json", encoding="utf-8")), ensure_ascii=False, separators=(",", ":"))
FACES = [("Roboto", 400, "roboto-400"), ("Roboto", 500, "roboto-500"), ("Roboto", 700, "roboto-700"), ("Jost", 500, "jost-500")]
fontcss = "".join(f'@font-face{{font-family:"{fam}";font-weight:{w};font-style:normal;font-display:swap;src:url(data:font/woff;base64,{base64.b64encode(open(f"src/fonts/{n}.woff","rb").read()).decode()}) format("woff");}}' for fam, w, n in FACES)
css = fontcss + open("src/ex.css", encoding="utf-8").read()
parts = ["ex1.js", "read_xlsx.js", "read_pdf.js", "read_decl.js", "ocr.js", "ex2.js", "ex3.js", "ex4.js"]
js = "\n".join(open("src/" + f, encoding="utf-8").read().replace('"use strict";', "", 1) for f in parts)
html = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#023DFF"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'self' data: blob:">
<title>Экспресс-анализ для КМ</title>
<style>{css}</style></head>
<body><script>window.SPEC = {spec};</script>
<script>"use strict";
{js}</script></body></html>"""
assert not re.search(r"https?://(?!www\.w3\.org|schemas\.openxmlformats)", html), "внешние ссылки"
open("index.html", "w", encoding="utf-8").write(html)
print(len(html))
