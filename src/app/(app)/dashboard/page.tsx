"use client";

import { useAuthStore } from "@/stores/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BookOpen,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Calendar,
  Mic,
  ArrowRight,
  Quote,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";

const DAILY_QUOTES = [
  { body: "가장 큰 영광은 한 번도 실패하지 않음이 아니라, 실패할 때마다 다시 일어서는 데에 있다.", author: "공자" },
  { body: "어제의 나와 오늘의 나를 비교하라. 다른 사람과 비교하지 마라.", author: "조던 피터슨" },
  { body: "메타인지는 자기 자신을 한 걸음 뒤에서 바라보는 능력이다.", author: "존 플라벨" },
  { body: "변화를 원한다면 먼저 자신을 알아야 한다.", author: "소크라테스" },
  { body: "매일 조금씩 나아지는 것이 가장 강력한 전략이다.", author: "제임스 클리어" },
];

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const [quote, setQuote] = useState(DAILY_QUOTES[0]);
  const [greeting, setGreeting] = useState("안녕하세요");

  useEffect(() => {
    // 오늘의 명언 선택 (일자 기반)
    const dayIndex = new Date().getDate() % DAILY_QUOTES.length;
    setQuote(DAILY_QUOTES[dayIndex]);

    // 시간대별 인사
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("좋은 아침이에요");
    else if (hour < 18) setGreeting("좋은 오후예요");
    else setGreeting("좋은 저녁이에요");
  }, []);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* 인사 & 프로필 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <Sun className="w-5 h-5 text-yellow-500" />
          <span className="text-sm text-muted-foreground">{greeting}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {profile?.displayName ?? "사용자"}님
        </h1>
        <p className="text-muted-foreground mt-1">
          오늘도 나를 들여다보는 시간을 가져볼까요?
        </p>
      </div>

      {/* 오늘의 영감 */}
      <Card className="glass border-0 rounded-3xl overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
              <Quote className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-accent mb-2 uppercase tracking-wider">
                오늘의 영감
              </p>
              <blockquote className="text-lg md:text-xl font-medium leading-relaxed">
                &ldquo;{quote.body}&rdquo;
              </blockquote>
              <p className="text-sm text-muted-foreground mt-3">— {quote.author}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 음성 일기 */}
        <Link href="/journal" className="group">
          <Card className="glass border-0 rounded-3xl overflow-hidden hover:scale-[1.02] transition-all duration-300 animate-fade-in-up cursor-pointer" style={{ animationDelay: "0.2s" }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Mic className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-1">음성 일기 녹음</h3>
              <p className="text-sm text-muted-foreground">
                오늘의 생각을 음성으로 기록하세요
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  <BookOpen className="w-3 h-3 mr-1" />
                  일기
                </Badge>
                <Badge variant="outline" className="text-xs border-muted-foreground/30">
                  <Calendar className="w-3 h-3 mr-1" />
                  {new Date().toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 코칭 */}
        <Link href="/coach" className="group">
          <Card className="glass border-0 rounded-3xl overflow-hidden hover:scale-[1.02] transition-all duration-300 animate-fade-in-up cursor-pointer" style={{ animationDelay: "0.3s" }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-accent" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-1">미래의 나와 대화</h3>
              <p className="text-sm text-muted-foreground">
                메타인지 코칭을 받아보세요
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                  <Sparkles className="w-3 h-3 mr-1" />
                  코칭
                </Badge>
                {profile?.mbti && (
                  <Badge variant="outline" className="text-xs border-muted-foreground/30">
                    {profile.mbti}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 프로필 요약 */}
      {profile && (
        <Card className="glass border-0 rounded-3xl animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">나의 프로필</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">MBTI</p>
                <p className="font-bold text-primary">{profile.mbti || "미설정"}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">핵심 가치</p>
                <p className="font-medium text-sm truncate">
                  {profile.values?.join(", ") || "미설정"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">목표</p>
                <p className="font-medium text-sm truncate">
                  {profile.goals?.join(", ") || "미설정"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">성장 포인트</p>
                <p className="font-medium text-sm truncate">
                  {profile.weaknesses?.join(", ") || "미설정"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
