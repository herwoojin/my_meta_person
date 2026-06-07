"use client";

import { useState } from "react";
import { TtsPlayer } from "@/components/tts/TtsPlayer";
import { BookOpen } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function BlogReaderPage() {
  const [blogText, setBlogText] = useState("");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-primary" />
          블로그 읽어주기
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          읽고 싶은 긴 글이나 블로그 포스트를 아래에 붙여넣고 음성으로 들어보세요. 모바일 화면이 꺼져도 계속 재생됩니다.
        </p>
      </div>

      {/* TTS 플레이어 */}
      <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <TtsPlayer text={blogText} title="블로그 읽어주기" />
      </div>

      {/* 텍스트 입력 영역 */}
      <div className="glass rounded-2xl p-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <Textarea
          value={blogText}
          onChange={(e) => setBlogText(e.target.value)}
          placeholder="여기에 읽을 텍스트를 입력하거나 붙여넣으세요..."
          className="min-h-[400px] bg-transparent border-0 resize-y focus-visible:ring-0 p-0 text-base leading-relaxed"
        />
      </div>
    </div>
  );
}
