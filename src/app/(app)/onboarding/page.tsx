"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Brain,
  Target,
  Heart,
  Shield,
  User,
} from "lucide-react";

const MBTI_INFO: Record<string, { label: string; desc: string }> = {
  INTJ: { label: "전략가", desc: "독립적이고 분석적인 전략가. 장기 비전을 세우고 체계적으로 실행합니다." },
  INTP: { label: "논리술사", desc: "호기심 많고 논리적인 사색가. 복잡한 문제를 분석하고 혁신적 해법을 찾습니다." },
  ENTJ: { label: "통솔자", desc: "결단력 있고 카리스마 넘치는 리더. 목표를 세우고 팀을 이끌어 성과를 냅니다." },
  ENTP: { label: "변론가", desc: "재치 있고 도전적인 발명가. 새로운 아이디어를 탐구하고 토론을 즐깁니다." },
  INFJ: { label: "옹호자", desc: "통찰력 있고 이상주의적인 조력자. 깊은 공감 능력으로 타인에게 영감을 줍니다." },
  INFP: { label: "중재자", desc: "이상주의적이고 감성적인 치유자. 내면의 가치를 따르며 창의적으로 표현합니다." },
  ENFJ: { label: "선도자", desc: "따뜻하고 영향력 있는 멘토. 타인의 성장을 돕고 조화로운 관계를 만듭니다." },
  ENFP: { label: "활동가", desc: "열정적이고 창의적인 자유영혼. 가능성을 탐구하고 사람들과 연결됩니다." },
  ISTJ: { label: "현실주의자", desc: "신뢰할 수 있고 체계적인 관리자. 책임감 있게 계획을 세우고 꾸준히 실행합니다." },
  ISFJ: { label: "수호자", desc: "헌신적이고 세심한 보호자. 주변 사람들을 돌보며 안정적인 환경을 만듭니다." },
  ESTJ: { label: "경영자", desc: "체계적이고 실행력 있는 조직가. 질서를 세우고 효율적으로 일을 처리합니다." },
  ESFJ: { label: "외교관", desc: "사교적이고 배려심 깊은 협력자. 조화를 중시하며 모두를 챙깁니다." },
  ISTP: { label: "만능재주꾼", desc: "침착하고 실용적인 분석가. 문제를 즉흥적으로 해결하고 도구를 잘 다룹니다." },
  ISFP: { label: "모험가", desc: "유연하고 감성적인 예술가. 현재를 즐기며 자신만의 방식으로 아름다움을 추구합니다." },
  ESTP: { label: "사업가", desc: "에너지 넘치고 현실적인 행동가. 즉각적으로 반응하고 모험을 즐깁니다." },
  ESFP: { label: "연예인", desc: "활기차고 즉흥적인 퍼포머. 사람들과 어울리며 즐거운 분위기를 만듭니다." },
};

const MBTI_TYPES = Object.keys(MBTI_INFO);

