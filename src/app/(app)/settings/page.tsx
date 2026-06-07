"use client";

import { useAuthStore } from "@/stores/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Settings as SettingsIcon,
  User,
  Brain,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Trash2,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "next-themes";
import { requestNotificationPermission } from "@/lib/firebase/messaging";
import { doc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { useState } from "react";

const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

const API_PROVIDERS: {
  field: string;
  label: string;
  hint: string;
  url: string;
}[] = [
  {
    field: "geminiApiKey",
    label: "Gemini",
    hint: "AIza...",
    url: "https://aistudio.google.com/apikey",
  },
  {
    field: "openaiApiKey",
    label: "OpenAI (GPT)",
    hint: "sk-...",
    url: "https://platform.openai.com/api-keys",
  },
  {
    field: "anthropicApiKey",
    label: "Anthropic (Claude)",
    hint: "sk-ant-...",
    url: "https://console.anthropic.com/settings/keys",
  },
];

export default function SettingsPage() {
  const { profile, user, fetchProfile } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [isRequesting, setIsRequesting] = useState(false);

  // --- API 키 (BYOK, 3개 제공자) ---
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState<string | null>(null);

  const profileKeys = profile as unknown as Record<string, string | undefined>;

  // --- 프로필(이름/이메일) 편집 ---
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const startEditProfile = () => {
    setNameInput(profile?.displayName ?? "");
    setEmailInput(profile?.email ?? "");
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { getClientDb } = await import("@/lib/firebase/client");
      const db = getClientDb();
      await setDoc(
        doc(db, "users", user.uid),
        { displayName: nameInput.trim(), email: emailInput.trim() },
        { merge: true }
      );
      await fetchProfile(user.uid);
      setEditingProfile(false);
    } catch (error) {
      console.error("프로필 저장 실패:", error);
      alert("프로필 저장에 실패했습니다.");
    } finally {
      setSavingProfile(false);
    }
  };

  // --- 알림 시간 ---
  const [savingTime, setSavingTime] = useState(false);

  const handleTimeChange = async (time: string) => {
    if (!user || !time) return;
    setSavingTime(true);
    try {
      const { getClientDb } = await import("@/lib/firebase/client");
      const db = getClientDb();
      await setDoc(
        doc(db, "users", user.uid),
        { notifyPrefs: { time } },
        { merge: true }
      );
      await fetchProfile(user.uid);
    } catch (error) {
      console.error("알림 시간 저장 실패:", error);
      alert("알림 시간 저장에 실패했습니다.");
    } finally {
      setSavingTime(false);
    }
  };

  // --- MBTI 변경 ---
  const [editingMbti, setEditingMbti] = useState(false);
  const [selectedMbti, setSelectedMbti] = useState("");
  const [savingMbti, setSavingMbti] = useState(false);

  const handleMbtiChange = async (type: string) => {
    if (!user || type === profile?.mbti) return;
    setSelectedMbti(type);
    setSavingMbti(true);
    try {
      const { getClientDb } = await import("@/lib/firebase/client");
      const db = getClientDb();
      await setDoc(
        doc(db, "users", user.uid),
        { mbti: type },
        { merge: true }
      );
      await fetchProfile(user.uid);
      setEditingMbti(false);
      setSelectedMbti("");
    } catch (error) {
      console.error("MBTI 변경 실패:", error);
      alert("MBTI 변경에 실패했습니다.");
    } finally {
      setSavingMbti(false);
    }
  };

  const saveKey = async (field: string, label: string) => {
    if (!user) return;
    const value = (keyInputs[field] ?? "").trim();
    if (!value) return;
    setSavingField(field);
    try {
      const { getClientDb } = await import("@/lib/firebase/client");
      const db = getClientDb();
      // setDoc + merge: 문서가 없어도 생성/병합되어 항상 저장됨
      await setDoc(doc(db, "users", user.uid), { [field]: value }, { merge: true });
      await fetchProfile(user.uid);
      setKeyInputs((p) => ({ ...p, [field]: "" }));
      alert(`${label} API 키가 저장되었습니다.`);
    } catch (error) {
      console.error("키 저장 실패:", error);
      alert("키 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSavingField(null);
    }
  };

  const removeKey = async (field: string, label: string) => {
    if (!user) return;
    if (!confirm(`등록된 ${label} API 키를 삭제할까요?`)) return;
    setSavingField(field);
    try {
      const { getClientDb } = await import("@/lib/firebase/client");
      const db = getClientDb();
      await updateDoc(doc(db, "users", user.uid), { [field]: deleteField() });
      await fetchProfile(user.uid);
    } catch (error) {
      console.error("키 삭제 실패:", error);
      alert("키 삭제에 실패했습니다.");
    } finally {
      setSavingField(null);
    }
  };

  const handleSignOut = async () => {
    const { signOut } = await import("firebase/auth");
    const { getClientAuth } = await import("@/lib/firebase/client");
    await signOut(getClientAuth());
    window.location.href = "/login";
  };

  const handleEnablePush = async () => {
    if (!user) return;
    setIsRequesting(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        const { getClientDb } = await import("@/lib/firebase/client");
        const db = getClientDb();
        await updateDoc(doc(db, "users", user.uid), {
          fcmToken: token,
          "notifyPrefs.enabled": true
        });
        alert("푸시 알림이 설정되었습니다.");
      } else {
        alert("알림 권한이 거부되었거나 지원하지 않는 브라우저입니다.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-muted-foreground" />
          설정
        </h1>
      </div>

      {/* 프로필 */}
      <Card className="glass border-0 rounded-3xl animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">프로필</h3>
            </div>
            {!editingProfile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startEditProfile}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
              >
                편집
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {editingProfile ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground px-1">이름</label>
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="이름"
                    className="h-11 rounded-xl bg-muted/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground px-1">이메일</label>
                  <Input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="이메일"
                    className="h-11 rounded-xl bg-muted/30"
                  />
                  <p className="text-[11px] text-muted-foreground px-1">
                    표시용 이메일입니다. 실제 로그인 계정(Google)은 변경되지 않습니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile || !nameInput.trim()}
                    className="flex-1 h-11 rounded-xl"
                  >
                    {savingProfile ? "저장 중..." : "저장"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setEditingProfile(false)}
                    disabled={savingProfile}
                    className="h-11 rounded-xl"
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                  <span className="text-sm text-muted-foreground">이름</span>
                  <span className="text-sm font-medium">{profile?.displayName}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                  <span className="text-sm text-muted-foreground">이메일</span>
                  <span className="text-sm font-medium">{profile?.email}</span>
                </div>
              </>
            )}
            <div className="p-3 rounded-xl bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">MBTI</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-0">{profile?.mbti}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingMbti(!editingMbti)}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                  >
                    {editingMbti ? "닫기" : "변경"}
                  </Button>
                </div>
              </div>
              {editingMbti && (
                <div className="mt-3 space-y-3 animate-fade-in-up">
                  <div className="grid grid-cols-4 gap-1.5">
                    {MBTI_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => handleMbtiChange(type)}
                        disabled={savingMbti}
                        className={`
                          py-2 rounded-lg text-center transition-all duration-200
                          ${
                            (selectedMbti || profile?.mbti) === type
                              ? "bg-primary text-primary-foreground scale-105"
                              : "bg-muted/40 text-foreground hover:bg-muted/60 hover:scale-105"
                          }
                        `}
                      >
                        <span className="block text-xs font-semibold">{type}</span>
                      </button>
                    ))}
                  </div>
                  {savingMbti && (
                    <p className="text-xs text-muted-foreground text-center">저장 중...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API 키 (BYOK, 3개 제공자) */}
      <Card className="glass border-0 rounded-3xl animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">AI 모델 API 키</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            음성 일기·코칭은 <span className="font-medium text-foreground">본인의 API 키</span>로 동작합니다.
            여러 개를 등록하면 질문 성격에 맞는 모델이 자동 선택되고, <span className="font-mono text-foreground">/모두</span> 로 물으면 모든 모델이 답한 뒤 종합합니다.
            키는 본인 계정에만 저장됩니다.
          </p>

          <div className="space-y-5">
            {API_PROVIDERS.map((p) => {
              const has = Boolean(profileKeys?.[p.field]);
              const saving = savingField === p.field;
              return (
                <div key={p.field}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.label}</span>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                      >
                        키 발급 <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    {has ? (
                      <Badge className="bg-green-500/10 text-green-500 border-0">등록됨</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">미등록</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      value={keyInputs[p.field] ?? ""}
                      onChange={(e) =>
                        setKeyInputs((prev) => ({ ...prev, [p.field]: e.target.value }))
                      }
                      placeholder={has ? "새 키 입력 (교체 시)" : `${p.hint} 형식의 키`}
                      className="h-11 rounded-xl bg-muted/30"
                    />
                    <Button
                      onClick={() => saveKey(p.field, p.label)}
                      disabled={saving || !(keyInputs[p.field] ?? "").trim()}
                      className="h-11 px-5 rounded-xl whitespace-nowrap"
                    >
                      {saving ? "저장 중..." : has ? "교체" : "저장"}
                    </Button>
                  </div>
                  {has && (
                    <button
                      onClick={() => removeKey(p.field, p.label)}
                      disabled={saving}
                      className="mt-2 text-xs text-destructive hover:underline"
                    >
                      등록된 키 삭제
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 테마 */}
      <Card className="glass border-0 rounded-3xl animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {theme === "dark" ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-yellow-500" />}
            <h3 className="font-semibold">테마</h3>
          </div>
          <div className="flex gap-2">
            {[
              { value: "dark", label: "다크", icon: Moon },
              { value: "light", label: "라이트", icon: Sun },
              { value: "system", label: "시스템", icon: SettingsIcon },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                  theme === t.value
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 알림 설정 */}
      <Card className="glass border-0 rounded-3xl animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-accent" />
            <h3 className="font-semibold">알림</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
              <div>
                <p className="text-sm font-medium">아침 영감 알림</p>
                <p className="text-xs text-muted-foreground mt-0.5">매일 아침 명언/시 1편을 받습니다</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnablePush}
                disabled={isRequesting}
                className="h-8 text-xs rounded-lg"
              >
                {isRequesting ? "설정 중..." : "푸시 켜기"}
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
              <div>
                <p className="text-sm font-medium">알림 받을 시간</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {savingTime ? "저장 중..." : "원하는 시간을 직접 지정하세요"}
                </p>
              </div>
              <input
                type="time"
                value={profile?.notifyPrefs?.time ?? "07:00"}
                onChange={(e) => handleTimeChange(e.target.value)}
                disabled={savingTime}
                className="h-9 px-3 rounded-lg bg-background border border-input text-sm text-foreground"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 개인정보 */}
      <Card className="glass border-0 rounded-3xl animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold">개인정보 · 보안</h3>
          </div>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors">
              <span className="text-sm">데이터 내보내기</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-destructive/10 transition-colors group">
              <span className="text-sm text-destructive flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                모든 데이터 삭제
              </span>
              <ChevronRight className="w-4 h-4 text-destructive" />
            </button>
          </div>
        </CardContent>
      </Card>

      <Separator className="opacity-30" />

      {/* 로그아웃 */}
      <Button
        variant="ghost"
        onClick={handleSignOut}
        className="w-full h-12 rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <LogOut className="w-4 h-4 mr-2" />
        로그아웃
      </Button>
    </div>
  );
}
