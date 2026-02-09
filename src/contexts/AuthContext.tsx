"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseReady } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isReady: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(isFirebaseReady());
    if (!auth) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const result = await getRedirectResult(auth!);
        if (result?.user) setUser(result.user);
      } catch (err) {
        console.error("redirect result", err);
      } finally {
        setLoading(false);
      }
    })();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      // 手機瀏覽器也嘗試使用 popup，若失敗再改用 redirect
      try {
        await signInWithPopup(auth, googleProvider);
        setLoading(false);
      } catch (popupError: any) {
        // Popup 被阻擋或失敗時，改用 redirect
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, googleProvider);
          // redirect 不會立即返回，所以不設定 loading=false
        } else {
          throw popupError;
        }
      }
    } catch (err) {
      console.error("登入失敗", err);
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signOut, isReady }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
