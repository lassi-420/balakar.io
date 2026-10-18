/* The 20 desi/regional languages. `whisper:false` = no native Whisper model (use model_overrides). */
(function (g) {
  var KK = (g.KK = g.KK || {});
  KK.languages = [
    { code: "hi", name: "Hindi", rtl: false, whisper: true, font: "NotoSansDevanagari-Bold" },
    { code: "en", name: "English", rtl: false, whisper: true, font: "Montserrat-ExtraBold" },
    { code: "ne", name: "Nepali", rtl: false, whisper: true, font: "NotoSansDevanagari-Bold" },
    { code: "ur", name: "Urdu", rtl: true, whisper: true, font: "NotoNastaliqUrdu" },
    { code: "ta", name: "Tamil", rtl: false, whisper: true, font: "NotoSansTamil-Bold" },
    { code: "ml", name: "Malayalam", rtl: false, whisper: true, font: "NotoSansMalayalam-Bold" },
    { code: "gu", name: "Gujarati", rtl: false, whisper: true, font: "NotoSansGujarati-Bold" },
    { code: "bn", name: "Bengali", rtl: false, whisper: true, font: "NotoSansBengali-Bold" },
    { code: "pa", name: "Punjabi", rtl: false, whisper: true, font: "NotoSansGurmukhi-Bold" },
    { code: "te", name: "Telugu", rtl: false, whisper: true, font: "NotoSansTelugu-Bold" },
    { code: "sd", name: "Sindhi", rtl: true, whisper: true, font: "NotoNaskhArabic-Bold" },
    { code: "mr", name: "Marathi", rtl: false, whisper: true, font: "NotoSansDevanagari-Bold" },
    { code: "kn", name: "Kannada", rtl: false, whisper: true, font: "NotoSansKannada-Bold" },
    { code: "ps", name: "Pashto", rtl: true, whisper: true, font: "NotoNaskhArabic-Bold" },
    { code: "ms", name: "Malay", rtl: false, whisper: true, font: "Montserrat-ExtraBold" },
    { code: "as", name: "Assamese", rtl: false, whisper: true, font: "NotoSansBengali-Bold" },
    { code: "ks", name: "Kashmiri", rtl: true, whisper: false, font: "NotoNaskhArabic-Bold" },
    { code: "fa", name: "Persian", rtl: true, whisper: true, font: "NotoNaskhArabic-Bold" },
    { code: "ar", name: "Arabic", rtl: true, whisper: true, font: "NotoNaskhArabic-Bold" },
    { code: "or", name: "Odia", rtl: false, whisper: false, font: "NotoSansOriya-Bold" }
  ];
  KK.lang = function (code) {
    for (var i = 0; i < KK.languages.length; i++) if (KK.languages[i].code === code) return KK.languages[i];
    return null;
  };
  KK.isRtlText = function (s) { return /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(s || ""); };
})(typeof window !== "undefined" ? window : globalThis);
