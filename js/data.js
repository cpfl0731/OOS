/* OOS content — draft, not professionally reviewed. Edit this file to change phrases. */
window.OOS_DATA = (function () {
  const INDUSTRIES = [
    { id: "cafe", label: "카페", icon: "☕" },
    { id: "convenience", label: "편의점", icon: "🏪" },
    { id: "restaurant", label: "식당", icon: "🍽️" },
    { id: "beauty", label: "뷰티샵", icon: "💄" },
  ];

  function byIndustry(map) {
    return map; // resolved at runtime with resolveText()
  }

  /** Resolve industry-specific string or plain string */
  function resolveText(value, industryId) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[industryId] || value.default || Object.values(value)[0] || "";
  }

  function applySlots(text, slots) {
    if (!text) return text;
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const v = slots && slots[key];
      return v && String(v).trim() ? String(v).trim() : "";
    });
  }

  function hasEmptySlots(text, slots) {
    if (!text || typeof text !== "string") return false;
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return false;
    return matches.some((m) => {
      const key = m.slice(2, -2);
      const v = slots && slots[key];
      return !v || !String(v).trim();
    });
  }

  // Shared fallback nodes reused via copy in situations
  const FALLBACK = {
    clarify: {
      id: "clarify",
      en: "I'm sorry, could you say that again more slowly?",
      ko: "죄송합니다. 조금 천천히 다시 말씀해 주실 수 있을까요?",
      choices: [
        {
          meaning: "다시 말씀해 주셨어요",
          enExample: "(guest repeats)",
          next: "__back__",
        },
        {
          meaning: "아직도 잘 모르겠어요",
          enExample: "I still don't understand",
          next: "manager",
        },
      ],
    },
    manager: {
      id: "manager",
      en: "Please wait a moment. I'll check with my manager.",
      ko: "잠시만 기다려 주세요. 담당자에게 확인해 볼게요.",
      endStatus: "need_check",
      endLabel: "추가 확인 필요",
    },
    sos: {
      id: "sos",
      en: "I'm sorry, I didn't catch that. Could you repeat it, please?",
      ko: "죄송합니다. 잘 못 들었어요. 다시 한 번 말씀해 주시겠어요?",
      choices: [
        {
          meaning: "다시 말씀해 주셨어요",
          enExample: "(guest repeats)",
          next: "__back__",
        },
        {
          meaning: "담당자에게 확인하고 싶어요",
          enExample: "Can I speak to a manager?",
          next: "manager",
        },
      ],
    },
  };

  /**
   * Situation shape:
   * - industries: ['all'] or list of industry ids
   * - start: node id
   * - nodes: { id: { en, ko, slots?, choices?, endStatus?, endLabel?, hint? } }
   * en/ko may be string or { cafe, convenience, restaurant, beauty, default }
   * slots: [{ key, label, help }] — fill before showing guest / speaking
   */
  const SITUATIONS = [
    // ——— Common 5 ———
    {
      id: "common-clarify",
      title: "되묻기·이해 확인",
      icon: "👂",
      industries: ["all"],
      start: "s1",
      nodes: {
        s1: {
          en: "I'm sorry, could you say that again?",
          ko: "죄송합니다. 다시 한 번 말씀해 주시겠어요?",
          choices: [
            {
              meaning: "천천히 다시 말해 주셨어요",
              enExample: "Sure. I said…",
              next: "s2",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Never mind / Forget it",
              next: "clarify",
            },
          ],
        },
        s2: {
          en: "Just to make sure I understand — is this what you mean?",
          ko: "제가 맞게 이해했는지 확인하고 싶어요. 이 뜻이 맞을까요?",
          choices: [
            {
              meaning: "맞다고 하셨어요",
              enExample: "Yes, that's right.",
              next: "done",
            },
            {
              meaning: "아니라고 하셨어요",
              enExample: "No, that's not it.",
              next: "clarify",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        done: {
          en: "Thank you. I'll take care of that for you.",
          ko: "감사합니다. 바로 도와드리겠습니다.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "common-wait",
      title: "잠시 대기·담당자 확인",
      icon: "⏳",
      industries: ["all"],
      start: "s1",
      nodes: {
        s1: {
          en: byIndustry({
            cafe: "Please wait a moment. I'll check on that for you.",
            convenience: "Please wait a moment. I'll check that for you.",
            restaurant: "Please wait a moment. I'll check with the kitchen.",
            beauty: "Please wait a moment. I'll check that for you.",
            default: "Please wait a moment. I'll check on that for you.",
          }),
          ko: byIndustry({
            cafe: "잠시만 기다려 주세요. 확인해 볼게요.",
            convenience: "잠시만 기다려 주세요. 확인해 볼게요.",
            restaurant: "잠시만 기다려 주세요. 주방에 확인해 볼게요.",
            beauty: "잠시만 기다려 주세요. 확인해 볼게요.",
            default: "잠시만 기다려 주세요. 확인해 볼게요.",
          }),
          choices: [
            {
              meaning: "기다릴 수 있다는 뜻이에요",
              enExample: "Okay / No problem.",
              next: "s2",
            },
            {
              meaning: "오래 기다리기 어렵다는 뜻이에요",
              enExample: "How long will it take?",
              next: "s_wait",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s_wait: {
          en: "I'll check right away and get back to you as soon as I can.",
          ko: "바로 확인하고, 되는 대로 바로 알려드릴게요.",
          choices: [
            {
              meaning: "기다린다고 하셨어요",
              enExample: "Okay, I'll wait.",
              next: "s2",
            },
            {
              meaning: "담당자를 찾고 싶다고 하셨어요",
              enExample: "Can I talk to a manager?",
              next: "manager",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s2: {
          en: "Thank you for waiting. I'll let you know as soon as I find out.",
          ko: "기다려 주셔서 감사합니다. 확인되는 대로 바로 알려드릴게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "common-payment",
      title: "결제 오류·다른 결제 수단",
      icon: "💳",
      industries: ["all"],
      start: "s1",
      nodes: {
        s1: {
          en: "I'm sorry, the payment didn't go through. Would you like to try another card or another payment method?",
          ko: "죄송합니다. 결제가 되지 않았어요. 다른 카드나 다른 결제 수단으로 시도해 보시겠어요?",
          choices: [
            {
              meaning: "다른 카드로 할게요",
              enExample: "I'll try another card.",
              next: "s2_card",
            },
            {
              meaning: "현금으로 할게요",
              enExample: "I'll pay with cash.",
              next: "s2_cash",
            },
            {
              meaning: "나중에 다시 할게요 / 취소할게요",
              enExample: "Never mind. / Cancel, please.",
              next: "s2_cancel",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "What happened?",
              next: "clarify",
            },
          ],
        },
        s2_card: {
          en: "Sure. Please try again when you're ready.",
          ko: "네. 준비되시면 다시 시도해 주세요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s2_cash: {
          en: "Of course. Cash is fine.",
          ko: "네, 현금으로 가능합니다.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s2_cancel: {
          en: "No problem. I've canceled this payment attempt.",
          ko: "알겠습니다. 이번 결제 시도는 취소할게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "common-unavailable",
      title: "이용 불가·대안 제안",
      icon: "🚫",
      industries: ["all"],
      start: "s1",
      nodes: {
        s1: {
          en: byIndustry({
            cafe: "I'm sorry, that drink isn't available right now. Would you like something else?",
            convenience: "I'm sorry, that item isn't available right now. Would you like something else?",
            restaurant: "I'm sorry, that dish isn't available right now. Would you like something else?",
            beauty: "I'm sorry, that product isn't available right now. Would you like something else?",
            default: "I'm sorry, that isn't available right now. Would you like something else?",
          }),
          ko: byIndustry({
            cafe: "죄송합니다. 그 음료는 지금은 준비할 수 없어요. 다른 걸로 드릴까요?",
            convenience: "죄송합니다. 그 상품은 지금은 없어요. 다른 상품을 찾아드릴까요?",
            restaurant: "죄송합니다. 그 메뉴는 지금은 준비할 수 없어요. 다른 메뉴로 드릴까요?",
            beauty: "죄송합니다. 그 제품은 지금은 없어요. 다른 제품으로 안내해 드릴까요?",
            default: "죄송합니다. 지금은 이용할 수 없어요. 다른 걸로 도와드릴까요?",
          }),
          choices: [
            {
              meaning: "다른 상품이나 메뉴를 원해요",
              enExample: "Sure, what else do you have?",
              next: "s2_alt",
            },
            {
              meaning: "괜찮아요 / 됐어요",
              enExample: "That's okay. Never mind.",
              next: "s2_ok",
            },
            {
              meaning: "담당자에게 확인하고 싶어요",
              enExample: "Can you check again?",
              next: "manager",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s2_alt: {
          en: byIndustry({
            cafe: "Sure. What would you like instead?",
            convenience: "Sure. Which one would you like instead?",
            restaurant: "Sure. What would you like instead?",
            beauty: "Sure. I can show you similar products.",
            default: "Sure. What would you like instead?",
          }),
          ko: byIndustry({
            cafe: "네. 대신 어떤 걸로 드릴까요?",
            convenience: "네. 대신 어떤 걸로 드릴까요?",
            restaurant: "네. 대신 어떤 메뉴로 드릴까요?",
            beauty: "네. 비슷한 다른 제품을 안내해 드릴게요.",
            default: "네. 대신 어떤 걸로 드릴까요?",
          }),
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s2_ok: {
          en: "Okay. Please let me know if you need anything else.",
          ko: "알겠습니다. 다른 도움이 필요하시면 말씀해 주세요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "common-refund",
      title: "취소·교환·환불 요청",
      icon: "↩️",
      industries: ["all"],
      start: "s1",
      nodes: {
        s1: {
          en: "I understand. Let me check whether we can cancel, exchange, or refund this.",
          ko: "알겠습니다. 취소·교환·환불이 가능한지 먼저 확인해 볼게요.",
          hint: "가능 여부는 확인 후에만 안내하세요.",
          choices: [
            {
              meaning: "취소하고 싶다는 뜻이에요",
              enExample: "I'd like to cancel.",
              next: "s2_check",
            },
            {
              meaning: "교환하고 싶다는 뜻이에요",
              enExample: "Can I exchange this?",
              next: "s2_check",
            },
            {
              meaning: "환불하고 싶다는 뜻이에요",
              enExample: "Can I get a refund?",
              next: "s2_check",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s2_check: {
          en: "Please wait a moment. I need to check with my manager about our policy.",
          ko: "잠시만 기다려 주세요. 매장 정책을 담당자에게 확인해 볼게요.",
          choices: [
            {
              meaning: "기다린다고 하셨어요",
              enExample: "Okay, I'll wait.",
              next: "manager",
            },
            {
              meaning: "그냥 됐어요",
              enExample: "Never mind.",
              next: "s2_cancel_req",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s2_cancel_req: {
          en: "Okay. Please let me know if you change your mind.",
          ko: "알겠습니다. 마음이 바뀌시면 말씀해 주세요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },

    // ——— Cafe 2 ———
    {
      id: "cafe-options",
      title: "음료 옵션 확인",
      icon: "🥛",
      industries: ["cafe"],
      start: "s1",
      nodes: {
        s1: {
          en: "Would you like that hot or iced?",
          ko: "뜨겁게 드릴까요, 아이스로 드릴까요?",
          choices: [
            {
              meaning: "뜨겁게요",
              enExample: "Hot, please.",
              next: "s2_size",
            },
            {
              meaning: "아이스요",
              enExample: "Iced, please.",
              next: "s2_size",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s2_size: {
          en: "What size would you like?",
          ko: "사이즈는 어떻게 드릴까요?",
          choices: [
            {
              meaning: "사이즈를 골랐어요",
              enExample: "Regular / Large, please.",
              next: "s3",
            },
            {
              meaning: "옵션을 더 묻고 있어요",
              enExample: "Can I get oat milk? / Less sweet?",
              next: "s3_extra",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s3: {
          en: "Got it. I'll prepare that for you.",
          ko: "알겠습니다. 그렇게 준비해 드릴게요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s3_extra: {
          en: "Sure. Please tell me the options you'd like, and I'll check if we can do that.",
          ko: "네. 원하시는 옵션을 말씀해 주세요. 가능한지 확인해 볼게요.",
          hint: "알레르기·성분은 추측하지 마세요.",
          choices: [
            {
              meaning: "옵션을 말해 주셨어요",
              enExample: "Oat milk, please.",
              next: "s3",
            },
            {
              meaning: "확인하고 싶다고 하셨어요",
              enExample: "Can you check?",
              next: "manager",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "cafe-here-or-go",
      title: "매장 이용·포장 확인",
      icon: "🥡",
      industries: ["cafe"],
      start: "s1",
      nodes: {
        s1: {
          en: "For here or to go?",
          ko: "매장에서 드실래요, 포장해 드릴까요?",
          choices: [
            {
              meaning: "매장에서 먹을게요",
              enExample: "For here.",
              next: "s2_here",
            },
            {
              meaning: "포장해 주세요",
              enExample: "To go, please.",
              next: "s2_go",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s2_here: {
          en: "Okay. I'll bring it to you when it's ready. Please take a seat.",
          ko: "네. 준비되면 가져다드릴게요. 자리에 앉아 계세요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s2_go: {
          en: "Okay. I'll pack it for you.",
          ko: "네. 포장해 드릴게요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },

    // ——— Convenience 2 ———
    {
      id: "cvs-location",
      title: "상품 위치 안내",
      icon: "📍",
      industries: ["convenience"],
      start: "s1",
      nodes: {
        s1: {
          en: "What are you looking for?",
          ko: "무엇을 찾고 계세요?",
          choices: [
            {
              meaning: "상품 이름을 말씀해 주셨어요",
              enExample: "Where is the water? / Do you have…?",
              next: "s2",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s2: {
          en: "It's over this way. Please follow me.",
          ko: "이쪽에 있어요. 따라와 주세요.",
          choices: [
            {
              meaning: "안내해 드리면 됩니다",
              enExample: "Thank you.",
              next: "done",
            },
            {
              meaning: "없다고 해야 할 것 같아요",
              enExample: "Do you have it in stock?",
              next: "s_out",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s_out: {
          en: "I'm not sure if we have it right now. Please wait a moment while I check.",
          ko: "지금 있는지는 확실하지 않아요. 잠시만 기다려 주세요. 확인해 볼게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        done: {
          en: "Here you go. Let me know if you need anything else.",
          ko: "여기 있어요. 다른 도움이 필요하시면 말씀해 주세요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "cvs-promo",
      title: "행사 적용 여부 확인",
      icon: "🏷️",
      industries: ["convenience"],
      start: "s1",
      nodes: {
        s1: {
          en: "Let me check if a promotion applies to this item.",
          ko: "이 상품에 행사가 적용되는지 확인해 볼게요.",
          choices: [
            {
              meaning: "행사인지 묻고 있어요",
              enExample: "Is this on sale? / Buy one get one?",
              next: "s2",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s2: {
          en: "Please wait a moment. I'll confirm and let you know.",
          ko: "잠시만 기다려 주세요. 확인해서 알려드릴게요.",
          choices: [
            {
              meaning: "기다린다고 하셨어요",
              enExample: "Okay.",
              next: "s3_safe",
            },
            {
              meaning: "담당자를 원해요",
              enExample: "Manager, please.",
              next: "manager",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s3_safe: {
          en: "I'll confirm the promotion details and get back to you.",
          ko: "행사 내용을 확인한 뒤 다시 안내해 드릴게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },

    // ——— Restaurant 2 ———
    {
      id: "rest-seating",
      title: "인원·좌석·대기 안내",
      icon: "🪑",
      industries: ["restaurant"],
      start: "s1",
      nodes: {
        s1: {
          en: "How many people are in your party?",
          ko: "몇 분이세요?",
          slots: [
            {
              key: "partySize",
              label: "인원 수 (확인한 뒤 입력)",
              help: "숫자를 입력하면 다음 안내에 반영됩니다. 비우면 안전한 문장으로 안내합니다.",
            },
          ],
          choices: [
            {
              meaning: "인원을 말씀해 주셨어요",
              enExample: "Two, please. / Table for four.",
              next: "s2",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s2: {
          en: "Please wait a moment. I'll check for available seats.",
          ko: "잠시만 기다려 주세요. 자리가 있는지 확인해 볼게요.",
          choices: [
            {
              meaning: "바로 안내하면 됩니다",
              enExample: "Okay.",
              next: "s3_seat",
            },
            {
              meaning: "대기가 필요해요",
              enExample: "How long is the wait?",
              next: "s3_wait",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s3_seat: {
          enSlot: "Right this way. A table for {{partySize}}.",
          enFallback: "Right this way. Please follow me to your table.",
          koSlot: "이쪽으로 오세요. {{partySize}}분 자리입니다.",
          koFallback: "이쪽으로 오세요. 자리로 안내해 드릴게요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s3_wait: {
          en: "Please wait a moment. I'll confirm the wait and let you know.",
          ko: "잠시만 기다려 주세요. 대기 여부를 확인해서 알려드릴게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "rest-order",
      title: "주문 내용·요청사항 확인",
      icon: "📝",
      industries: ["restaurant"],
      start: "s1",
      nodes: {
        s1: {
          en: "Are you ready to order?",
          ko: "주문하실 준비되셨나요?",
          choices: [
            {
              meaning: "주문할 준비가 됐어요",
              enExample: "Yes, I'd like…",
              next: "s2",
            },
            {
              meaning: "아직이에요 / 메뉴를 더 볼게요",
              enExample: "Not yet. / I need a minute.",
              next: "s_wait",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s_wait: {
          en: "No problem. Please take your time. Just let me know when you're ready.",
          ko: "괜찮습니다. 천천히 보세요. 준비되시면 불러 주세요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s2: {
          en: "Just to confirm — is there anything I should note, like spice level or no ingredients?",
          ko: "확인할게요. 맵기나 빼실 재료 같은 요청사항이 있으신가요?",
          hint: "알레르기·성분은 추측하지 마세요.",
          choices: [
            {
              meaning: "요청사항이 있어요",
              enExample: "Not too spicy. / No onions, please.",
              next: "s3",
            },
            {
              meaning: "특별한 요청은 없어요",
              enExample: "No, that's all.",
              next: "s3",
            },
            {
              meaning: "알레르기라고 하셨어요",
              enExample: "I have an allergy.",
              next: "s_allergy",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s3: {
          en: "Got it. I'll place your order now.",
          ko: "알겠습니다. 주문 넣어드릴게요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s_allergy: {
          en: "Thank you for telling me. Please wait a moment — I need to check with the kitchen about the ingredients.",
          ko: "말씀해 주셔서 감사합니다. 잠시만요. 재료는 주방에 확인해 볼게요.",
          hint: "알레르기·성분은 추측하지 마세요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },

    // ——— Beauty / cosmetics 5 ———
    {
      id: "beauty-location",
      title: "상품 위치·카테고리 안내",
      icon: "🗺️",
      industries: ["beauty"],
      start: "s1",
      nodes: {
        s1: {
          en: "Are you looking for skincare, masks, or makeup?",
          ko: "스킨케어, 마스크팩, 메이크업 중 어떤 코너를 찾고 계세요?",
          choices: [
            {
              meaning: "스킨케어를 찾아요",
              enExample: "Skincare, please. / Face cream.",
              next: "s_skin",
            },
            {
              meaning: "마스크팩을 찾아요",
              enExample: "Where are the face masks?",
              next: "s_mask",
            },
            {
              meaning: "메이크업을 찾아요",
              enExample: "Makeup / Lipstick / Foundation.",
              next: "s_makeup",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s_skin: {
          en: "The skincare section is this way. Please follow me.",
          ko: "스킨케어 코너는 이쪽이에요. 따라와 주세요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s_mask: {
          en: "Face masks are over here. Let me show you.",
          ko: "마스크팩은 이쪽에 있어요. 안내해 드릴게요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s_makeup: {
          en: "Makeup is this way — lips, eyes, and base are separated by category.",
          ko: "메이크업은 이쪽이에요. 립·아이·베이스로 나뉘어 있어요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "beauty-taxfree",
      title: "면세(Tax Free)·결제 확인",
      icon: "🛂",
      industries: ["beauty"],
      start: "s1",
      nodes: {
        s1: {
          en: "Would you like tax-free shopping today?",
          ko: "오늘 면세(Tax Free)로 결제하실까요?",
          choices: [
            {
              meaning: "면세하고 싶어요",
              enExample: "Yes, tax free, please.",
              next: "s2",
            },
            {
              meaning: "일반 결제할게요",
              enExample: "No, regular payment is fine.",
              next: "s_regular",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "What is tax free?",
              next: "s_explain",
            },
          ],
        },
        s2: {
          en: "Please show me your passport. I'll check the tax-free process and guide you.",
          ko: "여권을 보여 주시겠어요? 면세 절차를 확인한 뒤 안내해 드릴게요.",
          hint: "환급 금액·한도·즉시/사후 조건은 임의로 말하지 마세요.",
          choices: [
            {
              meaning: "여권을 보여 주셨어요",
              enExample: "Here you go. / Here's my passport.",
              next: "s3",
            },
            {
              meaning: "여권이 없어요 / 준비가 안 됐어요",
              enExample: "I don't have my passport with me.",
              next: "s_no_pass",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s3: {
          en: "Please wait a moment. I'll confirm whether instant refund or later refund applies, then I'll explain.",
          ko: "잠시만 기다려 주세요. 즉시 환급인지 사후 면세인지 확인한 뒤 안내해 드릴게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        s_regular: {
          en: "Okay. We'll proceed with a regular payment.",
          ko: "알겠습니다. 일반 결제로 진행할게요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s_explain: {
          en: "Tax-free means you may get a VAT refund as a traveler. Please wait a moment — I'll confirm the details for you.",
          ko: "면세는 여행객 부가세 환급을 말씀하시는 경우가 많아요. 잠시만요. 자세한 내용은 확인 후 안내해 드릴게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        s_no_pass: {
          en: "I'm sorry. For tax-free, a passport is usually required. Please wait a moment — I'll check what options we have.",
          ko: "죄송합니다. 면세에는 보통 여권이 필요해요. 잠시만요. 가능한 방법을 확인해 볼게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "beauty-tester",
      title: "테스터·샘플 요청 응대",
      icon: "🧴",
      industries: ["beauty"],
      start: "s1",
      nodes: {
        s1: {
          en: "Would you like to try a tester, or are you asking about a sample?",
          ko: "테스터를 써 보고 싶으신가요, 아니면 샘플을 문의하시는 건가요?",
          choices: [
            {
              meaning: "테스터를 찾아요",
              enExample: "Can I try a tester?",
              next: "s_tester",
            },
            {
              meaning: "샘플을 원해요",
              enExample: "Do you have a sample?",
              next: "s_sample",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s_tester: {
          en: "Please wait a moment. I'll check if we have a tester and where it's displayed.",
          ko: "잠시만 기다려 주세요. 테스터가 있는지, 어디에 비치되어 있는지 확인해 볼게요.",
          choices: [
            {
              meaning: "테스터가 있어요 / 안내해 주세요",
              enExample: "Okay, thank you.",
              next: "s_tester_ok",
            },
            {
              meaning: "테스터가 없다고 안내해야 해요",
              enExample: "(no tester)",
              next: "s_tester_no",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s_tester_ok: {
          en: "The tester is over here. You're welcome to try it.",
          ko: "테스터는 이쪽에 있어요. 사용해 보시면 됩니다.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s_tester_no: {
          en: "I'm sorry, we don't have a tester for this one right now. I can show you similar products.",
          ko: "죄송합니다. 이 제품 테스터는 지금은 없어요. 비슷한 제품을 안내해 드릴까요?",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s_sample: {
          en: "Please wait a moment. I'll check whether a sample is available with your purchase.",
          ko: "잠시만 기다려 주세요. 구매 시 샘플 증정이 가능한지 확인해 볼게요.",
          hint: "샘플 유무·개수를 추측하지 마세요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "beauty-stock",
      title: "재고 문의·다른 지점 안내",
      icon: "📦",
      industries: ["beauty"],
      start: "s1",
      nodes: {
        s1: {
          en: "Please wait a moment. I'll check if we have that in stock.",
          ko: "잠시만 기다려 주세요. 재고가 있는지 확인해 볼게요.",
          hint: "재고 수량·타 지점 재고를 임의로 말하지 마세요.",
          choices: [
            {
              meaning: "매장에 있는 것 같아요",
              enExample: "Okay.",
              next: "s_have",
            },
            {
              meaning: "품절인 것 같아요",
              enExample: "Is it sold out?",
              next: "s_out",
            },
            {
              meaning: "다른 지점도 물어봐요",
              enExample: "Do other stores have it?",
              next: "s_branch",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s_have: {
          en: "Yes, we have it here. Let me get it for you.",
          ko: "네, 매장에 있어요. 찾아드릴게요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        s_out: {
          en: "I'm sorry, it's out of stock at this store right now. I can check other branches for you.",
          ko: "죄송합니다. 이 매장에서는 지금은 품절이에요. 다른 지점 재고를 확인해 드릴까요?",
          choices: [
            {
              meaning: "다른 지점 확인해 주세요",
              enExample: "Yes, please check other stores.",
              next: "s_branch",
            },
            {
              meaning: "괜찮아요",
              enExample: "That's okay. Never mind.",
              next: "s_ok",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "I don't understand.",
              next: "clarify",
            },
          ],
        },
        s_branch: {
          en: "Please wait a moment. I'll check stock at other branches and get back to you.",
          ko: "잠시만 기다려 주세요. 다른 지점 재고를 확인해서 알려드릴게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        s_ok: {
          en: "Okay. Please let me know if you need anything else.",
          ko: "알겠습니다. 다른 도움이 필요하시면 말씀해 주세요.",
          endStatus: "done",
          endLabel: "응대 마침",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
    {
      id: "beauty-promo",
      title: "1+1·행사·사은품 안내",
      icon: "🎁",
      industries: ["beauty"],
      start: "s1",
      nodes: {
        s1: {
          en: "Are you asking about a 1+1 / 2+1 deal, or about a free gift?",
          ko: "1+1·2+1 행사 문의이신가요, 아니면 사은품 문의이신가요?",
          choices: [
            {
              meaning: "1+1 / 2+1 행사요",
              enExample: "Is this 1+1? / Buy one get one?",
              next: "s_deal",
            },
            {
              meaning: "사은품·증정품이요",
              enExample: "Do I get a free gift?",
              next: "s_gift",
            },
            {
              meaning: "무슨 뜻인지 모르겠어요",
              enExample: "Sorry?",
              next: "clarify",
            },
          ],
        },
        s_deal: {
          en: "Please wait a moment. I'll confirm which promotion applies to this product.",
          ko: "잠시만 기다려 주세요. 이 제품에 어떤 행사가 적용되는지 확인해 볼게요.",
          hint: "할인율·행사 조건을 추측하지 마세요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        s_gift: {
          en: "Please wait a moment. I'll check the gift-with-purchase conditions for you.",
          ko: "잠시만 기다려 주세요. 사은품 증정 조건을 확인해 볼게요.",
          endStatus: "need_check",
          endLabel: "추가 확인 필요",
        },
        clarify: FALLBACK.clarify,
        manager: FALLBACK.manager,
        sos: FALLBACK.sos,
      },
    },
  ];

  function getIndustry(id) {
    return INDUSTRIES.find((i) => i.id === id) || null;
  }

  function situationsForIndustry(industryId) {
    const common = SITUATIONS.filter((s) => s.industries.includes("all"));
    const specific = SITUATIONS.filter(
      (s) => !s.industries.includes("all") && s.industries.includes(industryId)
    );
    return { common, specific };
  }

  function getSituation(id) {
    return SITUATIONS.find((s) => s.id === id) || null;
  }

  function getNodePhrase(node, industryId, slots) {
    if (!node) return { en: "", ko: "", incomplete: false };

    let en = "";
    let ko = "";

    if (node.enSlot || node.enFallback) {
      const slotted = applySlots(node.enSlot || "", slots);
      if (node.enSlot && !hasEmptySlots(node.enSlot, slots) && slotted) {
        en = slotted;
      } else {
        en = node.enFallback || resolveText(node.en, industryId);
      }
    } else {
      en = resolveText(node.en, industryId);
      en = applySlots(en, slots);
    }

    if (node.koSlot || node.koFallback) {
      const slotted = applySlots(node.koSlot || "", slots);
      if (node.koSlot && !hasEmptySlots(node.koSlot, slots) && slotted) {
        ko = slotted;
      } else {
        ko = node.koFallback || resolveText(node.ko, industryId);
      }
    } else {
      ko = resolveText(node.ko, industryId);
      ko = applySlots(ko, slots);
    }

    const incomplete =
      hasEmptySlots(resolveText(node.en, industryId) || node.enSlot || "", slots) ||
      (node.enSlot && hasEmptySlots(node.enSlot, slots) && !node.enFallback);

    // If still has {{}} after apply, treat as incomplete for guest/TTS
    const hasBrackets = /\{\{\w+\}\}/.test(en);
    return {
      en: hasBrackets ? (node.enFallback || "I'll confirm and get back to you.") : en,
      ko: hasBrackets ? (node.koFallback || "확인 후 안내해 드릴게요.") : ko,
      incomplete: hasBrackets || (incomplete && !node.enFallback),
      rawIncomplete: hasBrackets,
    };
  }

  return {
    INDUSTRIES,
    SITUATIONS,
    FALLBACK,
    getIndustry,
    situationsForIndustry,
    getSituation,
    resolveText,
    getNodePhrase,
    applySlots,
    hasEmptySlots,
  };
})();
