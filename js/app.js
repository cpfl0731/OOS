(function () {
  const D = window.OOS_DATA;
  const Store = window.OOS_STORE;
  const Speech = window.OOS_SPEECH;
  const Practice = window.OOS_PRACTICE;

  const appEl = document.getElementById("app");

  const state = {
    tab: "work",
    view: "home", // home | flow | onboarding | account
    situationId: null,
    nodeId: null,
    history: [],
    slots: {},
    guestOpen: false,
    guestChoices: null,
    modal: null, // confirm dialogs
    industryPopup: false, // center popup for industry
    phraseFilter: null, // industry id; null → current work industry
    practiceSession: null,
    practiceDraft: "",
    practiceMode: null, // null | 'text' | 'voice'
    practiceIndustry: null, // industry id after mode pick
    practiceQuickPick: false, // short text/voice sheet from favorite detail
    practiceReturn: null, // 'phrases' | null — where to go after exit
    listening: false,
    listenHandle: null,
    swipeOpenId: null,
    fromPhrases: false,
    skipNextOpen: false,
    favsExpanded: false,
    splash: true, // cold-start splash
  };

  let splashScheduled = false;
  let toastTimer = null;

  // Smooth confirm: overlay without wiping the page (avoids flicker)
  function showConfirm(opts) {
    hideConfirm();
    const back = document.createElement("div");
    back.id = "oos-confirm";
    back.className = "popup-back popup-smooth";
    back.setAttribute("role", "presentation");
    back.innerHTML = `<div class="popup-card popup-card-confirm" role="dialog" aria-modal="true">
      <h3 class="popup-title">${esc(opts.title || "삭제할까요?")}</h3>
      <p class="popup-sub">${esc(opts.body || "")}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" data-confirm="no">취소</button>
        <button type="button" class="btn btn-danger" data-confirm="yes">${esc(opts.okLabel || "삭제")}</button>
      </div>
    </div>`;
    back.addEventListener("click", (e) => {
      if (e.target === back) hideConfirm();
    });
    back.querySelector('[data-confirm="no"]').addEventListener("click", () => hideConfirm());
    back.querySelector('[data-confirm="yes"]').addEventListener("click", () => {
      hideConfirm();
      if (opts.onOk) opts.onOk();
    });
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add("is-visible"));
  }

  function hideConfirm() {
    const el = document.getElementById("oos-confirm");
    if (el) el.remove();
  }

  function hideIndustryPopup() {
    state.industryPopup = false;
    const el = document.getElementById("oos-industry-popup");
    if (el) el.remove();
  }

  function showIndustryPopup() {
    hideIndustryPopup();
    state.industryPopup = true;
    const current = industryId();
    const back = document.createElement("div");
    back.id = "oos-industry-popup";
    back.className = "popup-back";
    back.setAttribute("role", "presentation");
    back.innerHTML = `<div class="popup-card popup-card-compact" role="dialog" aria-modal="true" aria-label="업종 변경">
      <div class="popup-industry-grid">
        ${D.INDUSTRIES.map(
          (i) =>
            `<button type="button" class="popup-tile ${current === i.id ? "is-current" : ""}" data-industry="${i.id}">
              <span class="ico" aria-hidden="true">${i.icon}</span>
              <span class="label">${i.label}</span>
            </button>`
        ).join("")}
      </div>
    </div>`;
    back.addEventListener("click", (e) => {
      if (e.target === back) hideIndustryPopup();
    });
    back.querySelectorAll("[data-industry]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectIndustry(btn.getAttribute("data-industry"));
      });
    });
    document.body.appendChild(back);
  }

  function hideQuickPractice() {
    state.practiceQuickPick = false;
    const el = document.getElementById("oos-quick-practice");
    if (el) el.remove();
  }

  function showQuickPractice() {
    hideQuickPractice();
    state.practiceQuickPick = true;
    const back = document.createElement("div");
    back.id = "oos-quick-practice";
    back.className = "popup-back";
    back.setAttribute("role", "presentation");
    back.innerHTML = `<div class="popup-card popup-card-confirm" role="dialog" aria-modal="true" aria-label="연습 방식">
      <h3 class="popup-title">어떻게 연습할까요?</h3>
      <p class="popup-sub">Text나 Voice 중 하나를 고르면 바로 시작해요.</p>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" data-qp="text">⌨️ Text</button>
        <button type="button" class="btn btn-primary" data-qp="voice">🎙️ Voice</button>
      </div>
    </div>`;
    back.addEventListener("click", (e) => {
      if (e.target === back) hideQuickPractice();
    });
    back.querySelector('[data-qp="text"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      hideQuickPractice();
      const ind = state.phraseFilter || industryId() || "cafe";
      const res = await Practice.startFromSituation(state.situationId, ind, "text");
      beginPracticeSession(res, {
        mode: "text",
        industryId: ind,
        returnTo: "phrases",
      });
    });
    back.querySelector('[data-qp="voice"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      hideQuickPractice();
      const ind = state.phraseFilter || industryId() || "cafe";
      const res = await Practice.startFromSituation(state.situationId, ind, "voice");
      beginPracticeSession(res, {
        mode: "voice",
        industryId: ind,
        returnTo: "phrases",
      });
    });
    document.body.appendChild(back);
  }

  /** Toast without full re-render (avoids page remount flicker) */
  function toast(msg) {
    let el = document.getElementById("oos-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "oos-toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = String(msg == null ? "" : msg);
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (el && el.parentNode) el.remove();
    }, 2200);
  }

  function industryId() {
    return Store.getIndustryId();
  }

  function goOnboarding() {
    state.view = "onboarding";
    state.tab = "work";
    hideIndustryPopup();
    hideQuickPractice();
    hideConfirm();
    render();
  }

  function selectIndustry(id) {
    Store.setIndustryId(id);
    state.view = "home";
    state.tab = "work";
    hideIndustryPopup();
    state.phraseFilter = id;
    toast(D.getIndustry(id).label + "으로 변경했어요");
    render();
  }

  function openSituation(id, opts) {
    const sit = D.getSituation(id);
    if (!sit) return;
    opts = opts || {};
    state.situationId = id;
    state.nodeId = opts.nodeId && sit.nodes[opts.nodeId] ? opts.nodeId : sit.start;
    state.history = [];
    state.slots = {};
    state.view = "flow";
    state.guestOpen = false;
    state.fromPhrases = !!opts.fromPhrases;
    hideQuickPractice();
    render();
  }

  function goNode(nextId) {
    if (nextId === "__back__") {
      goBack();
      return;
    }
    if (!state.situationId) return;
    const sit = D.getSituation(state.situationId);
    if (!sit.nodes[nextId]) {
      toast("다음 단계 데이터가 없습니다.");
      return;
    }
    state.history.push(state.nodeId);
    state.nodeId = nextId;
    trackRecent();
    render();
  }

  function goBack() {
    if (state.history.length) {
      state.nodeId = state.history.pop();
      render();
      return;
    }
    goHomeFlow();
  }

  function goHomeFlow() {
    hideQuickPractice();
    if (state.fromPhrases) {
      state.tab = "phrases";
      state.view = "home";
      state.situationId = null;
      state.nodeId = null;
      state.history = [];
      state.fromPhrases = false;
      state.guestOpen = false;
      Speech.stop();
      stopListen();
      render();
      return;
    }
    state.view = "home";
    state.situationId = null;
    state.nodeId = null;
    state.history = [];
    state.guestOpen = false;
    state.fromPhrases = false;
    Speech.stop();
    stopListen();
    render();
  }

  function currentPhrase() {
    const sit = D.getSituation(state.situationId);
    if (!sit) return null;
    const node = sit.nodes[state.nodeId];
    if (!node) return null;
    const phrase = D.getNodePhrase(node, industryId(), state.slots);
    return { sit, node, phrase };
  }

  function trackRecent() {
    const cur = currentPhrase();
    if (!cur || !cur.phrase.en) return;
    Store.addRecent({
      situationId: cur.sit.id,
      nodeId: state.nodeId,
      en: cur.phrase.en,
      ko: cur.phrase.ko,
      industryId: industryId(),
      title: cur.sit.title,
    });
  }

  function openSos() {
    if (state.view === "flow" && state.situationId) {
      const sit = D.getSituation(state.situationId);
      if (sit.nodes.sos) {
        state.history.push(state.nodeId);
        state.nodeId = "sos";
        render();
        return;
      }
    }
    openSituation("common-clarify");
    const sit = D.getSituation("common-clarify");
    if (sit && sit.nodes.sos) {
      state.nodeId = "sos";
      state.history = [sit.start];
      render();
    }
  }

  function openGuest() {
    const cur = currentPhrase();
    if (!cur) return;
    if (cur.phrase.rawIncomplete || /\{\{\w+\}\}/.test(cur.phrase.en)) {
      toast("값이 비어 있는 문장은 손님에게 보여주지 않습니다.");
      return;
    }
    const choices = (cur.node.choices || [])
      .filter((c) => c.enExample && !c.enExample.startsWith("("))
      .slice(0, 4);
    state.guestOpen = true;
    state.guestChoices = choices;
    render();
  }

  function closeGuest() {
    state.guestOpen = false;
    state.guestChoices = null;
    render();
  }

  function speakPhrase() {
    const cur = currentPhrase();
    if (!cur) return;
    if (cur.phrase.rawIncomplete || /\{\{\w+\}\}/.test(cur.phrase.en)) {
      toast("값이 채워지지 않은 문장은 재생하지 않습니다.");
      return;
    }
    Speech.speak(cur.phrase.en, (err) => toast(err));
  }

  function toggleFav() {
    const cur = currentPhrase();
    if (!cur) return;
    const item = {
      situationId: cur.sit.id,
      nodeId: state.nodeId,
      en: cur.phrase.en,
      ko: cur.phrase.ko,
      industryId: industryId(),
      title: cur.sit.title,
    };
    const on = Store.toggleFavorite(item);
    toast(on ? "즐겨찾기에 넣었어요" : "즐겨찾기에서 뺐어요");
    render();
  }

  function beginPracticeSession(res, opts) {
    opts = opts || {};
    if (!res || !res.ok) {
      toast((res && res.message) || "연습을 시작할 수 없습니다.");
      return;
    }
    stopListen();
    Speech.stop();
    state.practiceSession = res;
    state.practiceDraft = "";
    hideQuickPractice();
    state.tab = "practice";
    state.view = "home";
    state.fromPhrases = false;
    state.guestOpen = false;
    state.practiceReturn = opts.returnTo || null;
    if (opts.mode) state.practiceMode = opts.mode;
    if (opts.industryId) state.practiceIndustry = opts.industryId;
    render();
    if (res.inputMode === "voice") setTimeout(playGuestLine, 350);
  }

  function stopListen() {
    if (state.listenHandle) {
      state.listenHandle.stop();
      state.listenHandle = null;
    }
    state.listening = false;
  }

  function submitPracticeAnswer(text) {
    if (!state.practiceSession) return;
    state.practiceDraft = "";
    stopListen();
    state.practiceSession = Practice.submitAnswer(state.practiceSession, text);
    render();
    // Auto-play next guest line in voice mode
    if (
      state.practiceSession &&
      !state.practiceSession.done &&
      state.practiceSession.inputMode === "voice"
    ) {
      setTimeout(playGuestLine, 400);
    }
  }

  function playGuestLine() {
    const s = state.practiceSession;
    if (!s || s.done) return;
    const step = s.scenario.steps[s.stepIndex];
    if (!step) return;
    Speech.speak(step.guest, (err) => toast(err));
  }

  function startVoiceAnswer() {
    if (state.listening) {
      stopListen();
      render();
      return;
    }
    if (!Speech.listenSupported()) {
      toast("음성 인식을 쓸 수 없습니다. Chrome/Edge에서 시도하거나 텍스트 연습을 이용해 주세요.");
      return;
    }
    Speech.stop();
    state.listening = true;
    render();
    state.listenHandle = Speech.listen({
      onResult: function (text) {
        state.listening = false;
        state.listenHandle = null;
        if (!text) {
          toast("인식된 말이 없어요. 다시 눌러 주세요.");
          render();
          return;
        }
        submitPracticeAnswer(text);
      },
      onError: function (msg) {
        state.listening = false;
        state.listenHandle = null;
        toast(msg);
        render();
      },
      onEnd: function () {
        if (state.listening) {
          state.listening = false;
          state.listenHandle = null;
          render();
        }
      },
    });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Soft line breaks for long English without ugly mid-word cuts */
  function formatEn(text) {
    return esc(text);
  }

  function brandHtml() {
    // Logo only on settings / account / inquiry — not onboarding
    const show =
      state.tab === "settings" ||
      state.view === "account" ||
      state.view === "inquiry";
    if (!show || state.guestOpen || state.splash) return "";
    return `<header class="brand-bar">
      <img src="assets/oos-parrot.png" alt="OOS 마스코트" width="40" height="40" />
      <div class="brand-text">
        <span class="brand-name">OOS</span>
        <span class="brand-tag">Only One Sentence</span>
      </div>
    </header>`;
  }

  function splashHtml() {
    return `<div class="splash" role="status" aria-label="OOS">
      <div class="splash-center">
        <img class="splash-logo" src="assets/oos-parrot.png" alt="OOS" width="120" height="120" />
        <p class="splash-tag" aria-label="Only One Sentence"><span class="splash-acro">O</span>nly <span class="splash-acro">O</span>ne <span class="splash-acro">S</span>entence</p>
      </div>
    </div>`;
  }

  function navHtml() {
    if (
      state.view === "onboarding" ||
      state.guestOpen ||
      state.view === "account" ||
      state.view === "inquiry"
    )
      return "";
    const items = [
      { id: "work", label: "근무", icon: "💼" },
      { id: "phrases", label: "나의 표현", icon: "⭐" },
      { id: "practice", label: "연습", icon: "🎯" },
      { id: "settings", label: "설정", icon: "⚙️" },
    ];
    return (
      `<nav class="bottom-nav" aria-label="하단 메뉴">` +
      items
        .map(
          (it) =>
            `<button type="button" class="nav-item ${state.tab === it.id ? "active" : ""}" data-tab="${it.id}">
          <span class="nav-icon" aria-hidden="true">${it.icon}</span>
          <span>${it.label}</span>
        </button>`
        )
        .join("") +
      `</nav>`
    );
  }

  function modalHtml() {
    if (!state.modal) return "";
    const m = state.modal;
    return `<div class="modal-back" data-action="modal-cancel">
      <div class="modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
        <h3>${esc(m.title)}</h3>
        <p>${esc(m.body)}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-secondary" data-action="modal-cancel">취소</button>
          <button type="button" class="btn btn-danger" data-action="modal-ok">${esc(m.okLabel || "확인")}</button>
        </div>
      </div>
    </div>`;
  }

  function renderOnboarding() {
    return `<div class="page onboarding-hero">
      <h1 class="page-title">지금 당신에게 필요한<br/>단 한 문장</h1>
      <p class="page-sub">손님 앞에서 바로 꺼내는 응대 한 줄</p>
      <p class="onboarding-prompt">근무 업종을 선택하세요</p>
      <div class="industry-grid">
        ${D.INDUSTRIES.map(
          (i) =>
            `<button type="button" class="industry-btn" data-industry="${i.id}">
              <span class="ico" aria-hidden="true">${i.icon}</span>
              <span>${i.label}</span>
            </button>`
        ).join("")}
      </div>
    </div>`;
  }

  function renderWorkHome() {
    const ind = D.getIndustry(industryId());
    const { common, specific } = D.situationsForIndustry(industryId());

    function sitBtn(s) {
      return `<button type="button" class="situation-btn" data-situation="${s.id}">
        <span class="ico" aria-hidden="true">${s.icon}</span>
        <span class="label">${esc(s.title)}</span>
        <span class="chev" aria-hidden="true">›</span>
      </button>`;
    }

    return `<div class="page work-home">
      <div class="work-header">
        <div class="work-header-text">
          <h1 class="page-title">근무</h1>
          <p class="page-sub tight">상황만 고르면 문장이 나옵니다</p>
        </div>
        <button type="button" class="industry-chip" data-action="open-industry-popup" aria-label="업종 변경">
          ${ind ? ind.icon + " " + ind.label : "업종"} · 변경
        </button>
      </div>

      <button type="button" class="sos-btn" data-action="sos">못 알아들었어요</button>

      <p class="section-label">공통 응대</p>
      <div class="situation-list">${common.map(sitBtn).join("")}</div>

      <p class="section-label">${ind ? ind.label + " 전용" : "업종 전용"}</p>
      <div class="situation-list">${specific.map(sitBtn).join("")}</div>
    </div>`;
  }


  function renderFlow() {
    const cur = currentPhrase();
    if (!cur) return `<div class="page"><p>상황을 찾을 수 없습니다.</p></div>`;
    const { sit, node, phrase } = cur;
    const favOn = Store.isFavorite({
      situationId: sit.id,
      nodeId: state.nodeId,
      en: phrase.en,
    });
    const stepNum = state.history.length + 1;

    let slotsHtml = "";
    if (node.slots && node.slots.length) {
      slotsHtml =
        `<div class="input-block">` +
        node.slots
          .map((sl) => {
            const val = state.slots[sl.key] || "";
            return `<label for="slot-${esc(sl.key)}">${esc(sl.label)}</label>
              <input id="slot-${esc(sl.key)}" type="text" data-slot="${esc(sl.key)}" value="${esc(val)}" placeholder="확인한 값 입력" />
              ${sl.help ? `<p class="help">${esc(sl.help)}</p>` : ""}`;
          })
          .join("") +
        `</div>`;
    }

    let choicesHtml = "";
    if (node.choices && node.choices.length) {
      choicesHtml = `<p class="section-label">손님 뜻</p>
        <div class="choice-list">
          ${node.choices
            .map(
              (c, i) =>
                `<button type="button" class="choice-btn" data-choice="${i}">
                  <div class="choice-meaning">${esc(c.meaning)}</div>
                  ${c.enExample ? `<div class="choice-en">${formatEn(c.enExample)}</div>` : ""}
                </button>`
            )
            .join("")}
        </div>`;
    }

    let endHtml = "";
    if (node.endStatus) {
      const cls = node.endStatus === "done" ? "status-done" : "status-need";
      endHtml = `<div class="status-badge ${cls}" role="status">${esc(node.endLabel || node.endStatus)}</div>`;
    }

    const sosHtml = state.fromPhrases
      ? ""
      : `<button type="button" class="sos-btn sos-fab" data-action="sos">못 알아들었어요</button>`;

    return `<div class="page flow-page">
      ${sosHtml}
      <div class="flow-top">
        <button type="button" class="back-link" data-action="flow-back">← 이전</button>
        <span class="step-pill">${esc(sit.title)} · ${stepNum}</span>
      </div>
      <div class="phrase-card">
        <p class="phrase-en">${formatEn(phrase.en)}</p>
        <p class="phrase-ko">${esc(phrase.ko)}</p>
      </div>
      ${node.hint ? `<div class="hint-box">${esc(node.hint)}</div>` : ""}
      ${slotsHtml}
      ${endHtml}
      <div class="action-grid">
        <button type="button" class="btn btn-secondary btn-sm" data-action="speak">발음 듣기</button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="fav">${favOn ? "★ 저장됨" : "☆ 즐겨찾기"}</button>
        <button type="button" class="btn btn-primary btn-sm action-span" data-action="guest">손님에게 크게 보여주기</button>
        ${
          state.fromPhrases
            ? `<button type="button" class="btn btn-ghost btn-sm action-span" data-action="open-quick-practice">이 표현 연습하기</button>`
            : `<button type="button" class="btn btn-secondary btn-sm" data-action="flow-home">처음으로</button>`
        }
        ${
          state.fromPhrases || node.endStatus === "need_check" || state.nodeId === "manager"
            ? ""
            : `<button type="button" class="btn btn-secondary btn-sm" data-action="goto-manager">담당자 확인</button>`
        }
      </div>
      ${choicesHtml}
    </div>`;
  }

  function renderGuest() {
    const cur = currentPhrase();
    if (!cur) return "";
    const choices = state.guestChoices || [];
    return `<div class="guest-overlay" role="dialog" aria-label="손님용 화면">
      <div class="guest-top">
        <button type="button" class="guest-close" data-action="guest-close">닫기</button>
      </div>
      <div class="guest-body">
        <p class="guest-en">${formatEn(cur.phrase.en)}</p>
        ${
          choices.length
            ? `<div class="guest-choices">
                <p class="guest-choices-label">Tap an option</p>
                ${choices
                  .map(
                    (c, i) =>
                      `<button type="button" class="guest-choice" data-guest-choice="${i}">${formatEn(c.enExample)}</button>`
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>
    </div>`;
  }

  function swipeItemHtml(item) {
    const id = item.id;
    return `<div class="swipe-row" data-swipe-id="${esc(id)}" data-swipe-type="fav" data-swipe-key="${esc(item.id)}">
      <div class="swipe-delete-bg" aria-hidden="true">삭제</div>
      <div class="swipe-front">
        <button type="button" class="list-item list-item-slim" data-open-phrase="${esc(item.situationId)}" data-node="${esc(item.nodeId || "")}">
          <span class="en">${formatEn(item.en)}</span>
          <span class="ko">${esc(item.ko)}</span>
        </button>
      </div>
    </div>`;
  }

  function groupFavoritesBySituation(favs) {
    const map = {};
    const order = [];
    favs.forEach((f) => {
      const key = f.situationId || f.title || "etc";
      if (!map[key]) {
        map[key] = { title: f.title || "기타", items: [] };
        order.push(key);
      }
      map[key].items.push(f);
    });
    return order.map((k) => map[k]);
  }

  function renderPhrases() {
    const data = Store.read();
    const filter = state.phraseFilter || industryId() || "cafe";
    state.phraseFilter = filter;
    const favs = data.favorites.filter((f) => f.industryId === filter);
    const recent = data.recent.slice(0, 3);
    const showAll = state.favsExpanded || favs.length <= 3;
    const visibleFavs = showAll ? favs : favs.slice(0, 3);
    const groups = groupFavoritesBySituation(visibleFavs);
    const hiddenCount = favs.length - visibleFavs.length;

    function recentHtml(item) {
      return `<button type="button" class="list-item list-item-slim" data-open-phrase="${esc(item.situationId)}" data-node="${esc(item.nodeId || "")}">
        <span class="en">${formatEn(item.en)}</span>
        <span class="ko">${esc(item.ko)}</span>
      </button>`;
    }

    let favHtml;
    if (!favs.length) {
      favHtml = `<div class="empty-state"><div class="ico">☆</div><p>즐겨찾기가 없어요.</p></div>`;
    } else {
      favHtml =
        groups
          .map(
            (g) =>
              `<p class="section-label section-label-sit">${esc(g.title)}</p>
              ${g.items.map((f) => swipeItemHtml(f)).join("")}`
          )
          .join("") +
        (hiddenCount > 0
          ? `<button type="button" class="more-favs-btn" data-action="expand-favs">더보기 · ${hiddenCount}개</button>`
          : state.favsExpanded && favs.length > 3
            ? `<button type="button" class="more-favs-btn" data-action="collapse-favs">접기</button>`
            : "");
    }

    return `<div class="page">
      <h1 class="page-title">나의 표현</h1>
      <div class="filter-tabs filter-tabs-spaced">
        ${D.INDUSTRIES.map(
          (i) =>
            `<button type="button" class="filter-tab ${filter === i.id ? "active" : ""}" data-filter="${i.id}">${i.label}</button>`
        ).join("")}
      </div>
      <p class="section-label">즐겨찾기</p>
      ${favHtml}
      <p class="section-label">최근 사용</p>
      ${
        recent.length
          ? recent.map(recentHtml).join("")
          : `<div class="empty-state"><p>최근 사용한 표현이 여기에 쌓여요.</p></div>`
      }
    </div>`;
  }

  function feedbackHtml(fb) {
    if (!fb) return "";
    const cls =
      fb.level === "good" ? "fb-good" : fb.level === "ok" ? "fb-ok" : "fb-bad";
    return `<div class="answer-feedback ${cls}">
      <span class="fb-mark">${esc(fb.mark)}</span>
      <span class="fb-text">${esc(fb.text)}</span>
      ${fb.suggest ? `<p class="fb-suggest">${formatEn(fb.suggest)}</p>` : ""}
    </div>`;
  }

  function renderPractice() {
    if (state.practiceSession) {
      const s = state.practiceSession;
      const isVoice = s.inputMode === "voice";
      return `<div class="page practice-session-page">
        <button type="button" class="back-link" data-action="practice-exit">← 나가기</button>
        <div class="flow-top">
          <h1 class="page-title" style="margin:0">${esc(s.scenario.title)}</h1>
          <span class="step-pill">${isVoice ? "Voice" : "Text"}</span>
        </div>
        <div class="chat-log" id="chat-log">
          ${s.messages
            .map((m) => {
              if (m.role === "guest")
                return `<div class="bubble bubble-guest"><strong>Guest</strong><p class="bubble-en">${formatEn(m.text)}</p>${m.ko ? `<p class="bubble-ko">${esc(m.ko)}</p>` : ""}</div>`;
              if (m.role === "staff")
                return `<div class="bubble-wrap bubble-wrap-staff">
                  <div class="bubble bubble-staff"><strong>${esc(m.label || "나")}</strong><p class="bubble-en">${formatEn(m.text)}</p></div>
                  ${feedbackHtml(m.feedback)}
                </div>`;
              return "";
            })
            .join("")}
        </div>
        ${
          s.done
            ? `<button type="button" class="btn btn-primary" data-action="practice-exit">목록으로</button>`
            : isVoice
              ? `<div class="voice-controls practice-composer">
                  <button type="button" class="btn btn-secondary" data-action="play-guest">다시 듣기</button>
                  <button type="button" class="btn btn-primary ${state.listening ? "is-listening" : ""}" data-action="voice-answer">
                    ${state.listening ? "듣는 중…" : "마이크로 답하기"}
                  </button>
                </div>`
              : `<div class="practice-composer">
                  <div class="practice-input-row">
                    <input type="text" id="practice-input" placeholder="영어로 답하기" value="${esc(state.practiceDraft)}" autocomplete="off" />
                    <button type="button" class="btn btn-primary practice-send-btn" data-action="practice-send">보내기</button>
                  </div>
                </div>`
        }
      </div>`;
    }

    if (!state.practiceMode) {
      return `<div class="page practice-pick">
        <h1 class="page-title">연습</h1>
        <p class="page-sub tight">손님 응대를 한 줄로 연습해요</p>
        <div class="practice-mode-row">
          <button type="button" class="practice-mode-tile" data-action="practice-mode-text">
            <span class="ico">⌨️</span>
            <span class="label">Text</span>
            <span class="tile-hint">글로 답하기</span>
          </button>
          <button type="button" class="practice-mode-tile" data-action="practice-mode-voice">
            <span class="ico">🎙️</span>
            <span class="label">Voice</span>
            <span class="tile-hint">말로 답하기</span>
          </button>
        </div>
      </div>`;
    }

    if (!state.practiceIndustry) {
      return `<div class="page">
        <button type="button" class="back-link" data-action="practice-mode-back">← 방식 변경</button>
        <h1 class="page-title">업종 선택</h1>
        <p class="page-sub tight">${state.practiceMode === "voice" ? "Voice" : "Text"} · 연습할 업종을 고르세요</p>
        <div class="industry-grid">
          ${D.INDUSTRIES.map(
            (i) =>
              `<button type="button" class="industry-btn" data-practice-industry="${i.id}">
                <span class="ico" aria-hidden="true">${i.icon}</span>
                <span>${i.label}</span>
              </button>`
          ).join("")}
        </div>
      </div>`;
    }

    const situations = Practice.listSituationsForIndustry(state.practiceIndustry);
    const ind = D.getIndustry(state.practiceIndustry);
    return `<div class="page">
      <button type="button" class="back-link" data-action="practice-industry-back">← 업종 변경</button>
      <h1 class="page-title">상황 선택</h1>
      <p class="page-sub tight">${ind ? ind.label : ""} · ${state.practiceMode === "voice" ? "Voice" : "Text"}</p>
      <div class="situation-list">
        ${situations
          .map(
            (sc) =>
              `<button type="button" class="situation-btn" data-practice-start="${esc(sc.id)}">
                <span class="ico">${sc.icon}</span>
                <span class="label">${esc(sc.title)}</span>
                <span class="chev">›</span>
              </button>`
          )
          .join("")}
      </div>
    </div>`;
  }

  function renderAccount() {
    const providers = [
      { id: "naver", label: "네이버", mark: "N" },
      { id: "google", label: "Google", mark: "G" },
      { id: "apple", label: "Apple", mark: "" },
    ];
    return `<div class="page">
      <button type="button" class="back-link" data-action="account-back">← 설정</button>
      <h1 class="page-title">계정 정보</h1>
      <p class="section-label">로그인</p>
      <div class="account-providers">
        ${providers
          .map((p) => {
            const mark =
              p.id === "apple"
                ? `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M16.4 12.2c0-2.1 1.1-3.7 3.1-4.4-.4-1.1-1-2-1.8-2.7-1-.9-2.3-1.4-3.6-1.4-1.6 0-2.8.7-3.7.7-.9 0-2.2-.7-3.6-.7-1.8.1-3.5 1.1-4.4 2.9-1.9 3.3-.5 8.2 1.4 10.9.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.6-.9s2.1.9 3.6.8c1.5-.1 2.4-1.3 3.3-2.6.7-1 1-1.9 1-2 .1 0-2.7-1-2.7-3.3zM14.3 3.4c.7-.9 1.3-2.1 1.1-3.4-1.1.1-2.4.8-3.2 1.7-.7.8-1.3 2.1-1.1 3.3 1.2.1 2.4-.6 3.2-1.6z"/></svg>`
                : esc(p.mark);
            return `<button type="button" class="account-provider" data-action="account-stub">
                <span class="provider-mark provider-${p.id}">${mark}</span>
                <span class="provider-label">${p.label}</span>
                <span class="provider-action">연결</span>
              </button>`;
          })
          .join("")}
      </div>
      <p class="section-label">관리</p>
      <div class="account-links">
        <button type="button" class="account-link" data-action="account-stub">로그아웃</button>
        <button type="button" class="account-link account-link-danger" data-action="account-stub">회원 탈퇴</button>
      </div>
    </div>`;
  }

  function renderInquiry() {
    return `<div class="page">
      <button type="button" class="back-link" data-action="inquiry-back">← 설정</button>
      <h1 class="page-title">문의하기</h1>
      <div class="settings-list settings-list-compact" style="margin-top:12px">
        <button type="button" class="settings-row settings-row-compact settings-row-btn" data-action="inquiry-stub">
          <div class="label">1:1 문의</div>
          <span class="chev">›</span>
        </button>
        <button type="button" class="settings-row settings-row-compact settings-row-btn" data-action="inquiry-stub">
          <div class="label">오류 제보</div>
          <span class="chev">›</span>
        </button>
      </div>
    </div>`;
  }

  function renderSettings() {
    const prefs = Speech.getPrefs();
    const avail = Speech.availableAccents();
    const name = Store.getDisplayName() || "게스트";
    return `<div class="page">
      <h1 class="page-title">설정</h1>
      <button type="button" class="settings-profile" data-action="open-account">
        <div class="settings-profile-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="12" cy="8" r="3.5"/>
            <path d="M5 19c1.8-3.2 4-4.5 7-4.5s5.2 1.3 7 4.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="settings-profile-text">
          <div class="settings-profile-name">${esc(name)}</div>
          <div class="settings-profile-link">계정 정보 <span class="chev">›</span></div>
        </div>
      </button>

      <p class="section-label">음성</p>
      <div class="voice-block">
        <div class="chip-row">
          <button type="button" class="choice-chip ${prefs.accent === "us" ? "is-on" : ""}" data-accent="us">미국</button>
          <button type="button" class="choice-chip ${prefs.accent === "gb" ? "is-on" : ""}" data-accent="gb">영국</button>
          <button type="button" class="choice-chip ${prefs.accent === "au" ? "is-on" : ""}" data-accent="au">호주</button>
        </div>
        <div class="chip-row" style="margin-top:8px">
          <button type="button" class="choice-chip ${prefs.gender === "female" ? "is-on" : ""}" data-gender="female">여성</button>
          <button type="button" class="choice-chip ${prefs.gender === "male" ? "is-on" : ""}" data-gender="male">남성</button>
        </div>
        <button type="button" class="btn btn-secondary btn-sm voice-preview" data-action="preview-voice">미리 듣기</button>
        ${!avail.gb && !avail.au ? "" : ""}
      </div>

      <div class="settings-list settings-list-compact" style="margin-top:20px">
        <button type="button" class="settings-row settings-row-compact settings-row-btn" data-action="clear-data">
          <div class="label">저장 기록 초기화</div>
          <span class="chev">›</span>
        </button>
        <button type="button" class="settings-row settings-row-compact settings-row-btn" data-action="open-inquiry">
          <div class="label">문의하기</div>
          <span class="chev">›</span>
        </button>
      </div>
      <p class="notice notice-quiet">
        손님 음성·결제정보는 수집하지 않습니다. 환불·재고·알레르기 안전은 앱이 보장하지 않습니다.
      </p>
    </div>`;
  }

  function render() {
    if (state.splash) {
      appEl.innerHTML = splashHtml();
      if (!splashScheduled) {
        splashScheduled = true;
        setTimeout(() => {
          const el = appEl.querySelector(".splash");
          if (el) el.classList.add("is-out");
          setTimeout(() => {
            state.splash = false;
            render();
          }, 320);
        }, 1400);
      }
      return;
    }

    const id = industryId();
    if (!id && state.view !== "onboarding") {
      state.view = "onboarding";
    }

    let main = "";
    if (state.view === "onboarding") {
      main = renderOnboarding();
    } else if (state.view === "account") {
      main = renderAccount();
    } else if (state.view === "inquiry") {
      main = renderInquiry();
    } else if (state.view === "flow" && state.tab === "work") {
      main = renderFlow();
    } else if (state.tab === "work") {
      main = renderWorkHome();
    } else if (state.tab === "phrases") {
      main = renderPhrases();
    } else if (state.tab === "practice") {
      main = renderPractice();
    } else if (state.tab === "settings") {
      main = renderSettings();
    }

    appEl.innerHTML =
      brandHtml() +
      main +
      navHtml() +
      modalHtml() +
      (state.guestOpen ? renderGuest() : "");

    const log = document.getElementById("chat-log");
    if (log) log.scrollTop = log.scrollHeight;

    bind();
  }

  function bindSwipe() {
    appEl.querySelectorAll(".swipe-row").forEach((row) => {
      const front = row.querySelector(".swipe-front");
      if (!front) return;
      let startX = 0;
      let startY = 0;
      let dx = 0;
      let locking = null;
      let moved = false;

      const resetFront = () => {
        front.style.transition = "transform 0.2s ease";
        front.style.transform = "translateX(0)";
        row.classList.remove("is-swiping", "is-open");
      };

      const askDelete = () => {
        const key = row.getAttribute("data-swipe-key");
        state.skipNextOpen = true;
        row.classList.add("is-open");
        row.classList.remove("is-swiping");
        front.style.transition = "transform 0.18s ease";
        front.style.transform = "translateX(-72px)";
        showConfirm({
          title: "삭제할까요?",
          body: "이 즐겨찾기를 삭제합니다.",
          onOk: () => {
            Store.removeFavorite(key);
            state.skipNextOpen = false;
            toast("삭제했어요");
            render();
          },
        });
        const obs = new MutationObserver(() => {
          if (!document.getElementById("oos-confirm")) {
            resetFront();
            state.skipNextOpen = false;
            obs.disconnect();
          }
        });
        obs.observe(document.body, { childList: true });
      };

      const onStart = (x, y) => {
        startX = x;
        startY = y;
        dx = 0;
        locking = null;
        moved = false;
        front.style.transition = "none";
      };
      const onMove = (x, y) => {
        const mx = x - startX;
        const my = y - startY;
        if (locking === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
          locking = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        }
        if (locking !== "x") return;
        moved = true;
        state.skipNextOpen = true;
        row.classList.add("is-swiping");
        dx = Math.min(0, Math.max(-120, mx));
        front.style.transform = `translateX(${dx}px)`;
      };
      const onEnd = () => {
        if (!moved || locking !== "x") {
          resetFront();
          setTimeout(() => {
            state.skipNextOpen = false;
          }, 50);
          return;
        }
        if (dx < -72) {
          askDelete();
        } else {
          resetFront();
          setTimeout(() => {
            state.skipNextOpen = false;
          }, 180);
        }
      };

      front.addEventListener(
        "touchstart",
        (e) => {
          const t = e.changedTouches[0];
          onStart(t.clientX, t.clientY);
        },
        { passive: true }
      );
      front.addEventListener(
        "touchmove",
        (e) => {
          const t = e.changedTouches[0];
          onMove(t.clientX, t.clientY);
          if (locking === "x") e.preventDefault();
        },
        { passive: false }
      );
      front.addEventListener("touchend", onEnd);
      front.addEventListener("touchcancel", () => {
        resetFront();
        state.skipNextOpen = false;
      });

      let down = false;
      front.addEventListener("mousedown", (e) => {
        down = true;
        onStart(e.clientX, e.clientY);
      });
      const onWinMove = (e) => {
        if (!down) return;
        onMove(e.clientX, e.clientY);
      };
      const onWinUp = () => {
        if (!down) return;
        down = false;
        onEnd();
      };
      window.addEventListener("mousemove", onWinMove);
      window.addEventListener("mouseup", onWinUp);
    });
  }

  function bind() {
    appEl.querySelectorAll("[data-tab]").forEach((el) => {
      el.addEventListener("click", () => {
        state.tab = el.getAttribute("data-tab");
        state.view = "home";
        state.fromPhrases = false;
        state.guestOpen = false;
        hideIndustryPopup();
        hideQuickPractice();
        if (state.tab !== "practice") {
          state.practiceMode = null;
          state.practiceIndustry = null;
          state.practiceSession = null;
          state.practiceReturn = null;
        }
        state.swipeOpenId = null;
        state.skipNextOpen = false;
        hideConfirm();
        Speech.stop();
        stopListen();
        render();
      });
    });

    appEl.querySelectorAll("[data-industry]").forEach((el) => {
      el.addEventListener("click", () => selectIndustry(el.getAttribute("data-industry")));
    });

    appEl.querySelectorAll("[data-situation]").forEach((el) => {
      el.addEventListener("click", () => openSituation(el.getAttribute("data-situation")));
    });

    appEl.querySelectorAll("[data-choice]").forEach((el) => {
      el.addEventListener("click", () => {
        const cur = currentPhrase();
        if (!cur) return;
        const idx = Number(el.getAttribute("data-choice"));
        const choice = cur.node.choices[idx];
        if (choice) goNode(choice.next);
      });
    });

    appEl.querySelectorAll("[data-guest-choice]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.getAttribute("data-guest-choice"));
        const choice = (state.guestChoices || [])[idx];
        closeGuest();
        if (choice && choice.next) goNode(choice.next);
      });
    });

    appEl.querySelectorAll("[data-slot]").forEach((el) => {
      el.addEventListener("change", () => {
        state.slots[el.getAttribute("data-slot")] = el.value;
        render();
        const again = appEl.querySelector(`[data-slot="${el.getAttribute("data-slot")}"]`);
        if (again) {
          again.focus();
          const v = again.value;
          again.setSelectionRange(v.length, v.length);
        }
      });
    });

    appEl.querySelectorAll("[data-filter]").forEach((el) => {
      el.addEventListener("click", () => {
        state.phraseFilter = el.getAttribute("data-filter");
        state.swipeOpenId = null;
        state.skipNextOpen = false;
        state.favsExpanded = false;
        render();
      });
    });

    appEl.querySelectorAll("[data-accent]").forEach((el) => {
      el.addEventListener("click", () => {
        const accent = el.getAttribute("data-accent");
        Store.setVoicePrefs({ accent });
        Speech.setPrefs({ accent });
        render();
      });
    });

    appEl.querySelectorAll("[data-gender]").forEach((el) => {
      el.addEventListener("click", () => {
        const gender = el.getAttribute("data-gender");
        Store.setVoicePrefs({ gender });
        Speech.setPrefs({ gender });
        render();
      });
    });

    appEl.querySelectorAll("[data-open-phrase]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (state.skipNextOpen) {
          e.preventDefault();
          e.stopPropagation();
          state.skipNextOpen = false;
          return;
        }
        const sid = el.getAttribute("data-open-phrase");
        const nid = el.getAttribute("data-node");
        state.tab = "work";
        openSituation(sid, { nodeId: nid || null, fromPhrases: true });
      });
    });

    appEl.querySelectorAll("[data-practice-industry]").forEach((el) => {
      el.addEventListener("click", () => {
        state.practiceIndustry = el.getAttribute("data-practice-industry");
        render();
      });
    });

    appEl.querySelectorAll("[data-practice-start]").forEach((el) => {
      el.addEventListener("click", async () => {
        const sitId = el.getAttribute("data-practice-start");
        const res = await Practice.startFromSituation(
          sitId,
          state.practiceIndustry,
          state.practiceMode
        );
        beginPracticeSession(res, {
          mode: state.practiceMode,
          industryId: state.practiceIndustry,
        });
      });
    });

    const actions = {
      sos: openSos,
      "open-industry-popup": () => showIndustryPopup(),
      "close-industry-popup": () => hideIndustryPopup(),
      "expand-favs": () => {
        state.favsExpanded = true;
        render();
      },
      "collapse-favs": () => {
        state.favsExpanded = false;
        render();
      },
      "flow-back": goBack,
      "flow-home": goHomeFlow,
      speak: speakPhrase,
      fav: toggleFav,
      guest: openGuest,
      "guest-close": closeGuest,
      "goto-manager": () => goNode("manager"),
      "open-quick-practice": () => showQuickPractice(),
      "close-quick-practice": () => hideQuickPractice(),
      "practice-exit": () => {
        stopListen();
        Speech.stop();
        state.practiceSession = null;
        state.practiceDraft = "";
        if (state.practiceReturn === "phrases") {
          state.practiceReturn = null;
          state.practiceMode = null;
          state.practiceIndustry = null;
          state.tab = "phrases";
          state.view = "home";
        }
        render();
      },
      "practice-mode-text": () => {
        state.practiceMode = "text";
        state.practiceIndustry = null;
        render();
      },
      "practice-mode-voice": () => {
        state.practiceMode = "voice";
        state.practiceIndustry = null;
        render();
      },
      "practice-mode-back": () => {
        state.practiceMode = null;
        state.practiceIndustry = null;
        render();
      },
      "practice-industry-back": () => {
        state.practiceIndustry = null;
        render();
      },
      "preview-voice": () => {
        Speech.speak("Just to confirm — one iced americano, right?", (err) => toast(err));
      },
      "practice-send": () => {
        const input = document.getElementById("practice-input");
        const text = (input && input.value) || state.practiceDraft || "";
        submitPracticeAnswer(text);
      },
      "play-guest": playGuestLine,
      "voice-answer": startVoiceAnswer,
      "open-account": () => {
        state.view = "account";
        render();
      },
      "account-back": () => {
        state.view = "home";
        state.tab = "settings";
        render();
      },
      "open-inquiry": () => {
        state.view = "inquiry";
        render();
      },
      "inquiry-back": () => {
        state.view = "home";
        state.tab = "settings";
        render();
      },
      "inquiry-stub": () => toast("곧 연결 예정"),
      "account-stub": () => toast("곧 연결 예정"),
      "clear-data": () => {
        showConfirm({
          title: "저장 기록을 지울까요?",
          body: "즐겨찾기, 최근 사용, 업종 선택이 모두 삭제됩니다.",
          okLabel: "모두 삭제",
          onOk: () => {
            Store.clearAll();
            state.practiceSession = null;
            goOnboarding();
            toast("기록을 초기화했어요");
          },
        });
      },
      "modal-cancel": () => {
        state.modal = null;
        render();
      },
      "modal-ok": () => {
        if (state.modal && state.modal.onOk) state.modal.onOk();
        else {
          state.modal = null;
          render();
        }
      },
    };

    appEl.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (
          (el.classList.contains("modal-back") || el.classList.contains("popup-back")) &&
          e.target !== el
        ) {
          return;
        }
        const a = el.getAttribute("data-action");
        if (actions[a]) actions[a]();
      });
    });

    const pInput = document.getElementById("practice-input");
    if (pInput) {
      pInput.addEventListener("input", () => {
        state.practiceDraft = pInput.value;
      });
      pInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") actions["practice-send"]();
      });
    }

    bindSwipe();
  }

  // sync stored voice prefs
  Speech.setPrefs(Store.getVoicePrefs());
  state.phraseFilter = industryId() || "cafe";

  if (!industryId()) state.view = "onboarding";
  else state.view = "home";
  Speech.refreshVoices();
  render();
})();
