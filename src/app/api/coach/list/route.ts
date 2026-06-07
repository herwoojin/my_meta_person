// ============================================================
// /api/coach/list — 코칭 대화 기록 조회/삭제
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError } from "@/lib/auth/verify";
import { adminDb } from "@/lib/firebase/admin";

// GET — 모든 코칭 대화 기록 (최신순)
export async function GET(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  try {
    const snap = await adminDb.collection(`users/${uid}/coachLogs`).get();

    const logs = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          query: (data.query as string) ?? "",
          answer: (data.answer as string) ?? "",
          provider: (data.provider as string) ?? "",
          createdAt: (data.createdAt as string) ?? "",
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[Coach] 기록 조회 실패:", error);
    return NextResponse.json(
      { error: "코칭 기록 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE — 특정 코칭 대화 기록 삭제 (?id=...)
export async function DELETE(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  try {
    await adminDb.doc(`users/${uid}/coachLogs/${id}`).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Coach] 기록 삭제 실패:", error);
    return NextResponse.json(
      { error: "코칭 기록 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
