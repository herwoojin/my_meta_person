// ============================================================
// /api/coach — 메타인지 코칭 API (스트리밍)
// ============================================================

import { NextRequest } from "next/server";
import { verifyAuth, isAuthError } from "@/lib/auth/verify";
import { adminDb } from "@/lib/firebase/admin";
import { buildCoachSystemPrompt, buildCoachUserPrompt } from "@/lib/llm/prompts";
import type { UserProfile, SelfPersona, JournalEntry } from "@/types";

export async function POST(req: NextRequest) {
  // 인증 확인
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "질문을 입력해주세요." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 사용자 프로필 조회
    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) {
      return new Response(
        JSON.stringify({ error: "프로필을 찾을 수 없습니다." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    const profile = { uid, ...userDoc.data() } as UserProfile;

    // 기본 페르소나 조회
    const personaSnap = await adminDb
      .collection(`users/${uid}/selfPersonas`)
      .where("isDefault", "==", true)
      .limit(1)
      .get();

    let persona: SelfPersona;
    if (!personaSnap.empty) {
      const doc = personaSnap.docs[0];
      persona = { id: doc.id, ...doc.data() } as SelfPersona;
    } else {
      persona = {
        id: "default",
        ownerUid: uid,
        name: "미래의 나",
        tone: "따뜻하지만 솔직한",
        perspective: "성장 지향적",
        priorities: ["자기 성장"],
        isDefault: true,
      };
    }

    // 최근 7일 일기 조회
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateKeyStart = sevenDaysAgo.toISOString().split("T")[0];

    const journalsSnap = await adminDb
      .collection(`users/${uid}/journals`)
      .where("dateKey", ">=", dateKeyStart)
      .orderBy("dateKey", "desc")
      .limit(7)
      .get();

    const recentEntries: JournalEntry[] = [];
    const dateKeys: string[] = [];

    for (const jDoc of journalsSnap.docs) {
      const entriesSnap = await adminDb
        .collection(`users/${uid}/journals/${jDoc.id}/entries`)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      for (const eDoc of entriesSnap.docs) {
        recentEntries.push({ id: eDoc.id, ...eDoc.data() } as JournalEntry);
        dateKeys.push(jDoc.data().dateKey);
      }
    }

    // 프롬프트 구성
    const systemPrompt = buildCoachSystemPrompt(profile, persona);
    const userPrompt = buildCoachUserPrompt(query, recentEntries, dateKeys);

    // API 키 결정: 서버 환경변수 → 사용자 BYOK 키
    const apiKey =
      process.env.GEMINI_API_KEY ||
      (profile as UserProfile & { geminiApiKey?: string }).geminiApiKey;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "AI 기능을 사용하려면 설정 페이지에서 Gemini API 키를 등록해주세요.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 서버 환경변수에 키가 있으면 orchestrator 사용, 없으면 BYOK로 직접 호출
    if (process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
      const { orchestrator } = await import("@/lib/llm/orchestrator");
      const stream = await orchestrator.generateStream(systemPrompt, userPrompt);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // BYOK: 사용자 Gemini API 키로 직접 호출
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContentStream(userPrompt);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("[Coach] 스트리밍 오류:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Coach] 코칭 응답 실패:", errMsg, error);
    return new Response(
      JSON.stringify({ error: `코칭 응답 실패: ${errMsg}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

