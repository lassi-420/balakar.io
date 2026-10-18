"""Model manager: download Whisper / NLLB checkpoints into a local folder for fully offline use.

    python -m captionkit.models list
    python -m captionkit.models pull small
    python -m captionkit.models pull turbo --dir D:/models
"""
import json
import os
import sys

REGISTRY = {
    "base":  {"repo": "openai/whisper-base",           "dir": "whisper-base",  "size": "0.15 GB", "kind": "whisper"},
    "small": {"repo": "openai/whisper-small",          "dir": "whisper-small", "size": "0.5 GB",  "kind": "whisper"},
    "medium": {"repo": "openai/whisper-medium",        "dir": "whisper-medium", "size": "1.5 GB", "kind": "whisper"},
    "turbo": {"repo": "openai/whisper-large-v3-turbo", "dir": "whisper-large-v3-turbo", "size": "1.6 GB", "kind": "whisper"},
    "nllb":  {"repo": "facebook/nllb-200-distilled-600M", "dir": "nllb-200-600m", "size": "2.5 GB", "kind": "translation"},
}
_PATTERNS = ["*.json", "*.txt", "*.model", "*.safetensors"]
_IGNORE = ["tf_*", "flax_*", "*.h5", "*.msgpack", "*.onnx", "*.ot"]


def models_dir(override=None):
    base = override or os.environ.get("BALAKAR_MODELS") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "models")
    return os.path.abspath(base)


def pull(key, dest_root=None, progress=print):
    if key not in REGISTRY:
        raise SystemExit("unknown model '%s' (choose: %s)" % (key, ", ".join(REGISTRY)))
    # downloading is the ONE operation that needs the network; override offline mode here
    os.environ.pop("HF_HUB_OFFLINE", None)
    os.environ.pop("TRANSFORMERS_OFFLINE", None)
    from huggingface_hub import snapshot_download
    m = REGISTRY[key]
    dest = os.path.join(models_dir(dest_root), m["dir"])
    patterns = list(_PATTERNS) + (["*.bin"] if m["kind"] == "translation" else [])
    progress("Downloading %s (%s) -> %s" % (m["repo"], m["size"], dest))
    snapshot_download(repo_id=m["repo"], local_dir=dest, allow_patterns=patterns, ignore_patterns=_IGNORE)
    progress("Done: " + dest)
    return dest


def installed(dest_root=None):
    root = models_dir(dest_root)
    return {k: os.path.join(root, v["dir"]) for k, v in REGISTRY.items()
            if os.path.isfile(os.path.join(root, v["dir"], "config.json"))}


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    d = None
    if "--dir" in a:
        i = a.index("--dir"); d = a[i + 1]; del a[i:i + 2]
    if not a or a[0] == "list":
        have = installed(d)
        print(json.dumps({k: {"size": v["size"], "repo": v["repo"], "installed": k in have} for k, v in REGISTRY.items()}, indent=2))
    elif a[0] == "pull" and len(a) > 1:
        for k in a[1:]:
            pull(k, d)
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
