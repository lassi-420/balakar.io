# Contributing
Good first issues: macOS installer, new caption templates (`extension/js/kk-templates.js`), more fine-tuned model recipes, translations of the website.
```
pip install pytest && python -m pytest tests/engine
node tests/panel_test.js && node tests/jsx_mock_test.js
```
Open a pull request against `main`; CI runs all of the above and compiles the installer.
**Real After Effects testing is the most valuable contribution**: the ExtendScript is only mock-tested. Include your AE version and the panel log in bug reports.
Templates must use generic names - no creator names, logos or trademarks.
