"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BIBLE_BOOKS } from "@/data/bibleBooks";
import { loadRecords, saveRecords, formatRecordDate, type DevotionRecord } from "@/lib/devotion";
import { useAuth } from "@/contexts/AuthContext";

type Phase =
  | "idle"
  | "prayer"
  | "scripture"
  | "observation"
  | "application"
  | "prayer-write";

const PRAYER_MINUTES = 5;
const YOUTUBE_VIDEO_ID = "V7Bohz21qq4"; // https://youtu.be/V7Bohz21qq4
const YOUTUBE_AUDIO_URL = "https://www.youtube.com/watch?v=V7Bohz21qq4"; // 手機備用

const DEFAULT_SCRIPTURE = {
  reference: "詩篇 46:10",
  text: "你們要休息，要知道我是神；我必在外邦中被尊崇，在遍地上也被尊崇。",
};

const API_BASE = "https://api.scripture.api.bible/v1";

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

function useYouTubeBackgroundMusic(isPlaying: boolean) {
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
      iframe.src = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&controls=0&mute=0&enablejsapi=1`;
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
        videoId: YOUTUBE_VIDEO_ID,
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: YOUTUBE_VIDEO_ID,
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
  }, [isPlaying, isMobile]);

  return containerRef;
}

export default function DevotionPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [todayScripture, setTodayScripture] = useState(DEFAULT_SCRIPTURE);
  const [bookIndex, setBookIndex] = useState(18); // 詩篇
  const [chapter, setChapter] = useState(46);
  const [verseFrom, setVerseFrom] = useState<string>(""); // 起始節，空＝整章
  const [verseTo, setVerseTo] = useState<string>(""); // 結束節
  const [scriptureLoading, setScriptureLoading] = useState(false);
  const [scriptureError, setScriptureError] = useState<string | null>(null);
  const [showApiSelector, setShowApiSelector] = useState(false);
  const [observation, setObservation] = useState("");
  const [application, setApplication] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [fontFamily, setFontFamily] = useState("serif");
  const [fontSize, setFontSize] = useState("medium");
  const [scriptureSize, setScriptureSize] = useState("medium");
  const [panelOpen, setPanelOpen] = useState(false);
  const [records, setRecords] = useState<DevotionRecord[]>([]);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle, signOut, isReady } = useAuth();
  const musicPlaying = phase !== "idle";
  const youtubeContainerRef = useYouTubeBackgroundMusic(musicPlaying);

  useEffect(() => {
    try {
      const storedFont = localStorage.getItem(STORAGE_FONT);
      const storedSize = localStorage.getItem(STORAGE_FONT_SIZE);
      const storedScriptureSize = localStorage.getItem(STORAGE_SCRIPTURE_SIZE);
      if (storedFont) setFontFamily(storedFont);
      if (storedSize) setFontSize(storedSize);
      if (storedScriptureSize) setScriptureSize(storedScriptureSize);
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
      scripture: { ...todayScripture },
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
      setObservation("");
      setApplication("");
      setPrayerText("");
      router.push("/records");
    }
  }, [todayScripture, observation, application, prayerText, records, user?.uid, router]);

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
    } catch (_) {}
  }, [fontFamily, fontSize, scriptureSize]);

  const scriptureSizeClass =
    SCRIPTURE_SIZE_OPTIONS.find((s) => s.id === scriptureSize)?.className ??
    "text-xl md:text-2xl";

  const selectedBook = BIBLE_BOOKS[bookIndex];
  const chapterOptions = selectedBook
    ? Array.from({ length: selectedBook.chapters }, (_, i) => i + 1)
    : [];

  const loadScripture = useCallback(async () => {
    const book = BIBLE_BOOKS[bookIndex];
    const apiKey = process.env.NEXT_PUBLIC_SCRIPTURE_API_KEY;
    const bibleId =
      process.env.NEXT_PUBLIC_SCRIPTURE_BIBLE_ID || "9879d2657fe39de4-01";
    if (!apiKey) {
      setScriptureError("請在環境變數設定 NEXT_PUBLIC_SCRIPTURE_API_KEY（至 https://scripture.api.bible 申請）");
      return;
    }
    const from = verseFrom.trim() ? parseInt(verseFrom.trim(), 10) : 0;
    const to = verseTo.trim() ? parseInt(verseTo.trim(), 10) : 0;
    const useRange = from > 0;
    if (useRange && to > 0 && from > to) {
      setScriptureError("起始節不可大於結束節");
      return;
    }
    setScriptureError(null);
    setScriptureLoading(true);
    try {
      let text: string;
      let reference: string;
      if (!useRange) {
        const chapterId = `${book.id}.${chapter}`;
        const res = await fetch(
          `${API_BASE}/bibles/${bibleId}/chapters/${chapterId}?content-type=text&include-verse-numbers=false&include-chapter-numbers=false`,
          { headers: { "api-key": apiKey } }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `經文載入失敗 (${res.status})`);
        }
        const data = await res.json();
        text = (data?.data?.content ?? "").trim().replace(/\n{2,}/g, "\n");
        reference = `${book.name} ${chapter}`;
      } else {
        const passageId =
          to > 0 && to >= from
            ? `${book.id}.${chapter}.${from}-${book.id}.${chapter}.${to}`
            : `${book.id}.${chapter}.${from}`;
        const res = await fetch(
          `${API_BASE}/bibles/${bibleId}/passages/${passageId}?content-type=text&include-verse-numbers=false&include-chapter-numbers=false`,
          { headers: { "api-key": apiKey } }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `經文載入失敗 (${res.status})`);
        }
        const data = await res.json();
        const raw =
          data?.data?.content ??
          (typeof data?.data?.passages !== "undefined" && data.data.passages[0]?.content) ??
          "";
        text = String(raw).trim().replace(/\n{2,}/g, "\n");
        reference =
          to > 0 && to >= from
            ? `${book.name} ${chapter}:${from}-${to}`
            : `${book.name} ${chapter}:${from}`;
      }
      setTodayScripture({
        reference,
        text: text || "（此段無經文內容）",
      });
    } catch (e) {
      setScriptureError(e instanceof Error ? e.message : "經文載入失敗");
    } finally {
      setScriptureLoading(false);
    }
  }, [bookIndex, chapter, verseFrom, verseTo]);

  const startDevotion = useCallback(() => {
    setPhase("prayer");
  }, []);

  useEffect(() => {
    if (phase !== "prayer") return;
    const t = setTimeout(
      () => setPhase("scripture"),
      PRAYER_MINUTES * 60 * 1000
    );
    return () => clearTimeout(t);
  }, [phase]);

  const formatRecordDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
                        <span className="font-medium">{rec.scripture.reference}</span>
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
                        <p className="text-[var(--text-soft)]">{rec.scripture.text}</p>
                        {rec.observation && <p><span className="text-[var(--accent-subtle)]">觀察：</span>{rec.observation}</p>}
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
          <p className="text-center mb-6">
            <Link
              href="/records"
              className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)] underline"
            >
              查看靈修記錄
            </Link>
          </p>
          <p className="text-[var(--accent-subtle)] text-sm mb-3">
            從任何聖經 app、網站或實體聖經複製經文，貼到下方即可。
          </p>
          <div className="mb-4 space-y-2">
            <input
              type="text"
              value={todayScripture.reference}
              onChange={(e) =>
                setTodayScripture((prev) => ({ ...prev, reference: e.target.value }))
              }
              placeholder="經文出處（例如：詩篇 46:10）"
              className="w-full px-3 py-2 bg-[var(--bg-softer)] border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
            />
            <textarea
              value={todayScripture.text}
              onChange={(e) =>
                setTodayScripture((prev) => ({ ...prev, text: e.target.value }))
              }
              placeholder="經文內容（直接貼上從 YouVersion、Bible.com 等複製的經文）"
              rows={5}
              className={`w-full px-3 py-2 bg-[var(--bg-softer)] border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)] ${scriptureSizeClass}`}
            />
          </div>
          <div className="mb-4 p-3 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)]">
            <p className="text-[var(--accent-subtle)] text-xs mb-1">
              即將默想的經文
            </p>
            <p className="text-[var(--text-soft)] font-medium text-sm">
              {todayScripture.reference || "—"}
            </p>
            <p className={`text-[var(--text-quiet)] mt-1 line-clamp-2 ${scriptureSizeClass}`}>
              {todayScripture.text || "請在上方貼上經文出處與內容。"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowApiSelector((v) => !v)}
            className="text-sm text-[var(--text-quiet)] underline mb-3"
          >
            {showApiSelector ? "收起" : "或用 API 依書卷／章／節載入（需金鑰）"}
          </button>
          {showApiSelector && (
            <div className="mb-4 p-3 rounded-sm border border-[var(--border-soft)] bg-white/50 space-y-3">
              <div className="flex flex-wrap gap-3">
                <label className="flex-1 min-w-[100px]">
                  <span className="sr-only">書卷</span>
                  <select
                    value={bookIndex}
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      setBookIndex(i);
                      const maxCh = BIBLE_BOOKS[i].chapters;
                      setChapter((c) => (c > maxCh ? maxCh : c));
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] text-sm"
                  >
                    {BIBLE_BOOKS.map((b, i) => (
                      <option key={b.id} value={i}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label className="w-20">
                  <span className="sr-only">章</span>
                  <select
                    value={chapter}
                    onChange={(e) => setChapter(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] text-sm"
                  >
                    {chapterOptions.map((ch) => (
                      <option key={ch} value={ch}>{ch} 章</option>
                    ))}
                  </select>
                </label>
                <label className="w-16">
                  <input
                    type="number"
                    min={1}
                    placeholder="節起"
                    value={verseFrom}
                    onChange={(e) => setVerseFrom(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </label>
                <label className="w-16">
                  <input
                    type="number"
                    min={1}
                    placeholder="節止"
                    value={verseTo}
                    onChange={(e) => setVerseTo(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={loadScripture}
                  disabled={scriptureLoading}
                  className="px-3 py-1.5 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] text-sm hover:bg-[var(--bg-softer)] disabled:opacity-60"
                >
                  {scriptureLoading ? "載入中…" : "載入"}
                </button>
              </div>
              {scriptureError && (
                <p className="text-xs text-[var(--accent-subtle)]">{scriptureError}</p>
              )}
            </div>
          )}

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

      {phase === "prayer" && (
        <section className="text-center max-w-lg animate-fade-in">
          <p className="text-left mb-6">
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)]"
            >
              ← 返回開始
            </button>
          </p>
          <p className="text-[var(--text-quiet)] text-lg leading-relaxed">
            在主面前靜默。
          </p>
          <p className="text-[var(--text-quiet)] text-base mt-6 opacity-80">
            在這段時間裡保持靜默。時間到了，經文會自動出現。
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setPhase("scripture")}
              className="px-6 py-2 rounded-sm border border-[var(--border-soft)] text-[var(--text-quiet)] text-sm hover:bg-[var(--bg-softer)] hover:text-[var(--text-soft)] transition-colors"
            >
              跳過，直接進入經文
            </button>
          </div>
          {typeof window !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
            <div className="mt-8 p-4 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)]">
              <p className="text-[var(--text-quiet)] text-sm mb-3">
                背景音樂已載入
              </p>
              <button
                type="button"
                onClick={() => {
                  const iframe = youtubeContainerRef.current?.querySelector("iframe");
                  if (iframe) {
                    // 觸發 YouTube iframe 播放（需要用戶互動）
                    iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                  }
                }}
                className="px-4 py-2 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] text-sm hover:bg-white transition-colors"
              >
                ▶ 播放背景音樂
              </button>
              <p className="text-[var(--accent-subtle)] text-xs mt-2">
                手機瀏覽器需要點擊才能播放音樂
              </p>
            </div>
          )}
        </section>
      )}

      {phase === "scripture" && (
        <section className="max-w-2xl w-full animate-fade-in">
          <p className="mb-6">
            <button
              type="button"
              onClick={() => setPhase("prayer")}
              className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)]"
            >
              ← 返回靜默
            </button>
          </p>
          <p className="text-[var(--accent-subtle)] text-sm mb-6">
            {todayScripture.reference}
          </p>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <p className={`${scriptureSizeClass} leading-relaxed text-[var(--text-soft)] font-normal`}>
              {todayScripture.text}
            </p>
          </div>
          <button
            onClick={() => setPhase("observation")}
            className="mt-12 px-6 py-2 text-[var(--text-quiet)] text-sm border border-[var(--border-soft)] rounded-sm hover:bg-[var(--bg-softer)] transition-colors"
          >
            繼續
          </button>
        </section>
      )}

      {phase === "observation" && (
        <section className="w-full max-w-4xl flex gap-6 animate-fade-in">
          <aside className="shrink-0 w-48 lg:w-56 p-4 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] self-start sticky top-8 hidden md:block max-h-[70vh] overflow-y-auto">
            <p className="text-[var(--accent-subtle)] text-xs mb-1">今日經文</p>
            <p className="text-[var(--text-soft)] font-medium text-sm">{todayScripture.reference}</p>
            <p className="text-[var(--text-quiet)] text-sm mt-2 leading-relaxed">{todayScripture.text}</p>
          </aside>
          <div className="flex-1 min-w-0">
            <p className="mb-4">
              <button
                type="button"
                onClick={() => setPhase("scripture")}
                className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)]"
              >
                ← 返回經文
              </button>
            </p>
            <div className="md:hidden mb-4 p-3 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] max-h-40 overflow-y-auto">
              <p className="text-[var(--accent-subtle)] text-xs mb-1">今日經文</p>
              <p className="text-[var(--text-soft)] font-medium text-sm">{todayScripture.reference}</p>
              <p className="text-[var(--text-quiet)] text-sm mt-1 leading-relaxed">{todayScripture.text}</p>
            </div>
            <p className="text-[var(--accent-subtle)] text-sm mb-2">觀察</p>
            <p className="text-[var(--text-quiet)] text-base mb-4">
              你在這段經文裡注意到什麼？
            </p>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="靜靜默想……"
              className="w-full min-h-[140px] p-4 bg-[var(--bg-softer)] border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
              rows={5}
            />
            <button
              onClick={() => setPhase("application")}
              className="mt-6 px-6 py-2 text-[var(--text-quiet)] text-sm border border-[var(--border-soft)] rounded-sm hover:bg-[var(--bg-softer)] transition-colors"
            >
              繼續
            </button>
          </div>
        </section>
      )}

      {phase === "application" && (
        <section className="w-full max-w-4xl flex gap-6 animate-fade-in">
          <aside className="shrink-0 w-48 lg:w-56 p-4 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] self-start sticky top-8 hidden md:block max-h-[70vh] overflow-y-auto">
            <p className="text-[var(--accent-subtle)] text-xs mb-1">今日經文</p>
            <p className="text-[var(--text-soft)] font-medium text-sm">{todayScripture.reference}</p>
            <p className="text-[var(--text-quiet)] text-sm mt-2 leading-relaxed">{todayScripture.text}</p>
          </aside>
          <div className="flex-1 min-w-0">
            <p className="mb-4">
              <button
                type="button"
                onClick={() => setPhase("observation")}
                className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)]"
              >
                ← 返回觀察
              </button>
            </p>
            <div className="md:hidden mb-4 p-3 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] max-h-40 overflow-y-auto">
              <p className="text-[var(--accent-subtle)] text-xs mb-1">今日經文</p>
              <p className="text-[var(--text-soft)] font-medium text-sm">{todayScripture.reference}</p>
              <p className="text-[var(--text-quiet)] text-sm mt-1 leading-relaxed">{todayScripture.text}</p>
            </div>
            <p className="text-[var(--accent-subtle)] text-sm mb-2">應用</p>
            <p className="text-[var(--text-quiet)] text-base mb-4">
              這段經文如何對你今日的生活說話？
            </p>
            <textarea
              value={application}
              onChange={(e) => setApplication(e.target.value)}
              placeholder="與生活的連結……"
              className="w-full min-h-[140px] p-4 bg-[var(--bg-softer)] border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
              rows={5}
            />
            <button
              onClick={() => setPhase("prayer-write")}
              className="mt-6 px-6 py-2 text-[var(--text-quiet)] text-sm border border-[var(--border-soft)] rounded-sm hover:bg-[var(--bg-softer)] transition-colors"
            >
              繼續
            </button>
          </div>
        </section>
      )}

      {phase === "prayer-write" && (
        <section className="w-full max-w-4xl flex gap-6 animate-fade-in">
          <aside className="shrink-0 w-48 lg:w-56 p-4 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] self-start sticky top-8 hidden md:block max-h-[70vh] overflow-y-auto">
            <p className="text-[var(--accent-subtle)] text-xs mb-1">今日經文</p>
            <p className="text-[var(--text-soft)] font-medium text-sm">{todayScripture.reference}</p>
            <p className="text-[var(--text-quiet)] text-sm mt-2 leading-relaxed">{todayScripture.text}</p>
          </aside>
          <div className="flex-1 min-w-0">
            <p className="mb-4">
              <button
                type="button"
                onClick={() => setPhase("application")}
                className="text-sm text-[var(--text-quiet)] hover:text-[var(--text-soft)]"
              >
                ← 返回應用
              </button>
            </p>
            <div className="md:hidden mb-4 p-3 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] max-h-40 overflow-y-auto">
              <p className="text-[var(--accent-subtle)] text-xs mb-1">今日經文</p>
              <p className="text-[var(--text-soft)] font-medium text-sm">{todayScripture.reference}</p>
              <p className="text-[var(--text-quiet)] text-sm mt-1 leading-relaxed">{todayScripture.text}</p>
            </div>
            <p className="text-[var(--accent-subtle)] text-sm mb-2">禱告</p>
            <p className="text-[var(--text-quiet)] text-base mb-4">
              在這裡寫下你的禱告。
            </p>
            <textarea
              value={prayerText}
              onChange={(e) => setPrayerText(e.target.value)}
              placeholder="..."
              className="w-full min-h-[200px] p-4 bg-[var(--bg-softer)] border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)]"
              rows={8}
            />
            <button
              type="button"
              onClick={saveCurrentDevotion}
              className="mt-6 px-6 py-2 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] text-sm hover:bg-[var(--bg-softer)] transition-colors"
            >
              完成此次靈修（儲存記錄）
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
