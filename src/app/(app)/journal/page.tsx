"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic,
  Square,
  Send,
  Calendar,
  Clock,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Keyboard,
} from "lucide-react";

interface Entry {
  id: string;
  time: string;
  text: string;
  source: "voice" | "text";
}

export default function JournalPage() {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dateKey, setDateKey] = useState(getTodayKey());
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 일기 로드
  useEffect(() => {
    const fetchEntries = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/journal?date=${dateKey}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        }
      } catch (error) {
        console.error("일기 로드 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEntries();
  }, [dateKey, user]);

  // DB에 단일 항목 저장
  const saveEntry = async (time: string, text: string, source: "voice" | "text") => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch("/api/journal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dateKey, time, text, source }),
      });
    } catch (error) {
      console.error("일기 저장 실패:", error);
    }
  };

  // 녹음 시작
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleTranscribe(blob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (error) {
      console.error("마이크 접근 실패:", error);
      alert("마이크 접근 권한이 필요합니다.");
    }
  }, []);

  // 녹음 중지
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // STT 변환
  const handleTranscribe = async (blob: Blob) => {
    if (!user) return;
    setIsTranscribing(true);

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("dateKey", dateKey);

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        // 키 미등록 → 설정으로 안내
        if (data?.code === "NO_API_KEY") {
          if (confirm(`${data.error}\n\n설정 페이지로 이동할까요?`)) {
            window.location.href = "/settings";
          }
          return;
        }
        throw new Error(data?.error || "STT 변환 실패");
      }

      if (!data.text?.trim()) {
        alert("음성에서 텍스트를 인식하지 못했습니다. 다시 시도해주세요.");
        return;
      }

      const newEntry: Entry = {
        id: Date.now().toString(),
        time: data.time || getCurrentTime(),
        text: data.text,
        source: "voice",
      };
      setEntries((prev) => [...prev, newEntry]);
      await saveEntry(newEntry.time, newEntry.text, newEntry.source);
    } catch (error) {
      console.error("변환 오류:", error);
      alert("음성 변환에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // 텍스트 직접 입력
  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    const newEntry: Entry = {
      id: Date.now().toString(),
      time: getCurrentTime(),
      text: textInput.trim(),
      source: "text",
    };
    setEntries((prev) => [...prev, newEntry]);
    setTextInput("");
    setShowTextInput(false);
    await saveEntry(newEntry.time, newEntry.text, newEntry.source);
  };

  // MD 내보내기
  const handleExport = () => {
    const md = entriesToMd(dateKey, entries);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dateKey}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 날짜 이동
  const moveDate = (delta: number) => {
    const d = new Date(dateKey);
    d.setDate(d.getDate() + delta);
    setDateKey(d.toISOString().split("T")[0]);
    setEntries([]);
  };

  const isToday = dateKey === getTodayKey();

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" />
            음성 일기
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            하루의 생각을 음성으로 자유롭게 기록하세요
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          disabled={entries.length === 0}
          className="rounded-xl"
        >
          <Download className="w-4 h-4 mr-1" />
          내보내기
        </Button>
      </div>

      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <Button variant="ghost" size="icon" onClick={() => moveDate(-1)} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">
            {new Date(dateKey).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
          </span>
          {isToday && (
            <Badge className="bg-primary/10 text-primary text-xs border-0">오늘</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => moveDate(1)}
          disabled={isToday}
          className="rounded-full"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* 일기 엔트리 */}
      <ScrollArea className="h-[calc(100vh-380px)] md:h-[calc(100vh-340px)]">
        <div className="space-y-4 pr-2">
          {isLoading ? (
            <div className="flex justify-center py-16 animate-fade-in-up">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : entries.length === 0 && !isTranscribing ? (
            <div className="text-center py-16 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="w-20 h-20 rounded-3xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Mic className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground">
                {isToday
                  ? "아래 버튼을 눌러 오늘의 일기를 시작하세요"
                  : "이 날의 기록이 없습니다"}
              </p>
            </div>
          ) : (
            entries.map((entry, i) => (
              <Card
                key={entry.id}
                className="glass border-0 rounded-2xl animate-fade-in-up"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-mono text-muted-foreground">{entry.time}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        entry.source === "voice"
                          ? "border-primary/30 text-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {entry.source === "voice" ? "🎙️ 음성" : "⌨️ 텍스트"}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                </CardContent>
              </Card>
            ))
          )}

          {isTranscribing && (
            <Card className="glass border-0 rounded-2xl animate-fade-in-up">
              <CardContent className="p-5 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">음성을 텍스트로 변환하는 중...</span>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* 텍스트 입력 영역 */}
      {showTextInput && (
        <div className="glass rounded-2xl p-4 animate-fade-in-up">
          <Textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="직접 입력하세요..."
            className="min-h-[80px] bg-transparent border-0 resize-none focus-visible:ring-0 p-0 text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowTextInput(false)} className="rounded-xl">
              취소
            </Button>
            <Button size="sm" onClick={handleTextSubmit} className="rounded-xl" disabled={!textInput.trim()}>
              <Send className="w-3 h-3 mr-1" />
              추가
            </Button>
          </div>
        </div>
      )}

      {/* 녹음 컨트롤 */}
      {isToday && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowTextInput(!showTextInput)}
            className="w-12 h-12 rounded-full glass"
          >
            <Keyboard className="w-5 h-5" />
          </Button>

          <Button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            className={`
              w-16 h-16 rounded-full transition-all duration-300
              ${
                isRecording
                  ? "bg-destructive hover:bg-destructive/90 animate-pulse-glow"
                  : "bg-gradient-to-br from-primary to-accent hover:from-primary/90 hover:to-accent/90 glow"
              }
            `}
          >
            {isRecording ? (
              <Square className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </Button>

          {isRecording && (
            <div className="glass rounded-full px-4 py-2 flex items-center gap-3 animate-fade-in-up">
              {/* 웨이브 애니메이션 */}
              <div className="flex items-center gap-0.5 h-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="wave-bar bg-destructive"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-sm font-mono text-destructive">
                {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 유틸 함수
function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function entriesToMd(dateKey: string, entries: Entry[]): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(dateKey);
  const dow = days[d.getDay()];
  let md = `# ${dateKey} (${dow})\n\n`;
  for (const e of entries) {
    md += `## ${e.time}\n${e.text}\n\n`;
  }
  return md;
}
