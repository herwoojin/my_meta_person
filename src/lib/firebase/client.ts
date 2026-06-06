// ============================================================
// Firebase 클라이언트 SDK 초기화 — Lazy
// ============================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  type FirebaseStorage,
} from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _emulatorConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

function connectEmulators() {
  if (_emulatorConnected) return;
  if (process.env.NEXT_PUBLIC_USE_EMULATOR !== "1") return;
  _emulatorConnected = true;

  try {
    if (_auth) connectAuthEmulator(_auth, "http://localhost:9099", { disableWarnings: true });
    if (_db) connectFirestoreEmulator(_db, "localhost", 8080);
    if (_storage) connectStorageEmulator(_storage, "localhost", 9199);
  } catch {
    // 이미 연결된 경우 무시
  }
}

export function getClientAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());
  connectEmulators();
  return _auth;
}

export function getClientDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getFirebaseApp());
  connectEmulators();
  return _db;
}

export function getClientStorage(): FirebaseStorage {
  if (_storage) return _storage;
  _storage = getStorage(getFirebaseApp());
  connectEmulators();
  return _storage;
}

// 하위 호환 — 기존 import { auth, db } 코드 지원
// 클라이언트 전용이므로 typeof window 체크
export const auth: Auth = typeof window !== "undefined"
  ? getClientAuth()
  : ({} as Auth);

export const db: Firestore = typeof window !== "undefined"
  ? getClientDb()
  : ({} as Firestore);

export const storage: FirebaseStorage = typeof window !== "undefined"
  ? getClientStorage()
  : ({} as FirebaseStorage);
