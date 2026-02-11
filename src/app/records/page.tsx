"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loadRecords,
  saveRecords,
  formatRecordDate,
  isToday,
  normalizeScriptures,
  type DevotionRecord,
} from "@/lib/devotion";
import { useAuth } from "@/contexts/AuthContext";

function RecordsList({
  records,
  expandedId,
  onToggle,
  onDelete,
}: {
  records: DevotionRecord[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  if (records.length === 0) return null;
  return (
    <ul className="space-y-3">
      {records.map((rec) => (
        <li
          key={rec.id}
          className="border border-[var(--border-soft)] rounded-sm overflow-hidden bg-white shadow-sm"
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => onToggle(expandedId === rec.id ? null : rec.id)}
              className="flex-1 text-left px-4 py-3 hover:bg-[var(--bg-softer)] transition-colors min-w-0"
            >
              <span className="text-[var(--accent-subtle)] block text-xs mb-0.5">
                {formatRecordDate(rec.date)}
              </span>
              <span className="font-medium text-[var(--text-soft)]">
                {normalizeScriptures(rec.scripture).map((s, i) => s.reference || `版本 ${i + 1}`).join(" / ")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(rec.id)}
              className="px-3 py-3 text-[var(--accent-subtle)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              title="刪除此記錄"
              aria-label="刪除此記錄"
            >
              刪除
            </button>
          </div>
          {expandedId === rec.id && (
            <div className="px-4 py-3 pt-0 border-t border-[var(--border-soft)] bg-[var(--bg-softer)] text-sm text-[var(--text-quiet)] space-y-3 max-h-96 overflow-y-auto whitespace-pre-wrap">
              {normalizeScriptures(rec.scripture).map((scripture, index) => (
                <div key={index} className={index > 0 ? "pt-3 border-t border-[var(--border-soft)]" : ""}>
                  <p className="text-[var(--accent-subtle)] text-xs mb-1">
                    經文{normalizeScriptures(rec.scripture).length > 1 ? ` (版本 ${index + 1})` : ""}
                  </p>
                  <p className="text-[var(--text-soft)] font-medium text-sm mb-1">{scripture.reference || `版本 ${index + 1}`}</p>
                  <p className="text-[var(--text-soft)]">{scripture.text}</p>
                </div>
              ))}
              {rec.observation && (
                <div>
                  <p className="text-[var(--accent-subtle)] text-xs mb-1">觀察</p>
                  <p className="text-[var(--text-soft)]">{rec.observation}</p>
                </div>
              )}
              {rec.application && (
                <div>
                  <p className="text-[var(--accent-subtle)] text-xs mb-1">應用</p>
                  <p className="text-[var(--text-soft)]">{rec.application}</p>
                </div>
              )}
              {rec.prayerText && (
                <div>
                  <p className="text-[var(--accent-subtle)] text-xs mb-1">禱告</p>
                  <p className="text-[var(--text-soft)]">{rec.prayerText}</p>
                </div>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function RecordsPage() {
  const [records, setRecords] = useState<DevotionRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    loadRecords(user?.uid ?? null).then(setRecords);
  }, [user?.uid, authLoading]);

  const todayRecords = records.filter((r) => isToday(r.date));
  const previousRecords = records.filter((r) => !isToday(r.date));

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除此靈修記錄嗎？")) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await saveRecords(next, user?.uid ?? null);
    if (expandedId === id) setExpandedId(null);
  };

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
        靈修記錄
      </h1>

      {user && (
        <p className="text-[var(--accent-subtle)] text-sm mb-4">
          已以 Google 帳號登入，記錄已同步至雲端
        </p>
      )}

      {records.length === 0 ? (
        <p className="text-[var(--text-quiet)]">
          尚無記錄。完成靈修後按「完成此次靈修」即可儲存。
        </p>
      ) : (
        <div className="space-y-8">
          {todayRecords.length > 0 && (
            <section>
              <h2 className="text-[var(--accent-subtle)] text-sm font-medium mb-4">
                今日
              </h2>
              <RecordsList
                records={todayRecords}
                expandedId={expandedId}
                onToggle={setExpandedId}
                onDelete={handleDelete}
              />
            </section>
          )}
          {previousRecords.length > 0 && (
            <section>
              <h2 className="text-[var(--accent-subtle)] text-sm font-medium mb-4">
                較早記錄
              </h2>
              <RecordsList
                records={previousRecords}
                expandedId={expandedId}
                onToggle={setExpandedId}
                onDelete={handleDelete}
              />
            </section>
          )}
        </div>
      )}
    </main>
  );
}
