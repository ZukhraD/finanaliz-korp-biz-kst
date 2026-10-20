"use strict";
/* ================================================================ Сканы: PDF без текста и фотографии документов.
   Картинка страницы берётся из PDF (JPEG, Flate, CCITT), распознаётся Tesseract в фоновом процессе браузера (ocr/worker.js),
   а результат собирается в те же строки и ячейки, что и у PDF с текстом, — дальше разбор общий. Ничего не отправляется наружу. */
const OCR = (() => {
  let worker = null, seq = 0;
  const waits = new Map();
  function getWorker() {
    if (worker) return worker;
    if (location.protocol === "file:") throw new Error("распознавание сканов работает только на сайте (не в файле, открытом с компьютера)");
    worker = new Worker("/express/ocr/worker.js");
    worker.onmessage = e => { const w = waits.get(e.data.id); if (w) { waits.delete(e.data.id); e.data.err ? w.rej(new Error(e.data.err)) : w.res(e.data); } };
    worker.onerror = e => { for (const [, w] of waits) w.rej(new Error("движок распознавания не загрузился")); waits.clear(); worker = null; };
    return worker;
  }
  const run = png => new Promise((res, rej) => { const id = ++seq; waits.set(id, { res, rej }); getWorker().postMessage({ id, png }, [png.buffer]); });

  /* --- картинка страницы → холст в оттенках серого, нужного размера */
  const TARGET = 2480;    // ~300 dpi для A4
  function canvasFor(w, h, rot) {
    const k = Math.min(3, Math.max(0.5, TARGET / Math.max(1, Math.min(w, h))));
    const sw = Math.round(w * k), sh = Math.round(h * k), r = ((rot % 360) + 360) % 360;
    const cv = document.createElement("canvas");
    cv.width = r === 90 || r === 270 ? sh : sw; cv.height = r === 90 || r === 270 ? sw : sh;
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
    g.translate(cv.width / 2, cv.height / 2); g.rotate(r * Math.PI / 180);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    return { cv, g, sw, sh };
  }
  async function toPng(cv) {
    const g = cv.getContext("2d"), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; d[i] = d[i + 1] = d[i + 2] = y; }
    g.putImageData(im, 0, 0);
    const blob = await new Promise(res => cv.toBlob(res, "image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function drawBitmap(bmp, rot) {
    const { cv, g, sw, sh } = canvasFor(bmp.width, bmp.height, rot);
    g.drawImage(bmp, -sw / 2, -sh / 2, sw, sh);
    return cv;
  }
  // несжатые пиксели (Flate/LZW или CCITT уже распакован) → ImageData
  function rawToImageData(img) {
    const { w, h, bpc, cs, pal } = img, data = img.data, out = new ImageData(w, h), o = out.data;
    const nc = pal ? 1 : cs === "/DeviceGray" || img.mask ? 1 : cs === "/DeviceCMYK" ? 4 : 3;
    const rowBits = w * nc * bpc, stride = Math.ceil(rowBits / 8), max = (1 << bpc) - 1;
    const get = (row, idx) => {
      if (bpc === 8) return data[row * stride + idx];
      if (bpc === 16) return data[row * stride + idx * 2];
      const bit = idx * bpc, byte = data[row * stride + (bit >> 3)], sh = 8 - bpc - (bit & 7);
      return (byte >> sh) & max;
    };
    const sc = bpc >= 8 ? 1 : 255 / max;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4; let r, gg, b;
      if (pal) { const i = get(y, x) * 3; r = pal[i]; gg = pal[i + 1]; b = pal[i + 2]; }
      else if (nc === 1) { let v = get(y, x) * sc; if (img.invert) v = 255 - v; r = gg = b = v; }
      else if (nc === 4) { const c = get(y, x * 4), m = get(y, x * 4 + 1), yy = get(y, x * 4 + 2), k = get(y, x * 4 + 3); r = 255 - Math.min(255, c + k); gg = 255 - Math.min(255, m + k); b = 255 - Math.min(255, yy + k); }
      else { r = get(y, x * 3) * sc; gg = get(y, x * 3 + 1) * sc; b = get(y, x * 3 + 2) * sc; }
      o[p] = r; o[p + 1] = gg; o[p + 2] = b; o[p + 3] = 255;
    }
    return out;
  }
  async function pageCanvas(img) {
    if (img.type === "jpeg") {
      const bmp = await createImageBitmap(new Blob([img.data], { type: "image/jpeg" }));
      return drawBitmap(bmp, img.rot);
    }
    if (img.type === "jpx" || img.type === "jbig2" || img.type === "unknown") throw new Error(`скан сохранён в формате ${img.type === "jpx" ? "JPEG 2000" : img.type === "jbig2" ? "JBIG2" : "который браузер не читает"} — пересохраните PDF (например, «Печать в PDF») или отсканируйте в цвете / оттенках серого`);
    if (img.type === "ccitt") img = { ...img, data: CCITT.decode(img.data, img.w, img.h, img.parms || {}), bpc: 1, cs: "/DeviceGray", pal: null };
    if (img.type === "raw" || img.type === "ccitt") {
      const id = rawToImageData(img), tmp = document.createElement("canvas"); tmp.width = img.w; tmp.height = img.h; tmp.getContext("2d").putImageData(id, 0, 0);
      return drawBitmap(tmp, img.rot);
    }
    throw new Error("не удалось достать картинку страницы");
  }

  /* --- результат распознавания (TSV: слово, координаты) → строки и ячейки, как у PDF с текстом */
  const DIGITISH = { "О": "0", "о": "0", "O": "0", "o": "0", "З": "3", "з": "3", "l": "1", "I": "1", "|": "1", "Б": "6", "б": "6", "S": "5", "s": "5", "В": "8", "Z": "2" };
  function fixWord(s) {
    const t = s.replace(/[“”«»"']/g, "");
    const digits = (t.match(/\d/g) || []).length;
    if (digits && digits / t.replace(/[\s.,()\-−–]/g, "").length >= 0.6) return t.replace(/[ОоOoЗзlI|БбSsВZ]/g, c => DIGITISH[c]).replace(/[−–—]/g, "-");
    return s;
  }
  function tsvToPage(tsv, W, H) {
    const words = [];
    for (const row of tsv.split("\n")) {
      const c = row.split("\t"); if (c[0] !== "5" || c.length < 12) continue;
      const s = c.slice(11).join(" ").trim(), conf = +c[10]; if (!s || conf < 0) continue;
      words.push({ l: +c[6], t: +c[7], w: +c[8], h: +c[9], s: fixWord(s), conf });
    }
    // группы цифр «1 234 567» — одно число
    words.sort((a, b) => (a.t + a.h / 2) - (b.t + b.h / 2) || a.l - b.l);
    const k = 600 / Math.max(W, 1), items = [];
    for (const wd of words) items.push({ x: wd.l * k, y: (H - wd.t - wd.h) * k, s: wd.s, w: wd.w * k, fs: Math.max(6, wd.h * k * 1.15), dx: 1, dy: 0, h: wd.h * k });
    const lines = PdfReader._test.layout(items);
    for (const L of lines) for (const cell of L.cells) {
      // внутри ячейки склеиваем группы разрядов: «12 345 678» → «12345678», «(1 234)» → «(1234)»
      cell.s = cell.s.replace(/(\d)\s(?=\d{3}(?:\D|$))/g, "$1");
    }
    for (const L of lines) L.text = L.cells.map(c => c.s).join("  ");
    return { lines };
  }

  /* --- PDF-скан: все страницы */
  async function pdf(buf, onProgress) {
    const imgs = await PdfReader.pageImages(buf);
    if (!imgs.some(Boolean)) throw new Error("в PDF нет ни текста, ни картинок страниц");
    const pages = []; let confSum = 0, n = 0;
    for (let i = 0; i < imgs.length; i++) {
      if (onProgress) onProgress(i + 1, imgs.length);
      if (!imgs[i]) { pages.push({ lines: [] }); continue; }
      const cv = await pageCanvas(imgs[i]), png = await toPng(cv);
      const r = await run(png);
      pages.push(tsvToPage(r.tsv, cv.width, cv.height)); confSum += r.conf; n++;
    }
    return { pages, ocr: true, conf: n ? confSum / n : 0, noText: false, nPages: imgs.length };
  }
  /* --- фото / картинка документа */
  async function image(file, onProgress) {
    if (onProgress) onProgress(1, 1);
    const bmp = await createImageBitmap(file);
    const cv = await drawBitmap(bmp, 0), png = await toPng(cv), r = await run(png);
    return { pages: [tsvToPage(r.tsv, cv.width, cv.height)], ocr: true, conf: r.conf, noText: false, nPages: 1 };
  }
  return { pdf, image };
})();

/* ---------------------------------------------------------------- CCITT G3/G4 (чёрно-белые сканы МФУ) */
const CCITT = (() => {
  // коды длин серий: [длина кода, код, длина серии]
  const WT = [[8,0x35,0],[6,0x7,1],[4,0x7,2],[4,0x8,3],[4,0xB,4],[4,0xC,5],[4,0xE,6],[4,0xF,7],[5,0x13,8],[5,0x14,9],[5,0x7,10],[5,0x8,11],[6,0x8,12],[6,0x3,13],[6,0x34,14],[6,0x35,15],[6,0x2A,16],[6,0x2B,17],[7,0x27,18],[7,0xC,19],[7,0x8,20],[7,0x17,21],[7,0x3,22],[7,0x4,23],[7,0x28,24],[7,0x2B,25],[7,0x13,26],[7,0x24,27],[7,0x18,28],[8,0x2,29],[8,0x3,30],[8,0x1A,31],[8,0x1B,32],[8,0x12,33],[8,0x13,34],[8,0x14,35],[8,0x15,36],[8,0x16,37],[8,0x17,38],[8,0x28,39],[8,0x29,40],[8,0x2A,41],[8,0x2B,42],[8,0x2C,43],[8,0x2D,44],[8,0x4,45],[8,0x5,46],[8,0xA,47],[8,0xB,48],[8,0x52,49],[8,0x53,50],[8,0x54,51],[8,0x55,52],[8,0x24,53],[8,0x25,54],[8,0x58,55],[8,0x59,56],[8,0x5A,57],[8,0x5B,58],[8,0x4A,59],[8,0x4B,60],[8,0x32,61],[8,0x33,62],[8,0x34,63],
    [5,0x1B,64],[5,0x12,128],[6,0x17,192],[7,0x37,256],[8,0x36,320],[8,0x37,384],[8,0x64,448],[8,0x65,512],[8,0x68,576],[8,0x67,640],[9,0xCC,704],[9,0xCD,768],[9,0xD2,832],[9,0xD3,896],[9,0xD4,960],[9,0xD5,1024],[9,0xD6,1088],[9,0xD7,1152],[9,0xD8,1216],[9,0xD9,1280],[9,0xDA,1344],[9,0xDB,1408],[9,0x98,1472],[9,0x99,1536],[9,0x9A,1600],[6,0x18,1664],[9,0x9B,1728]];
  const BT = [[10,0x37,0],[3,0x2,1],[2,0x3,2],[2,0x2,3],[3,0x3,4],[4,0x3,5],[4,0x2,6],[5,0x3,7],[6,0x5,8],[6,0x4,9],[7,0x4,10],[7,0x5,11],[7,0x7,12],[8,0x4,13],[8,0x7,14],[9,0x18,15],[10,0x17,16],[10,0x18,17],[10,0x8,18],[11,0x67,19],[11,0x68,20],[11,0x6C,21],[11,0x37,22],[11,0x28,23],[11,0x17,24],[11,0x18,25],[12,0xCA,26],[12,0xCB,27],[12,0xCC,28],[12,0xCD,29],[12,0x68,30],[12,0x69,31],[12,0x6A,32],[12,0x6B,33],[12,0xD2,34],[12,0xD3,35],[12,0xD4,36],[12,0xD5,37],[12,0xD6,38],[12,0xD7,39],[12,0x6C,40],[12,0x6D,41],[12,0xDA,42],[12,0xDB,43],[12,0x54,44],[12,0x55,45],[12,0x56,46],[12,0x57,47],[12,0x64,48],[12,0x65,49],[12,0x52,50],[12,0x53,51],[12,0x24,52],[12,0x37,53],[12,0x38,54],[12,0x27,55],[12,0x28,56],[12,0x58,57],[12,0x59,58],[12,0x2B,59],[12,0x2C,60],[12,0x5A,61],[12,0x66,62],[12,0x67,63],
    [10,0xF,64],[12,0xC8,128],[12,0xC9,192],[12,0x5B,256],[12,0x33,320],[12,0x34,384],[12,0x35,448],[13,0x6C,512],[13,0x6D,576],[13,0x4A,640],[13,0x4B,704],[13,0x4C,768],[13,0x4D,832],[13,0x72,896],[13,0x73,960],[13,0x74,1024],[13,0x75,1088],[13,0x76,1152],[13,0x77,1216],[13,0x52,1280],[13,0x53,1344],[13,0x54,1408],[13,0x55,1472],[13,0x5A,1536],[13,0x5B,1600],[13,0x64,1664],[13,0x65,1728]];
  const EXT = [[11,0x8,1792],[11,0xC,1856],[11,0xD,1920],[12,0x12,1984],[12,0x13,2048],[12,0x14,2112],[12,0x15,2176],[12,0x16,2240],[12,0x17,2304],[12,0x1C,2368],[12,0x1D,2432],[12,0x1E,2496],[12,0x1F,2560]];
  const mk = t => { const m = new Map(); for (const [l, c, r] of t.concat(EXT)) m.set(l * 65536 + c, r); return m; };
  const WM = mk(WT), BM = mk(BT);
  function decode(data, cols, rows, prm) {
    const K = +(prm.K || 0), C = +prm.Columns || cols || 1728, R = +prm.Rows || rows || 0, blackIs1 = prm.BlackIs1 === true || (prm.BlackIs1 && prm.BlackIs1.k === "true"), align = !!prm.EncodedByteAlign;
    let pos = 0; const nbits = data.length * 8;
    const bit = () => { if (pos >= nbits) return 0; const b = (data[pos >> 3] >> (7 - (pos & 7))) & 1; pos++; return b; };
    const peek = n => { let v = 0; for (let i = 0; i < n; i++) { const p = pos + i; v = (v << 1) | (p < nbits ? (data[p >> 3] >> (7 - (p & 7))) & 1 : 0); } return v; };
    const run1 = white => { const M = white ? WM : BM; let code = 0; for (let l = 1; l <= 13; l++) { code = (code << 1) | bit(); const r = M.get(l * 65536 + code); if (r !== undefined) return r; } return -1; };
    const runLen = white => { let t = 0; for (;;) { const r = run1(white); if (r < 0) return -1; t += r; if (r < 64) return t; } };
    const stride = Math.ceil(C / 8), out = new Uint8Array(stride * (R || 4000)).fill(0);
    let ref = [C, C], y = 0;
    const setRow = (chg) => { // chg: позиции смены цвета, начиная с белого; в выход — 1 = чёрный
      const off = y * stride; let col = 0, black = false;
      for (const c of chg) { if (black) for (let x = col; x < Math.min(c, C); x++) out[off + (x >> 3)] |= 0x80 >> (x & 7); col = c; black = !black; }
      if (black) for (let x = col; x < C; x++) out[off + (x >> 3)] |= 0x80 >> (x & 7);
    };
    const maxRows = R || 4000;
    while (y < maxRows && pos < nbits) {
      if (align && K >= 0 && pos & 7) pos += 8 - (pos & 7);
      // EOL (000000000001) пропускаем
      while (peek(12) === 1) pos += 12;
      let twoD = K < 0;
      if (K > 0) twoD = bit() === 0;
      const cur = []; let a0 = -1, color = 0;  // 0 — белый
      if (!twoD) {
        let x = 0; let white = true;
        while (x < C) { const r = runLen(white); if (r < 0) { pos = nbits; break; } x += r; cur.push(Math.min(x, C)); white = !white; }
      } else {
        const b1of = (a0, col) => { let i = 0; while (i < ref.length && (ref[i] <= a0 || (i & 1) !== col)) i++; return i; };
        while (a0 < C) {
          const bi = b1of(a0 < 0 ? -1 : a0, color), b1 = ref[bi] ?? C, b2 = ref[bi + 1] ?? C;
          if (peek(4) === 1) { pos += 4; a0 = b2; continue; }                                   // pass
          if (peek(3) === 1) { pos += 3; const st = a0 < 0 ? 0 : a0; const r1 = runLen(color === 0), r2 = runLen(color !== 0); if (r1 < 0 || r2 < 0) { pos = nbits; break; } const a1 = st + r1, a2 = a1 + r2; cur.push(Math.min(a1, C), Math.min(a2, C)); a0 = a2; continue; } // horizontal
          let d = null;
          if (bit() === 1) d = 0;
          else { const b = (bit() << 1) | bit(); if (b === 3) d = 1; else if (b === 2) d = -1; else { const b2_ = (b << 3) | (bit() << 2) | (bit() << 1) | bit(); if (b2_ === 3) d = 2; else if (b2_ === 2) d = -2; else { const b3 = (b2_ << 1) | bit(); if (b3 === 3) d = 3; else if (b3 === 2) d = -3; else { pos = nbits; break; } } } }
          const a1 = Math.max(0, b1 + d); cur.push(Math.min(a1, C)); a0 = a1; color ^= 1;
        }
      }
      setRow(cur); ref = cur.concat([C, C]); y++;
    }
    const used = out.subarray(0, stride * (R || y));
    if (!blackIs1) for (let i = 0; i < used.length; i++) used[i] ^= 0xFF;   // в PDF по умолчанию 0 — чёрный
    return used;
  }
  return { decode };
})();
