"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square, Loader2, Volume2, User, FastForward } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TtsPlayerProps {
  text: string;
  title?: string;
}

export function TtsPlayer({ text, title = "블로그 읽어주기" }: TtsPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gender, setGender] = useState<"FEMALE" | "MALE">("FEMALE");
  const [speed, setSpeed] = useState<number>(1.0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // 음성 설정이나 텍스트가 바뀌면 기존 생성된 오디오 무효화
  useEffect(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [text, gender, speed]);

  // MediaSession 연동 (백그라운드 제어)
  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: "MetaMe TTS",
        artwork: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => {
        if (audioRef.current) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        handleStop();
      });
    }
  }, [title]);

  const handlePlayPause = async () => {
    if (!text.trim()) {
      alert("읽을 텍스트가 없습니다.");
      return;
    }

    // 이미 오디오가 있다면 재생/일시정지 토글
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    // 오디오가 없으면 서버에 요청
    setIsLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, gender, speed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "음성 변환에 실패했습니다.");
      }

      const blob = await res.blob();
      const newUrl = URL.createObjectURL(blob);
      setAudioUrl(newUrl);

      // 브라우저 렌더링 틱 대기 후 재생
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(err => {
            console.error("재생 오류:", err);
            alert("자동 재생이 차단되었습니다. 다시 재생 버튼을 눌러주세요.");
          });
        }
      }, 50);

    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "음성 변환 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const onEnded = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <Card className="glass border-0 rounded-2xl p-4 animate-fade-in-up">
      <CardContent className="p-0 flex flex-col gap-4">
        
        {/* 숨겨진 오디오 태그 (백그라운드 재생용) */}
        <audio
          ref={audioRef}
          src={audioUrl || ""}
          onEnded={onEnded}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          className="hidden"
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-primary" />
            <h3 className="font-medium">블로그 읽어주기</h3>
          </div>

          {/* 재생 컨트롤 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePlayPause}
              disabled={isLoading}
              className={`rounded-full transition-all ${
                isPlaying ? "bg-primary text-primary-foreground border-primary" : ""
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-1" />
              )}
            </Button>
            
            {(isPlaying || audioUrl) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStop}
                className="rounded-full text-muted-foreground hover:text-destructive"
              >
                <Square className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* 설정 영역 */}
        <div className="bg-muted/30 rounded-xl p-3 flex flex-wrap gap-4 items-center justify-between text-sm">
          {/* 음성 모드 선택 */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground hidden sm:inline">음성 모드</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "FEMALE" | "MALE")}
              className="bg-background border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="FEMALE">여성 음성</option>
              <option value="MALE">남성 음성</option>
            </select>
          </div>

          {/* 배속 설정 (1.0 ~ 3.0) */}
          <div className="flex items-center gap-2 flex-1 max-w-[200px]">
            <FastForward className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground hidden sm:inline whitespace-nowrap">속도: {speed}x</span>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-muted-foreground sm:hidden w-8 text-right">{speed}x</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
