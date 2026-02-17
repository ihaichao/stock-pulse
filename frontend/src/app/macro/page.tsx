"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import EventCard from "@/components/EventCard";
import { format, addMonths, subMonths } from "date-fns";

export default function MacroPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, "yyyy-MM");

  const { data: events, isLoading } = useQuery({
    queryKey: ["macro-calendar", monthStr],
    queryFn: () => api.getMacroCalendar(monthStr),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📅 宏观经济日历</h1>
        <p className="text-gray-500 mt-1">FOMC、CPI、非农、GDP 等重要宏观事件</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
        >
          ← 上月
        </button>
        <span className="text-lg font-semibold">
          {format(currentMonth, "yyyy 年 M 月")}
        </span>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
        >
          下月 →
        </button>
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="text-gray-400 text-sm">加载中...</div>
      ) : events && events.length > 0 ? (
        <div className="space-y-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-sm rounded-lg border border-dashed p-8 text-center">
          本月暂无宏观事件数据
        </div>
      )}
    </div>
  );
}
