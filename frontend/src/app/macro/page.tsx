"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, StockEvent } from "@/lib/api";
import {
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Sparkles } from "lucide-react";

/* ── Helpers ── */

function eventImportanceColor(importance: string) {
  switch (importance) {
    case "high": return { dot: "bg-red-500", pill: "bg-red-500 text-white", label: "bg-red-500/10 text-red-500" };
    case "medium": return { dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-500", label: "bg-amber-500/10 text-amber-500" };
    default: return { dot: "bg-blue-500", pill: "bg-blue-500/10 text-blue-500", label: "bg-slate-500/10 text-slate-400" };
  }
}

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/* ── Main Component ── */

export default function MacroPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const monthStr = format(currentMonth, "yyyy-MM");

  const { data: events, isLoading } = useQuery({
    queryKey: ["macro-calendar", monthStr],
    queryFn: () => api.getMacroCalendar(monthStr),
  });

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart); // 0=Sun

  // Events grouped by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, StockEvent[]>();
    (events || []).forEach((e) => {
      const dayKey = format(parseISO(e.event_date), "yyyy-MM-dd");
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(e);
    });
    return map;
  }, [events]);

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => isSameDay(parseISO(e.event_date), selectedDate));
  }, [events, selectedDate]);

  const selectedEvent = selectedEvents[0]; // Show first event in detail panel

  return (
    <div className="pb-8">
      <div className="flex h-[calc(100vh-80px)]">
        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Controls */}
          <div className="py-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold tracking-tight">
                {format(currentMonth, "yyyy年 M月", { locale: zhCN })}
              </h1>
              <div className="flex items-center rounded-lg border border-border p-1 bg-muted">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-1 hover:text-primary transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}
                  className="px-3 text-sm font-medium hover:text-primary transition-colors"
                >
                  今天
                </button>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1 hover:text-primary transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* AI Weekly Summary */}
          {selectedEvents.length > 0 && selectedEvent?.ai_summary && (
            <div className="py-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-4">
                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-primary mb-1">AI 简要解读</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedEvent.ai_summary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto pb-6">
            <div className="min-w-[800px]">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-x border-t border-border rounded-t-xl bg-muted/50">
                {weekdays.map((d) => (
                  <div key={d} className="py-3 text-center text-xs font-bold text-muted-foreground uppercase">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 border-l border-t border-border">
                {/* Padding for start of month */}
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} className="h-28 border-r border-b border-border bg-muted/5 p-2">
                    <span className="text-xs text-muted-foreground/40" />
                  </div>
                ))}

                {/* Actual days */}
                {daysInMonth.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(dayKey) || [];
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDay = isToday(day);
                  const hasHighImpact = dayEvents.some((e) => e.importance === "high");

                  return (
                    <div
                      key={dayKey}
                      onClick={() => setSelectedDate(day)}
                      className={`h-28 border-r border-b border-border p-2 cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10 ring-1 ring-primary/30" :
                        isTodayDay ? "bg-primary/5" :
                        hasHighImpact ? "bg-red-500/5" :
                        "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-bold ${isTodayDay ? "text-primary" : ""}`}>
                          {format(day, "d")}
                        </span>
                        {isTodayDay && (
                          <span className="bg-primary text-white text-[9px] px-1 rounded font-bold">TODAY</span>
                        )}
                        {hasHighImpact && !isTodayDay && (
                          <span className="text-[9px] font-bold text-red-500">HIGH</span>
                        )}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 3).map((e) => {
                          const colors = eventImportanceColor(e.importance);
                          return (
                            <div
                              key={e.id}
                              className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-bold truncate ${
                                e.importance === "high" ? colors.pill : colors.label
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                e.importance === "high" && dayEvents.length <= 2 ? "bg-white" : colors.dot
                              } ${isTodayDay && e.importance === "high" ? "animate-pulse" : ""}`} />
                              <span className="truncate">
                                {e.macro_event_name || e.ticker || e.title}
                              </span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-[9px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar: Event Detail ── */}
        <aside className="w-80 border-l border-border p-6 flex-col gap-6 bg-muted/5 hidden xl:flex overflow-y-auto">
          {selectedEvents.length > 0 && selectedEvent ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">指标详情</h3>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                  selectedEvent.importance === "high"
                    ? "bg-red-500/10 text-red-500"
                    : selectedEvent.importance === "medium"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-slate-500/10 text-slate-400"
                }`}>
                  {selectedEvent.importance === "high" ? "高影响" : selectedEvent.importance === "medium" ? "中影响" : "低影响"}
                </span>
              </div>

              {/* Event Name Card */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
                <p className="text-muted-foreground text-xs mb-1">指标名称</p>
                <h4 className="font-bold text-base leading-tight">
                  {selectedEvent.macro_event_name || selectedEvent.title}
                </h4>
                <p className="text-[10px] text-muted-foreground mt-2">
                  发布时间: {format(parseISO(selectedEvent.event_date), "yyyy-MM-dd HH:mm")}
                </p>
              </div>

              {/* Values Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-card border border-border text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">前值</p>
                  <p className="text-sm font-bold">{selectedEvent.previous_value || "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">预测值</p>
                  <p className="text-sm font-bold">{selectedEvent.consensus || "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-[10px] text-primary mb-1">公布值</p>
                  <p className="text-sm font-black text-primary">{selectedEvent.actual_value || "—"}</p>
                </div>
              </div>

              {/* Interpretation */}
              {selectedEvent.ai_summary && (
                <div className="p-4 rounded-xl border border-border bg-card">
                  <h5 className="text-xs font-bold mb-3 flex items-center gap-2">
                    ℹ️ AI 解读
                  </h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedEvent.ai_summary}
                  </p>
                </div>
              )}

              {/* View details link */}
              <Link
                href={`/event/${selectedEvent.id}`}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-center block"
              >
                查看详情
              </Link>

              {/* Other events on this day */}
              {selectedEvents.length > 1 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-muted-foreground">当日其他事件</h5>
                  {selectedEvents.slice(1).map((e) => (
                    <Link key={e.id} href={`/event/${e.id}`} className="block">
                      <div className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors text-sm">
                        <p className="font-bold text-xs">{e.macro_event_name || e.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{e.description?.slice(0, 60)}...</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <p className="text-sm">选择日历中的日期<br />查看事件详情</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
