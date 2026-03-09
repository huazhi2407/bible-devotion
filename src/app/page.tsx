"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadRecords, saveRecords, formatRecordDate, normalizeScriptures, type DevotionRecord, type ScriptureVersion, type HighlightsPerScripture, type ScriptureHighlight } from "@/lib/devotion";
import { useAuth } from "@/contexts/AuthContext";

/** 四階段：讀經 → 默想 → 禱告 → 默觀（可自由切換） */
type Phase =
  | "idle"
  | "scripture"
  | "meditation"
  | "prayer-write"
  | "contemplation";

const STAGES: { id: Phase; label: string }[] = [
  { id: "scripture", label: "讀經" },
  { id: "meditation", label: "默想" },
  { id: "prayer-write", label: "禱告" },
  { id: "contemplation", label: "默觀" },
];

const MUSIC_OPTIONS = [
  { id: "V7Bohz21qq4", label: "音樂 1", url: "https://youtu.be/V7Bohz21qq4" },
  { id: "QcunXPt6ZzM", label: "音樂 2", url: "https://youtu.be/QcunXPt6ZzM" },
  { id: "G43H8uk633A", label: "音樂 3", url: "https://youtu.be/G43H8uk633A" },
  { id: "WmgrMH2ltD4", label: "音樂 4", url: "https://youtu.be/WmgrMH2ltD4" },
  { id: "5XELCMPGo_c", label: "音樂 5", url: "https://youtu.be/5XELCMPGo_c" },
];

const DEFAULT_MUSIC_ID = MUSIC_OPTIONS[0].id;

const DEFAULT_SCRIPTURE: ScriptureVersion = {
  reference: "詩篇 46:10",
  text: "你們要休息，要知道我是神；我必在外邦中被尊崇，在遍地上也被尊崇。",
};

const FONT_OPTIONS: { id: string; label: string; value: string }[] = [
  { id: "serif", label: "襯線（預設）", value: "Georgia, Cambria, \"Times New Roman\", serif" },
  { id: "sans", label: "黑體", value: "\"Microsoft JhengHei\", \"PingFang TC\", \"Helvetica Neue\", sans-serif" },
  { id: "ming", label: "明體", value: "\"PMingLiU\", \"MingLiU\", \"Noto Serif TC\", serif" },
];

const FONT_SIZE_OPTIONS: { id: string; label: string; value: string }[] = [
  { id: "small", label: "小", value: "14px" },
  { id: "medium", label: "中", value: "16px" },
  { id: "large", label: "大", value: "18px" },
];

const SCRIPTURE_SIZE_OPTIONS: { id: string; label: string; className: string }[] = [
  { id: "small", label: "小", className: "text-lg" },
  { id: "medium", label: "中", className: "text-xl md:text-2xl" },
  { id: "large", label: "大", className: "text-2xl md:text-3xl" },
  { id: "xlarge", label: "特大", className: "text-3xl md:text-4xl" },
];

const STORAGE_FONT = "devotion-font";
const STORAGE_FONT_SIZE = "devotion-font-size";
const STORAGE_SCRIPTURE_SIZE = "devotion-scripture-size";
const STORAGE_MUSIC_ID = "devotion-music-id";

