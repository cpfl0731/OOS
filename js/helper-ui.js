/**
 * 알바 영어 도우미 — index.html 예시 UI 바인딩
 * OOS_GEMINI: startRoleplay, getFeedback, translateToEnglish, speakText, startSpeechRecognition
 */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);

  function waitGemini(timeoutMs) {
    return new Promise((resolve, reject) => {
      if (window.OOS_GEMINI && window.OOS_GEMINI.ready) {
        window.OOS_GEMINI.ready().then(resolve).catch(reject);
        return;
      }
      const t = setTimeout(() => reject(new Error("Gemini 로드 시간 초과")), timeoutMs || 8000);
      window.addEventListener(
        "oos-gemini-ready",
        () => {
          clearTimeout(t);
          if (window.OOS_GEMINI && window.OOS_GEMINI.ready) {
            window.OOS_GEMINI.ready().then(resolve).catch(reject);
          } else reject(new Error("OOS_GEMINI 없음"));
        },
        { once: true }
      );
    });
  }

  function setStatus(el, msg, isErr) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-err", !!isErr);
  }

  function appendChat(box, who, en, ko) {
    if (!box) return;
    const div = document.createElement("div");
    div.className = "helper-bubble helper-bubble-" + who;
    div.innerHTML =
      `<strong>${who === "guest" ? "Guest" : "나"}</strong>` +
      `<p class="helper-en"></p>` +
      (ko ? `<p class="helper-ko"></p>` : "");
    div.querySelector(".helper-en").textContent = en || "";
    if (ko) div.querySelector(".helper-ko").textContent = ko;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function bind() {
    const root = $("#oos-helper");
    if (!root) return;

    const fab = $("#oos-helper-fab");
    const panel = $("#oos-helper-panel");
    const closeBtn = $("#oos-helper-close");

    fab &&
      fab.addEventListener("click", () => {
        root.classList.toggle("is-open");
      });
    closeBtn &&
      closeBtn.addEventListener("click", () => {
        root.classList.remove("is-open");
      });

    /* tabs */
    root.querySelectorAll("[data-helper-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-helper-tab");
        root.querySelectorAll("[data-helper-tab]").forEach((b) => b.classList.toggle("is-on", b === btn));
        root.querySelectorAll("[data-helper-pane]").forEach((p) => {
          p.hidden = p.getAttribute("data-helper-pane") !== id;
        });
      });
    });

    let sessionId = null;
    let listenHandle = null;

    const rpStatus = $("#helper-rp-status");
    const rpChat = $("#helper-rp-chat");
    const rpSituation = $("#helper-rp-situation");
    const rpIndustry = $("#helper-rp-industry");
    const rpAnswer = $("#helper-rp-answer");
    const rpFeedback = $("#helper-rp-feedback");

    $("#helper-rp-start") &&
      $("#helper-rp-start").addEventListener("click", async () => {
        try {
          setStatus(rpStatus, "역할극 준비 중…");
          await waitGemini();
          const G = window.OOS_GEMINI;
          const res = await G.startRoleplay({
            situationKo: rpSituation.value,
            industry: rpIndustry.value,
          });
          sessionId = res.sessionId;
          rpChat.innerHTML = "";
          appendChat(rpChat, "guest", res.guestEn, res.guestKo);
          rpFeedback.textContent = "";
          setStatus(rpStatus, "손님이 말했어요. 영어로 답해 보세요.");
          G.speakText(res.guestEn);
        } catch (e) {
          setStatus(rpStatus, e.message || String(e), true);
        }
      });

    $("#helper-rp-send") &&
      $("#helper-rp-send").addEventListener("click", async () => {
        try {
          if (!sessionId) {
            setStatus(rpStatus, "먼저 역할극을 시작해 주세요.", true);
            return;
          }
          const userEnglish = rpAnswer.value.trim();
          setStatus(rpStatus, "피드백 생성 중…");
          await waitGemini();
          const G = window.OOS_GEMINI;
          appendChat(rpChat, "staff", userEnglish, "");
          const res = await G.getFeedback({ sessionId, userEnglish });
          rpFeedback.innerHTML = "";
          const tip = document.createElement("div");
          tip.className = "helper-tip";
          tip.innerHTML =
            `<p><strong>더 자연한 표현</strong></p><p class="helper-en"></p>` +
            `<p class="helper-ko"></p>` +
            `<button type="button" class="helper-mini-btn" data-speak-better>듣기</button>`;
          tip.querySelector(".helper-en").textContent = res.betterEn;
          tip.querySelector(".helper-ko").textContent = res.tipKo;
          tip.querySelector("[data-speak-better]").addEventListener("click", () => G.speakText(res.betterEn));
          rpFeedback.appendChild(tip);
          if (res.guestEn) appendChat(rpChat, "guest", res.guestEn, res.guestKo);
          rpAnswer.value = "";
          setStatus(rpStatus, "다음 손님 말까지 반영했어요.");
          if (res.guestEn) G.speakText(res.guestEn);
        } catch (e) {
          setStatus(rpStatus, e.message || String(e), true);
        }
      });

    $("#helper-rp-mic") &&
      $("#helper-rp-mic").addEventListener("click", () => {
        const G = window.OOS_GEMINI;
        if (!G) return;
        if (listenHandle) {
          listenHandle.stop();
          listenHandle = null;
          setStatus(rpStatus, "인식 중지");
          return;
        }
        setStatus(rpStatus, "듣는 중… (영어로 말해 보세요)");
        listenHandle = G.startSpeechRecognition({
          lang: "en-US",
          onResult: (text) => {
            rpAnswer.value = text;
            setStatus(rpStatus, "인식됨 — 보내기를 누르세요.");
            listenHandle = null;
          },
          onError: (msg) => {
            setStatus(rpStatus, msg, true);
            listenHandle = null;
          },
          onEnd: () => {
            listenHandle = null;
          },
        });
      });

    /* translate */
    const trStatus = $("#helper-tr-status");
    const trIn = $("#helper-tr-ko");
    const trOut = $("#helper-tr-en");
    const trNote = $("#helper-tr-note");

    $("#helper-tr-run") &&
      $("#helper-tr-run").addEventListener("click", async () => {
        try {
          setStatus(trStatus, "번역 중…");
          await waitGemini();
          const G = window.OOS_GEMINI;
          const res = await G.translateToEnglish(trIn.value, {
            industry: ($("#helper-tr-industry") && $("#helper-tr-industry").value) || "카페",
            situation: "손님 응대",
          });
          trOut.textContent = res.en;
          trNote.textContent =
            (res.noteKo || "") +
            (res.alt && res.alt.length ? " · 다른 표현: " + res.alt.join(" / ") : "");
          setStatus(trStatus, "번역 완료");
        } catch (e) {
          setStatus(trStatus, e.message || String(e), true);
        }
      });

    $("#helper-tr-speak") &&
      $("#helper-tr-speak").addEventListener("click", () => {
        const en = (trOut.textContent || "").trim();
        if (!en) {
          setStatus(trStatus, "먼저 번역해 주세요.", true);
          return;
        }
        window.OOS_GEMINI && window.OOS_GEMINI.speakText(en);
      });

    /* TTS demo */
    $("#helper-tts-run") &&
      $("#helper-tts-run").addEventListener("click", () => {
        const t = ($("#helper-tts-text") && $("#helper-tts-text").value) || "";
        window.OOS_GEMINI &&
          window.OOS_GEMINI.speakText(t, {
            onError: (m) => setStatus($("#helper-tts-status"), m, true),
            onEnd: () => setStatus($("#helper-tts-status"), "재생 끝"),
          });
        setStatus($("#helper-tts-status"), "재생 중…");
      });

    $("#helper-tts-stop") &&
      $("#helper-tts-stop").addEventListener("click", () => {
        window.OOS_GEMINI && window.OOS_GEMINI.stopSpeaking();
        setStatus($("#helper-tts-status"), "중지");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
