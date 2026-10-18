# Troubleshooting
| Symptom | Fix |
|---|---|
| Panel says "Engine offline" | Start Menu > Balakar > Start Engine. It also starts at sign-in. Check `%LOCALAPPDATA%\Programs\Balakar\setup.log`. |
| Balakar missing from Window > Extensions | Restart After Effects. Check `HKCU\Software\Adobe\CSXS.<n>\PlayerDebugMode` = `1` and that the folder `%APPDATA%\Adobe\CEP\extensions\com.balakar.captions` exists. |
| Installer fails while downloading | Re-run it; finished steps are skipped. Needs internet, a few GB free, and access to python.org, pypi.org, download.pytorch.org, github.com, huggingface.co. |
| Urdu/Arabic letters disconnected | AE > Preferences > Type > Text Engine = South Asian and Middle Eastern, and use a font that covers the script. |
| Odia / Kashmiri output is poor | Whisper has no native model. Add a fine-tuned checkpoint under `model_overrides` in `engine/config.json`. |
| Out of memory | Choose a smaller model in `engine/config.json` (`whisper_model`). Models live in `models/`. |
| "Output Module template not found" | Type your own template name in the panel's Render section. |
| Highlight/box/typewriter missing | Captions fall back to plain text if AE rejects a property; the panel log shows the AE error. Please open an issue with it. |
Add more models: `python\python.exe -m captionkit.models pull medium --dir ..\models` from `engine\`, then set `whisper_model` to that folder.
