// ============================================================
// Gemini LLM 프로바이더
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  LLMProviderAdapter,
  GenerateOptions,
  GenerateResult,
} from "../types";

const DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiProvider implements LLMProviderAdapter {
  name = "gemini";
  private client: GoogleGenerativeAI;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const model = this.client.getGenerativeModel({
      model: options?.model ?? DEFAULT_MODEL,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(userPrompt);
    const text = result.response.text();

    return {
      content: text,
      model: options?.model ?? DEFAULT_MODEL,
      tokensUsed:
        result.response.usageMetadata?.totalTokenCount ?? 0,
    };
  }

  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const model = this.client.getGenerativeModel({
      model: options?.model ?? DEFAULT_MODEL,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContentStream(userPrompt);
    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
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
      },
    });
  }
}
