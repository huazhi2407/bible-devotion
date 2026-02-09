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
      // Safari 和大部分瀏覽器都優先使用 popup（避免 sessionStorage 問題）
      // 只有當 popup 被明確阻擋時才改用 redirect
      try {
        await signInWithPopup(auth, googleProvider);
        setLoading(false);
      } catch (popupError: any) {
        // Popup 被阻擋時，改用 redirect（但 Safari 可能仍有 sessionStorage 問題）
        if (popupError.code === 'auth/popup-blocked') {
          console.warn("彈出視窗被阻擋，改用重新導向。若在 Safari 上失敗，請允許彈出視窗。");
          await signInWithRedirect(auth, googleProvider);
          // redirect 不會立即返回，所以不設定 loading=false
        } else if (popupError.code === 'auth/popup-closed-by-user') {
          // 用戶關閉彈出視窗，不視為錯誤
          setLoading(false);
        } else {
          throw popupError;
        }
      }
    } catch (err) {
      console.error("登入失敗", err);
      setLoading(false);
      alert("登入失敗。若使用 Safari，請允許彈出視窗，或嘗試使用 Chrome 瀏覽器。");
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
