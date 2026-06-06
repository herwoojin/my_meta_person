"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Link from "next/link";
import {
  History,
  Clock,
  FileText,
  Loader2,
  BookOpen,
  Search,
  Trash2,
  Brain,
  MessageCircle,
} from "lucide-react";

interface JournalSummary {
  dateKey: string;
  mdSnapshot: string;
  updatedAt: string | null;
}

interface CoachLog {
  id: string;
  query: string;
  answer: string;
  createdAt: string;
}

interface ParsedEntry {
  time: string;
  text: string;
}

const PERIODS = [
  { value: "all", label: "전체" },
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

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
  if (out.length === 0) out.push({ time: "", text: md.trim() });
  return out;
}

function formatDate(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  if (isNaN(d.getTime())) return dateKey;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 기간 컷오프 (YYYY-MM-DD). all이면 빈 문자열
function periodCutoff(period: Period): string {
  if (period === "all") return "";
  const d = new Date();
  d.setDate(d.getDate() - Number(period));
  return d.toISOString().split("T")[0];
}

export default function RecordsPage() {
  const { user } = useAuthStore();
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [logs, setLogs] = useState<CoachLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [period, setPeriod] = useState<Period>("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [jRes, cRes] = await Promise.all([
          fetch("/api/journal/list", { headers }),
          fetch("/api/coach/list", { headers }),
        ]);
        const jData = await jRes.json();
        const cData = await cRes.json();
        if (!cancelled) {
          if (jRes.ok) setJournals(jData.journals ?? []);
          if (cRes.ok) setLogs(cData.logs ?? []);
        }
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

  const cutoff = periodCutoff(period);
  const kw = keyword.trim().toLowerCase();

  // 일기 필터: 기간 + 키워드(매칭 엔트리만)
  const filteredJournals = useMemo(() => {
    return journals
      .filter((j) => (cutoff ? j.dateKey >= cutoff : true))
      .map((j) => {
        const entries = parseEntries(j.mdSnapshot);
        const matched = kw
          ? entries.filter((e) => e.text.toLowerCase().includes(kw))
          : entries;
        return { dateKey: j.dateKey, entries: matched };
      })
      .filter((j) => j.entries.length > 0);
  }, [journals, cutoff, kw]);

  // 코칭 필터: 기간 + 키워드
  const filteredLogs = useMemo(() => {
    return logs
      .filter((l) => (cutoff ? (l.createdAt.split("T")[0] || "") >= cutoff : true))
      .filter((l) =>
        kw
          ? l.query.toLowerCase().includes(kw) ||
            l.answer.toLowerCase().includes(kw)
          : true
      );
  }, [logs, cutoff, kw]);

  const deleteJournal = async (dateKey: string) => {
    if (!user) return;
    if (!confirm(`${formatDate(dateKey)} 기록을 삭제할까요? 되돌릴 수 없습니다.`))
      return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/journal?date=${dateKey}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setJournals((prev) => prev.filter((j) => j.dateKey !== dateKey));
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  const deleteLog = async (id: string) => {
    if (!user) return;
    if (!confirm("이 코칭 대화를 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/coach/list?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-7 h-7 text-primary" />
          기록
        </h1>
        <p className="text-muted-foreground mt-1">
          일기와 코칭 대화를 모아보고 검색·관리합니다
        </p>
      </div>

      {/* 검색 + 기간 필터 */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="키워드 검색..."
            className="h-11 rounded-xl bg-muted/30 pl-9"
          />
        </div>
        <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : (
        <Tabs defaultValue="journal" className="animate-fade-in-up">
          <TabsList>
            <TabsTrigger value="journal">
              <BookOpen className="w-4 h-4" />
              일기 ({filteredJournals.length})
            </TabsTrigger>
            <TabsTrigger value="coach">
              <Brain className="w-4 h-4" />
              코칭 ({filteredLogs.length})
            </TabsTrigger>
          </TabsList>

          {/* 일기 탭 */}
          <TabsContent value="journal" className="space-y-4 pt-2">
            {filteredJournals.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={kw || period !== "all" ? "조건에 맞는 일기가 없습니다" : "아직 일기 기록이 없습니다"}
                cta={
                  <Link href="/journal">
                    <Button className="rounded-xl">
                      <BookOpen className="w-4 h-4 mr-2" />
                      음성 일기 쓰러 가기
                    </Button>
                  </Link>
                }
              />
            ) : (
              filteredJournals.map((j, i) => (
                <Card
                  key={j.dateKey}
                  className="glass border-0 rounded-3xl animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">{formatDate(j.dateKey)}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {j.entries.length}개
                        </Badge>
                        <Link
                          href={`/journal?date=${j.dateKey}`}
                          className="text-xs text-primary hover:underline px-1"
                        >
                          열기
                        </Link>
                        <button
                          onClick={() => deleteJournal(j.dateKey)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          aria-label="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {j.entries.map((e, idx) => (
                        <div key={idx} className="flex gap-3 p-3 rounded-xl bg-muted/20">
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
              ))
            )}
          </TabsContent>

          {/* 코칭 탭 */}
          <TabsContent value="coach" className="space-y-4 pt-2">
            {filteredLogs.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title={kw || period !== "all" ? "조건에 맞는 코칭 대화가 없습니다" : "아직 코칭 대화 기록이 없습니다"}
                cta={
                  <Link href="/coach">
                    <Button className="rounded-xl">
                      <Brain className="w-4 h-4 mr-2" />
                      코칭 시작하기
                    </Button>
                  </Link>
                }
              />
            ) : (
              filteredLogs.map((l, i) => (
                <Card
                  key={l.id}
                  className="glass border-0 rounded-3xl animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(l.createdAt)}
                      </span>
                      <button
                        onClick={() => deleteLog(l.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        aria-label="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Badge className="bg-primary/10 text-primary border-0 h-fit shrink-0">나</Badge>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{l.query}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className="bg-accent/10 text-accent border-0 h-fit shrink-0">코치</Badge>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                          {l.answer}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  cta: React.ReactNode;
}) {
  return (
    <Card className="glass border-0 rounded-3xl">
      <CardContent className="p-10 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="font-medium">{title}</p>
        {cta}
      </CardContent>
    </Card>
  );
}