declare global {
  interface Window {
    YT: {
      ready: (fn: () => void) => void;
      Player: new (
        element: string | HTMLElement,
        options: { videoId: string; playerVars?: Record<string, number | string> }
      ) => {
        playVideo: () => void;
        pauseVideo: () => void;
        destroy: () => void;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function useYouTubeBackgroundMusic(isPlaying: boolean, videoId: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<{
    playVideo: () => void;
    pauseVideo: () => void;
    destroy: () => void;
  } | null>(null);
  const isMobile = typeof window !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isPlaying || typeof window === "undefined") {
      // 停止播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.destroy?.();
        playerRef.current = null;
      }
      return;
    }

    // 手機瀏覽器：使用 YouTube 嵌入 iframe（簡化版，不依賴 API）
    if (isMobile) {
      if (!containerRef.current) return;
      // 手機上直接嵌入 YouTube iframe，讓用戶可以手動播放
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&mute=0&enablejsapi=1`;
      iframe.allow = "autoplay; encrypted-media";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(iframe);
      
      return () => {
        if (containerRef.current) containerRef.current.innerHTML = "";
      };
    }

    // 桌面瀏覽器：使用 YouTube iframe API
    const loadScript = () => {
      if (window.YT?.ready) {
        window.YT.ready(initPlayer);
        return;
      }
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScript = document.getElementsByTagName("script")[0];
      firstScript?.parentNode?.insertBefore(tag, firstScript);
      window.onYouTubeIframeAPIReady = () => window.YT.ready(initPlayer);
    };

    const initPlayer = () => {
      if (!containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
          showinfo: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
        },
      });
    };

    loadScript();
    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [isPlaying, isMobile, videoId]);

  return containerRef;
}

/** 合併重疊的畫線區間並排序 */
function mergeHighlights(ranges: ScriptureHighlight[]): ScriptureHighlight[] {
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
function segmentText(text: string, highlights: ScriptureHighlight[]): { text: string; highlight: boolean }[] {
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

/** 畫線經句（含穩定 id，供標籤與默想欄對應） */
type HighlightedSnippet = { id: string; reference: string; text: string };

/** 從經文與畫線資料取出所有「畫線經句」，供默想頁當標籤顯示 */
function getHighlightedSnippets(
  scriptures: ScriptureVersion[],
  highlightsPerScripture: HighlightsPerScripture
): HighlightedSnippet[] {
  const out: HighlightedSnippet[] = [];
  scriptures.forEach((scripture, index) => {
    const highlights = highlightsPerScripture[String(index)] ?? [];
    const merged = mergeHighlights(highlights);
    for (const r of merged) {
      const text = scripture.text.slice(r.start, r.end).trim();
      if (text) out.push({ id: `${index}-${r.start}-${r.end}`, reference: scripture.reference || `版本 ${index + 1}`, text });
    }
  });
  return out;
}

/** 可畫線的經文區塊（選取後加入畫線） */
function HighlightableScripture({
  scriptureIndex,
  text,
  highlights,
  scriptureSizeClass,
  onAddHighlight,
  onRemoveHighlight,
}: {
  scriptureIndex: number;
  text: string;
  highlights: ScriptureHighlight[];
  scriptureSizeClass: string;
  onAddHighlight: (index: number, start: number, end: number) => void;
  onRemoveHighlight: (index: number, start: number, end: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAddBtn, setShowAddBtn] = useState(false);
  const [pendingRange, setPendingRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<ScriptureHighlight | null>(null);

  const updatePendingFromSelection = useCallback(() => {
    const sel = window.getSelection();
    const node = containerRef.current;
    if (!sel || !node) return;

    // 手機點擊「加入畫線」時選取可能會先被清掉；若已經有 pendingRange 就先保留
    if (sel.isCollapsed || sel.rangeCount === 0) {
      if (!pendingRange) {
        setShowAddBtn(false);
        setPendingRange(null);
      }
      return;
    }

    const userRange = sel.getRangeAt(0);
    if (!node.contains(userRange.startContainer) || !node.contains(userRange.endContainer)) {
      setShowAddBtn(false);
      return;
    }
    try {
      const startRange = document.createRange();
      startRange.selectNodeContents(node);
      startRange.setEnd(userRange.startContainer, userRange.startOffset);
      const start = startRange.toString().length;

      const endRange = document.createRange();
      endRange.selectNodeContents(node);
      endRange.setEnd(userRange.endContainer, userRange.endOffset);
      const end = endRange.toString().length;

      const startOff = Math.min(start, end);
      const endOff = Math.max(start, end);
      if (startOff >= endOff) return;
      setPendingRange({ start: startOff, end: endOff });
      setShowAddBtn(true);
    } catch {
      // ignore
    }
  }, [pendingRange]);

  const onPointerUp = useCallback(() => {
    updatePendingFromSelection();
  }, [updatePendingFromSelection]);

  useEffect(() => {
    const handler = () => updatePendingFromSelection();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [updatePendingFromSelection]);

  useEffect(() => {
    if (!selectedHighlight) return;
    const merged = mergeHighlights(highlights);
    const stillExists = merged.some(
      (h) => h.start === selectedHighlight.start && h.end === selectedHighlight.end
    );
    if (!stillExists) setSelectedHighlight(null);
  }, [highlights, selectedHighlight]);

  const addHighlight = useCallback(() => {
    if (pendingRange) {
      onAddHighlight(scriptureIndex, pendingRange.start, pendingRange.end);
      setPendingRange(null);
      setShowAddBtn(false);
      window.getSelection()?.removeAllRanges();
    }
  }, [scriptureIndex, pendingRange, onAddHighlight]);

  const mergedHighlights = mergeHighlights(highlights);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  mergedHighlights.forEach((h, idx) => {
    if (h.start > pos) {
      parts.push(<span key={`t-${idx}`}>{text.slice(pos, h.start)}</span>);
    }
    const isSelected = selectedHighlight?.start === h.start && selectedHighlight?.end === h.end;
    parts.push(
      <button
        key={`h-${idx}`}
        type="button"
        onClick={() => setSelectedHighlight(h)}
        className="inline p-0 m-0 bg-transparent border-0"
        title="點擊可刪除這段畫線"
      >
        <mark
          className={`rounded px-0.5 ${
            isSelected
              ? "bg-amber-300/90 dark:bg-amber-500/40 ring-2 ring-amber-400/60 dark:ring-amber-400/40"
              : "bg-amber-200/80 dark:bg-amber-600/30"
          }`}
        >
          {text.slice(h.start, h.end)}
        </mark>
      </button>
    );
    pos = h.end;
  });
  if (pos < text.length) parts.push(<span key="t-end">{text.slice(pos)}</span>);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onMouseUp={onPointerUp}
        onTouchEnd={onPointerUp}
        onPointerUp={onPointerUp}
        className={`${scriptureSizeClass} leading-relaxed text-[var(--text-soft)] font-normal select-text cursor-text`}
        style={{ userSelect: "text" }}
      >
        {mergedHighlights.length ? parts : text}
      </div>
      {selectedHighlight && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onRemoveHighlight(scriptureIndex, selectedHighlight.start, selectedHighlight.end);
              setSelectedHighlight(null);
            }}
            className="px-3 py-1.5 rounded-sm border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            刪除畫線
          </button>
          <button
            type="button"
            onClick={() => setSelectedHighlight(null)}
            className="px-3 py-1.5 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] text-[var(--text-soft)] text-sm hover:bg-[var(--bg-softer)]/70 transition-colors"
          >
            取消
          </button>
        </div>
      )}
      {showAddBtn && pendingRange && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            addHighlight();
          }}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => {
            e.preventDefault();
            addHighlight();
          }}
          onClick={addHighlight}
          className="mt-2 px-3 py-1.5 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] text-[var(--text-soft)] text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          加入畫線
        </button>
      )}
    </div>
  );
}

export default function DevotionPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [todayScriptures, setTodayScriptures] = useState<ScriptureVersion[]>([DEFAULT_SCRIPTURE]);
  const [highlightsPerScripture, setHighlightsPerScripture] = useState<HighlightsPerScripture>({});
  const [meditationBySnippet, setMeditationBySnippet] = useState<Record<string, string>>({});
  const [expandedSnippetIds, setExpandedSnippetIds] = useState<string[]>([]);
  const [observation, setObservation] = useState("");
  const [application, setApplication] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [fontFamily, setFontFamily] = useState("serif");
  const [fontSize, setFontSize] = useState("medium");
  const [scriptureSize, setScriptureSize] = useState("medium");
  const [musicId, setMusicId] = useState(DEFAULT_MUSIC_ID);
  const [panelOpen, setPanelOpen] = useState(false);
  const [records, setRecords] = useState<DevotionRecord[]>([]);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle, signOut, isReady } = useAuth();
  const musicPlaying = phase !== "idle";
  const youtubeContainerRef = useYouTubeBackgroundMusic(musicPlaying, musicId);

  useEffect(() => {
    try {
      const storedFont = localStorage.getItem(STORAGE_FONT);
      const storedSize = localStorage.getItem(STORAGE_FONT_SIZE);
      const storedScriptureSize = localStorage.getItem(STORAGE_SCRIPTURE_SIZE);
      const storedMusicId = localStorage.getItem(STORAGE_MUSIC_ID);
      if (storedFont) setFontFamily(storedFont);
      if (storedSize) setFontSize(storedSize);
      if (storedScriptureSize) setScriptureSize(storedScriptureSize);
      if (storedMusicId && MUSIC_OPTIONS.some(m => m.id === storedMusicId)) {
        setMusicId(storedMusicId);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (authLoading) return;
    loadRecords(user?.uid ?? null).then(setRecords);
  }, [user?.uid, authLoading]);

  const saveCurrentDevotion = useCallback(async () => {
    const record: DevotionRecord = {
      id: `devotion-${Date.now()}`,
      date: new Date().toISOString(),
      scripture: todayScriptures.length === 1 ? todayScriptures[0] : todayScriptures,
      highlightsPerScripture: Object.keys(highlightsPerScripture).length ? highlightsPerScripture : undefined,
      meditationBySnippet: Object.keys(meditationBySnippet).length ? meditationBySnippet : undefined,
      observation,
      application,
      prayerText,
    };
    const next = [record, ...records];
    setRecords(next);
    try {
      await saveRecords(next, user?.uid ?? null);
    } catch (err) {
      console.error("儲存失敗", err);
    } finally {
      setPhase("idle");
      setTodayScriptures([DEFAULT_SCRIPTURE]);
      setHighlightsPerScripture({});
      setMeditationBySnippet({});
      setExpandedSnippetIds([]);
      setObservation("");
      setApplication("");
      setPrayerText("");
      router.push("/records");
    }
  }, [todayScriptures, highlightsPerScripture, meditationBySnippet, observation, application, prayerText, records, user?.uid, router]);

  const deleteRecord = useCallback(async (id: string) => {
    if (!confirm("確定要刪除此靈修記錄嗎？")) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await saveRecords(next, user?.uid ?? null);
    if (expandedRecordId === id) setExpandedRecordId(null);
  }, [records, expandedRecordId, user?.uid]);

  useEffect(() => {
    const font = FONT_OPTIONS.find((f) => f.id === fontFamily) ?? FONT_OPTIONS[0];
    const size = FONT_SIZE_OPTIONS.find((s) => s.id === fontSize) ?? FONT_SIZE_OPTIONS[1];
    document.body.style.fontFamily = font.value;
    document.documentElement.style.fontSize = size.value;
  }, [fontFamily, fontSize]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FONT, fontFamily);
      localStorage.setItem(STORAGE_FONT_SIZE, fontSize);
      localStorage.setItem(STORAGE_SCRIPTURE_SIZE, scriptureSize);
      localStorage.setItem(STORAGE_MUSIC_ID, musicId);
    } catch (_) {}
  }, [fontFamily, fontSize, scriptureSize, musicId]);

  const scriptureSizeClass =
    SCRIPTURE_SIZE_OPTIONS.find((s) => s.id === scriptureSize)?.className ??
    "text-xl md:text-2xl";

  const startDevotion = useCallback(() => {
    setPhase("scripture");
  }, []);

  const addHighlight = useCallback((scriptureIndex: number, start: number, end: number) => {
    setHighlightsPerScripture((prev) => {
      const key = String(scriptureIndex);
      const list = [...(prev[key] ?? []), { start, end }];
      return { ...prev, [key]: mergeHighlights(list) };
    });
  }, []);

  const removeHighlight = useCallback((scriptureIndex: number, start: number, end: number) => {
    const key = String(scriptureIndex);
    setHighlightsPerScripture((prev) => {
      const list = prev[key] ?? [];
      const nextList = list.filter((h) => !(h.start === start && h.end === end));
      const next: HighlightsPerScripture = { ...prev };
      if (nextList.length) next[key] = nextList;
      else delete next[key];
      return next;
    });
    const snippetId = `${scriptureIndex}-${start}-${end}`;
    setMeditationBySnippet((prev) => {
      if (!(snippetId in prev)) return prev;
      const { [snippetId]: _removed, ...rest } = prev;
      return rest;
    });
    setExpandedSnippetIds((prev) => prev.filter((id) => id !== snippetId));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative">
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="fixed top-4 right-4 z-10 px-3 py-2 rounded-sm border border-[var(--border-soft)] text-[var(--text-quiet)] text-sm hover:bg-[var(--bg-softer)] transition-colors"
        aria-label="開啟設定與記錄"
      >
        設定與記錄
      </button>

      {/* 右側設定／記錄面板：常駐 DOM，僅用 CSS 控制顯示，避免 insertBefore/removeChild 錯誤 */}
      <div className="fixed inset-0 z-[15]" style={{ pointerEvents: panelOpen ? "auto" : "none" }} aria-hidden={!panelOpen}>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          className={`absolute inset-0 bg-black/20 transition-opacity ${panelOpen ? "opacity-100" : "opacity-0"}`}
          aria-label="關閉"
        />
        <div
          className={`fixed top-0 right-0 z-20 h-full w-full max-w-sm bg-[var(--bg-softer)] border-l border-[var(--border-soft)] shadow-lg transition-transform duration-300 ease-out flex flex-col ${
            panelOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-soft)]">
          <h2 className="text-lg font-normal text-[var(--text-soft)]">設定與記錄</h2>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="p-1.5 text-[var(--text-quiet)] hover:text-[var(--text-soft)] rounded-sm"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
            <h3 className="text-[var(--accent-subtle)] text-sm mb-3">帳戶</h3>
            {!isReady ? (
              <p className="text-[var(--text-quiet)] text-sm">
                若要使用 Google 登入與雲端同步，請在專案根目錄建立 .env.local 並填入 Firebase 變數，然後<strong>重新啟動 dev server</strong>（<code>npm run dev</code>）。
              </p>
            ) : user ? (
              <div>
                <p className="text-[var(--text-quiet)] text-sm truncate mb-2" title={user.email ?? undefined}>
                  {user.email}
                </p>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)] underline"
                >
                  登出
                </button>
                <p className="text-[var(--accent-subtle)] text-xs mt-2">已登入，靈修記錄會同步至雲端</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                disabled={authLoading}
                className="px-4 py-2 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] text-sm hover:bg-[var(--bg-softer)] disabled:opacity-60"
              >
                {authLoading ? "登入中…" : "以 Google 帳號登入"}
              </button>
            )}
          </section>
          <section>
            <h3 className="text-[var(--accent-subtle)] text-sm mb-3">顯示設定</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-quiet)] text-sm">字體</span>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-quiet)] text-sm">字級</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
                >
                  {FONT_SIZE_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-quiet)] text-sm">經文字級</span>
                <select
                  value={scriptureSize}
                  onChange={(e) => setScriptureSize(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
                >
                  {SCRIPTURE_SIZE_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-quiet)] text-sm">背景音樂</span>
                <select
                  value={musicId}
                  onChange={(e) => setMusicId(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
                >
                  {MUSIC_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section>
            <h3 className="text-[var(--accent-subtle)] text-sm mb-3">歷史記錄</h3>
            <Link
              href="/records"
              className="inline-block text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)] mb-3 underline"
            >
              查看全部記錄 →
            </Link>
            {records.length === 0 ? (
              <p className="text-[var(--text-quiet)] text-sm">尚無記錄。完成靈修後按「完成此次靈修」即可儲存。</p>
            ) : (
              <ul className="space-y-2">
                {records.map((rec) => (
                  <li key={rec.id} className="border border-[var(--border-soft)] rounded-sm overflow-hidden">
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => setExpandedRecordId(expandedRecordId === rec.id ? null : rec.id)}
                        className="flex-1 text-left px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--border-soft)] transition-colors min-w-0"
                      >
                        <span className="text-[var(--accent-subtle)] block text-xs">{formatRecordDate(rec.date)}</span>
                        <span className="font-medium">{normalizeScriptures(rec.scripture).map((s, i) => s.reference || `版本 ${i + 1}`).join(" / ")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecord(rec.id)}
                        className="px-2 py-2 text-[var(--accent-subtle)] hover:text-red-600 hover:bg-red-50 text-xs shrink-0"
                        title="刪除"
                      >
                        刪除
                      </button>
                    </div>
                    {expandedRecordId === rec.id && (
                      <div className="px-3 py-2 pt-0 border-t border-[var(--border-soft)] bg-white/50 text-sm text-[var(--text-quiet)] space-y-3 max-h-80 overflow-y-auto whitespace-pre-wrap">
                        {normalizeScriptures(rec.scripture).map((scripture, index) => {
                          const highlights = rec.highlightsPerScripture?.[String(index)] ?? [];
                          const segments = segmentText(scripture.text, highlights);
                          return (
                            <div key={index} className={index > 0 ? "pt-3 border-t border-[var(--border-soft)]" : ""}>
                              <p className="text-[var(--accent-subtle)] text-xs mb-1">
                                {normalizeScriptures(rec.scripture).length > 1 ? `版本 ${index + 1}` : "經文"}
                              </p>
                              <p className="text-[var(--text-soft)] font-medium text-sm mb-1">{scripture.reference || `版本 ${index + 1}`}</p>
                              <p className="text-[var(--text-soft)]">
                                {segments.map((seg, i) =>
                                  seg.highlight ? (
                                    <mark key={i} className="bg-amber-200/80 dark:bg-amber-600/30 rounded px-0.5">{seg.text}</mark>
                                  ) : (
                                    <span key={i}>{seg.text}</span>
                                  )
                                )}
                              </p>
                            </div>
                          );
                        })}
                        {rec.observation && <p><span className="text-[var(--accent-subtle)]">觀察：</span>{rec.observation}</p>}
                        {rec.meditationBySnippet && Object.entries(rec.meditationBySnippet).map(([id, text]) => text && <p key={id}><span className="text-[var(--accent-subtle)]">默想：</span>{text}</p>)}
                        {rec.application && <p><span className="text-[var(--accent-subtle)]">應用：</span>{rec.application}</p>}
                        {rec.prayerText && <p><span className="text-[var(--accent-subtle)]">禱告：</span>{rec.prayerText}</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        </div>
      </div>

      {/* 靈修背景音樂：YouTube 嵌入，常駐 DOM 避免 removeChild 錯誤 */}
      <div
        ref={youtubeContainerRef}
        className="fixed -bottom-[9999px] left-0 w-[320px] h-[180px] overflow-hidden opacity-0 pointer-events-none"
        style={{ display: musicPlaying ? "block" : "none" }}
        aria-hidden
      />
      {phase === "idle" && (
        <section className="max-w-lg w-full animate-fade-in">
          <h1 className="text-2xl font-normal text-[var(--text-soft)] mb-2 tracking-wide text-center">
            靈修
          </h1>
          <p className="text-center mb-6 space-x-4">
            <Link
              href="/records"
              className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)] underline"
            >
              查看靈修記錄
            </Link>
            <Link
              href="/checkin"
              className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)] underline"
            >
              每日簽到
            </Link>
          </p>
          <p className="text-[var(--accent-subtle)] text-sm mb-3">
            從任何聖經 app、網站或實體聖經複製經文，貼到下方即可。可以添加多個版本進行對照。
          </p>
          <div className="mb-4 space-y-4">
            {todayScriptures.map((scripture, index) => (
              <div key={index} className="space-y-2 p-3 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[var(--accent-subtle)] text-xs">版本 {index + 1}</span>
                  {todayScriptures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTodayScriptures((prev) => prev.filter((_, i) => i !== index));
                      }}
                      className="text-xs text-[var(--accent-subtle)] hover:text-red-600 underline"
                    >
                      刪除此版本
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={scripture.reference}
                  onChange={(e) => {
                    const updated = [...todayScriptures];
                    updated[index] = { ...updated[index], reference: e.target.value };
                    setTodayScriptures(updated);
                  }}
                  placeholder="經文出處（例如：詩篇 46:10）"
                  className="w-full px-3 py-2 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
                />
                <textarea
                  value={scripture.text}
                  onChange={(e) => {
                    const updated = [...todayScriptures];
                    updated[index] = { ...updated[index], text: e.target.value };
                    setTodayScriptures(updated);
                  }}
                  placeholder="經文內容（直接貼上從 YouVersion、Bible.com 等複製的經文）"
                  rows={5}
                  className={`w-full px-3 py-2 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)] ${scriptureSizeClass}`}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setTodayScriptures((prev) => [...prev, { reference: "", text: "" }]);
              }}
              className="w-full px-4 py-2 rounded-sm border border-dashed border-[var(--border-soft)] text-[var(--text-quiet)] text-sm hover:bg-[var(--bg-softer)] hover:text-[var(--text-soft)] transition-colors"
            >
              + 新增版本
            </button>
          </div>
          <div className="mb-4 p-3 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)]">
            <p className="text-[var(--accent-subtle)] text-xs mb-2">
              即將默想的經文
            </p>
            {todayScriptures.map((scripture, index) => (
              <div key={index} className={index > 0 ? "mt-3 pt-3 border-t border-[var(--border-soft)]" : ""}>
                <p className="text-[var(--text-soft)] font-medium text-sm">
                  {scripture.reference || "—"}
                </p>
                <p className={`text-[var(--text-quiet)] mt-1 line-clamp-2 ${scriptureSizeClass}`}>
                  {scripture.text || "請在上方貼上經文出處與內容。"}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[var(--text-quiet)] text-base mb-6 leading-relaxed text-center">
            先安靜片刻。準備好了再按開始。
          </p>
          <div className="text-center">
            <button
              onClick={startDevotion}
              className="px-8 py-3 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] hover:bg-[var(--bg-softer)] transition-colors duration-300 text-base font-normal"
            >
              開始今日靈修
            </button>
          </div>
        </section>
      )}

      {/* 四階段導覽：讀經、默想、禱告、默觀，可自由切換；內含設定按鈕 */}
      {phase !== "idle" && (
        <nav className="fixed top-0 left-0 right-0 z-10 flex flex-wrap items-center justify-center gap-1 p-3 bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--border-soft)]">
          {STAGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPhase(id)}
              className={`px-4 py-2 rounded-sm text-sm transition-colors ${
                phase === id
                  ? "bg-[var(--border-soft)] text-[var(--text-soft)]"
                  : "text-[var(--text-quiet)] hover:bg-[var(--bg-softer)] hover:text-[var(--text-soft)]"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="px-3 py-2 text-[var(--text-quiet)] text-sm hover:bg-[var(--bg-softer)] hover:text-[var(--text-soft)] rounded-sm"
            title="字體、字級、經文大小、背景音樂、歷史記錄"
          >
            設定
          </button>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="px-3 py-2 text-[var(--text-quiet)] text-sm hover:text-[var(--text-soft)]"
            title="返回開始"
          >
            結束
          </button>
        </nav>
      )}

      {phase === "scripture" && (
        <section className="max-w-2xl w-full animate-fade-in mt-14">
          <p className="text-[var(--accent-subtle)] text-sm mb-4">
            選取經文字句後按「加入畫線」，可到默想頁整理所思。也可以點擊已畫線的字句來刪除畫線。
          </p>
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6">
            {todayScriptures.map((scripture, index) => (
              <div key={index} className={index > 0 ? "pt-6 border-t border-[var(--border-soft)]" : ""}>
                <p className="text-[var(--accent-subtle)] text-sm mb-4">
                  {scripture.reference || `版本 ${index + 1}`}
                </p>
                <HighlightableScripture
                  scriptureIndex={index}
                  text={scripture.text}
                  highlights={highlightsPerScripture[String(index)] ?? []}
                  scriptureSizeClass={scriptureSizeClass}
                  onAddHighlight={addHighlight}
                  onRemoveHighlight={removeHighlight}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 經文側欄（含畫線）：用於默想、禱告 */}
      {phase === "meditation" && (
        <section className="w-full max-w-4xl flex gap-6 animate-fade-in mt-14">
          <aside className="shrink-0 w-48 lg:w-56 p-4 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] self-start sticky top-16 hidden md:block max-h-[70vh] overflow-y-auto">
            <p className="text-[var(--accent-subtle)] text-xs mb-2">今日經文</p>
            {todayScriptures.map((scripture, index) => (
              <div key={index} className={index > 0 ? "mt-4 pt-4 border-t border-[var(--border-soft)]" : ""}>
                <p className="text-[var(--text-soft)] font-medium text-sm">{scripture.reference || `版本 ${index + 1}`}</p>
                <div className="text-[var(--text-quiet)] text-sm mt-1 leading-relaxed">
                  {segmentText(scripture.text, highlightsPerScripture[String(index)] ?? []).map((seg, i) =>
                    seg.highlight ? (
                      <mark key={i} className="bg-amber-200/80 dark:bg-amber-600/30 rounded px-0.5">{seg.text}</mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )}
                </div>
              </div>
            ))}
          </aside>
          <div className="flex-1 min-w-0">
            <div className="md:hidden mb-4 p-3 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] max-h-40 overflow-y-auto">
              <p className="text-[var(--accent-subtle)] text-xs mb-2">今日經文</p>
              {todayScriptures.map((scripture, index) => (
                <div key={index} className={index > 0 ? "mt-3 pt-3 border-t border-[var(--border-soft)]" : ""}>
                  <p className="text-[var(--text-soft)] font-medium text-sm">{scripture.reference || `版本 ${index + 1}`}</p>
                  <div className="text-[var(--text-quiet)] text-sm mt-1 leading-relaxed">
                    {segmentText(scripture.text, highlightsPerScripture[String(index)] ?? []).map((seg, i) =>
                      seg.highlight ? (
                        <mark key={i} className="bg-amber-200/80 dark:bg-amber-600/30 rounded px-0.5">{seg.text}</mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[var(--accent-subtle)] text-sm mb-2">默想</p>
            {getHighlightedSnippets(todayScriptures, highlightsPerScripture).length > 0 && (
              <div className="mb-4 space-y-3">
                <p className="text-[var(--text-quiet)] text-xs">點擊標籤展開／收合默想欄</p>
                <div className="space-y-2">
                  {getHighlightedSnippets(todayScriptures, highlightsPerScripture).map((snippet) => {
                    const isExpanded = expandedSnippetIds.includes(snippet.id);
                    return (
                      <div
                        key={snippet.id}
                        className="rounded-lg border border-amber-200/80 dark:border-amber-700/50 overflow-hidden bg-amber-50/50 dark:bg-amber-900/20"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedSnippetIds((prev) => (prev.includes(snippet.id) ? prev.filter((id) => id !== snippet.id) : [...prev, snippet.id]))}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-amber-100/80 dark:hover:bg-amber-900/30 transition-colors"
                        >
                          <span className="text-amber-800 dark:text-amber-200 text-xs shrink-0 font-medium">{snippet.reference}</span>
                          <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-amber-50 text-sm">{snippet.text}</span>
                          <span className="text-amber-700 dark:text-amber-300 text-xs shrink-0" aria-hidden>
                            {isExpanded ? "▼ 收合" : "▶ 展開"}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-amber-200/80 dark:border-amber-700/50 p-3">
                            <textarea
                              value={meditationBySnippet[snippet.id] ?? ""}
                              onChange={(e) => setMeditationBySnippet((prev) => ({ ...prev, [snippet.id]: e.target.value }))}
                              placeholder="針對這段經句寫下默想……"
                              className="w-full min-h-[100px] p-3 bg-white dark:bg-black/20 border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-amber-600 placeholder:dark:text-amber-400 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
                              rows={4}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-[var(--text-quiet)] text-base mb-4">
              整理你對這段經文的想法與領受。
            </p>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="靜靜默想，寫下你注意到的、與生活的連結……"
              className="w-full min-h-[200px] p-4 bg-[var(--bg-softer)] border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
              rows={6}
            />
          </div>
        </section>
      )}

      {phase === "prayer-write" && (
        <section className="w-full max-w-4xl flex gap-6 animate-fade-in mt-14">
          <aside className="shrink-0 w-48 lg:w-56 p-4 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] self-start sticky top-16 hidden md:block max-h-[70vh] overflow-y-auto">
            <p className="text-[var(--accent-subtle)] text-xs mb-2">今日經文</p>
            {todayScriptures.map((scripture, index) => (
              <div key={index} className={index > 0 ? "mt-4 pt-4 border-t border-[var(--border-soft)]" : ""}>
                <p className="text-[var(--text-soft)] font-medium text-sm">{scripture.reference || `版本 ${index + 1}`}</p>
                <div className="text-[var(--text-quiet)] text-sm mt-1 leading-relaxed">
                  {segmentText(scripture.text, highlightsPerScripture[String(index)] ?? []).map((seg, i) =>
                    seg.highlight ? (
                      <mark key={i} className="bg-amber-200/80 dark:bg-amber-600/30 rounded px-0.5">{seg.text}</mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )}
                </div>
              </div>
            ))}
          </aside>
          <div className="flex-1 min-w-0">
            <div className="md:hidden mb-4 p-3 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] max-h-40 overflow-y-auto">
              <p className="text-[var(--accent-subtle)] text-xs mb-2">今日經文</p>
              {todayScriptures.map((scripture, index) => (
                <div key={index} className={index > 0 ? "mt-3 pt-3 border-t border-[var(--border-soft)]" : ""}>
                  <p className="text-[var(--text-soft)] font-medium text-sm">{scripture.reference || `版本 ${index + 1}`}</p>
                  <div className="text-[var(--text-quiet)] text-sm mt-1 leading-relaxed">
                    {segmentText(scripture.text, highlightsPerScripture[String(index)] ?? []).map((seg, i) =>
                      seg.highlight ? (
                        <mark key={i} className="bg-amber-200/80 dark:bg-amber-600/30 rounded px-0.5">{seg.text}</mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[var(--accent-subtle)] text-sm mb-2">禱告</p>
            <p className="text-[var(--text-quiet)] text-base mb-4">
              在這裡寫下你對神的回應與禱告。
            </p>
            <textarea
              value={prayerText}
              onChange={(e) => setPrayerText(e.target.value)}
              placeholder="..."
              className="w-full min-h-[200px] p-4 bg-[var(--bg-softer)] border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
              rows={8}
            />
          </div>
        </section>
      )}

      {phase === "contemplation" && (
        <section className="max-w-lg w-full animate-fade-in mt-14 text-center">
          <p className="text-[var(--text-quiet)] text-lg leading-relaxed mb-6">
            在神的平安中休息。
          </p>
          <p className="text-[var(--text-soft)] text-base mb-8">
            默觀不是再思考，而是安歇在主的同在中，感受祂的平安。
          </p>
          <button
            type="button"
            onClick={saveCurrentDevotion}
            className="px-6 py-3 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] text-sm hover:bg-[var(--bg-softer)] transition-colors"
          >
            完成此次靈修（儲存記錄）
          </button>
        </section>
      )}
    </main>
  );
}
