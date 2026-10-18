"""Configuration: backend/config.json (optional) overridden by environment variables."""
import json
import os

DEFAULTS = {
    "host": "127.0.0.1",
    "port": 8765,
    # Any Hugging Face id OR a local folder with a Whisper checkpoint.
    "whisper_model": "openai/whisper-large-v3-turbo",
    # Per-language overrides, e.g. fine-tuned Hindi/Urdu/Odia checkpoints.
    "model_overrides": {},
    "translation_model": "facebook/nllb-200-distilled-600M",
    "ffmpeg": "ffmpeg",
    "device": "auto",          # auto | cpu | cuda | mps
    "batch_size": 8,
    "offline": True,           # never touch the network; models must already be cached
    "model_dir": None,         # optional HF cache dir
}


def load():
    cfg = dict(DEFAULTS)
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.environ.get("KK_CONFIG", os.path.join(here, "config.json"))
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    env = {
        "KK_PORT": ("port", int), "KK_MODEL": ("whisper_model", str), "KK_FFMPEG": ("ffmpeg", str),
        "KK_DEVICE": ("device", str), "KK_MODEL_DIR": ("model_dir", str),
    }
    for k, (name, cast) in env.items():
        if os.environ.get(k):
            cfg[name] = cast(os.environ[k])
    if os.environ.get("KK_OFFLINE") is not None:
        cfg["offline"] = os.environ["KK_OFFLINE"] not in ("0", "false", "False")
    if cfg["offline"]:
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    if cfg.get("model_dir"):
        os.environ.setdefault("HF_HOME", cfg["model_dir"])
    return cfg
