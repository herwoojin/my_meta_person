// getMessaging/getToken 등은 브라우저에서만 동작하므로
// requestNotificationPermission() 내부에서 firebase/messaging을 동적 import한다.

// 환경변수에서 VAPID 키를 가져옵니다. (Firebase 콘솔 - Cloud Messaging에서 생성 가능)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) {
    console.warn("이 브라우저는 데스크톱 알림을 지원하지 않습니다.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    try {
      const app = await import("./client").then(m => m.getFirebaseApp());
      const { getMessaging, getToken } = await import("firebase/messaging");
      const messaging = getMessaging(app);

      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (token) {
        return token;
      } else {
        console.warn("푸시 토큰을 가져올 수 없습니다.");
        return null;
      }
    } catch (error) {
      console.error("푸시 알림 설정 오류:", error);
      return null;
    }
  }

  return null;
}
