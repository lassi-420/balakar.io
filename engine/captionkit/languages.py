"""Language tables: the 20 desi/regional languages plus NLLB codes for translation targets."""

# code, name, rtl, whisper_supported, recommended font (PostScript name; user must have it installed)
DESI_LANGUAGES = [
    ("hi", "Hindi", False, True, "NotoSansDevanagari-Bold"),
    ("en", "English", False, True, "Montserrat-ExtraBold"),
    ("ne", "Nepali", False, True, "NotoSansDevanagari-Bold"),
    ("ur", "Urdu", True, True, "NotoNastaliqUrdu"),
    ("ta", "Tamil", False, True, "NotoSansTamil-Bold"),
    ("ml", "Malayalam", False, True, "NotoSansMalayalam-Bold"),
    ("gu", "Gujarati", False, True, "NotoSansGujarati-Bold"),
    ("bn", "Bengali", False, True, "NotoSansBengali-Bold"),
    ("pa", "Punjabi", False, True, "NotoSansGurmukhi-Bold"),
    ("te", "Telugu", False, True, "NotoSansTelugu-Bold"),
    ("sd", "Sindhi", True, True, "NotoNaskhArabic-Bold"),
    ("mr", "Marathi", False, True, "NotoSansDevanagari-Bold"),
    ("kn", "Kannada", False, True, "NotoSansKannada-Bold"),
    ("ps", "Pashto", True, True, "NotoNaskhArabic-Bold"),
    ("ms", "Malay", False, True, "Montserrat-ExtraBold"),
    ("as", "Assamese", False, True, "NotoSansBengali-Bold"),
    ("ks", "Kashmiri", True, False, "NotoNaskhArabic-Bold"),
    ("fa", "Persian", True, True, "NotoNaskhArabic-Bold"),
    ("ar", "Arabic", True, True, "NotoNaskhArabic-Bold"),
    ("or", "Odia", False, False, "NotoSansOriya-Bold"),
]

RTL = {c for c, _, rtl, _, _ in DESI_LANGUAGES if rtl} | {"he", "yi"}
WHISPER_UNSUPPORTED = {c for c, _, _, ok, _ in DESI_LANGUAGES if not ok}

# ISO-639-1 -> NLLB-200 (FLORES-200) codes. 70+ targets for the translation feature.
NLLB = {
    "en": "eng_Latn", "hi": "hin_Deva", "ne": "npi_Deva", "ur": "urd_Arab", "ta": "tam_Taml",
    "ml": "mal_Mlym", "gu": "guj_Gujr", "bn": "ben_Beng", "pa": "pan_Guru", "te": "tel_Telu",
    "sd": "snd_Arab", "mr": "mar_Deva", "kn": "kan_Knda", "ps": "pbt_Arab", "ms": "zsm_Latn",
    "as": "asm_Beng", "ks": "kas_Arab", "fa": "pes_Arab", "ar": "arb_Arab", "or": "ory_Orya",
    "es": "spa_Latn", "fr": "fra_Latn", "de": "deu_Latn", "pt": "por_Latn", "it": "ita_Latn",
    "ru": "rus_Cyrl", "tr": "tur_Latn", "id": "ind_Latn", "vi": "vie_Latn", "th": "tha_Thai",
    "ja": "jpn_Jpan", "ko": "kor_Hang", "zh": "zho_Hans", "zh-TW": "zho_Hant", "nl": "nld_Latn",
    "pl": "pol_Latn", "uk": "ukr_Cyrl", "sv": "swe_Latn", "el": "ell_Grek", "he": "heb_Hebr",
    "cs": "ces_Latn", "ro": "ron_Latn", "hu": "hun_Latn", "fi": "fin_Latn", "da": "dan_Latn",
    "no": "nob_Latn", "bg": "bul_Cyrl", "hr": "hrv_Latn", "sr": "srp_Cyrl", "sk": "slk_Latn",
    "sl": "slv_Latn", "lt": "lit_Latn", "lv": "lvs_Latn", "et": "est_Latn", "sw": "swh_Latn",
    "af": "afr_Latn", "am": "amh_Ethi", "si": "sin_Sinh", "my": "mya_Mymr", "km": "khm_Khmr",
    "lo": "lao_Laoo", "ka": "kat_Geor", "hy": "hye_Armn", "az": "azj_Latn", "kk": "kaz_Cyrl",
    "uz": "uzn_Latn", "mn": "khk_Cyrl", "ca": "cat_Latn", "ga": "gle_Latn", "is": "isl_Latn",
    "mt": "mlt_Latn", "ha": "hau_Latn", "yo": "yor_Latn", "zu": "zul_Latn", "so": "som_Latn",
    "tl": "tgl_Latn", "jv": "jav_Latn", "su": "sun_Latn", "ku": "ckb_Arab", "tg": "tgk_Cyrl",
}


def is_rtl(code):
    return (code or "").split("-")[0] in RTL


def languages_payload():
    return [
        {"code": c, "name": n, "rtl": rtl, "whisper": ok, "font": font}
        for c, n, rtl, ok, font in DESI_LANGUAGES
    ]
