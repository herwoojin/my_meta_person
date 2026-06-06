// ============================================================
// Markdown 일기 변환 모듈
// ============================================================

import type { JournalEntry } from "@/types";

/**
 * 일기 엔트리 배열을 Markdown 형식으로 변환합니다.
 * 
 * 출력 형식:
 * ```markdown
 * # 2026-06-05 (금)
 * 
 * ## 09:12
 * 오늘 아침은 ...
 * 
 * ## 14:30
 * 회의에서 느낀 점은 ...
 * ```
 */
export function entriesToMarkdown(
  dateKey: string,
  entries: JournalEntry[]
): string {
  const dayOfWeek = getDayOfWeek(dateKey);
  const header = `# ${dateKey} (${dayOfWeek})\n`;

  if (entries.length === 0) {
    return header;
  }

  // 시간순 정렬
  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time));

  const body = sorted
    .map((entry) => `## ${entry.time}\n${entry.text}`)
    .join("\n\n");

  return `${header}\n${body}\n`;
}

/**
 * dateKey (YYYY-MM-DD)로부터 요일 문자열을 반환합니다.
 */
function getDayOfWeek(dateKey: string): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const date = new Date(dateKey);
  return days[date.getDay()];
}

/**
 * 현재 시각을 HH:MM 형식으로 반환합니다.
 */
export function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환합니다.
 */
export function getTodayKey(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}
