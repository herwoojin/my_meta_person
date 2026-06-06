"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LegalDisclaimer } from "@/components/ui/disclaimer";
import {
  Sparkles,
  Send,
  User,
  Brain,
  Loader2,
  RotateCcw,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: Date;
}

export default function CoachPage() {
  const { user, profile } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || !user || isStreaming) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: userMessage.content }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || "코칭 응답 실패");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  fullContent += parsed.text;
                  setStreamingContent(fullContent);
                }
              } catch {
                // JSON 파싱 실패 무시
              }
            }
          }
        }
      }

      const coachMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: fullContent || "응답을 생성하지 못했습니다.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, coachMessage]);
    } catch (error) {
      console.error("코칭 오류:", error);
      const errorMsg =
        error instanceof Error && error.message !== "코칭 응답 실패"
          ? error.message
          : "죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "coach",
          content: errorMsg,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-80px)]">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 animate-fade-in-up">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-7 h-7 text-accent" />
            메타인지 코칭
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            &ldquo;되고 싶은 미래의 나&rdquo;가 당신을 코칭합니다
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetChat}
          className="rounded-xl text-muted-foreground"
          disabled={messages.length === 0}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          새 대화
        </Button>
      </div>

      {/* 채팅 영역 */}
      <ScrollArea className="flex-1 -mx-2 px-2" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-16 animate-fade-in-up">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                안녕하세요, {profile?.displayName ?? ""}님
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                무엇이 고민인가요? 최근 일기를 바탕으로<br />
                메타인지적 관점에서 함께 생각해볼게요.
              </p>

              {/* 예시 질문 */}
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {[
                  "요즘 반복되는 감정 패턴이 뭘까?",
                  "커리어 방향에 대해 조언해줘",
                  "인간관계에서 힘든 부분이 있어",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-xs px-4 py-2 rounded-full glass text-muted-foreground hover:text-foreground hover:scale-105 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
            >
              {msg.role === "coach" && (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "glass rounded-bl-md"
                }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {renderCoachContent(msg.content)}
                </div>
                <p className="text-[10px] mt-2 opacity-50">
                  {msg.timestamp.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {msg.role === "user" && (
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* 스트리밍 중 표시 */}
          {isStreaming && (
            <div className="flex gap-3 animate-fade-in-up">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mt-1">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="max-w-[80%] glass rounded-2xl rounded-bl-md p-4">
                {streamingContent ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {renderCoachContent(streamingContent)}
                    <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">생각하는 중...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 입력 영역 */}
      <div className="pt-4 border-t border-border/30 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <div className="flex gap-2 items-end">
          <div className="flex-1 glass rounded-2xl p-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="고민이나 질문을 입력하세요..."
              className="min-h-[44px] max-h-[120px] bg-transparent border-0 resize-none focus-visible:ring-0 px-3 py-2.5 text-sm"
              disabled={isStreaming}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent hover:from-primary/90 hover:to-accent/90 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <LegalDisclaimer />
      </div>
    </div>
  );
}

// 코칭 응답 렌더링 (4단 구조 시각 구분)
function renderCoachContent(content: string) {
  const sections = [
    { marker: "### 🔍 관찰", color: "text-blue-400" },
    { marker: "### 💡 해석", color: "text-yellow-400" },
    { marker: "### 🎯 행동 제안", color: "text-green-400" },
    { marker: "### ✨ 오늘의 한 문장", color: "text-purple-400" },
  ];

  let formatted = content;
  for (const section of sections) {
    formatted = formatted.replace(
      section.marker,
      `\n${section.marker}`
    );
  }

  return formatted;
}
