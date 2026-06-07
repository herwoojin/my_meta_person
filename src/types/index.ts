// ============================================================
// MetaMe — TypeScript 타입 정의 (ERD 기반)
// ============================================================

import { Timestamp } from "firebase/firestore";

// --- User ---
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  mbti: string;
  values: string[];
  goals: string[];
  weaknesses: string[];
  timezone: string;
  notifyPrefs: NotifyPrefs;
  onboardingComplete: boolean;
  /** 사용자 본인의 API 키 (BYOK). Firestore 규칙상 본인만 읽기/쓰기. */
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  createdAt: Timestamp;
}

export interface NotifyPrefs {
  enabled: boolean;
  time: string; // "HH:MM"
  channels: ("push" | "email")[];
}

// --- Self Persona (되고 싶은 나) ---
export interface SelfPersona {
  id: string;
  ownerUid: string;
  name: string;
  tone: string;
  perspective: string;
  priorities: string[];
  isDefault: boolean;
}

// --- Journal ---
export interface Journal {
  id: string;
  ownerUid: string;
  dateKey: string; // "YYYY-MM-DD"
  mdSnapshot: string;
  entryCount: number;
  updatedAt: Timestamp;
}

export interface JournalEntry {
  id: string;
  time: string; // "HH:MM"
  text: string;
  source: "voice" | "text";
  audioUrl?: string;
  createdAt: Timestamp;
}

// --- Coach Session ---
export interface CoachSession {
  id: string;
  ownerUid: string;
  topic: string;
  selfPersonaId: string;
  expertPersonaId?: string;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  role: "user" | "coach";
  content: string;
  meta?: {
    models?: string[];
    tokens?: number;
  };
  createdAt: Timestamp;
}

// --- Expert Persona ---
export interface ExpertPersona {
  id: string;
  name: string;
  domain: string;
  thinkingFrame: string;
  principles: string[];
  isCurated: boolean;
}

// --- Person (관계 카드) ---
export interface Person {
  id: string;
  ownerUid: string;
  name: string;
  relation: string;
  mbti?: string;
  context: string;
  createdAt: Timestamp;
}

export interface Interaction {
  id: string;
  note: string;
  sentiment: string;
  occurredAt: Timestamp;
}

// --- Notification ---
export interface NotificationLog {
  id: string;
  ownerUid: string;
  type: "morning" | "report";
  contentRef: string;
  channel: string;
  sentAt: Timestamp;
}

// --- Weekly Report ---
export interface WeeklyReport {
  id: string;
  ownerUid: string;
  weekKey: string; // "YYYY-Www"
  summaryMd: string;
  metrics: {
    moodAvg?: number;
    topTopics?: string[];
    streakDays?: number;
  };
  createdAt: Timestamp;
}

// --- Inspiration ---
export interface Inspiration {
  id: string;
  type: "quote" | "poem" | "scholar";
  body: string;
  author: string;
  source: string;
  publicDomain: boolean;
}

// --- LLM ---
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed: number;
}

export type LLMProvider = "openai" | "anthropic" | "gemini";
