"use client";

import { useState } from "react";
import { CheckInRecord, getDateKey, formatCheckInDate } from "@/lib/checkin";

type CalendarProps = {
  checkIns: CheckInRecord[];
  onDateClick?: (date: Date) => void;
  selectedDate?: Date;
};

export default function CheckInCalendar({
  checkIns,
  onDateClick,
  selectedDate,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // 獲取月份的第一天和最後一天
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // 創建簽到記錄的 Map，方便快速查找
  const checkInMap = new Map<string, CheckInRecord>();
  checkIns.forEach((checkIn) => {
    const dateKey = getDateKey(new Date(checkIn.date));
    checkInMap.set(dateKey, checkIn);
  });

  // 生成日曆天數
  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // 上個月的日期（填充第一週）
  const prevMonth = new Date(year, month - 1);
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    });
  }

  // 當月的日期
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      date: new Date(year, month, day),
      isCurrentMonth: true,
    });
  }

  // 下個月的日期（填充最後一週）
  const remainingDays = 42 - calendarDays.length; // 6 週 x 7 天 = 42
  for (let day = 1; day <= remainingDays; day++) {
    calendarDays.push({
      date: new Date(year, month + 1, day),
      isCurrentMonth: false,
    });
  }

  const getDateStatus = (date: Date): "checked" | "unchecked" | "future" => {
    const dateKey = getDateKey(date);
    const checkIn = checkInMap.get(dateKey);
    
    // 比較日期（不包含時間）
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (dateOnly > todayOnly) return "future";
    if (checkIn) return "checked";
    return "unchecked";
  };

  const isToday = (date: Date): boolean => {
    return getDateKey(date) === getDateKey(today);
  };

  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return getDateKey(date) === getDateKey(selectedDate);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const monthNames = [
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
  ];

  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div className="w-full">
      {/* 月份導航 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 text-[var(--text-quiet)] hover:text-[var(--text-soft)] hover:bg-[var(--bg-softer)] rounded-sm transition-colors"
          aria-label="上一個月"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-[var(--text-soft)]">
            {year}年 {monthNames[month]}
          </h3>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs text-[var(--text-quiet)] hover:text-[var(--text-soft)] hover:bg-[var(--bg-softer)] rounded-sm transition-colors"
          >
            今天
          </button>
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 text-[var(--text-quiet)] hover:text-[var(--text-soft)] hover:bg-[var(--bg-softer)] rounded-sm transition-colors"
          aria-label="下一個月"
        >
          →
        </button>
      </div>

      {/* 星期標題 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-[var(--text-quiet)] py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日曆網格 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          const status = getDateStatus(date);
          const dateKey = getDateKey(date);
          const checkIn = checkInMap.get(dateKey);
          const dayNumber = date.getDate();

          return (
            <button
              key={`${dateKey}-${index}`}
              onClick={() => onDateClick?.(date)}
              className={`
                aspect-square p-1 rounded-sm text-sm transition-all
                ${!isCurrentMonth ? "opacity-30" : ""}
                ${isSelected(date) ? "ring-2 ring-[var(--accent-subtle)] ring-offset-1" : ""}
                ${
                  status === "checked"
                    ? "bg-green-100 hover:bg-green-200 text-green-800 font-medium"
                    : status === "unchecked"
                    ? "bg-red-50 hover:bg-red-100 text-red-600"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-400"
                }
                ${isToday(date) ? "ring-2 ring-blue-400" : ""}
              `}
              title={
                isCurrentMonth
                  ? `${formatCheckInDate(date.toISOString())}${
                      checkIn ? ` - 已簽到${checkIn.mood ? ` ${checkIn.mood}` : ""}` : " - 未簽到"
                    }`
                  : ""
              }
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span>{dayNumber}</span>
                {checkIn?.mood && (
                  <span className="text-xs mt-0.5">{checkIn.mood}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 圖例 */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-[var(--text-quiet)]">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-sm bg-green-100 border border-green-300"></div>
          <span>已簽到</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-sm bg-red-50 border border-red-200"></div>
          <span>未簽到</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-sm bg-gray-50 border border-gray-200"></div>
          <span>未來</span>
        </div>
      </div>
    </div>
  );
}
