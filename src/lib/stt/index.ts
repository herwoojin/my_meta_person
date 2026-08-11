// ============================================================
// STT (음성→텍스트) 어댑터
// ============================================================

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface STTResult {
  text: string;
  language: string;
}

export interface STTOptions {
  /** BYOK: 사용자별 Gemini API 키. 없으면 서버 환경변수로 폴백. */
  geminiApiKey?: string;
}

export interface RefineOptions {
  /** BYOK: 사용자별 Gemini API 키. 없으면 서버 환경변수로 폴백. */
  geminiApiKey?: string;
  /** 같은 날 앞선 기록 등. 고유명사·회의명 표기를 맞추는 데 쓰인다. */
  context?: string;
}

/** 사용자가 자기 키를 등록하지 않았을 때 던지는 식별 가능한 에러. */
export class MissingApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingApiKeyError";
  }
}

/**
 * 오디오 파일을 텍스트로 변환합니다.
 * - gemini  : Google Gemini (멀티모달, 사용자 키 또는 GEMINI_API_KEY)
 * - whisper : OpenAI Whisper (OPENAI_API_KEY)
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options?: STTOptions
): Promise<STTResult> {
  const provider = process.env.STT_PROVIDER ?? "gemini";

  if (provider === "gemini") {
    return geminiTranscribe(audioBlob, options);
  }
  if (provider === "whisper") {
    return whisperTranscribe(audioBlob);
  }

  throw new Error(`지원하지 않는 STT 제공자: ${provider}`);
}

const GEMINI_STT_MODEL = "gemini-2.5-flash";

async function geminiTranscribe(
  audioBlob: Blob,
  options?: STTOptions
): Promise<STTResult> {
  // 사용자 본인 키 우선, 없으면 서버 환경변수 폴백
  const apiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError(
      "Gemini API 키가 없습니다. 설정에서 본인의 Gemini API 키를 등록해주세요."
    );
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: GEMINI_STT_MODEL });

  // Blob → base64 (서버 환경)
  const base64 = Buffer.from(await audioBlob.arrayBuffer()).toString("base64");
  const mimeType = audioBlob.type || "audio/webm";

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64,
        mimeType,
      },
    },
    {
      text:
        "이 오디오를 한국어로 정확히 받아쓰기해줘. " +
        "설명·따옴표·머리말 없이 받아쓴 텍스트만 출력해. " +
        "음성이 비어있거나 들리지 않으면 빈 문자열을 출력해.",
    },
  ]);

  const text = result.response.text().trim();

  return {
    text,
    language: "ko",
  };
}

async function whisperTranscribe(audioBlob: Blob): Promise<STTResult> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Blob을 File 객체로 변환
  const file = new File([audioBlob], "audio.webm", {
    type: audioBlob.type || "audio/webm",
  });

  const response = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: file,
    language: "ko",
    response_format: "json",
  });

  return {
    text: response.text,
    language: "ko",
  };
}

// ============================================================
// 받아쓰기 교정 (STT 후처리)
// ============================================================

const GEMINI_REFINE_MODEL = "gemini-2.5-flash";

const REFINE_PROMPT = `너는 한국어 음성 받아쓰기 결과를 교정하는 편집자다.
아래 [원문]은 음성 인식기가 받아쓴 것이라 오인식·중복·군더더기가 섞여 있다.
이것을 사람이 읽을 수 있는 자연스러운 문장으로 고쳐라.

규칙:
1. 없는 내용을 새로 지어내지 마라. 요약하지도 마라. 원문에 있는 정보는 모두 남긴다.
2. 문맥상 명백히 잘못 인식된 단어는 맞는 단어로 고친다.
   (예: 회의·업무 맥락에서 소리가 비슷한 엉뚱한 단어 → 맥락에 맞는 업무 용어)
3. 필러와 말버릇("어", "음", "뭐", "이제", 같은 말 반복)은 지운다.
4. 띄어쓰기·조사·문장부호를 바로잡고, 긴 내용은 문장 단위로 끊는다.
5. 말투(반말/존댓말)와 숫자 표기(예: "27년")는 원문 그대로 유지한다.
6. 무슨 말인지 도저히 알 수 없는 부분은 억지로 바꾸지 말고 원문 그대로 둔다.
7. 설명·머리말·따옴표 없이, 교정된 본문만 출력한다.`;

/**
 * 받아쓴 원문을 문맥에 맞게 교정합니다.
 * 실패하거나 결과가 이상하면 원문을 그대로 돌려주므로 기록이 유실되지 않습니다.
 */
export async function refineTranscript(
  rawText: string,
  options?: RefineOptions
): Promise<string> {
  const raw = rawText?.trim() ?? "";
  // 너무 짧으면 교정할 문맥 자체가 없다
  if (raw.length < 8) return raw;

  const apiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return raw;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: GEMINI_REFINE_MODEL });

    const contextBlock = options?.context?.trim()
      ? `\n\n[같은 날 앞선 기록 — 사람·회의·용어의 올바른 표기를 여기서 참고해라]\n${options.context.trim()}`
      : "";

    const result = await model.generateContent(
      `${REFINE_PROMPT}${contextBlock}\n\n[원문]\n${raw}`
    );

    const refined = result.response.text().trim();
    if (!refined) return raw;

    // 원문의 30% 미만으로 줄었다면 요약/누락으로 보고 원문 유지
    if (refined.length < raw.length * 0.3) return raw;

    return refined;
  } catch (error) {
    console.warn("[STT] 교정 실패, 원문 유지:", error);
    return raw;
  }
}
