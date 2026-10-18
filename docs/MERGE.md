# Merging into your existing plugin

## 0. Architecture
```
panel (HTML/JS in CEP)  --fetch+token-->  backend (python, 127.0.0.1)   -> Whisper / NLLB / ffmpeg
        |  evalScript (UTF-8 temp file)
   jsx/kk-captions.jsx  -> builds/styles caption layers, render queue, imports audio
```

## 1. Copy files
- `extension/js/*.js`, `extension/css/kk-features.css`, and the `<div id="kk-root">` block from `extension/index.html` into your extension.
- `extension/jsx/kk-captions.jsx` into your extension's `jsx/` folder.
- `engine/` anywhere (ship it next to your Python/Whisper runtime).

## 2. Load them (index.html)
```html
<link rel="stylesheet" href="css/kk-features.css">
<script src="CSInterface.js"></script> <!-- use Adobe's, or ours: extension/js/CSInterface.js -->
<script src="js/kk-languages.js"></script><script src="js/kk-segments.js"></script>
<script src="js/kk-export.js"></script><script src="js/kk-templates.js"></script>
<script src="js/kk-api.js"></script><script src="js/kk-bridge.js"></script>
<script src="js/kk-batch.js"></script><script src="js/kk-ui.js"></script>
<script>
  var root = new CSInterface().getSystemPath(SystemPath.EXTENSION);
  window.addEventListener("load", function () { KK.ui.init(root); });
</script>
```
Paste the contents of `kk-features.html` where the UI should appear. All DOM ids are `kk-*`,
the global is `KK`, ExtendScript tags layers with `KK_CAPTION` comments - no collisions with
unprefixed code.

## 3. manifest.xml
Allow local fetch and file dialogs; Node is NOT required.
```xml
<CEFCommandLine><Parameter>--enable-nodejs</Parameter><Parameter>--mixed-context</Parameter></CEFCommandLine>
```
(optional, only if your plugin already uses Node). `cep.fs` and `fetch` work without it.
Set `PlayerDebugMode` while developing unsigned extensions.

## 4. Keep using YOUR local Whisper (compatibility)
Two options, pick one:

**A. Use the bundled server** - it already runs HF `transformers` Whisper with word timestamps.
Point `config.json` `whisper_model` at your cached model id or local folder.

**B. Keep your own transcriber** and feed the rest of the kit:
```js
KK.api.setTranscriber(function (opts, onProgress) {
  // opts = { path, language, task, script, group }
  return yourExistingWhisperCall(opts.path, opts.language);   // Promise
});
```
Return any of: `{segments:[{start,end,text,words?}]}` (openai-whisper / faster-whisper /
whisper.cpp JSON), the raw HF pipeline output `{chunks:[{text,timestamp:[s,e]}]}`, or a segment
array. `KK.segments.normalize` accepts all three; word timestamps unlock highlight/word templates.
Translation, enhancement, export, fonts, templates and render still use the server.

## 5. Security
The server binds to 127.0.0.1 and requires an `X-KK-Token` header; the token is regenerated on
each start and written to `~/.captionkit/token` (mode 600). Do not disable this: the API can
write files and read local media, and any web page can reach localhost.

## 6. Extending
- New template: push an object onto `KK.templates.list` (schema at the top of `kk-templates.js`).
- New enhancement engine: add a branch in `enhance.py`.
- New ExtendScript action: add `A.myAction = function (p) {...}` and call `KK.bridge.call({action:"myAction"})`.

## 7. First-run checklist in After Effects
1. Build captions on a short clip in each template; confirm highlight/pop/typewriter/box work.
2. Switch template and use *Restyle* with "Apply to all" on and off.
3. Urdu/Hindi clip: set the Text Engine preference, install a matching font, confirm shaping.
4. Render alpha / green; if "Lossless with Alpha" is missing, type your template name in the panel.
5. Anything that fails is listed in the panel log with the AE error text - fix the match-name there.
