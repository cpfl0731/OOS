/**
 * Browser TTS + Speech Recognition.
 * Same API as Lovable OOS (speechSynthesis) — quality depends on installed OS voices.
 * Accent/gender prefs pick the best matching local voice.
 */
window.OOS_SPEECH = (function () {
  let cachedVoice = null;
  let voicesReady = false;
  let prefs = { accent: "us", gender: "female" };

  const ACCENT_LANG = {
    us: ["en-us", "en_us"],
    gb: ["en-gb", "en_gb", "en-uk"],
    au: ["en-au", "en_au"],
  };

  function supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  function listenSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function setPrefs(next) {
    prefs = { ...prefs, ...next };
    refreshVoices();
    return prefs;
  }

  function getPrefs() {
    return { ...prefs };
  }

  function genderScore(name, gender) {
    const n = name.toLowerCase();
    const female = /female|woman|zira|samantha|karen|moira|aria|jenny|sonia|sara|ana|susan|hazel|catherine|heather|linda|allison|ava|zoe|karen|moira/;
    const male = /male|man|david|mark|daniel|alex|guy|ryan|george|thomas|james|fred|ravi/;
    if (gender === "female") {
      if (female.test(n)) return 35;
      if (male.test(n)) return -25;
    } else {
      if (male.test(n)) return 35;
      if (female.test(n)) return -25;
    }
    return 0;
  }

  function accentScore(lang, accent) {
    const l = (lang || "").toLowerCase().replace("_", "-");
    const targets = ACCENT_LANG[accent] || ACCENT_LANG.us;
    if (targets.some((t) => l === t || l.startsWith(t))) return 50;
    if (l.startsWith("en")) return 5;
    return -1000;
  }

  function scoreVoice(v) {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase();
    if (!lang.startsWith("en")) return -1000;

    let score = accentScore(lang, prefs.accent);
    score += genderScore(name, prefs.gender);

    if (/google/.test(name)) score += 80;
    if (/microsoft (aria|jenny|guy|sara|ryan|sonia|ana|natasha|william)/.test(name)) score += 75;
    if (/natural|neural|online \(natural\)/.test(name)) score += 70;
    if (/samantha|karen|moira|daniel|alex|ava|zoe|catherine|hazel/.test(name)) score += 45;
    if (/enhanced|premium/.test(name)) score += 25;
    if (/compact|eloquence|espeak|microsoft david desktop|microsoft zira desktop/.test(name)) score -= 45;
    if (v.localService === false) score += 12;
    return score;
  }

  function pickBestVoice() {
    if (!supported()) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    const ranked = voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a));
    // If no good accent match, still return best English
    return ranked[0] && scoreVoice(ranked[0]) > -500 ? ranked[0] : ranked.find((v) => (v.lang || "").toLowerCase().startsWith("en")) || ranked[0];
  }

  function refreshVoices() {
    cachedVoice = pickBestVoice();
    voicesReady = !!(cachedVoice || (window.speechSynthesis.getVoices() || []).length);
    return cachedVoice;
  }

  if (supported()) {
    refreshVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
    setTimeout(refreshVoices, 250);
    setTimeout(refreshVoices, 1000);
  }

  function speak(text, onError, onEnd) {
    if (!text || !String(text).trim()) {
      if (onError) onError("읽을 문장이 없습니다.");
      return;
    }
    if (/\{\{\w+\}\}/.test(text) || /\[[^\]]+\]/.test(text)) {
      if (onError) onError("값이 채워지지 않은 문장은 재생하지 않습니다.");
      return;
    }
    if (!supported()) {
      if (onError) onError("이 기기에서는 음성 읽기를 지원하지 않습니다.");
      return;
    }

    const run = function () {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text).trim());
        const voice = cachedVoice || refreshVoices();
        const langMap = { us: "en-US", gb: "en-GB", au: "en-AU" };
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang || langMap[prefs.accent] || "en-US";
        } else {
          u.lang = langMap[prefs.accent] || "en-US";
        }
        // Lovable site uses ~0.85 — slightly slower reads clearer for staff
        u.rate = 0.88;
        u.pitch = 1;
        u.volume = 1;
        u.onerror = function () {
          if (onError) onError("음성 재생에 실패했습니다. 기기 설정을 확인해 주세요.");
        };
        u.onend = function () {
          if (onEnd) onEnd();
        };
        window.speechSynthesis.speak(u);
      } catch (e) {
        if (onError) onError("음성 재생에 실패했습니다.");
      }
    };

    if (!voicesReady && !(window.speechSynthesis.getVoices() || []).length) {
      setTimeout(function () {
        refreshVoices();
        run();
      }, 300);
      return;
    }
    run();
  }

  function stop() {
    if (supported()) window.speechSynthesis.cancel();
  }

  function getVoiceLabel() {
    const v = cachedVoice || refreshVoices();
    return v ? v.name : "기본 영어 음성";
  }

  function availableAccents() {
    const voices = supported() ? window.speechSynthesis.getVoices() || [] : [];
    const has = (accent) =>
      voices.some((v) => accentScore(v.lang, accent) >= 50 && scoreVoice(Object.assign({}, v, {})) > -500) ||
      voices.some((v) => {
        const l = (v.lang || "").toLowerCase();
        return (ACCENT_LANG[accent] || []).some((t) => l === t || l.startsWith(t));
      });
    return {
      us: true,
      gb: has("gb") || voices.some((v) => /en-gb|en_gb|uk english|british/i.test((v.lang || "") + v.name)),
      au: has("au") || voices.some((v) => /en-au|en_au|australian/i.test((v.lang || "") + v.name)),
    };
  }

  function listen(handlers) {
    handlers = handlers || {};
    if (!listenSupported()) {
      if (handlers.onError) {
        handlers.onError("이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome/Edge를 권장합니다.");
      }
      return { stop: function () {} };
    }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    const langMap = { us: "en-US", gb: "en-GB", au: "en-AU" };
    rec.lang = langMap[prefs.accent] || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = function (ev) {
      const text = (ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || "";
      if (handlers.onResult) handlers.onResult(text.trim());
    };
    rec.onerror = function (ev) {
      let msg = "음성 인식에 실패했습니다.";
      if (ev.error === "not-allowed") msg = "마이크 권한이 필요합니다.";
      else if (ev.error === "no-speech") msg = "말이 감지되지 않았어요.";
      else if (ev.error === "network") msg = "음성 인식 네트워크 오류입니다.";
      if (handlers.onError) handlers.onError(msg);
    };
    rec.onend = function () {
      if (handlers.onEnd) handlers.onEnd();
    };

    try {
      rec.start();
    } catch (e) {
      if (handlers.onError) handlers.onError("음성 인식을 시작할 수 없습니다.");
    }

    return {
      stop: function () {
        try {
          rec.stop();
        } catch (e) {}
      },
    };
  }

  return {
    supported,
    listenSupported,
    speak,
    stop,
    listen,
    getVoiceLabel,
    refreshVoices,
    setPrefs,
    getPrefs,
    availableAccents,
  };
})();
