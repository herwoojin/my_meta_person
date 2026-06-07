// ============================================================
// BYOK 멀티 LLM — 사용자별 키로 3개 제공자 호출 + 질문 라우팅
// ============================================================

export type Provider = "gemini" | "openai" | "anthropic";

export interface ProviderKeys {
  gemini?: string;
  openai?: string;
  anthropic?: string;
}

const LABELS: Record<Provider, string> = {
  gemini: "Gemini",
  openai: "GPT (OpenAI)",
  anthropic: "Claude (Anthropic)",
};

const MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
};

export function providerLabel(p: Provider): string {
  return LABELS[p];
}

export function availableProviders(keys: ProviderKeys): Provider[] {
  const out: Provider[] = [];
  if (keys.gemini) out.push("gemini");
  if (keys.openai) out.push("openai");
  if (keys.anthropic) out.push("anthropic");
  return out;
}

/**
 * 질문 성격에 따라 가장 잘 맞는 모델을 고른다 (키워드 휴리스틱, 추가 LLM 호출 없음).
 * - 감정/관계/위로 → Claude (공감·뉘앙스)
 * - 계획/분석/결정 → GPT (구조적 추론)
 * - 그 외 → Gemini (범용·빠름)
 * 선택한 제공자의 키가 없으면 사용 가능한 첫 제공자로 폴백.
 */
export function routeProvider(query: string, available: Provider[]): Provider {
  const q = query.toLowerCase();
  const emotional =
    /(감정|기분|마음|관계|외로|불안|우울|화가|분노|슬프|위로|상처|사랑|두려|스트레스|공허|relationship|feel|lonely|anxious|depress)/;
  const analytical =
    /(계획|전략|분석|결정|선택|우선순위|방법|어떻게|단계|목표|생산성|효율|논리|판단|plan|strategy|analy|decision|productiv|how to)/;

  let preferred: Provider;
  if (emotional.test(q)) preferred = "anthropic";
  else if (analytical.test(q)) preferred = "openai";
  else preferred = "gemini";

  return available.includes(preferred) ? preferred : available[0];
}

// --- 비스트리밍 단일 생성 (/모두 종합용) ---
export async function generateOnce(
  p: Provider,
  key: string,
  system: string,
  user: string
): Promise<string> {
  if (p === "gemini") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: MODELS.gemini,
      systemInstruction: system,
    });
    const r = await model.generateContent(user);
    return r.response.text();
  }
  if (p === "openai") {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: key });
    const r = await client.chat.completions.create({
      model: MODELS.openai,
      max_tokens: 2048,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return r.choices[0]?.message?.content ?? "";
  }
  // anthropic
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: key });
  const r = await client.messages.create({
    model: MODELS.anthropic,
    max_tokens: 2048,
    temperature: 0.7,
    system,
    messages: [{ role: "user", content: user }],
  });
  const tb = r.content.find((b) => b.type === "text");
  return tb && tb.type === "text" ? tb.text : "";
}

// --- 스트리밍 (텍스트 청크 async generator) ---
export async function* streamText(
  p: Provider,
  key: string,
  system: string,
  user: string
): AsyncGenerator<string> {
  if (p === "gemini") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: MODELS.gemini,
      systemInstruction: system,
    });
    const result = await model.generateContentStream(user);
    for await (const chunk of result.stream) {
      const t = chunk.text();
      if (t) yield t;
    }
    return;
  }
  if (p === "openai") {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: key });
    const stream = await client.chat.completions.create({
      model: MODELS.openai,
      max_tokens: 2048,
      temperature: 0.7,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    for await (const chunk of stream) {
      const t = chunk.choices[0]?.delta?.content;
      if (t) yield t;
    }
    return;
  }
  // anthropic
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: key });
  const stream = client.messages.stream({
    model: MODELS.anthropic,
    max_tokens: 2048,
    temperature: 0.7,
    system,
    messages: [{ role: "user", content: user }],
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
