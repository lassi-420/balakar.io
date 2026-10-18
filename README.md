# Balakar

Free, open-source captions for After Effects in 20 languages (Hindi, Urdu, Tamil, Bengali and more).
Everything runs on your PC: local Whisper, no account, no API key, no uploads.

**[Website](https://lassi-420.github.io/balakar.io/)** · **[Download for Windows](https://github.com/lassi-420/balakar.io/releases/latest/download/Balakar-Setup.exe)** · [All releases](https://github.com/lassi-420/balakar.io/releases)

## Use it
1. Download and run `Balakar-Setup.exe`. Pick a speech model (Small is a good start).
2. Restart After Effects, open **Window > Extensions > Balakar**.
3. Select a clip, press **Transcribe**, pick a style, press **Build captions**.

Setup downloads Python, PyTorch, ffmpeg and the model once (10-30 minutes, a few GB). After that it works offline.
Windows may show a SmartScreen warning because the installer is unsigned: More info > Run anyway, or verify the `.sha256` on the release.

## What's inside
| Folder | What |
|---|---|
| `engine/` | Python server: Whisper (Hugging Face transformers), NLLB translation, ffmpeg audio cleanup, exporters, model manager |
| `extension/` | After Effects CEP panel (UI, templates, ExtendScript that builds caption layers) |
| `installer/` | NSIS installer + `setup.ps1` that provisions Python, libraries, ffmpeg, model, and installs the panel |
| `website/` | Static site, deployed by GitHub Pages |
| `docs/` | Troubleshooting, merging into your own plugin |
| `tests/` | Engine, panel and ExtendScript (mock) tests |

## Publish your own copy
```
python scripts/set_repo.py YOURNAME/balakar.io     # rewrites links
git init && git add . && git commit -m "Balakar 1.0.0"
git remote add origin https://github.com/YOURNAME/balakar.io.git && git push -u origin main
```
1. Repo **Settings > Pages > Source: GitHub Actions** (site goes live at `https://YOURNAME.github.io/balakar.io/`).
2. Release: `git tag v1.0.0 && git push --tags`. The *Release installer* workflow builds `Balakar-Setup.exe` on a Windows runner, **silently installs it on a clean machine and checks the engine answers**, and only then attaches it to the release.
3. Optional: sign the exe (e.g. SignPath, Azure Trusted Signing) to remove the SmartScreen warning.

## Build and run from source
```
cd engine && pip install torch transformers accelerate numpy huggingface_hub && python -m captionkit.models pull small
python -m captionkit            # needs ffmpeg on PATH
makensis -DVERSION=1.0.0 installer/balakar.nsi    # -> dist/Balakar-Setup.exe
```

## Honest status
- Python engine, panel logic, templates and ExtendScript control flow are tested (CI). The ExtendScript uses AE property names that were **not yet run inside After Effects**; failures fall back to plain captions and are reported in the panel.
- The installer compiles, and CI installs it silently on Windows before every release, but treat the first release as a beta.
- Whisper has no native Odia or Kashmiri; supply a fine-tuned model in `model_overrides`.
- Windows only for now; Mac contributions welcome.

MIT licensed. Not affiliated with Adobe. See `CONTRIBUTING.md`, `SECURITY.md`, `docs/`.
