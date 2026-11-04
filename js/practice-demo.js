/**
 * Practice engine — rule-based demo (no cloud AI yet).
 * - Multiple guest-line variants per scenario
 * - Saved work situations → playable practice from situation data
 * - Score answers: good / ok / bad (shown under staff bubble in UI)
 */
window.OOS_PRACTICE = (function () {
  const ENGINE = "demo";

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokens(s) {
    return normalize(s).split(" ").filter((w) => w.length > 1);
  }

  function jaccard(a, b) {
    const A = new Set(tokens(a));
    const B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach((t) => {
      if (B.has(t)) inter++;
    });
    return inter / (A.size + B.size - inter);
  }

  /** Rule-based grading against example answers */
  function evaluateAnswer(userText, exampleAnswers) {
    const examples = exampleAnswers || [];
    const bestExample = examples[0] || "I'm sorry, could you wait a moment while I check?";
    const raw = String(userText || "").trim();
    if (!raw) {
      return {
        level: "bad",
        mark: "X",
        text: "답이 비어 있어요. 이렇게 말해 보세요.",
        suggest: bestExample,
      };
    }

    let best = 0;
    let bestEx = bestExample;
    examples.forEach((ex) => {
      const s = jaccard(raw, ex);
      if (s > best) {
        best = s;
        bestEx = ex;
      }
    });

    // Keyword bonus for polite service phrases
    const n = normalize(raw);
    const polite = ["sorry", "please", "would you", "could you", "let me", "i'll", "check", "moment", "available", "instead"];
    const hit = polite.filter((k) => n.includes(k)).length;

    if (best >= 0.45 || (best >= 0.28 && hit >= 2)) {
      return {
        level: "good",
        mark: "O",
        text: "적절한 표현이에요.",
        suggest: null,
      };
    }
    if (best >= 0.18 || hit >= 2) {
      return {
        level: "ok",
        mark: "△",
        text: "괜찮아요. 더 자연스럽게는 이렇게 말해 보세요.",
        suggest: bestEx,
      };
    }
    return {
      level: "bad",
      mark: "X",
      text: "상황에 맞지 않아요. 이렇게 말해 보세요.",
      suggest: bestEx,
    };
  }

  // ——— Cafe unavailable: several guest scripts ———
  const CAFE_UNAVAILABLE_VARIANTS = [
    {
      steps: [
        {
          guest: "Hi, can I get a caramel latte?",
          guestKo: "카라멜 라떼 주문할게요.",
          exampleAnswers: [
            "I'm sorry, that drink isn't available right now. Would you like something else?",
            "Sorry, we're out of caramel latte. Can I suggest another drink?",
          ],
        },
        {
          guest: "Oh no. What else is good?",
          guestKo: "아쉽네요. 다른 추천 있어요?",
          exampleAnswers: [
            "Would you like a vanilla latte or an Americano instead?",
            "Sure — what kind of drink do you usually like?",
          ],
        },
        {
          guest: "Vanilla latte, please. For here.",
          guestKo: "바닐라 라떼로 할게요. 매장에서 마실게요.",
          exampleAnswers: [
            "Got it. A vanilla latte for here. I'll prepare that for you.",
            "Okay, vanilla latte for here. Coming right up.",
          ],
        },
      ],
    },
    {
      steps: [
        {
          guest: "I'd like an iced matcha latte, please.",
          guestKo: "아이스 말차 라떼 주세요.",
          exampleAnswers: [
            "I'm sorry, matcha isn't available right now. Would you like something else?",
            "Sorry, we're out of matcha. Can I offer another drink?",
          ],
        },
        {
          guest: "Do you have anything similar?",
          guestKo: "비슷한 거 있어요?",
          exampleAnswers: [
            "We have green tea, or I can recommend a latte. What would you like?",
            "Would you like a green tea latte or an Americano instead?",
          ],
        },
        {
          guest: "Green tea latte to go, please.",
          guestKo: "녹차 라떼 포장으로 주세요.",
          exampleAnswers: [
            "Sure. A green tea latte to go. I'll get that ready.",
            "Got it — green tea latte to go.",
          ],
        },
      ],
    },
    {
      steps: [
        {
          guest: "Can I order a strawberry smoothie?",
          guestKo: "딸기 스무디 주문할 수 있나요?",
          exampleAnswers: [
            "I'm sorry, that isn't available right now. Would you like something else?",
            "Sorry, we're out of strawberry smoothie. Anything else I can get you?",
          ],
        },
        {
          guest: "I'll just take an iced Americano then.",
          guestKo: "그럼 아이스 아메리카노로 할게요.",
          exampleAnswers: [
            "Sure. One iced Americano. For here or to go?",
            "Got it. An iced Americano — for here or to go?",
          ],
        },
        {
          guest: "To go, please.",
          guestKo: "포장해 주세요.",
          exampleAnswers: [
            "Okay. I'll pack it for you.",
            "Sure, iced Americano to go.",
          ],
        },
      ],
    },
    {
      steps: [
        {
          guest: "One blueberry muffin and a cappuccino, please.",
          guestKo: "블루베리 머핀이랑 카푸치노 주세요.",
          exampleAnswers: [
            "I'm sorry, the blueberry muffin isn't available. Would you like another pastry?",
            "Sorry, we're out of blueberry muffins. Can I suggest something else?",
          ],
        },
        {
          guest: "Just the cappuccino is fine. Hot, please.",
          guestKo: "카푸치노만 뜨겁게 주세요.",
          exampleAnswers: [
            "Sure. One hot cappuccino. For here or to go?",
            "Got it — a hot cappuccino. For here or to go?",
          ],
        },
        {
          guest: "For here.",
          guestKo: "매장에서요.",
          exampleAnswers: [
            "Okay. I'll bring it to you when it's ready.",
            "Got it. One hot cappuccino for here.",
          ],
        },
      ],
    },
  ];

  const BUILTIN = [
    {
      id: "demo-cafe-unavailable",
      situationId: "common-unavailable",
      title: "품절 후 대안 제안 (카페)",
      industryId: "cafe",
      variants: CAFE_UNAVAILABLE_VARIANTS,
    },
  ];

  function resolvePhrase(node, industryId) {
    if (!node) return { en: "", ko: "" };
    const D = window.OOS_DATA;
    if (D && D.getNodePhrase) {
      return D.getNodePhrase(node, industryId || "cafe", {});
    }
    const en = typeof node.en === "string" ? node.en : (node.en && (node.en[industryId] || node.en.default)) || "";
    const ko = typeof node.ko === "string" ? node.ko : (node.ko && (node.ko[industryId] || node.ko.default)) || "";
    return { en, ko };
  }

  /**
   * Local guest openers per situation (demo stand-in for AI).
   * Later: swap pickGuestOpener() to call an API and keep this as fallback.
   */
  const GUEST_OPENERS = {
    "common-clarify": [
      { en: "Sorry, could you help me for a second?", ko: "죄송한데, 잠깐만요." },
      { en: "Excuse me — I asked something just now.", ko: "저기요, 방금 말씀드렸는데요." },
      { en: "Hi, I think you missed what I said.", ko: "안녕하세요. 제 말 못 들으신 것 같아요." },
    ],
    "common-wait": [
      { en: "Excuse me, is my order ready yet?", ko: "저기요, 제 주문 아직인가요?" },
      { en: "Hi, can someone check this for me?", ko: "안녕하세요. 이거 좀 확인해 주실 수 있나요?" },
      { en: "Sorry, how much longer will this take?", ko: "죄송한데, 얼마나 더 걸려요?" },
    ],
    "common-payment": [
      { en: "My card isn't working. Can I pay another way?", ko: "카드가 안 되네요. 다른 방법으로 결제할 수 있나요?" },
      { en: "Hi, the payment failed just now.", ko: "안녕하세요. 방금 결제가 실패했어요." },
      { en: "Excuse me, do you take cash or another card?", ko: "저기요, 현금이나 다른 카드도 되나요?" },
    ],
    "common-unavailable": [
      { en: "Hi, can I get a caramel latte?", ko: "안녕하세요. 카라멜 라떼 주문할게요." },
      { en: "Excuse me, do you still have this?", ko: "저기요, 이거 아직 있나요?" },
      { en: "Hi, I'd like to order this one, please.", ko: "안녕하세요. 이거로 주문하고 싶어요." },
    ],
    "common-refund": [
      { en: "Hi, I'd like to return this, please.", ko: "안녕하세요. 이거 반품하고 싶어요." },
      { en: "Excuse me, can I get a refund?", ko: "저기요, 환불 가능할까요?" },
      { en: "Sorry, I need to cancel my order.", ko: "죄송한데, 주문 취소하고 싶어요." },
    ],
    "cafe-options": [
      { en: "Hi, iced americano, please. Make it less sweet.", ko: "아이스 아메리카노요. 덜 달게 해주세요." },
      { en: "Can I get oat milk instead of regular milk?", ko: "일반 우유 대신 오트밀크로 될까요?" },
      { en: "Hi, one latte — extra hot, no foam.", ko: "라떼 하나요. 더 뜨겁게, 거품은 빼 주세요." },
    ],
    "cafe-here-or-go": [
      { en: "Hi, one iced americano, please.", ko: "아이스 아메리카노 하나 주세요." },
      { en: "For here or to go? Oh wait — I'll take it to go.", ko: "매장이요, 포장이요? 아, 포장할게요." },
      { en: "Hi, can I drink this here?", ko: "안녕하세요. 여기서 마셔도 되나요?" },
    ],
    "cvs-location": [
      { en: "Excuse me, where can I find the batteries?", ko: "저기요, 건전지가 어디에 있어요?" },
      { en: "Hi, I'm looking for instant ramen.", ko: "안녕하세요. 라면 어디 있나요?" },
      { en: "Sorry, where is the water aisle?", ko: "죄송한데, 생수 코너가 어디예요?" },
    ],
    "cvs-promo": [
      { en: "Is this on sale? The sign says 1+1.", ko: "이거 세일인가요? 1+1이라고 되어 있어요." },
      { en: "Hi, can I use this coupon?", ko: "안녕하세요. 이 쿠폰 쓸 수 있나요?" },
      { en: "Excuse me, does the discount apply to this?", ko: "저기요, 이것도 할인되나요?" },
    ],
    "rest-seating": [
      { en: "Hi, table for three, please.", ko: "안녕하세요. 세 명인데요." },
      { en: "Excuse me, how long is the wait?", ko: "저기요, 대기 얼마나 걸려요?" },
      { en: "Hi, do you have a table near the window?", ko: "창가 자리 있나요?" },
    ],
    "rest-order": [
      { en: "Hi, we'd like to order, please.", ko: "안녕하세요. 주문할게요." },
      { en: "Can we get this without onions?", ko: "양파 빼 주실 수 있나요?" },
      { en: "Excuse me, is this spicy?", ko: "저기요, 이거 매운가요?" },
    ],
    "beauty-location": [
      { en: "Hi, where is the skincare section?", ko: "스킨케어 코너가 어디예요?" },
      { en: "Excuse me, where can I find face masks?", ko: "마스크팩은 어디에 있어요?" },
      { en: "Hi, I'm looking for lipstick.", ko: "립스틱 찾고 있어요." },
    ],
    "beauty-taxfree": [
      { en: "Hi, can I get tax free?", ko: "면세 되나요?" },
      { en: "Do I need my passport for tax free?", ko: "면세하려면 여권이 필요해요?" },
      { en: "Is this instant refund or later?", ko: "즉시 환급인가요, 사후 면세인가요?" },
    ],
    "beauty-tester": [
      { en: "Can I try a tester?", ko: "테스터 써 봐도 되나요?" },
      { en: "Do you have a sample?", ko: "샘플 있나요?" },
      { en: "Where is the tester for this?", ko: "이 제품 테스터가 어디 있어요?" },
    ],
    "beauty-stock": [
      { en: "Do you have this in stock?", ko: "이거 재고 있나요?" },
      { en: "Is this sold out?", ko: "품절인가요?" },
      { en: "Can you check other stores?", ko: "다른 지점도 확인해 주실래요?" },
    ],
    "beauty-promo": [
      { en: "Is this 1+1?", ko: "이거 1+1인가요?" },
      { en: "Do I get a free gift with this?", ko: "사은품 증정되나요?" },
      { en: "What's the promotion on this?", ko: "이 제품 행사 뭐예요?" },
    ],
  };

  const GUEST_OPENERS_FALLBACK = [
    { en: "Excuse me, can you help me with this?", ko: "저기요, 이것 좀 도와주실 수 있나요?" },
    { en: "Hi, I have a quick question.", ko: "안녕하세요. 잠깐 여쭤볼게요." },
    { en: "Sorry, could you check something for me?", ko: "죄송한데, 이것 좀 확인해 주시겠어요?" },
  ];

  function pickGuestOpenerLocal(sit) {
    const pool = (sit && GUEST_OPENERS[sit.id]) || GUEST_OPENERS_FALLBACK;
    return pick(pool);
  }

  /** Prefer Gemini; fall back to local pool */
  async function pickGuestOpener(sit, industryId) {
    const G = window.OOS_GEMINI;
    if (G && typeof G.generateGuestOpener === "function") {
      try {
        if (typeof G.ready === "function") await G.ready();
        const D = window.OOS_DATA;
        const ind = D && D.getIndustry ? D.getIndustry(industryId) : null;
        const opener = await G.generateGuestOpener({
          industryId: industryId,
          industryLabel: ind ? ind.label : industryId,
          situationId: sit && sit.id,
          situationTitle: sit && sit.title,
        });
        if (opener && opener.en) return opener;
      } catch (e) {
        console.warn("[OOS] Gemini opener fallback:", e && e.message);
      }
    }
    return pickGuestOpenerLocal(sit);
  }

  /** Build 2–3 practice steps from a work situation's dialogue tree */
  async function buildFromSituation(sit, industryId) {
    const steps = [];
    let nodeId = sit.start;
    let guard = 0;
    const opener = await pickGuestOpener(sit, industryId);
    let prevGuest = opener.en;
    let prevGuestKo = opener.ko;

    while (nodeId && sit.nodes[nodeId] && guard < 3) {
      const node = sit.nodes[nodeId];
      if (nodeId === "sos" || nodeId === "clarify") break;
      const phrase = resolvePhrase(node, industryId);
      if (!phrase.en) break;

      const examples = [phrase.en];
      if (node.enFallback) examples.push(node.enFallback);

      steps.push({
        guest: prevGuest,
        guestKo: prevGuestKo,
        exampleAnswers: examples,
      });

      const choices = (node.choices || []).filter(
        (c) => c.next && c.next !== "clarify" && c.next !== "sos" && c.next !== "manager" && c.next !== "__back__"
      );
      if (!choices.length) break;
      const ch = pick(choices);
      prevGuest = ch.enExample && !String(ch.enExample).startsWith("(") ? ch.enExample : ch.meaning;
      prevGuestKo = ch.meaning;
      nodeId = ch.next;
      guard++;
    }

    if (!steps.length) {
      const phrase = resolvePhrase(sit.nodes[sit.start], industryId);
      const again = await pickGuestOpener(sit, industryId);
      steps.push({
        guest: again.en,
        guestKo: again.ko,
        exampleAnswers: [phrase.en || "Please wait a moment."],
      });
    }
    return steps;
  }

  function getMode() {
    return ENGINE;
  }

  function listSituationsForIndustry(industryId) {
    const D = window.OOS_DATA;
    if (!D || !D.situationsForIndustry) return [];
    const { common, specific } = D.situationsForIndustry(industryId);
    return []
      .concat(common || [], specific || [])
      .map((s) => ({
        id: s.id,
        title: s.title,
        icon: s.icon || "💬",
        industryId: industryId,
      }));
  }

  /** @deprecated kept for older callers — prefer listSituationsForIndustry */
  function listScenarios(savedPracticeIds) {
    const list = BUILTIN.map((b) => ({
      id: b.id,
      title: b.title,
      demo: true,
      situationId: b.situationId,
      industryId: b.industryId,
    }));
    (savedPracticeIds || []).forEach((s) => {
      if (list.some((x) => x.situationId === s.situationId)) return;
      list.push({
        id: "saved-" + s.situationId,
        title: s.title,
        demo: false,
        situationId: s.situationId,
        industryId: s.industryId === "all" ? null : s.industryId,
        fromSaved: true,
      });
    });
    return list;
  }

  async function resolveScenario(scenarioId, industryId) {
    const builtin = BUILTIN.find((b) => b.id === scenarioId);
    if (builtin) {
      const variant = pick(builtin.variants);
      return {
        id: builtin.id,
        situationId: builtin.situationId,
        title: builtin.title,
        industryId: builtin.industryId,
        steps: variant.steps,
      };
    }

    const raw = String(scenarioId || "");
    let sitId = null;
    if (raw.startsWith("saved-") || raw.startsWith("sit-")) {
      sitId = raw.replace(/^(saved-|sit-)/, "");
    } else if (raw) {
      sitId = raw;
    }
    if (!sitId) return null;

    const D = window.OOS_DATA;
    const sit = D && D.getSituation ? D.getSituation(sitId) : null;
    if (!sit) return null;
    const ind =
      industryId ||
      (sit.industries && sit.industries[0] !== "all" ? sit.industries[0] : "cafe");
    return {
      id: "sit-" + sitId,
      situationId: sitId,
      title: sit.title,
      industryId: ind,
      steps: await buildFromSituation(sit, ind),
    };
  }

  function makeSession(scenario, inputMode) {
    if (!scenario || !scenario.steps || !scenario.steps.length) {
      return { ok: false, message: "이 연습 상황을 불러올 수 없습니다." };
    }
    const mode = inputMode === "voice" ? "voice" : "text";
    const first = scenario.steps[0];
    return {
      ok: true,
      engine: ENGINE,
      inputMode: mode,
      scenario: scenario,
      stepIndex: 0,
      messages: [
        {
          role: "guest",
          text: first.guest,
          ko: first.guestKo,
        },
      ],
    };
  }

  async function startSession(scenarioId, inputMode, industryId) {
    return makeSession(await resolveScenario(scenarioId, industryId), inputMode);
  }

  async function startFromSituation(situationId, industryId, inputMode) {
    return startSession("sit-" + situationId, inputMode, industryId);
  }

  function submitAnswer(session, userText) {
    const scenario = session.scenario;
    const step = scenario.steps[session.stepIndex];
    const messages = session.messages.slice();
    const label = session.inputMode === "voice" ? "나 (음성)" : "나";
    const feedback = evaluateAnswer(userText, step.exampleAnswers);

    messages.push({
      role: "staff",
      text: userText || "(빈 답변)",
      label: label,
      feedback: feedback,
    });

    const nextIndex = session.stepIndex + 1;
    if (nextIndex >= scenario.steps.length) {
      return {
        ...session,
        messages,
        stepIndex: nextIndex,
        done: true,
      };
    }

    const next = scenario.steps[nextIndex];
    messages.push({
      role: "guest",
      text: next.guest,
      ko: next.guestKo,
    });
    return {
      ...session,
      messages,
      stepIndex: nextIndex,
      done: false,
    };
  }

  async function submitAnswerAI() {
    throw new Error("AI not connected");
  }

  return {
    getMode,
    listScenarios,
    listSituationsForIndustry,
    startSession,
    startFromSituation,
    submitAnswer,
    submitAnswerAI,
    evaluateAnswer,
  };
})();
