import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export const STORAGE_CHECKINS = "checkin-records";

export type CheckInRecord = {
  id: string;
  date: string; // ISO string
  mood?: string; // 心情（可選）
  note?: string; // 備註（可選）
};

export function loadCheckInsLocal(): CheckInRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_CHECKINS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCheckInsLocal(checkIns: CheckInRecord[]) {
  try {
    localStorage.setItem(STORAGE_CHECKINS, JSON.stringify(checkIns));
  } catch (_) {}
}

const FIRESTORE_CHECKIN_COLLECTION = "checkins";

export async function loadCheckInsFirestore(uid: string): Promise<CheckInRecord[]> {
  if (!db || typeof window === "undefined") return [];
  try {
    const col = collection(db, "users", uid, FIRESTORE_CHECKIN_COLLECTION);
    const q = query(col, orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CheckInRecord);
  } catch (err) {
    console.error("載入 Firestore 簽到記錄失敗", err);
    throw err;
  }
}

export async function saveCheckInsFirestore(
  uid: string,
  checkIns: CheckInRecord[]
): Promise<void> {
  if (!db || typeof window === "undefined") return;
  try {
    const userCol = collection(db, "users", uid, FIRESTORE_CHECKIN_COLLECTION);
    for (const checkIn of checkIns) {
      const docRef = doc(userCol, checkIn.id);
      await setDoc(docRef, checkIn);
    }
    // Remove docs that are no longer in checkIns
    const snap = await getDocs(userCol);
    const ids = new Set(checkIns.map((c) => c.id));
    for (const d of snap.docs) {
      if (!ids.has(d.id)) await deleteDoc(d.ref);
    }
    console.log(`已將 ${checkIns.length} 筆簽到記錄同步至 Firestore`);
  } catch (err: any) {
    console.error("saveCheckInsFirestore 失敗", err);
    if (err?.code === 'permission-denied') {
      console.error("Firestore 權限被拒絕！請確認：\n1. 已登入 Google 帳號\n2. Firestore 規則已正確設定（firestore.rules）");
    }
    throw err;
  }
}

/**
 * 合併雲端與本機簽到記錄（以日期為 key，同一天只保留一筆，優先保留內容較完整或較新的）
 */
export function mergeCheckIns(
  cloud: CheckInRecord[],
  local: CheckInRecord[]
): CheckInRecord[] {
  const byDate = new Map<string, CheckInRecord>();
  for (const c of cloud) {
    const key = getDateKey(new Date(c.date));
    byDate.set(key, c);
  }
  for (const c of local) {
    const key = getDateKey(new Date(c.date));
    const existing = byDate.get(key);
    if (!existing) {
      byDate.set(key, c);
    } else {
      const existingLen = (existing.mood || "").length + (existing.note || "").length;
      const localLen = (c.mood || "").length + (c.note || "").length;
      const localNewer = new Date(c.date).getTime() > new Date(existing.date).getTime();
      if (localLen > existingLen || (localNewer && localLen >= existingLen)) {
        byDate.set(key, c);
      }
    }
  }
  return Array.from(byDate.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/** 依登入狀態載入簽到記錄（已登入時會合併雲端與本機，確保多裝置同步） */
export async function loadCheckIns(uid?: string | null): Promise<CheckInRecord[]> {
  const local = loadCheckInsLocal();
  if (uid && db) {
    try {
      const cloud = await loadCheckInsFirestore(uid);
      const merged = mergeCheckIns(cloud, local);
      if (merged.length > 0) {
        saveCheckInsLocal(merged);
      }
      console.log(`簽到記錄已同步：雲端 ${cloud.length} 筆，本機 ${local.length} 筆，合併後 ${merged.length} 筆`);
      return merged;
    } catch (err: any) {
      console.error("載入 Firestore 失敗，改用本機記錄", err);
      if (err?.code === "permission-denied") {
        console.warn("Firestore 權限被拒絕，請檢查 Firestore 規則是否已設定");
      }
      return local;
    }
  }
  return local;
}

/**
 * 依登入狀態儲存簽到記錄。
 * 已登入時會先拉取雲端最新資料再合併後寫回，避免手機/電腦互相覆蓋。
 * @returns 合併後的完整列表（已登入時），供畫面更新用
 */
export async function saveCheckIns(
  checkIns: CheckInRecord[],
  uid?: string | null
): Promise<CheckInRecord[]> {
  saveCheckInsLocal(checkIns);
  if (uid && db) {
    try {
      const cloud = await loadCheckInsFirestore(uid);
      const merged = mergeCheckIns(cloud, checkIns);
      await saveCheckInsFirestore(uid, merged);
      saveCheckInsLocal(merged);
      console.log(`簽到已寫入並同步：雲端 ${cloud.length} 筆 + 本機 → 合併 ${merged.length} 筆`);
      return merged;
    } catch (err) {
      console.error("雲端同步失敗，已儲存至本機", err);
    }
  }
  return checkIns;
}

export function isTodayCheckIn(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function formatCheckInDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCheckInForDate(checkIns: CheckInRecord[], date: Date = new Date()): CheckInRecord | null {
  const dateKey = getDateKey(date);
  return checkIns.find((c) => {
    const checkInDate = new Date(c.date);
    return getDateKey(checkInDate) === dateKey;
  }) || null;
}
