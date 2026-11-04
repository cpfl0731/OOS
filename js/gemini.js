/**
 * OOS Gemini client (browser CDN)
 * - @google/genai via esm.sh
 * - GEMINI_API_KEY is loaded from ./.env (not hardcoded)
 *
 * ⚠ .env를 fetch 하므로 로컬 서버로 열어야 합니다 (Live Server 등).
 *   file:// 더블클릭만으로는 .env를 읽을 수 없습니다.
 */
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.30.0";

let apiKey = "";
let model = "gemini-2.0-flash";
let ai = null;
let readyPromise = null;

function parseEnv(text) {
  const out = {};
  String(text || "")
    .split(/\r?\n/)
    .forEach((raw) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      const i = line.indexOf("=");
      if (i < 0) return;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    });
  return out;
}

async function loadEnv() {
  // prefer .env; also try env without dot if host blocks dotfiles
  let lastError = null;
  for (const path of ["./.env", "./env", "/.env"]) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        lastError = new Error(`${path} HTTP ${res.status}`);
        continue;
      }
      const env = parseEnv(await res.text());
      const key = (env.GEMINI_API_KEY || "").trim();
      if (!key) {
        lastError = new Error(`${path}에 GEMINI_API_KEY가 없습니다.`);
        continue;
      }
      apiKey = key;
      if ((env.GEMINI_MODEL || "").trim()) model = env.GEMINI_MODEL.trim();
      ai = new GoogleGenAI({ apiKey });
      return { ok: true, model, source: path };
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(
    (lastError && lastError.message ? lastError.message + " — " : "") +
      ".env의 GEMINI_API_KEY를 읽지 못했습니다. Live Server 등으로 http로 열고 .env가 프로젝트 루트에 있는지 확인하세요."
  );
}

/** Resolve once; safe to call many times */
function ready() {
  if (!readyPromise) {
    readyPromise = loadEnv().catch((e) => {
      readyPromise = null;
      throw e;
    });
  }
  return readyPromise;
}

function parseJsonLoose(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch (e2) {
      return null;
    }
  }
}

async function health() {
  try {
    await ready();
    return {
      ok: true,
      geminiKeyConfigured: Boolean(apiKey),
      model,
      mode: "browser-cdn-env",
    };
  } catch (e) {
    return { ok: false, reason: "env", error: e.message };
  }
}

/**
 * @param {{ prompt: string, systemInstruction?: string, responseJson?: boolean }} opts
 */
async function generateContent(opts) {
  opts = opts || {};
  await ready();
  const prompt = String(opts.prompt || "").trim();
  if (!prompt) throw new Error("prompt가 비어 있습니다.");
  if (!ai) throw new Error("Gemini 클라이언트가 초기화되지 않았습니다.");

  const config = {
    temperature: 0.9,
    maxOutputTokens: 1024,
  };
  if (opts.systemInstruction) config.systemInstruction = opts.systemInstruction;
  if (opts.responseJson) config.responseMimeType = "application/json";

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  const text = String(response.text || "").trim();
  if (!text) throw new Error("Gemini 응답이 비어 있습니다.");
  return { ok: true, text, model };
}

/** 연습용 손님 첫 멘트 */
async function generateGuestOpener(ctx) {
  ctx = ctx || {};
  const industry = ctx.industryLabel || ctx.industryId || "store";
  const title = ctx.situationTitle || ctx.situationId || "customer service";

  const systemInstruction =
    "You write short guest lines for Korean part-time staff practicing workplace English. " +
    "Keep guest English A2–B1, natural spoken English. Korean must be natural. " +
    "Return JSON only.";

  const prompt =
    `Create ONE guest opening line for this workplace practice scene.\n` +
    `Industry: ${industry}\n` +
    `Situation: ${title}\n` +
    `Rules:\n` +
    `- Guest is a customer speaking first to staff\n` +
    `- Do NOT use generic "Hi, could you help me?"\n` +
    `- Make it specific to the situation\n` +
    `- JSON shape: {"en":"...","ko":"..."}\n`;

  const res = await generateContent({
    prompt,
    systemInstruction,
    responseJson: true,
  });
  const parsed = parseJsonLoose(res.text);
  if (!parsed || !parsed.en) {
    throw new Error("손님 멘트 JSON을 해석하지 못했습니다.");
  }
  return {
    en: String(parsed.en).trim(),
    ko: String(parsed.ko || "").trim(),
  };
}

