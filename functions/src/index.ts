import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// 퍼블릭 도메인 명언/영감 목록 (MVP 용 하드코딩, 차후 DB 연동 가능)
const INSPIRATIONS = [
  { title: "오늘의 영감", body: "가장 큰 영광은 한 번도 실패하지 않음이 아니라, 실패할 때마다 다시 일어서는 데에 있다. - 공자" },
  { title: "오늘의 영감", body: "어제의 나와 오늘의 나를 비교하라. 다른 사람과 비교하지 마라. - 조던 피터슨" },
  { title: "오늘의 영감", body: "변화를 원한다면 먼저 자신을 알아야 한다. - 소크라테스" },
  { title: "오늘의 영감", body: "매일 조금씩 나아지는 것이 가장 강력한 전략이다. - 제임스 클리어" },
];

export const sendMorningInspirations = onSchedule("every 10 minutes", async (event) => {
  const now = new Date();
  console.log(`[${now.toISOString()}] 아침 영감 알림 발송 체크 시작...`);

  try {
    // 1. 알림 설정이 켜져 있고 토큰이 있는 사용자 조회
    const usersSnap = await db.collection("users")
      .where("notifyPrefs.enabled", "==", true)
      .get();

    if (usersSnap.empty) {
      console.log("알림 대상 사용자가 없습니다.");
      return;
    }

    const todayDateStr = now.toISOString().split("T")[0]; // UTC 기준 오늘 날짜 (단순화)

    for (const doc of usersSnap.docs) {
      const userData = doc.data();
      const fcmToken = userData.fcmToken;
      const targetTime = userData.notifyPrefs?.time || "07:00"; // "HH:MM"
      const userTimezone = userData.timezone || "Asia/Seoul";

      if (!fcmToken) continue;

      // 사용자 타임존 기준 현재 시간 구하기
      const userDate = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      const currentHour = userDate.getHours();
      const currentMinute = userDate.getMinutes();

      const [targetH, targetM] = targetTime.split(":").map(Number);

      // 정각 시간에서 ±5분 내외일 때 발송 (10분 단위 스케줄러를 고려)
      const isTimeMatch = currentHour === targetH && Math.abs(currentMinute - targetM) < 10;

      if (isTimeMatch) {
        // 이미 오늘 보냈는지 체크
        const logId = `${doc.id}_${todayDateStr}`;
        const logRef = db.collection("notificationLogs").doc(logId);
        const logSnap = await logRef.get();

        if (!logSnap.exists) {
          // 영감 랜덤 선택
          const randomInsp = INSPIRATIONS[Math.floor(Math.random() * INSPIRATIONS.length)];

          // 푸시 발송
          const message = {
            notification: {
              title: randomInsp.title,
              body: randomInsp.body,
            },
            token: fcmToken,
          };

          try {
            await admin.messaging().send(message);
            await logRef.set({
              userId: doc.id,
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
              type: "morning_inspiration"
            });
            console.log(`발송 성공: ${doc.id}`);
          } catch (error) {
            console.error(`발송 실패 (${doc.id}):`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error("알림 체크 중 오류:", error);
  }

  console.log("알림 발송 체크 완료.");
});