const STEPS = [
  { title: "MBTI 유형", subtitle: "나의 성향을 선택해주세요", icon: Brain },
  { title: "나의 가치", subtitle: "핵심 가치와 목표를 알려주세요", icon: Target },
  { title: "미래의 나", subtitle: "되고 싶은 나를 정의해주세요", icon: Sparkles },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, fetchProfile } = useAuthStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [mbti, setMbti] = useState("");
  const [valuesInput, setValuesInput] = useState("");
  const [goalsInput, setGoalsInput] = useState("");
  const [weaknessesInput, setWeaknessesInput] = useState("");
  const [personaName, setPersonaName] = useState("");
  const [personaTone, setPersonaTone] = useState("");
  const [personaPerspective, setPersonaPerspective] = useState("");
  const [personaPriorities, setPersonaPriorities] = useState("");

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { doc, setDoc, Timestamp } = await import("firebase/firestore");
      const { getClientDb } = await import("@/lib/firebase/client");
      const db = getClientDb();

      const values = valuesInput.split(",").map((s) => s.trim()).filter(Boolean);
      const goals = goalsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const weaknesses = weaknessesInput.split(",").map((s) => s.trim()).filter(Boolean);
      const priorities = personaPriorities.split(",").map((s) => s.trim()).filter(Boolean);

      // 사용자 프로필 저장
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.displayName ?? "",
        photoURL: user.photoURL ?? "",
        mbti,
        values,
        goals,
        weaknesses,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notifyPrefs: { enabled: true, time: "07:00", channels: ["push"] },
        onboardingComplete: true,
        createdAt: Timestamp.now(),
      });

      // 기본 페르소나 저장
      await setDoc(
        doc(db, "users", user.uid, "selfPersonas", "default"),
        {
          ownerUid: user.uid,
          name: personaName || "미래의 나",
          tone: personaTone || "따뜻하지만 솔직한",
          perspective: personaPerspective || "성장 지향적 관점",
          priorities: priorities.length > 0 ? priorities : ["자기 성장", "균형 잡힌 삶"],
          isDefault: true,
        }
      );

      await fetchProfile(user.uid);
      router.push("/dashboard");
    } catch (error) {
      console.error("온보딩 저장 실패:", error);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return mbti !== "";
    if (step === 1) return valuesInput.trim() !== "" && goalsInput.trim() !== "";
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg relative overflow-hidden">
      <div className="mesh-gradient" />
      <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-accent/5 blur-3xl animate-float" />

      <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in-up">
        {/* 프로그레스 */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  transition-all duration-500
                  ${
                    i < step
                      ? "bg-primary text-primary-foreground scale-100"
                      : i === step
                      ? "bg-primary/20 text-primary ring-2 ring-primary/30 scale-110"
                      : "bg-muted text-muted-foreground"
                  }
                `}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full transition-colors duration-500 ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* 단계 타이틀 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            {(() => {
              const Icon = STEPS[step].icon;
              return <Icon className="w-7 h-7 text-primary" />;
            })()}
          </div>
          <h2 className="text-2xl font-bold">{STEPS[step].title}</h2>
          <p className="text-muted-foreground mt-1">{STEPS[step].subtitle}</p>
        </div>

        {/* 컨텐츠 카드 */}
        <div className="glass rounded-3xl p-8">
          {/* Step 0: MBTI */}
          {step === 0 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">MBTI 유형 선택</Label>
              <div className="grid grid-cols-4 gap-2">
                {MBTI_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setMbti(type)}
                    className={`
                      py-2.5 rounded-xl text-center transition-all duration-200
                      ${
                        mbti === type
                          ? "bg-primary text-primary-foreground scale-105 glow"
                          : "bg-muted/50 text-foreground hover:bg-muted hover:scale-105"
                      }
                    `}
                  >
                    <span className="block text-sm font-semibold">{type}</span>
                    <span className={`block text-[10px] mt-0.5 ${mbti === type ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {MBTI_INFO[type].label}
                    </span>
                  </button>
                ))}
              </div>
              {mbti && (
                <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className="text-primary border-primary/30">
                      {mbti}
                    </Badge>
                    <span className="text-sm font-semibold text-primary">{MBTI_INFO[mbti].label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {MBTI_INFO[mbti].desc}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Values & Goals */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-accent" />
                  핵심 가치
                </Label>
                <Input
                  value={valuesInput}
                  onChange={(e) => setValuesInput(e.target.value)}
                  placeholder="예: 성장, 가족, 진정성 (쉼표로 구분)"
                  className="h-12 rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  목표
                </Label>
                <Textarea
                  value={goalsInput}
                  onChange={(e) => setGoalsInput(e.target.value)}
                  placeholder="예: 매일 성찰하기, 감정 인식 능력 향상 (쉼표로 구분)"
                  className="rounded-xl bg-muted/30 min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  극복하고 싶은 약점
                </Label>
                <Input
                  value={weaknessesInput}
                  onChange={(e) => setWeaknessesInput(e.target.value)}
                  placeholder="예: 미루는 습관, 과도한 걱정 (쉼표로 구분)"
                  className="h-12 rounded-xl bg-muted/30"
                />
              </div>
            </div>
          )}

          {/* Step 2: Future Self */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  미래 자아의 이름
                </Label>
                <Input
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="예: 현명한 나, 성장한 나"
                  className="h-12 rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>어조 · 말투</Label>
                <Input
                  value={personaTone}
                  onChange={(e) => setPersonaTone(e.target.value)}
                  placeholder="예: 따뜻하지만 솔직한"
                  className="h-12 rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>관점 · 시각</Label>
                <Input
                  value={personaPerspective}
                  onChange={(e) => setPersonaPerspective(e.target.value)}
                  placeholder="예: 성장 지향적, 균형 잡힌"
                  className="h-12 rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>우선순위</Label>
                <Input
                  value={personaPriorities}
                  onChange={(e) => setPersonaPriorities(e.target.value)}
                  placeholder="예: 자기 성장, 건강, 관계 (쉼표로 구분)"
                  className="h-12 rounded-xl bg-muted/30"
                />
              </div>
            </div>
          )}
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex items-center gap-3 mt-6">
          {step > 0 && (
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              className="h-12 px-6 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              이전
            </Button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="h-12 px-8 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              다음
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-12 px-8 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  저장 중...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  시작하기
                </div>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
