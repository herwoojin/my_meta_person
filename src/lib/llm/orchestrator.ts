// ============================================================
// LLM 오케스트레이터 (MVP: 단일 모델 경로)
// ============================================================

import type { LLMProviderAdapter, GenerateOptions, GenerateResult } from "./types";
import { ClaudeProvider } from "./providers/claude";
import { OpenAIProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";

export type ProviderName = "anthropic" | "openai" | "gemini";

/**
 * LLM 오케스트레이터.
 * MVP에서는 단일 모델(Claude)로 동작하고,
 * M3에서 분석→자문→검증→종합 다단계로 확장 예정.
 */
class Orchestrator {
  private providers: Map<ProviderName, LLMProviderAdapter> = new Map();
  private defaultProvider: ProviderName = "anthropic";
  private fallbackOrder: ProviderName[] = ["anthropic", "openai", "gemini"];

  constructor() {
    // 사용 가능한 프로바이더만 초기화
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set("anthropic", new ClaudeProvider());
    }
    if (process.env.OPENAI_API_KEY) {
      this.providers.set("openai", new OpenAIProvider());
    }
    if (process.env.GEMINI_API_KEY) {
      this.providers.set("gemini", new GeminiProvider());
    }

    // 기본 프로바이더 자동 선택
    if (!this.providers.has(this.defaultProvider)) {
      for (const name of this.fallbackOrder) {
        if (this.providers.has(name)) {
          this.defaultProvider = name;
          break;
        }
      }
    }
  }

  /**
   * 기본 프로바이더로 응답을 생성합니다.
   * 실패 시 폴백 순서대로 재시도합니다.
   */
  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions & { provider?: ProviderName }
  ): Promise<GenerateResult> {
    const providerName = options?.provider ?? this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      // 폴백 시도
      for (const name of this.fallbackOrder) {
        const fallback = this.providers.get(name);
        if (fallback) {
          console.warn(`[Orchestrator] ${providerName} 불가, ${name}으로 폴백`);
          return fallback.generate(systemPrompt, userPrompt, options);
        }
      }
      throw new Error("사용 가능한 LLM 프로바이더가 없습니다.");
    }

    try {
      return await provider.generate(systemPrompt, userPrompt, options);
    } catch (error) {
      console.error(`[Orchestrator] ${providerName} 실패:`, error);

      // 폴백
      for (const name of this.fallbackOrder) {
        if (name === providerName) continue;
        const fallback = this.providers.get(name);
        if (fallback) {
          console.warn(`[Orchestrator] ${name}으로 폴백 시도`);
          try {
            return await fallback.generate(systemPrompt, userPrompt, options);
          } catch {
            continue;
          }
        }
      }
      throw error;
    }
  }

  /**
   * 스트리밍 응답을 생성합니다.
   */
  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions & { provider?: ProviderName }
  ): Promise<ReadableStream<Uint8Array>> {
    const providerName = options?.provider ?? this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      for (const name of this.fallbackOrder) {
        const fallback = this.providers.get(name);
        if (fallback) {
          return fallback.generateStream(systemPrompt, userPrompt, options);
        }
      }
      throw new Error("사용 가능한 LLM 프로바이더가 없습니다.");
    }

    return provider.generateStream(systemPrompt, userPrompt, options);
  }
}

// 싱글턴 인스턴스
export const orchestrator = new Orchestrator();
