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
      // 優先使用 popup（避免 Safari sessionStorage 問題）
      try {
        await signInWithPopup(auth, googleProvider);
        setLoading(false);
      } catch (popupError: any) {
        // Popup 被阻擋時，改用 redirect
        if (popupError.code === 'auth/popup-blocked') {
          const useRedirect = confirm(
            "瀏覽器阻擋了彈出視窗。\n\n" +
            "選項 1：點「確定」使用重新導向登入（會跳轉到新頁面）\n" +
            "選項 2：點「取消」，然後在瀏覽器設定中允許此網站的彈出視窗後重試"
          );
          if (useRedirect) {
            await signInWithRedirect(auth, googleProvider);
            // redirect 不會立即返回，所以不設定 loading=false
          } else {
            setLoading(false);
          }
        } else if (popupError.code === 'auth/popup-closed-by-user') {
          // 用戶關閉彈出視窗，不視為錯誤
          setLoading(false);
        } else {
          throw popupError;
        }
      }
    } catch (err: any) {
      console.error("登入失敗", err);
      setLoading(false);
      const errorMsg = err?.code === 'auth/popup-blocked' 
        ? "請允許瀏覽器的彈出視窗，然後重試登入。"
        : err?.message || "登入失敗，請重試。";
      alert(errorMsg);
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
