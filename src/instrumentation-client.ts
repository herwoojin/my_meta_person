// ============================================================
// 클라이언트 계측 (Next.js instrumentation-client)
// React 하이드레이션 전, 페이지 로드 직후 1회 실행된다.
// ============================================================

import { analytics } from "./lib/firebase/analytics";

analytics.init();

// 라우터 네비게이션 추적 → GA page_navigation 이벤트
export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse"
) {
  analytics.track("page_navigation", {
    url,
    type: navigationType,
    timestamp: Date.now(),
  });
}
