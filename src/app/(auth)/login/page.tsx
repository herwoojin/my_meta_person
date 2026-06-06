"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, ArrowRight, Brain, BookOpen, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

async function doGoogleLogin() {
  const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
  const { getClientAuth } = await import("@/lib/firebase/client");
  const { doc, getDoc } = await import("firebase/firestore");
  const { getClientDb } = await import("@/lib/firebase/client");

  const auth = getClientAuth();
  const db = getClientDb();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const uid = result.user.uid;

  const userDoc = await getDoc(doc(db, "users", uid));
  const complete = userDoc.exists() && userDoc.data()?.onboardingComplete;
  return complete ? "/dashboard" : "/onboarding";
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const redirectTo = await doGoogleLogin();
      router.push(redirectTo);
    } catch (error) {
      console.error("로그인 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg relative overflow-hidden">
      <div className="mesh-gradient" />

      {/* 배경 장식 요소 */}
      <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        {/* 로고 & 타이틀 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent mb-6 animate-pulse-glow">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Meta<span className="text-primary">Me</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            되고 싶은 미래의 내가<br />
            현재의 나를 코칭합니다
          </p>
        </div>

        {/* 기능 하이라이트 */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { icon: BookOpen, label: "음성 일기", desc: "매일 기록" },
            { icon: Brain, label: "메타인지", desc: "패턴 발견" },
            { icon: MessageCircle, label: "AI 코칭", desc: "행동 제안" },
          ].map((item) => (
            <div
              key={item.label}
              className="glass rounded-2xl p-4 text-center hover:scale-105 transition-transform duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs font-medium">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 로그인 카드 */}
        <div className="glass rounded-3xl p-8">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium text-base transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                로그인 중...
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google 계정으로 시작하기
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            로그인하면 서비스 이용약관에 동의하게 됩니다.
          </p>
        </div>

        {/* 하단 텍스트 */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          🔒 모든 데이터는 암호화되어 본인만 접근할 수 있습니다
        </p>
      </div>
    </div>
  );
}
