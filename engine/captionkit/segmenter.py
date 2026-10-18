"""Group word-level timestamps into caption lines. Pure python, no dependencies."""
import re

_PUNCT_END = re.compile(r"[.!?؟۔।,;:،]$")


def _clean(t):
    return re.sub(r"\s+", " ", t or "").strip()


def group_words(words, max_chars=32, max_words=6, max_gap=0.6, max_duration=4.0,
                break_on_punct=True):
    """words: [{text,start,end}] -> segments [{id,start,end,text,words}]"""
    words = [dict(text=_clean(w["text"]), start=float(w["start"]), end=float(w["end"]))
             for w in words if _clean(w.get("text"))]
    segs, cur = [], []

    def flush():
        if not cur:
            return
        segs.append({
            "id": len(segs) + 1,
            "start": cur[0]["start"],
            "end": cur[-1]["end"],
            "text": " ".join(w["text"] for w in cur),
            "words": [dict(w) for w in cur],
        })
        cur.clear()

    for w in words:
        if cur:
            text_len = len(" ".join(x["text"] for x in cur)) + 1 + len(w["text"])
            gap = w["start"] - cur[-1]["end"]
            too_long = (text_len > max_chars or len(cur) >= max_words or gap > max_gap
                        or (w["end"] - cur[0]["start"]) > max_duration)
            if too_long:
                flush()
        cur.append(w)
        if break_on_punct and _PUNCT_END.search(w["text"]) and len(cur) >= 2:
            flush()
    flush()
    # make sure no overlaps / zero length
    for i, s in enumerate(segs):
        if s["end"] <= s["start"]:
            s["end"] = s["start"] + 0.2
        if i + 1 < len(segs) and s["end"] > segs[i + 1]["start"]:
            s["end"] = segs[i + 1]["start"]
    return segs


def spread_words(text, start, end):
    """Approximate word timings across a segment (used after translation)."""
    toks = _clean(text).split(" ")
    toks = [t for t in toks if t]
    if not toks:
        return []
    total = sum(max(len(t), 1) for t in toks)
    out, t0 = [], start
    for t in toks:
        d = (end - start) * max(len(t), 1) / total
        out.append({"text": t, "start": round(t0, 3), "end": round(t0 + d, 3)})
        t0 += d
    return out
