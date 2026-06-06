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
