// ============================================================
// /api/stt — 음성→텍스트 변환 API
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError } from "@/lib/auth/verify";
import { transcribeAudio, MissingApiKeyError } from "@/lib/stt";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  // 인증 확인
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "오디오 파일이 필요합니다." },
        { status: 400 }
      );
    }

    // BYOK: 이 사용자가 등록한 Gemini 키를 읽어온다 (없으면 env 폴백)
    const userDoc = await adminDb.doc(`users/${uid}`).get();
    const geminiApiKey = userDoc.data()?.geminiApiKey as string | undefined;

    // STT 변환
    const result = await transcribeAudio(audioFile, { geminiApiKey });

    // 현재 시각 (HH:MM)
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return NextResponse.json({
      text: result.text,
      time,
      language: result.language,
    });
  } catch (error) {
    // 키 미등록 → 클라이언트가 안내 메시지를 띄울 수 있게 400 + 코드
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: error.message, code: "NO_API_KEY" },
        { status: 400 }
      );
    }
    console.error("[STT] 변환 실패:", error);
    return NextResponse.json(
      { error: "음성 변환에 실패했습니다." },
      { status: 500 }
    );
  }
}
