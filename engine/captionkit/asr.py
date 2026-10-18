"""Local Whisper (Hugging Face transformers) with word timestamps. Nothing leaves the machine."""
import re
import threading

from . import audio as audiomod
from .languages import WHISPER_UNSUPPORTED
from .segmenter import group_words

_DEVA = re.compile(r"[\u0900-\u097F]")


def _device(pref):
    import torch
    if pref in ("cpu", "cuda", "mps"):
        return pref if pref != "cuda" else "cuda:0"
    if torch.cuda.is_available():
        return "cuda:0"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def to_latin(text):
    """Romanise Indic script ('Hinglish' output). Heuristic, good enough for captions."""
    try:
        from indic_transliteration import sanscript
        if _DEVA.search(text):
            t = sanscript.transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)
            for a, b in (("aa", "a"), ("ii", "i"), ("uu", "u"), ("~N", "n"), ("~n", "n"), (".N", "n"),
                         (".n", "n"), ("M", "n"), ("R^i", "ri"), ("sh", "sh"), ("Ch", "chh"), ("ee", "i")):
                t = t.replace(a, b)
            return t.lower()
    except ImportError:
        pass
    try:
        from unidecode import unidecode
        return unidecode(text)
    except ImportError:
        return text


class WhisperEngine:
    def __init__(self, cfg):
        self.cfg = cfg
        self._pipes = {}
        self._lock = threading.Lock()

    def model_for(self, lang, override=None):
        if override:
            return override
        return (self.cfg.get("model_overrides") or {}).get(lang) or self.cfg["whisper_model"]

    def _pipe(self, model_id):
        with self._lock:
            if model_id in self._pipes:
                return self._pipes[model_id]
            import torch
            from transformers import pipeline
            dev = _device(self.cfg.get("device", "auto"))
            dtype = torch.float16 if dev.startswith("cuda") else torch.float32
            p = pipeline("automatic-speech-recognition", model=model_id, torch_dtype=dtype,
                         device=dev)
            self._pipes = {model_id: p}   # keep one model resident to protect VRAM
            return p

    def transcribe(self, path, language=None, task="transcribe", model=None, script=None,
                   prompt=None, group=None, progress=None):
        """Returns {language, model, warnings, segments, words}.
        language: ISO code or None/'auto'. task: 'transcribe' | 'translate' (-> English)
        script: 'latin' to romanise (Hinglish)."""
        progress = progress or (lambda *_: None)
        warnings = []
        lang = None if language in (None, "", "auto") else language
        if lang in WHISPER_UNSUPPORTED:
            warnings.append(
                "Whisper has no native '%s' model; using auto-detect. Set model_overrides['%s'] "
                "to a fine-tuned checkpoint for good results." % (lang, lang))
            lang = None
        model_id = self.model_for(language, model)
        progress(0.05, "loading model")
        pipe = self._pipe(model_id)
        progress(0.2, "decoding audio")
        arr = audiomod.decode_f32(path, self.cfg.get("ffmpeg", "ffmpeg"))
        gk = {"task": task}
        if lang:
            gk["language"] = lang
        if prompt:
            try:
                import torch
                gk["prompt_ids"] = torch.tensor(pipe.tokenizer.get_prompt_ids(prompt))
            except Exception as e:  # prompt support varies by transformers version
                warnings.append("prompt ignored: %s" % e)
        progress(0.3, "transcribing")
        out = pipe({"array": arr, "sampling_rate": 16000}, chunk_length_s=30,
                   batch_size=int(self.cfg.get("batch_size", 8)), return_timestamps="word",
                   generate_kwargs=gk)
        progress(0.9, "segmenting")
        words = []
        for c in out.get("chunks", []):
            s, e = c["timestamp"]
            if s is None:
                continue
            if e is None:
                e = s + 0.3
            txt = c["text"].strip()
            if script == "latin":
                txt = to_latin(txt)
            words.append({"text": txt, "start": round(float(s), 3), "end": round(float(e), 3)})
        segs = group_words(words, **(group or {}))
        progress(1.0, "done")
        return {"language": lang or "auto", "model": model_id, "warnings": warnings,
                "segments": segs, "words": words}
