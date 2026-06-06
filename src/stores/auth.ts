// ============================================================
// 인증 상태 스토어 (Zustand) — SSR 안전
// ============================================================

import { create } from "zustand";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  fetchProfile: (uid: string) => Promise<void>;
  initializeAuthListener: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (uid: string) => {
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/client");
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        set({ profile: { uid, ...docSnap.data() } as UserProfile });
      } else {
        set({ profile: null });
      }
    } catch (error) {
      console.error("프로필 로드 실패:", error);
      set({ profile: null });
    }
  },

  initializeAuthListener: () => {
    if (get().initialized) return;

    import("firebase/auth").then(({ onAuthStateChanged }) => {
      import("@/lib/firebase/client").then(({ auth }) => {
        onAuthStateChanged(auth, async (user) => {
          set({ user });
          if (user) {
            await get().fetchProfile(user.uid);
          } else {
            set({ profile: null });
          }
          set({ loading: false, initialized: true });
        });
      });
    });
  },
}));
