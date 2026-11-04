window.OOS_STORE = (function () {
  const KEY = "oos_v1";

  const defaults = {
    industryId: null,
    favorites: [], // { id, situationId, nodeId, en, ko, industryId, title, savedAt }
    recent: [],
    practiceSaved: [], // { situationId, title, industryId, savedAt }
    onboardingDone: false,
    voicePrefs: { accent: "us", gender: "female" },
    displayName: "",
  };

  function migratePcbang(item) {
    if (!item || item.industryId !== "pcbang") return item;
    return { ...item, industryId: "beauty" };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults, favorites: [], recent: [], practiceSaved: [], voicePrefs: { ...defaults.voicePrefs } };
      const data = JSON.parse(raw);
      const industryId = data.industryId === "pcbang" ? "beauty" : data.industryId;
      return {
        ...defaults,
        ...data,
        industryId,
        favorites: (Array.isArray(data.favorites) ? data.favorites : []).map(migratePcbang),
        recent: (Array.isArray(data.recent) ? data.recent.slice(0, 3) : []).map(migratePcbang),
        practiceSaved: (Array.isArray(data.practiceSaved) ? data.practiceSaved : []).map(migratePcbang),
        voicePrefs: { ...defaults.voicePrefs, ...(data.voicePrefs || {}) },
        displayName: typeof data.displayName === "string" ? data.displayName : "",
      };
    } catch (e) {
      return { ...defaults, favorites: [], recent: [], practiceSaved: [], voicePrefs: { ...defaults.voicePrefs } };
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function update(fn) {
    const data = read();
    const next = fn(data) || data;
    write(next);
    return next;
  }

  function getIndustryId() {
    const id = read().industryId;
    // PC방 → 화장품·뷰티 매장 마이그레이션
    if (id === "pcbang") {
      setIndustryId("beauty");
      return "beauty";
    }
    return id;
  }

  function setIndustryId(id) {
    return update((d) => {
      d.industryId = id === "pcbang" ? "beauty" : id;
      d.onboardingDone = true;
      return d;
    });
  }

  function phraseKey(p) {
    return [p.situationId, p.nodeId, p.en].join("::");
  }

  function addFavorite(item) {
    return update((d) => {
      const key = phraseKey(item);
      if (d.favorites.some((f) => phraseKey(f) === key)) return d;
      d.favorites.unshift({
        ...item,
        id: "fav_" + Date.now(),
        savedAt: Date.now(),
      });
      return d;
    });
  }

  function removeFavorite(idOrKey) {
    return update((d) => {
      d.favorites = d.favorites.filter(
        (f) => f.id !== idOrKey && phraseKey(f) !== idOrKey
      );
      return d;
    });
  }

  function isFavorite(item) {
    const key = phraseKey(item);
    return read().favorites.some((f) => phraseKey(f) === key);
  }

  function toggleFavorite(item) {
    if (isFavorite(item)) {
      removeFavorite(phraseKey(item));
      return false;
    }
    addFavorite(item);
    return true;
  }

  function addRecent(item) {
    return update((d) => {
      const key = phraseKey(item);
      d.recent = d.recent.filter((r) => phraseKey(r) !== key);
      d.recent.unshift({
        ...item,
        id: "rec_" + Date.now(),
        savedAt: Date.now(),
      });
      d.recent = d.recent.slice(0, 3);
      return d;
    });
  }

  function getVoicePrefs() {
    return { ...defaults.voicePrefs, ...read().voicePrefs };
  }

  function setVoicePrefs(prefs) {
    return update((d) => {
      d.voicePrefs = { ...defaults.voicePrefs, ...d.voicePrefs, ...prefs };
      return d;
    });
  }

  function getDisplayName() {
    return read().displayName || "";
  }

  function setDisplayName(name) {
    return update((d) => {
      d.displayName = String(name || "").trim();
      return d;
    });
  }

  function savePractice(situation) {
    return update((d) => {
      if (d.practiceSaved.some((p) => p.situationId === situation.id)) return d;
      d.practiceSaved.unshift({
        situationId: situation.id,
        title: situation.title,
        industryId: situation.industries.includes("all")
          ? d.industryId || "cafe"
          : situation.industries[0],
        savedAt: Date.now(),
      });
      return d;
    });
  }

  function removePractice(situationId) {
    return update((d) => {
      d.practiceSaved = d.practiceSaved.filter((p) => p.situationId !== situationId);
      return d;
    });
  }

  function isPracticeSaved(situationId) {
    return read().practiceSaved.some((p) => p.situationId === situationId);
  }

  function clearAll() {
    write({ ...defaults, favorites: [], recent: [], practiceSaved: [] });
  }

  return {
    read,
    getIndustryId,
    setIndustryId,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    addRecent,
    savePractice,
    removePractice,
    isPracticeSaved,
    clearAll,
    phraseKey,
    getVoicePrefs,
    setVoicePrefs,
    getDisplayName,
    setDisplayName,
  };
})();

