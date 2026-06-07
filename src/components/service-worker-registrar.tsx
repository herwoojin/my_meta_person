"use client";

import { useEffect } from "react";

// PWA 설치 가능 조건(서비스 워커 + fetch 핸들러)을 충족시키기 위해
// 클라이언트에서 /sw.js 를 등록한다. (FCM용 SW와 별개)
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[PWA] SW 등록 실패:", err));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
