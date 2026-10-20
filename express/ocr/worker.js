/* Распознавание текста на сканах (Tesseract, модель rus) — в браузере, без отправки файлов куда-либо.
   Движок и модель загружаются с этого же сайта один раз и кэшируются браузером. */
let api = null, core = null, ready = null;
const simd = (() => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } })();
function init() {
  if (ready) return ready;
  ready = (async () => {
    importScripts(simd ? "tesseract-core-simd-lstm.wasm.js" : "tesseract-core-lstm.wasm.js");
    core = await TesseractCore();
    const r = await fetch("rus.traineddata");
    if (!r.ok) throw new Error("не загрузилась языковая модель");
    core.FS.writeFile("./rus.traineddata", new Uint8Array(await r.arrayBuffer()));
    api = new core.TessBaseAPI();
    if (api.Init(null, "rus", 1) !== 0) throw new Error("движок распознавания не запустился");
    api.SetVariable("tessedit_pageseg_mode", "6");      // таблица как единый блок: строки целиком
    api.SetVariable("preserve_interword_spaces", "1");
    api.SetVariable("user_defined_dpi", "300");
  })();
  return ready;
}
self.onmessage = async e => {
  const { id, png } = e.data;
  try {
    await init();
    core.FS.writeFile("/input", png);
    if (api.SetImageFile(1, 0) === 1) throw new Error("не удалось открыть картинку страницы");
    api.Recognize(null);
    const tsv = api.GetTSVText(0), conf = api.MeanTextConf();
    self.postMessage({ id, tsv, conf });
  } catch (err) { self.postMessage({ id, err: String(err && err.message || err) }); }
};
