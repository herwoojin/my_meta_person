// ============================================================
// Claude (Anthropic) LLM 프로바이더
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProviderAdapter,
  GenerateOptions,
  GenerateResult,
} from "../types";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export class ClaudeProvider implements LLMProviderAdapter {
  name = "anthropic";
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const response = await this.client.messages.create({
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return {
      content: textBlock?.text ?? "",
      model: response.model,
      tokensUsed:
        (response.usage.input_tokens ?? 0) +
        (response.usage.output_tokens ?? 0),
    };
  }

  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const stream = this.client.messages.stream({
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
  }
}
