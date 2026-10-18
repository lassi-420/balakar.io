"""Offline translation with NLLB-200 (70+ target languages)."""
import threading

from .languages import NLLB
from .segmenter import spread_words


class Translator:
    def __init__(self, cfg):
        self.cfg = cfg
        self._lock = threading.Lock()
        self._model = None
        self._tok = None
        self._id = None

    def _load(self, model_id):
        with self._lock:
            if self._id == model_id:
                return
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            self._tok = AutoTokenizer.from_pretrained(model_id)
            m = AutoModelForSeq2SeqLM.from_pretrained(model_id)
            dev = "cuda" if torch.cuda.is_available() else "cpu"
            self._model = m.to(dev).eval()
            self._dev = dev
            self._id = model_id

    def translate_segments(self, segments, source, target, model=None, progress=None):
        progress = progress or (lambda *_: None)
        if source not in NLLB or target not in NLLB:
            raise ValueError("Unsupported language pair: %s -> %s" % (source, target))
        import torch
        self._load(model or self.cfg["translation_model"])
        tok, m = self._tok, self._model
        tok.src_lang = NLLB[source]
        out = []
        B = 8
        for i in range(0, len(segments), B):
            chunk = segments[i:i + B]
            enc = tok([s["text"] for s in chunk], return_tensors="pt", padding=True,
                      truncation=True, max_length=256).to(self._dev)
            with torch.no_grad():
                gen = m.generate(**enc, forced_bos_token_id=tok.convert_tokens_to_ids(NLLB[target]),
                                 max_new_tokens=256, num_beams=4)
            texts = tok.batch_decode(gen, skip_special_tokens=True)
            for s, t in zip(chunk, texts):
                out.append({"id": s.get("id", len(out) + 1), "start": s["start"], "end": s["end"],
                            "text": t, "words": spread_words(t, s["start"], s["end"]),
                            "wordsApprox": True})
            progress(min(1.0, (i + B) / max(len(segments), 1)), "translating")
        return out
