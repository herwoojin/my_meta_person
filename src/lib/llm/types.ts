// ============================================================
// LLM 프로바이더 공통 인터페이스
// ============================================================

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface GenerateResult {
  content: string;
  model: string;
  tokensUsed: number;
}

/**
 * 모든 LLM 프로바이더가 구현해야 할 공통 인터페이스.
 * TRD의 Provider Adapter 패턴 구현.
 */
export interface LLMProviderAdapter {
  name: string;

  /**
   * 프롬프트를 받아 응답을 생성합니다.
   */
  generate(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResult>;

  /**
   * 스트리밍 응답을 생성합니다.
   * ReadableStream을 반환합니다.
   */
  generateStream(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateOptions
  ): Promise<ReadableStream<Uint8Array>>;
}
