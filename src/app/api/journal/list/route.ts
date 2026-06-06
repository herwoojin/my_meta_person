// ============================================================
// /api/journal/list — 사용자의 모든 일기(날짜별) 목록 조회
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError } from "@/lib/auth/verify";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  try {
    const snap = await adminDb.collection(`users/${uid}/journals`).get();

    const journals = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          dateKey: (data.dateKey as string) ?? doc.id,
          mdSnapshot: (data.mdSnapshot as string) ?? "",
          updatedAt: (data.updatedAt as string) ?? null,
        };
      })
      // 날짜 doc id(YYYY-MM-DD)는 문자열 정렬로 최신순 정렬 가능
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    return NextResponse.json({ journals });
  } catch (error) {
    console.error("[Journal] 목록 조회 실패:", error);
    return NextResponse.json(
      { error: "기록 목록 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