/**
 * 알바 상황별 회화 / 단어 생성
 * @param {{ industry: string, situation: string, kind?: 'dialogue'|'vocab', count?: number }} opts
 */
async function generateJobEnglish(opts) {
  opts = opts || {};
  const kind = opts.kind === "vocab" ? "vocab" : "dialogue";
  const count = Math.min(
    Math.max(Number(opts.count) || (kind === "vocab" ? 6 : 3), 1),
    12
  );
  const industry = opts.industry || "카페";
  const situation = opts.situation || "손님 응대";

  const systemInstruction =
    "You help Korean part-time workers learn short English for real store situations. " +
    "English should be practical and spoken. Return JSON only.";

  const prompt =
    kind === "vocab"
      ? `Generate ${count} useful English words/phrases for Korean staff.\n` +
        `Industry: ${industry}\nSituation: ${situation}\n` +
        `JSON: {"items":[{"en":"...","ko":"...","example":"..."}]}`
      : `Generate ${count} short staff↔guest dialogue turns for practice.\n` +
        `Industry: ${industry}\nSituation: ${situation}\n` +
        `JSON: {"lines":[{"role":"guest"|"staff","en":"...","ko":"..."}]}`;

  const res = await generateContent({
    prompt,
    systemInstruction,
    responseJson: true,
  });
  const parsed = parseJsonLoose(res.text);
  if (!parsed) throw new Error("생성 결과를 해석하지 못했습니다.");
  return { kind, industry, situation, ...parsed, rawText: res.text, model };
}

/** 편의 헬퍼: 회화 */
function loadDialogue(industry, situation, count) {
  return generateJobEnglish({ industry, situation, kind: "dialogue", count });
}

/** 편의 헬퍼: 단어 */
function loadVocab(industry, situation, count) {
  return generateJobEnglish({ industry, situation, kind: "vocab", count });
}

/* ——— 1) 역할극 + 피드백 ——— */
const roleplaySessions = new Map();
let roleplaySeq = 0;

/**
 * 어려운 알바 상황을 입력하면 외국인 손님이 먼저 말을 겁니다.
 * @param {{ situationKo: string, industry?: string }} opts
 * @returns {Promise<{ sessionId: string, guestEn: string, guestKo: string, turns: array }>}
 */
async function startRoleplay(opts) {
  opts = opts || {};
  const situationKo = String(opts.situationKo || "").trim();
  if (!situationKo) throw new Error("어려웠던 상황을 입력해 주세요.");
  const industry = String(opts.industry || "카페").trim() || "카페";

  const systemInstruction =
    "You are a foreign customer at a Korean part-time workplace. " +
    "Speak natural A2–B1 English. Keep lines short (1–2 sentences). Return JSON only.";

  const prompt =
    `Start a roleplay. Industry: ${industry}\n` +
    `Staff struggled with this situation (Korean): ${situationKo}\n` +
    `Write the FIRST guest line only.\n` +
    `JSON: {"guestEn":"...","guestKo":"..."}\n`;

  const res = await generateContent({
    prompt,
    systemInstruction,
    responseJson: true,
  });
  const parsed = parseJsonLoose(res.text);
  if (!parsed || !parsed.guestEn) {
    throw new Error("역할극 시작 멘트를 만들지 못했습니다.");
  }

  const sessionId = "rp-" + ++roleplaySeq;
  const turn = {
    role: "guest",
    en: String(parsed.guestEn).trim(),
    ko: String(parsed.guestKo || "").trim(),
  };
  const session = {
    id: sessionId,
    situationKo,
    industry,
    turns: [turn],
  };
  roleplaySessions.set(sessionId, session);

  return {
    sessionId,
    guestEn: turn.en,
    guestKo: turn.ko,
    turns: session.turns.slice(),
  };
}

