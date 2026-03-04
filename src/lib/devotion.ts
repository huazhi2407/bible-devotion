import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

export const STORAGE_RECORDS = "devotion-records";

export type ScriptureVersion = {
  reference: string;
  text: string;
};

/** 單一經文內的一段畫線（字元起訖） */
export type ScriptureHighlight = { start: number; end: number };

/** 每段經文（依索引）的畫線列表，key 為 scripture 陣列索引字串 "0","1",... */
export type HighlightsPerScripture = Record<string, ScriptureHighlight[]>;

/** 合併重疊的畫線區間並排序 */
export function mergeHighlights(ranges: ScriptureHighlight[]): ScriptureHighlight[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: ScriptureHighlight[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      out.push(sorted[i]);
    }
  }
  return out;
}

/** 將經文依畫線切成區段，用於渲染 */
export function segmentText(
  text: string,
  highlights: ScriptureHighlight[]
): { text: string; highlight: boolean }[] {
  const merged = mergeHighlights(highlights);
  if (merged.length === 0) return [{ text, highlight: false }];
  const out: { text: string; highlight: boolean }[] = [];
  let pos = 0;
  for (const r of merged) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start), highlight: false });
    out.push({ text: text.slice(r.start, r.end), highlight: true });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), highlight: false });
  return out;
}

/** 每個畫線經句的默想內容，key 為 snippetId（例如 "0-0-10"） */
export type MeditationBySnippet = Record<string, string>;

export type DevotionRecord = {
  id: string;
  date: string;
  scripture: ScriptureVersion | ScriptureVersion[]; // 支持單一或數組，向後兼容
  /** 經文畫線：依 scripture 索引儲存 */
  highlightsPerScripture?: HighlightsPerScripture;
  /** 每個畫線標籤對應的默想文字 */
  meditationBySnippet?: MeditationBySnippet;
  observation: string;
  application: string;
  prayerText: string;
};

export function loadRecordsLocal(): DevotionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_RECORDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecordsLocal(records: DevotionRecord[]) {
  try {
    localStorage.setItem(STORAGE_RECORDS, JSON.stringify(records));
  } catch (_) {}
}

const FIRESTORE_COLLECTION = "records";

export async function loadRecordsFirestore(uid: string): Promise<DevotionRecord[]> {
  if (!db || typeof window === "undefined") return [];
  try {
    const col = collection(db, "users", uid, FIRESTORE_COLLECTION);
    const q = query(col, orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as DevotionRecord);
  } catch (err) {
    console.error("載入 Firestore 記錄失敗", err);
    throw err; // 重新拋出錯誤，讓上層知道失敗了
  }
}

export async function saveRecordsFirestore(
  uid: string,
  records: DevotionRecord[]
): Promise<void> {
  if (!db || typeof window === "undefined") return;
  try {
    const userCol = collection(db, "users", uid, FIRESTORE_COLLECTION);
    // Firestore doesn't support batch overwrite of collection - we store each record as doc
    for (const rec of records) {
      const docRef = doc(userCol, rec.id);
      await setDoc(docRef, rec);
    }
    // Remove docs that are no longer in records
    const snap = await getDocs(userCol);
    const ids = new Set(records.map((r) => r.id));
    for (const d of snap.docs) {
      if (!ids.has(d.id)) await deleteDoc(d.ref);
    }
    console.log(`已將 ${records.length} 筆記錄同步至 Firestore`);
  } catch (err: any) {
    console.error("saveRecordsFirestore 失敗", err);
    if (err?.code === 'permission-denied') {
      console.error("Firestore 權限被拒絕！請確認：\n1. 已登入 Google 帳號\n2. Firestore 規則已正確設定（firestore.rules）");
    }
    throw err;
  }
}

/** 將 scripture 標準化為數組格式（向後兼容） */
export function normalizeScriptures(scripture: ScriptureVersion | ScriptureVersion[]): ScriptureVersion[] {
  return Array.isArray(scripture) ? scripture : [scripture];
}

export function formatRecordDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRecordDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", {
    month: "short",
    day: "numeric",
  });
}

export function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** 依登入狀態載入記錄：uid 時從 Firestore，失敗則改用 localStorage */
export async function loadRecords(uid?: string | null): Promise<DevotionRecord[]> {
  if (uid && db) {
    try {
      const cloud = await loadRecordsFirestore(uid);
      // 登入時優先使用 Firestore，即使為空也使用（不回退到 localStorage）
      console.log(`從 Firestore 載入 ${cloud.length} 筆記錄`);
      return cloud;
    } catch (err: any) {
      console.error("載入 Firestore 失敗，改用本機記錄", err);
      // Firestore 錯誤時（例如規則未設定），改用本機
      if (err?.code === 'permission-denied') {
        console.warn("Firestore 權限被拒絕，請檢查 Firestore 規則是否已設定");
      }
      return loadRecordsLocal();
    }
  }
  return loadRecordsLocal();
}

/** 依登入狀態儲存記錄：一律寫入 localStorage，登入時再同步至 Firestore */
export async function saveRecords(
  records: DevotionRecord[],
  uid?: string | null
): Promise<void> {
  saveRecordsLocal(records); // 永遠先存本機，避免遺失
  if (uid && db) {
    try {
      await saveRecordsFirestore(uid, records);
    } catch (err) {
      console.error("雲端同步失敗，已儲存至本機", err);
    }
  }
}
