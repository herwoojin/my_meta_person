"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { History, Clock, FileText, Loader2, BookOpen } from "lucide-react";

interface JournalSummary {
  dateKey: string;
  mdSnapshot: string;
  updatedAt: string | null;
}

interface ParsedEntry {
  time: string;
  text: string;
}

// mdSnapshot("## HH:MM\n내용\n\n" 반복)을 엔트리 배열로 파싱
function parseEntries(md: string): ParsedEntry[] {
  if (!md?.trim()) return [];
  const out: ParsedEntry[] = [];
  const re = /##\s*(\d{1,2}:\d{2})\s*\n([\s\S]*?)(?=\n##\s*\d{1,2}:\d{2}|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const text = m[2].trim();
    if (text) out.push({ time: m[1], text });
  }
  // 형식이 안 맞으면 통째로 한 덩어리로
  if (out.length === 0) out.push({ time: "", text: md.trim() });
  return out;
}

function formatDate(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  if (isNaN(d.getTime())) return dateKey;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export default function RecordsPage() {
  const { user } = useAuthStore();
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/journal/list", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok) setJournals(data.journals ?? []);
      } catch (error) {
        console.error("기록 로드 실패:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalEntries = journals.reduce(
    (sum, j) => sum + parseEntries(j.mdSnapshot).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-7 h-7 text-primary" />
          기록
        </h1>
        <p className="text-muted-foreground mt-1">
          지금까지 남긴 모든 일기를 한눈에 모아봅니다
        </p>
      </div>

      {/* 요약 */}
      {!loading && journals.length > 0 && (
        <div className="flex gap-3 animate-fade-in-up">
          <Badge className="bg-primary/10 text-primary border-0 px-3 py-1">
            {journals.length}일 기록
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            총 {totalEntries}개 항목
          </Badge>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          불러오는 중...
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && journals.length === 0 && (
        <Card className="glass border-0 rounded-3xl animate-fade-in-up">
          <CardContent className="p-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">아직 기록이 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">
                음성 일기를 시작하면 여기에 모아서 볼 수 있어요
              </p>
            </div>
            <Link href="/journal">
              <Button className="rounded-xl">
                <BookOpen className="w-4 h-4 mr-2" />
                음성 일기 쓰러 가기
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* 날짜별 기록 카드 */}
      {!loading &&
        journals.map((j, i) => {
          const entries = parseEntries(j.mdSnapshot);
          return (
            <Card
              key={j.dateKey}
              className="glass border-0 rounded-3xl animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{formatDate(j.dateKey)}</h3>
                  <Badge variant="outline" className="text-xs">
                    {entries.length}개
                  </Badge>
                </div>

                <div className="space-y-3">
                  {entries.map((e, idx) => (
                    <div
                      key={idx}
                      className="flex gap-3 p-3 rounded-xl bg-muted/20"
                    >
                      {e.time && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 pt-0.5">
                          <Clock className="w-3 h-3" />
                          {e.time}
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {e.text}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