/**
 * 직원이 영어 답변 → 더 자연·간결한 알바 표현 제안 + 손님 다음 말
 * @param {{ sessionId: string, userEnglish: string }} opts
 */
async function getFeedback(opts) {
  opts = opts || {};
  const sessionId = opts.sessionId;
  const userEnglish = String(opts.userEnglish || "").trim();
  if (!sessionId || !roleplaySessions.has(sessionId)) {
    throw new Error("역할극 세션이 없습니다. startRoleplay를 먼저 호출하세요.");
  }
  if (!userEnglish) throw new Error("영어 답변을 입력해 주세요.");

  const session = roleplaySessions.get(sessionId);
  session.turns.push({ role: "staff", en: userEnglish, ko: "" });

  const history = session.turns
    .map((t) => `${t.role === "guest" ? "Guest" : "Staff"}: ${t.en}`)
    .join("\n");

  const systemInstruction =
    "You coach Korean part-time staff in workplace English. " +
    "Prefer short, natural service English. Return JSON only.";

  const prompt =
    `Industry: ${session.industry}\nSituation: ${session.situationKo}\n` +
    `Dialogue so far:\n${history}\n\n` +
    `The staff just said: "${userEnglish}"\n` +
    `1) Suggest a better/more natural staff line (or same if already good)\n` +
    `2) Give a short tip in Korean\n` +
    `3) Write the next Guest reply\n` +
    `JSON: {"betterEn":"...","tipKo":"...","score":"good"|"ok"|"bad","guestEn":"...","guestKo":"..."}\n`;

  const res = await generateContent({
    prompt,
    systemInstruction,
    responseJson: true,
  });
  const parsed = parseJsonLoose(res.text);
  if (!parsed) throw new Error("피드백을 해석하지 못했습니다.");

  const guestTurn = {
    role: "guest",
    en: String(parsed.guestEn || "").trim(),
    ko: String(parsed.guestKo || "").trim(),
  };
  if (guestTurn.en) session.turns.push(guestTurn);

  return {
    sessionId,
    betterEn: String(parsed.betterEn || "").trim(),
    tipKo: String(parsed.tipKo || "").trim(),
    score: parsed.score || "ok",
    guestEn: guestTurn.en,
    guestKo: guestTurn.ko,
    turns: session.turns.slice(),
  };
}

function getRoleplaySession(sessionId) {
  const s = roleplaySessions.get(sessionId);
  return s ? { ...s, turns: s.turns.slice() } : null;
}

/* ——— 2) 한국어 → 영어 번역 ——— */
/**
 * 알바 상황에 맞는 자연스러운 영어 표현으로 번역
 * @param {string} koreanText
 * @param {{ industry?: string, situation?: string }} context
 */
async function translateToEnglish(koreanText, context) {
  context = context || {};
  const text = String(koreanText || "").trim();
  if (!text) throw new Error("번역할 한국어를 입력해 주세요.");

  const industry = context.industry || "카페";
  const situation = context.situation || "손님 응대";

  const systemInstruction =
    "Translate Korean staff speech into natural short workplace English for part-time jobs. " +
    "Prefer concise service phrases. Return JSON only.";

  const prompt =
    `Industry: ${industry}\nSituation: ${situation}\n` +
    `Korean: ${text}\n` +
    `JSON: {"en":"...","alt":["...","..."],"noteKo":"..."}\n`;

  const res = await generateContent({
    prompt,
    systemInstruction,
    responseJson: true,
  });
  const parsed = parseJsonLoose(res.text);
  if (!parsed || !parsed.en) throw new Error("번역 결과를 해석하지 못했습니다.");

  return {
    en: String(parsed.en).trim(),
    alt: Array.isArray(parsed.alt) ? parsed.alt.map((x) => String(x).trim()).filter(Boolean) : [],
    noteKo: String(parsed.noteKo || "").trim(),
    sourceKo: text,
  };
}

