importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js");

// Firebase 프로젝트 설정 (빌드 시 환경변수가 들어갈 수 없으므로, URL 파라미터나 고정 값 사용 필요. 
// 통상적으로 URL 파라미터에서 받아오거나 플러그인으로 주입합니다.
// 여기서는 기본 앱 초기화를 위해 빈 config를 넣고, 실제 사용 시에는 환경변수 값을 맞춰야 합니다.)
const firebaseConfig = {
  // 실제 키는 서비스 워커 로드 시 URL 파라미터 등으로 전달받는 방식을 주로 사용합니다.
  // 이 예제에서는 빈 값으로 두며, 클라이언트 쪽에서 토큰을 발급할 때 서비스 워커가 정상 등록되도록 돕는 역할을 합니다.
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Received background message ", payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: "/icons/icon-192.png",
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.log("Firebase app already initialized or config missing in SW");
}
