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
  Pencil,
  Trash2,
  Check,
  X,
  Sparkles,
} from "lucide-react";

interface Entry {
  id: string;
  time: string;
  text: string;
  source: "voice" | "text";
  /** 교정 전 받아쓰기 원문 (교정된 경우에만 존재) */
  rawText?: string;
  /** 사용자가 직접 수정한 기록 */
  edited?: boolean;
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
  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [rawShownId, setRawShownId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // URL의 ?date=YYYY-MM-DD 가 있으면 해당 날짜로 시작 (기록 페이지에서 "열기")
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("date");
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
      setDateKey(param);
    }
  }, []);

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

  // DB에 단일 항목 저장. 저장된 문서 id를 돌려준다(이후 수정·삭제에 사용)
  const saveEntry = async (entry: Entry): Promise<string | null> => {
    if (!user) return null;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dateKey,
          time: entry.time,
          text: entry.text,
          source: entry.source,
          rawText: entry.rawText,
        }),
      });
      const data = await res.json();
      return res.ok ? (data.id ?? null) : null;
    } catch (error) {
      console.error("일기 저장 실패:", error);
      return null;
    }
  };

  // 저장 직후 임시 id를 서버 문서 id로 교체
  const attachServerId = (localId: string, serverId: string | null) => {
    if (!serverId) return;
    setEntries((prev) =>
      prev.map((e) => (e.id === localId ? { ...e, id: serverId } : e))
    );
  };

  // --- 편집 ---
  const startEdit = (entry: Entry) => {
    setEditingId(entry.id);
    setEditText(entry.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  // 편집 중인 텍스트를 AI로 다시 다듬기 (저장은 사용자가 확인 후)
  const refineEditText = async () => {
    if (!user || !editText.trim()) return;
    setIsRefining(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: editText, dateKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      if (data.text) setEditText(data.text);
      if (!data.changed) alert("고칠 부분을 찾지 못했습니다.");
    } catch (error) {
      console.error("교정 실패:", error);
      alert("교정에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsRefining(false);
    }
  };

  const saveEdit = async (entry: Entry) => {
    const text = editText.trim();
    if (!user || !text || text === entry.text) {
      cancelEdit();
      return;
    }
    setIsSavingEdit(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/journal", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dateKey, id: entry.id, text }),
      });
      if (!res.ok) throw new Error();
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, text, edited: true } : e))
      );
      cancelEdit();
    } catch (error) {
      console.error("수정 실패:", error);
      alert("수정 저장에 실패했습니다.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteEntry = async (entry: Entry) => {
    if (!user) return;
    if (!confirm("이 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/journal?date=${dateKey}&entry=${entry.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error();
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (error) {
      console.error("삭제 실패:", error);
      alert("삭제에 실패했습니다.");
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
        const webmBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Gemini는 webm을 지원하지 않으므로 WAV로 변환해 전송
        let blob = webmBlob;
        try {
          blob = await blobToWav(webmBlob);
        } catch (err) {
          console.warn("WAV 변환 실패, 원본 전송:", err);
        }
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
      const ext = blob.type.includes("wav") ? "wav" : "webm";
      formData.append("audio", blob, `recording.${ext}`);
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
        throw new Error(data?.detail || data?.error || "STT 변환 실패");
      }

      if (!data.text?.trim()) {
        alert("음성에서 텍스트를 인식하지 못했습니다. 다시 시도해주세요.");
        return;
      }

      const newEntry: Entry = {
        id: Date.now().toString(),
        time: data.time || getCurrentTime(),
        // 서버에서 문맥 교정을 마친 텍스트
        text: data.text,
        source: "voice",
        // 교정으로 달라진 경우에만 받아쓰기 원문 보관
        rawText: data.refined ? data.rawText : undefined,
      };
      setEntries((prev) => [...prev, newEntry]);
      attachServerId(newEntry.id, await saveEntry(newEntry));
    } catch (error) {
      console.error("변환 오류:", error);
      const msg = error instanceof Error ? error.message : "";
      alert(
        msg
          ? `음성 변환에 실패했습니다.\n(${msg})`
          : "음성 변환에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
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
    attachServerId(newEntry.id, await saveEntry(newEntry));
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
                    {entry.edited && (
                      <Badge variant="outline" className="text-xs border-muted-foreground/30">
                        ✏️ 수정됨
                      </Badge>
                    )}

                    {editingId !== entry.id && (
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => startEdit(entry)}
                          className="text-muted-foreground hover:text-foreground p-1"
                          aria-label="수정"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteEntry(entry)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          aria-label="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {editingId === entry.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[120px] text-sm leading-relaxed rounded-xl bg-muted/20"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={refineEditText}
                          disabled={isRefining || isSavingEdit}
                          className="rounded-xl"
                        >
                          {isRefining ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 mr-1" />
                          )}
                          AI 교정
                        </Button>
                        {entry.rawText && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditText(entry.rawText ?? "")}
                            disabled={isRefining || isSavingEdit}
                            className="rounded-xl text-muted-foreground"
                          >
                            원문 불러오기
                          </Button>
                        )}
                        <div className="ml-auto flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={isSavingEdit}
                            className="rounded-xl"
                          >
                            <X className="w-3 h-3 mr-1" />
                            취소
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveEdit(entry)}
                            disabled={isSavingEdit || !editText.trim()}
                            className="rounded-xl"
                          >
                            {isSavingEdit ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3 mr-1" />
                            )}
                            저장
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p
                        className="text-sm leading-relaxed whitespace-pre-wrap cursor-text"
                        onDoubleClick={() => startEdit(entry)}
                      >
                        {entry.text}
                      </p>
                      {entry.rawText && (
                        <div className="mt-2">
                          <button
                            onClick={() =>
                              setRawShownId(rawShownId === entry.id ? null : entry.id)
                            }
                            className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground"
                          >
                            {rawShownId === entry.id
                              ? "받아쓰기 원문 숨기기"
                              : "받아쓰기 원문 보기"}
                          </button>
                          {rawShownId === entry.id && (
                            <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground/80 p-3 rounded-xl bg-muted/20">
                              {entry.rawText}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
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

// 녹음 blob(webm 등)을 Gemini 호환 WAV(16kHz mono PCM16)로 변환
async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuf = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuf);
    const wav = encodeWav(decoded, 16000);
    return new Blob([wav], { type: "audio/wav" });
  } finally {
    ctx.close();
  }
}

// AudioBuffer → WAV(ArrayBuffer). 모노 믹스다운 + 지정 샘플레이트로 리샘플
function encodeWav(buffer: AudioBuffer, targetRate: number): ArrayBuffer {
  // 모노 믹스다운
  const chs = buffer.numberOfChannels;
  const src = buffer.getChannelData(0);
  const mixed = new Float32Array(src.length);
  mixed.set(src);
  for (let c = 1; c < chs; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) mixed[i] += data[i];
  }
  if (chs > 1) for (let i = 0; i < mixed.length; i++) mixed[i] /= chs;

  // 리샘플 (선형 보간)
  const ratio = buffer.sampleRate / targetRate;
  const outLen = Math.floor(mixed.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, mixed.length - 1);
    out[i] = mixed[lo] + (mixed[hi] - mixed[lo]) * (idx - lo);
  }

  // PCM16 WAV 헤더 + 데이터
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = out.length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, out[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return ab;
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
