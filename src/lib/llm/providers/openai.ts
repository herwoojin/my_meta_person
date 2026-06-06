// ============================================================
// OpenAI LLM 프로바이더
// ============================================================

import OpenAI from "openai";
import type {
  LLMProviderAdapter,
  GenerateOptions,
  GenerateResult,
} from "../types";

const DEFAULT_MODEL = "gpt-4o";

export class OpenAIProvider implements LLMProviderAdapter {
  name = "openai";
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const response = await this.client.chat.completions.create({
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      model: response.model,
      tokensUsed: response.usage?.total_tokens ?? 0,
    };
  }

  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const stream = await this.client.chat.completions.create({
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
  }
}
