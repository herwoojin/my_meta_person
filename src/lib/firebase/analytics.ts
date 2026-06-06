// ============================================================
// Firebase Analytics — 클라이언트 전용, SSR-safe Lazy 초기화
// ============================================================
// getAnalytics()는 window가 필요하므로 서버에서 호출하면 터진다.
// isSupported() 가드로 미지원 환경(SSR, 일부 브라우저)에서는 no-op.

import type { Analytics } from "firebase/analytics";
import { getFirebaseApp } from "./client";

let _analytics: Analytics | null = null;
let _initStarted = false;

export const analytics = {
  /** instrumentation-client.ts에서 1회 호출. 미지원 환경에서는 조용히 skip. */
  init(): void {
    if (typeof window === "undefined") return;
    if (_initStarted) return;
    _initStarted = true;

    void (async () => {
      try {
        const { getAnalytics, isSupported } = await import("firebase/analytics");
        if (!(await isSupported())) return;
        _analytics = getAnalytics(getFirebaseApp());
      } catch (err) {
        console.warn("[analytics] 초기화 실패:", err);
      }
    })();
  },

  /** 커스텀 이벤트 기록. 아직 초기화 전이면 조용히 무시. */
  track(eventName: string, params?: Record<string, unknown>): void {
    if (!_analytics) return;
    void (async () => {
      try {
        const { logEvent } = await import("firebase/analytics");
        logEvent(_analytics!, eventName, params);
      } catch (err) {
        console.warn("[analytics] 이벤트 기록 실패:", err);
      }
    })();
  },
};
