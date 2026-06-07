// ============================================================
// /api/coach — 메타인지 코칭 API (스트리밍)
// ============================================================

import { NextRequest } from "next/server";
import { verifyAuth, isAuthError } from "@/lib/auth/verify";
import { adminDb } from "@/lib/firebase/admin";
import { buildCoachSystemPrompt, buildCoachUserPrompt } from "@/lib/llm/prompts";
import {
  type Provider,
  type ProviderKeys,
  availableProviders,
  routeProvider,
  providerLabel,
  generateOnce,
  streamText,
} from "@/lib/llm/byok";
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

    // BYOK 키 수집 (사용자 키 우선, 서버 env 폴백)
    const p = profile as UserProfile & {
      geminiApiKey?: string;
      openaiApiKey?: string;
      anthropicApiKey?: string;
    };
    const keys: ProviderKeys = {
      gemini: p.geminiApiKey || process.env.GEMINI_API_KEY || undefined,
      openai: p.openaiApiKey || process.env.OPENAI_API_KEY || undefined,
      anthropic: p.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined,
    };
    const available = availableProviders(keys);

    if (available.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "AI 기능을 사용하려면 설정에서 Gemini / OpenAI / Anthropic 키 중 하나 이상을 등록해주세요.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // "/모두" (또는 /all) → 모든 모델이 답한 뒤 종합
    const allMatch = /^\s*\/(모두|all)\b\s*/i;
    const isAll = allMatch.test(query);
    const realQuery = isAll ? query.replace(allMatch, "").trim() : query;

    const systemPrompt = buildCoachSystemPrompt(profile, persona);
    const userPrompt = buildCoachUserPrompt(realQuery, recentEntries, dateKeys);

    const encoder = new TextEncoder();
    const sse = (obj: unknown) =>
      encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

    let stream: ReadableStream<Uint8Array>;

    if (isAll) {
      // 종합 모드: 사용 가능한 모든 모델을 병렬 호출 → 1개로 종합 스트리밍
      stream = new ReadableStream({
        async start(controller) {
          try {
            const label = `종합 (${available.map(providerLabel).join(" · ")})`;
            controller.enqueue(sse({ provider: label }));

            const settled = await Promise.allSettled(
              available.map(async (prov) => ({
                prov,
                text: await generateOnce(prov, keys[prov]!, systemPrompt, userPrompt),
              }))
            );
            const answers = settled
              .filter(
                (r): r is PromiseFulfilledResult<{ prov: Provider; text: string }> =>
                  r.status === "fulfilled" && Boolean(r.value.text)
              )
              .map((r) => r.value);

            if (answers.length === 0) throw new Error("모든 모델 응답 실패");

            const synth = available[0];
            const synthSystem =
              "너는 여러 AI 코치의 답변을 종합하는 메타 코치다. 아래 각 코치의 답변을 읽고, 공통된 핵심과 가장 유용한 통찰을 골라 하나의 일관되고 따뜻한 한국어 코칭으로 통합하라. 코치별로 나열하지 말고 자연스럽게 녹여서 답하라.";
            const synthUser =
              `[원래 질문]\n${realQuery}\n\n` +
              answers
                .map((a) => `[${providerLabel(a.prov)}의 답변]\n${a.text}`)
                .join("\n\n") +
              "\n\n위 답변들을 종합한 최종 코칭을 작성하라.";

            for await (const t of streamText(synth, keys[synth]!, synthSystem, synthUser)) {
              controller.enqueue(sse({ text: t }));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            console.error("[Coach] 종합 스트리밍 오류:", err);
            controller.error(err);
          }
        },
      });
    } else {
      // 단일 모드: 질문 성격에 맞는 모델로 라우팅
      const provider = routeProvider(realQuery, available);
      stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(sse({ provider: providerLabel(provider) }));
            for await (const t of streamText(
              provider,
              keys[provider]!,
              systemPrompt,
              userPrompt
            )) {
              controller.enqueue(sse({ text: t }));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            console.error("[Coach] 스트리밍 오류:", err);
            controller.error(err);
          }
        },
      });
    }

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

