// ============================================================
// ID 토큰 검증 유틸 (서버 API 핸들러 공통)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export interface AuthResult {
  uid: string;
  email?: string;
}

/**
 * API Route에서 Firebase ID Token을 검증하고 uid를 반환합니다.
 * 실패 시 401 NextResponse를 반환합니다.
 */
export async function verifyAuth(
  req: NextRequest
): Promise<AuthResult | NextResponse> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "인증 토큰이 필요합니다." },
      { status: 401 }
    );
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (error) {
    // 실제 원인을 서버 로그로 남긴다 (Admin 초기화 실패/키 오류 등 진단용)
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Auth] 토큰 검증 실패:", msg);
    return NextResponse.json(
      { error: "유효하지 않은 인증 토큰입니다.", detail: msg },
      { status: 401 }
    );
  }
}

/**
 * verifyAuth 결과가 에러 응답인지 확인하는 타입 가드
 */
export function isAuthError(
  result: AuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
