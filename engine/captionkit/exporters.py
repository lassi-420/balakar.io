"""SRT / VTT / TXT / MD / DOCX export (zero dependencies) and SRT/VTT parsing."""
import io
import re
import zipfile
from xml.sax.saxutils import escape

from .languages import is_rtl


def _ts(t, sep):
    t = max(0.0, float(t))
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d%s%03d" % (h, m, s, sep, ms)


def to_srt(segs):
    out = []
    for i, s in enumerate(segs, 1):
        out.append("%d\n%s --> %s\n%s\n" % (i, _ts(s["start"], ","), _ts(s["end"], ","), s["text"]))
    return "\n".join(out)


def to_vtt(segs):
    out = ["WEBVTT\n"]
    for s in segs:
        out.append("%s --> %s\n%s\n" % (_ts(s["start"], "."), _ts(s["end"], "."), s["text"]))
    return "\n".join(out)


def to_txt(segs, timestamps=False):
    if timestamps:
        return "\n".join("[%s] %s" % (_ts(s["start"], ".")[:-4], s["text"]) for s in segs) + "\n"
    return " ".join(s["text"] for s in segs).strip() + "\n"


def to_md(segs, title="Transcript", timestamps=True):
    lines = ["# %s" % title, ""]
    for s in segs:
        stamp = "**[%s]** " % _ts(s["start"], ".")[:-4] if timestamps else ""
        lines.append(stamp + s["text"])
        lines.append("")
    return "\n".join(lines)


def to_docx_bytes(segs, title="Transcript", lang=None, timestamps=True):
    rtl = is_rtl(lang)
    ppr = "<w:pPr><w:bidi/></w:pPr>" if rtl else ""
    rpr = "<w:rPr><w:rtl/></w:rPr>" if rtl else ""

    def para(text, bold=False, size=None):
        rp = "<w:rPr>%s%s%s</w:rPr>" % ("<w:b/>" if bold else "", "<w:rtl/>" if rtl else "",
                                        '<w:sz w:val="%d"/>' % size if size else "")
        return "<w:p>%s<w:r>%s<w:t xml:space=\"preserve\">%s</w:t></w:r></w:p>" % (
            ppr, rp, escape(text))

    body = [para(title, bold=True, size=36)]
    for s in segs:
        stamp = "[%s] " % _ts(s["start"], ".")[:-4] if timestamps else ""
        body.append(para(stamp + s["text"]))
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                "<w:body>%s<w:sectPr/></w:body></w:document>" % "".join(body))
    ctypes = ('<?xml version="1.0" encoding="UTF-8"?>'
              '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
              '<Default Extension="xml" ContentType="application/xml"/>'
              '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
              "</Types>")
    rels = ('<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ctypes)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)
    return buf.getvalue()


_TIME = re.compile(r"(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})")


def _parse_ts(s):
    m = _TIME.match(s.strip())
    if not m:
        raise ValueError("bad timestamp: %r" % s)
    h, mi, se, ms = m.groups()
    return int(h or 0) * 3600 + int(mi) * 60 + int(se) + int(ms.ljust(3, "0")) / 1000.0


def parse_subtitles(text):
    """Parse SRT or VTT into segments."""
    text = text.replace("\r\n", "\n").lstrip("\ufeff")
    segs = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [l for l in block.split("\n") if l.strip()]
        idx = next((i for i, l in enumerate(lines) if "-->" in l), None)
        if idx is None:
            continue
        a, b = lines[idx].split("-->")[:2]
        segs.append({"id": len(segs) + 1, "start": _parse_ts(a), "end": _parse_ts(b.split()[0]),
                     "text": "\n".join(lines[idx + 1:]).strip(), "words": []})
    return segs


def export(fmt, segs, path=None, **kw):
    fmt = fmt.lower().lstrip(".")
    if fmt == "srt":
        data = to_srt(segs).encode("utf-8")
    elif fmt == "vtt":
        data = to_vtt(segs).encode("utf-8")
    elif fmt == "txt":
        data = to_txt(segs, kw.get("timestamps", False)).encode("utf-8")
    elif fmt == "md":
        data = to_md(segs, kw.get("title", "Transcript"), kw.get("timestamps", True)).encode("utf-8")
    elif fmt == "docx":
        data = to_docx_bytes(segs, kw.get("title", "Transcript"), kw.get("lang"),
                             kw.get("timestamps", True))
    else:
        raise ValueError("unknown format " + fmt)
    if path:
        with open(path, "wb") as f:
            f.write(data)
    return data
