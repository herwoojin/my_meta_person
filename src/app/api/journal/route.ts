// ============================================================
// /api/journal — 일기 CRUD API
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError } from "@/lib/auth/verify";
import { adminDb } from "@/lib/firebase/admin";

/**
 * entries 서브컬렉션으로부터 mdSnapshot을 다시 만들어 저장합니다.
 * (수정·삭제처럼 단순 append로 처리할 수 없는 경우에 사용)
 */
async function rebuildSnapshot(uid: string, dateKey: string): Promise<string> {
  const journalRef = adminDb.doc(`users/${uid}/journals/${dateKey}`);
  const entriesSnap = await journalRef
    .collection("entries")
    .orderBy("createdAt", "asc")
    .get();

  const md = entriesSnap.docs
    .map((doc) => {
      const d = doc.data();
      return `## ${d.time}\n${d.text}\n\n`;
    })
    .join("");

  await journalRef.set(
    { dateKey, mdSnapshot: md, updatedAt: new Date().toISOString() },
    { merge: true }
  );

  return md;
}

// GET — 특정 날짜의 일기 조회
export async function GET(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  const dateKey = req.nextUrl.searchParams.get("date");
  if (!dateKey) {
    return NextResponse.json(
      { error: "날짜(date) 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const journalDoc = await adminDb
      .doc(`users/${uid}/journals/${dateKey}`)
      .get();

    if (!journalDoc.exists) {
      return NextResponse.json({ entries: [], mdSnapshot: "" });
    }

    const entriesSnap = await adminDb
      .collection(`users/${uid}/journals/${dateKey}/entries`)
      .orderBy("createdAt", "asc")
      .get();

    const entries = entriesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      entries,
      mdSnapshot: journalDoc.data()?.mdSnapshot ?? "",
    });
  } catch (error) {
    console.error("[Journal] 조회 실패:", error);
    return NextResponse.json(
      { error: "일기 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST — 새로운 일기 항목 추가
export async function POST(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  try {
    const { dateKey, time, text, source, rawText } = await req.json();

    if (!dateKey || !time || !text || !source) {
      return NextResponse.json(
        { error: "필수 데이터(dateKey, time, text, source)가 누락되었습니다." },
        { status: 400 }
      );
    }

    const journalRef = adminDb.doc(`users/${uid}/journals/${dateKey}`);
    const entriesRef = journalRef.collection("entries");

    // 엔트리 추가
    const newEntryRef = entriesRef.doc();
    await newEntryRef.set({
      time,
      text,
      source,
      // 교정 전 받아쓰기 원문 (교정으로 뜻이 바뀐 경우 되돌릴 수 있게 보관)
      ...(rawText && rawText !== text ? { rawText } : {}),
      createdAt: new Date().toISOString(),
    });

    // 전체 mdSnapshot 업데이트 (단순 연결)
    const journalDoc = await journalRef.get();
    let currentMd = journalDoc.exists ? (journalDoc.data()?.mdSnapshot ?? "") : "";
    const newMdBlock = `## ${time}\n${text}\n\n`;
    currentMd += newMdBlock;

    await journalRef.set(
      {
        dateKey,
        mdSnapshot: currentMd,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: newEntryRef.id });
  } catch (error) {
    console.error("[Journal] 저장 실패:", error);
    return NextResponse.json(
      { error: "일기 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}

// PATCH — 기존 일기 항목의 본문 수정 (받아쓰기 오인식 교정용)
export async function PATCH(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  try {
    const { dateKey, id, text } = await req.json();

    if (!dateKey || !id || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "필수 데이터(dateKey, id, text)가 누락되었습니다." },
        { status: 400 }
      );
    }

    const entryRef = adminDb.doc(
      `users/${uid}/journals/${dateKey}/entries/${id}`
    );
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) {
      return NextResponse.json(
        { error: "해당 기록을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    await entryRef.set(
      {
        text: text.trim(),
        edited: true,
        editedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    await rebuildSnapshot(uid, dateKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Journal] 수정 실패:", error);
    return NextResponse.json(
      { error: "일기 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE — 날짜 전체 삭제 (?date=YYYY-MM-DD) 또는 항목 하나 삭제 (&entry=<id>)
export async function DELETE(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) return authResult;
  const { uid } = authResult;

  const dateKey = req.nextUrl.searchParams.get("date");
  const entryId = req.nextUrl.searchParams.get("entry");
  if (!dateKey) {
    return NextResponse.json(
      { error: "날짜(date) 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  // 항목 하나만 삭제
  if (entryId) {
    try {
      await adminDb
        .doc(`users/${uid}/journals/${dateKey}/entries/${entryId}`)
        .delete();
      await rebuildSnapshot(uid, dateKey);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[Journal] 항목 삭제 실패:", error);
      return NextResponse.json(
        { error: "기록 삭제에 실패했습니다." },
        { status: 500 }
      );
    }
  }

  try {
    const journalRef = adminDb.doc(`users/${uid}/journals/${dateKey}`);
    const entriesSnap = await journalRef.collection("entries").get();

    const batch = adminDb.batch();
    entriesSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(journalRef);
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Journal] 삭제 실패:", error);
    return NextResponse.json(
      { error: "일기 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
