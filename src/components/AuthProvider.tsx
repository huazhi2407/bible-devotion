"use client";

import { AuthProvider as FirebaseAuthProvider } from "@/contexts/AuthContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
}
