"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadCheckIns,
  saveCheckIns,
  subscribeCheckIns,
  getCheckInForDate,
  formatCheckInDate,
  getDateKey,
  getDateKeyFromISO,
  type CheckInRecord,
} from "@/lib/checkin";
import CheckInCalendar from "@/components/CheckInCalendar";
import {
  loadRecords,
  type DevotionRecord,
} from "@/lib/devotion";
import {
  prepareReviewData,
  generateAIReview,
  type ReviewPeriod,
} from "@/lib/ai-review";

const MOOD_OPTIONS = [
  { value: "😊", label: "開心" },
  { value: "😌", label: "平靜" },
  { value: "🙏", label: "感恩" },
  { value: "😔", label: "難過" },
  { value: "😰", label: "焦慮" },
  { value: "😴", label: "疲憊" },
  { value: "🤔", label: "思考" },
  { value: "💪", label: "充滿力量" },
];

export default function CheckInPage() {
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [devotionRecords, setDevotionRecords] = useState<DevotionRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mood, setMood] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  // 初始載入 + 已登入時訂閱即時同步
  useEffect(() => {
    if (authLoading) return;
    loadRecords(user?.uid ?? null).then(setDevotionRecords);
    loadCheckIns(user?.uid ?? null).then(setCheckIns);

    if (user?.uid) {
      const unsub = subscribeCheckIns(user.uid, setCheckIns);
      return () => {
        unsub?.();
      };
    }
  }, [user?.uid, authLoading]);

  // 切回此分頁時重新拉取
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && user?.uid) {
        loadCheckIns(user.uid).then(setCheckIns);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.uid]);

  // 定期拉取（每 20 秒），避免即時訂閱失敗時仍能同步
  useEffect(() => {
    if (!user?.uid || typeof document === "undefined") return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadCheckIns(user.uid).then(setCheckIns);
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  const handleSync = async () => {
    if (!user?.uid) {
      setSyncMessage("請先登入 Google 以同步");
      setTimeout(() => setSyncMessage(null), 3000);
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const merged = await loadCheckIns(user.uid);
      setCheckIns(merged);
      setSyncMessage(`已同步，共 ${merged.length} 筆`);
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (err) {
      console.error("同步失敗", err);
      setSyncMessage("同步失敗，請檢查網路或稍後再試");
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const todayCheckIn = getCheckInForDate(checkIns, selectedDate);
  const isToday = getDateKey(selectedDate) === getDateKey(new Date());

  useEffect(() => {
    if (todayCheckIn) {
      setMood(todayCheckIn.mood || "");
      setNote(todayCheckIn.note || "");
    } else {
      setMood("");
      setNote("");
    }
  }, [todayCheckIn, selectedDate]);

  const handleCheckIn = async () => {
    if (!isToday) {
      alert("只能為今天簽到");
      return;
    }

    setIsSubmitting(true);
    try {
      const dateKey = getDateKey(selectedDate);
      const existingIndex = checkIns.findIndex((c) => getDateKeyFromISO(c.date) === dateKey);

      const checkIn: CheckInRecord = {
        id: existingIndex >= 0 ? checkIns[existingIndex].id : `checkin-${Date.now()}`,
        date: selectedDate.toISOString(),
        mood: mood || undefined,
        note: note || undefined,
      };

      const updated = existingIndex >= 0
        ? checkIns.map((c, i) => (i === existingIndex ? checkIn : c))
        : [checkIn, ...checkIns];

      const synced = await saveCheckIns(updated, user?.uid ?? null);
      setCheckIns(synced);
      alert("簽到成功！");
    } catch (error) {
      console.error("簽到失敗", error);
      alert("簽到失敗，請重試");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateReview = async (period: ReviewPeriod) => {
    setReviewLoading(true);
    setReviewResult(null);
    setReviewPeriod(period);
    try {
      const reviewData = prepareReviewData(
        devotionRecords,
        checkIns,
        period,
        new Date()
      );
      const result = await generateAIReview(reviewData);
      setReviewResult(result);
    } catch (error: any) {
      console.error("生成回顧失敗", error);
      setReviewResult(`錯誤：${error.message}`);
    } finally {
      setReviewLoading(false);
    }
  };

  const recentCheckIns = checkIns.slice(0, 7);

  return (
    <main className="min-h-screen px-4 py-8 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="text-[var(--text-quiet)] text-sm hover:text-[var(--text-soft)] transition-colors"
        >
          ← 返回靈修
        </Link>
      </div>

      <h1 className="text-2xl font-normal text-[var(--text-soft)] mb-8 tracking-wide">
        每日簽到
      </h1>

      <div className="mb-6 space-y-2">
        {user ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[var(--accent-subtle)] text-sm">
                已登入，簽到會同步到雲端（手機與電腦請用同一個 Google 帳號）
              </p>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="px-3 py-1.5 text-sm rounded-sm border border-[var(--border-soft)] text-[var(--text-quiet)] hover:text-[var(--text-soft)] hover:bg-[var(--bg-softer)] disabled:opacity-50 transition-colors"
              >
                {syncing ? "同步中…" : "手動同步"}
              </button>
            </div>
            {syncMessage && (
              <p className="text-sm text-[var(--accent-subtle)]">{syncMessage}</p>
            )}
          </>
        ) : (
          <p className="text-[var(--text-quiet)] text-sm">
            未登入時簽到只會存於本裝置。請在「設定與記錄」用 Google 登入，手機與電腦使用同一帳號即可雙向同步。
          </p>
        )}
      </div>

      {/* 簽到表單 */}
      <section id="checkin-form" className="mb-8 p-6 rounded-sm border border-[var(--border-soft)] bg-white shadow-sm">
        <h2 className="text-lg font-medium text-[var(--text-soft)] mb-4">
          {isToday ? "今日簽到" : formatCheckInDate(selectedDate.toISOString())}
        </h2>

        {!isToday && (
          <p className="text-[var(--text-quiet)] text-sm mb-4">
            只能為今天簽到
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[var(--text-quiet)] text-sm mb-2">
              心情（可選）
            </label>
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMood(mood === option.value ? "" : option.value)}
                  disabled={!isToday}
                  className={`px-4 py-2 rounded-sm border transition-colors ${
                    mood === option.value
                      ? "border-[var(--accent-subtle)] bg-[var(--bg-softer)] text-[var(--text-soft)]"
                      : "border-[var(--border-soft)] text-[var(--text-quiet)] hover:bg-[var(--bg-softer)]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {option.value} {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[var(--text-quiet)] text-sm mb-2">
              備註（可選）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!isToday}
              placeholder="記錄今天的心情或想法..."
              rows={4}
              className="w-full px-3 py-2 bg-white border border-[var(--border-soft)] rounded-sm text-[var(--text-soft)] placeholder:text-[var(--accent-subtle)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {isToday && (
            <button
              onClick={handleCheckIn}
              disabled={isSubmitting}
              className="w-full px-6 py-3 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] hover:bg-[var(--bg-softer)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "簽到中..." : todayCheckIn ? "更新簽到" : "完成簽到"}
            </button>
          )}
        </div>
      </section>

      {/* AI 回顧 */}
      <section className="mb-8 p-6 rounded-sm border border-[var(--border-soft)] bg-white shadow-sm">
        <h2 className="text-lg font-medium text-[var(--text-soft)] mb-4">
          AI 回顧
        </h2>
        <p className="text-[var(--text-quiet)] text-sm mb-4">
          根據你的靈修記錄和簽到記錄，生成每週或每月的回顧報告
        </p>
        <p className="text-[var(--accent-subtle)] text-xs mb-4">
          💡 提示：如果未設定 API Key，系統會顯示設定說明。推薦使用 Hugging Face（完全免費）或 Google Gemini（免費層級）。
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => handleGenerateReview("week")}
            disabled={reviewLoading}
            className="flex-1 px-4 py-2 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] hover:bg-[var(--bg-softer)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reviewLoading && reviewPeriod === "week" ? "生成中..." : "本週回顧"}
          </button>
          <button
            onClick={() => handleGenerateReview("month")}
            disabled={reviewLoading}
            className="flex-1 px-4 py-2 rounded-sm border border-[var(--border-soft)] text-[var(--text-soft)] hover:bg-[var(--bg-softer)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reviewLoading && reviewPeriod === "month" ? "生成中..." : "本月回顧"}
          </button>
        </div>

        {reviewResult && (
          <div className="mt-6 rounded-sm border border-[var(--border-soft)] bg-[var(--bg-softer)] flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between p-4 pb-2 shrink-0">
              <h3 className="text-[var(--accent-subtle)] text-sm font-medium">
                {reviewPeriod === "week" ? "本週回顧" : "本月回顧"}
              </h3>
              <button
                onClick={() => setReviewResult(null)}
                className="text-[var(--text-quiet)] hover:text-[var(--text-soft)] text-sm"
              >
                關閉
              </button>
            </div>
            <div className="p-4 pt-2 overflow-y-auto flex-1 min-h-0 text-[var(--text-soft)] text-sm whitespace-pre-wrap leading-relaxed">
              {reviewResult}
            </div>
          </div>
        )}
      </section>

      {/* 簽到日曆 */}
      <section className="mb-8 p-6 rounded-sm border border-[var(--border-soft)] bg-white shadow-sm">
        <h2 className="text-lg font-medium text-[var(--text-soft)] mb-4">
          簽到日曆
        </h2>
        <CheckInCalendar
          checkIns={checkIns}
          selectedDate={selectedDate}
          onDateClick={(date) => {
            setSelectedDate(date);
            // 滾動到簽到表單
            const formElement = document.getElementById("checkin-form");
            formElement?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </section>

      {/* 最近簽到記錄 */}
      {recentCheckIns.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-[var(--text-soft)] mb-4">
            最近簽到
          </h2>
          <div className="space-y-2">
            {recentCheckIns.map((checkIn) => (
              <div
                key={checkIn.id}
                className="p-4 rounded-sm border border-[var(--border-soft)] bg-white shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[var(--accent-subtle)] text-sm">
                    {formatCheckInDate(checkIn.date)}
                  </span>
                  {checkIn.mood && (
                    <span className="text-lg">{checkIn.mood}</span>
                  )}
                </div>
                {checkIn.note && (
                  <p className="text-[var(--text-soft)] text-sm mt-2 whitespace-pre-wrap">
                    {checkIn.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
