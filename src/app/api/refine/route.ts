// ============================================================
// /api/refine — 받아쓰기 텍스트 교정 API
// 이미 저장된 기록을 다시 다듬을 때 사용한다 (편집 화면의 "AI 교정")
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError } from "@/lib/auth/verify";
import { refineTranscript } from "@/lib/stt";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  try {
    const { text, dateKey } = await req.json();

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "교정할 텍스트가 필요합니다." },
        { status: 400 }
      );
    }

    // BYOK: 사용자 키 우선 (없으면 env 폴백)
    const userDoc = await adminDb.doc(`users/${uid}`).get();
    const geminiApiKey = userDoc.data()?.geminiApiKey as string | undefined;

    // 같은 날 기록을 문맥으로 (고유명사·회의명 표기 통일)
    let context = "";
    if (dateKey) {
      try {
        const doc = await adminDb.doc(`users/${uid}/journals/${dateKey}`).get();
        context = ((doc.data()?.mdSnapshot as string | undefined) ?? "").slice(
          -1200
        );
      } catch {
        context = "";
      }
    }

    const refined = await refineTranscript(text, { geminiApiKey, context });

    return NextResponse.json({
      text: refined,
      changed: refined !== text.trim(),
    });
  } catch (error) {
    console.error("[Refine] 교정 실패:", error);
    return NextResponse.json(
      { error: "교정에 실패했습니다." },
      { status: 500 }
    );
  }
}