/* ——— 3) TTS (Web Speech API / OOS_SPEECH) ——— */
/**
 * 영어 문장 읽어주기 — 외부 TTS API 키 불필요
 * @param {string} text
 * @param {{ onError?: Function, onEnd?: Function }} opts
 */
function speakText(text, opts) {
  opts = opts || {};
  const Speech = window.OOS_SPEECH;
  if (Speech && typeof Speech.speak === "function") {
    Speech.speak(text, opts.onError, opts.onEnd);
    return;
  }
  if (!("speechSynthesis" in window)) {
    if (opts.onError) opts.onError("이 브라우저는 음성 읽기를 지원하지 않습니다.");
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text || "").trim());
  u.lang = "en-US";
  u.rate = 0.9;
  if (opts.onError) u.onerror = () => opts.onError("음성 재생 실패");
  if (opts.onEnd) u.onend = () => opts.onEnd();
  window.speechSynthesis.speak(u);
}

function stopSpeaking() {
  if (window.OOS_SPEECH && window.OOS_SPEECH.stop) window.OOS_SPEECH.stop();
  else if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/* ——— 4) STT (SpeechRecognition) ——— */
/**
 * 브라우저 음성 인식 → 텍스트
 * @param {{ lang?: string, onResult?: (text:string)=>void, onError?: (msg:string)=>void, onEnd?: ()=>void }} opts
 * @returns {{ stop: Function }}
 */
function startSpeechRecognition(opts) {
  opts = opts || {};
  const Speech = window.OOS_SPEECH;
  if (Speech && typeof Speech.listen === "function") {
    // reuse accent prefs when lang not forced
    if (opts.lang) {
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) {
        if (opts.onError) opts.onError("이 브라우저는 음성 인식을 지원하지 않습니다.");
        return { stop() {} };
      }
      const rec = new Rec();
      rec.lang = opts.lang;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        const text =
          (ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || "";
        if (opts.onResult) opts.onResult(String(text).trim());
      };
      rec.onerror = (ev) => {
        if (opts.onError) opts.onError(ev.error || "인식 실패");
      };
      rec.onend = () => {
        if (opts.onEnd) opts.onEnd();
      };
      try {
        rec.start();
      } catch (e) {
        if (opts.onError) opts.onError("음성 인식을 시작할 수 없습니다.");
      }
      return {
        stop() {
          try {
            rec.stop();
          } catch (e) {}
        },
      };
    }
    return Speech.listen({
      onResult: opts.onResult,
      onError: opts.onError,
      onEnd: opts.onEnd,
    });
  }

  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) {
    if (opts.onError) opts.onError("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome/Edge를 권장합니다.");
    return { stop() {} };
  }
  const rec = new Rec();
  rec.lang = opts.lang || "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (ev) => {
    const text =
      (ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || "";
    if (opts.onResult) opts.onResult(String(text).trim());
  };
  rec.onerror = (ev) => {
    if (opts.onError) opts.onError(ev.error || "인식 실패");
  };
  rec.onend = () => {
    if (opts.onEnd) opts.onEnd();
  };
  try {
    rec.start();
  } catch (e) {
    if (opts.onError) opts.onError("음성 인식을 시작할 수 없습니다.");
  }
  return {
    stop() {
      try {
        rec.stop();
      } catch (e) {}
    },
  };
}

window.OOS_GEMINI = {
  ready,
  health,
  generateContent,
  generateGuestOpener,
  generateJobEnglish,
  loadDialogue,
  loadVocab,
  startRoleplay,
  getFeedback,
  getRoleplaySession,
  translateToEnglish,
  speakText,
  stopSpeaking,
  startSpeechRecognition,
};

// Kick off env load early so practice can use AI sooner
ready().catch((e) => console.warn("[OOS_GEMINI]", e.message));
window.dispatchEvent(new CustomEvent("oos-gemini-ready"));
