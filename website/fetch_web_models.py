#!/usr/bin/env python3
"""Download the 3 browser Whisper models into website/models/ (served by GitHub Pages).
Run by the Pages workflow on every deploy; also usable locally:  pip install huggingface_hub && python scripts/fetch_web_models.py"""
import os, sys
from huggingface_hub import snapshot_download

MODELS = ["Xenova/whisper-tiny", "Xenova/whisper-base", "Xenova/whisper-small"]
PATTERNS = ["*.json", "*.txt", "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"]
NEEDED = ["config.json", "tokenizer.json", "preprocessor_config.json", "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"]
root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "website", "models")

total = 0
for m in MODELS:
    dest = os.path.join(root, m)
    if not os.path.isfile(os.path.join(dest, NEEDED[-1])):
        print("downloading", m, flush=True)
        snapshot_download(repo_id=m, local_dir=dest, allow_patterns=PATTERNS)
    missing = [f for f in NEEDED if not os.path.isfile(os.path.join(dest, f))]
    if missing:
        sys.exit("%s is missing %s - check the file names in the Hugging Face repo" % (m, missing))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(dest) for f in fs)
    total += size
    print("%-24s %6.1f MB" % (m, size / 1048576))
print("total %.1f MB (GitHub Pages limit is 1000 MB)" % (total / 1048576))
if total > 950 * 1048576:
    sys.exit("models too large for GitHub Pages")
