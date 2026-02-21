"use client";

import { useQuery } from "@tanstack/react-query";
import { api, StockEvent } from "@/lib/api";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

/* ─── helpers ─── */

function importanceBadge(importance: string) {
  switch (importance) {
    case "high":
      return (
        <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-[10px] font-bold uppercase border border-red-500/20">
          高重要性
        </span>
      );
    case "medium":
      return (
        <span className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase border border-cyan-500/20">
          中重要性
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 rounded bg-slate-500/10 text-slate-400 text-[10px] font-bold uppercase border border-slate-500/20">
          低重要性
        </span>
      );
  }
}

function eventIcon(type: string) {
  const base = "w-8 h-8 rounded flex items-center justify-center text-lg";
  switch (type) {
    case "earnings":
      return <div className={`${base} bg-primary/10 text-primary`}>📊</div>;
    case "macro":
      return <div className={`${base} bg-amber-500/10 text-amber-500`}>📅</div>;
    case "insider":
      return <div className={`${base} bg-amber-500/10 text-amber-500`}>👤</div>;
    case "analyst":
      return <div className={`${base} bg-emerald-500/10 text-emerald-500`}>📝</div>;
    default:
      return <div className={`${base} bg-slate-500/10 text-slate-400`}>📌</div>;
  }
}

function formatEventDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "MM/dd HH:mm");
  } catch {
    return dateStr;
  }
}

/* ─── sub-components ─── */

function EventTableRow({ event }: { event: StockEvent }) {
  return (
    <Link
      href={`/event/${event.id}`}
      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-primary/5 transition-colors cursor-pointer group"
    >
      <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
        <span className="font-bold text-base">{event.ticker || "—"}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {formatEventDate(event.event_date)}
        </span>
      </div>
      <div className="col-span-1 flex justify-center">
        {eventIcon(event.event_type)}
      </div>
      <div className="col-span-5 sm:col-span-7">
        <p className="text-sm font-medium truncate">{event.title}</p>
        {event.ai_summary && (
          <p className="text-xs text-muted-foreground mt-1 italic truncate hidden sm:block">
            {event.ai_summary}
          </p>
        )}
      </div>
      <div className="col-span-3 sm:col-span-2 text-right">
        {importanceBadge(event.importance)}
      </div>
    </Link>
  );
}

function TodayFocusCard({ event }: { event: StockEvent }) {
  const tagColor =
    event.event_type === "macro"
      ? "bg-amber-500/10 text-amber-500"
      : event.event_type === "earnings"
      ? "bg-primary/10 text-primary"
      : "bg-emerald-500/10 text-emerald-500";

  const tagLabel =
    event.event_type === "macro"
      ? "宏观数据"
      : event.event_type === "earnings"
      ? "财报"
      : event.event_type === "insider"
      ? "内部人交易"
      : event.event_type;

  return (
    <Link href={`/event/${event.id}`} className="block">
      <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-primary/30 transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16" />
        <div className="flex justify-between items-start mb-3">
          <div>
            <span
              className={`inline-block px-2 py-0.5 ${tagColor} text-[10px] font-bold rounded mb-2 uppercase tracking-tight`}
            >
              {tagLabel}
            </span>
            <h3 className="text-base font-bold leading-tight">{event.title}</h3>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 ml-4">
            {formatEventDate(event.event_date)}
          </span>
        </div>
        {event.ai_summary && (
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
            {event.ai_summary}
          </p>
        )}
        {event.event_type === "earnings" && event.eps_estimate && (
          <div className="mt-3 bg-muted p-3 rounded-lg border border-border text-xs">
            <span className="text-muted-foreground">预期 EPS: </span>
            <span className="font-medium">${event.eps_estimate}</span>
            {event.eps_actual && (
              <>
                <span className="text-muted-foreground ml-3">实际: </span>
                <span
                  className={`font-bold ${
                    event.eps_actual >= event.eps_estimate
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  ${event.eps_actual}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function EarningsReviewItem({ event }: { event: StockEvent }) {
  const beat =
    event.eps_actual && event.eps_estimate
      ? event.eps_actual >= event.eps_estimate
      : null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center font-bold text-xs">
          {event.ticker}
        </div>
        <div>
          <p className="text-xs font-semibold">{event.title}</p>
          {event.eps_actual && event.eps_estimate && (
            <p className="text-[10px] text-muted-foreground">
              EPS: ${event.eps_actual} (预期 ${event.eps_estimate})
            </p>
          )}
        </div>
      </div>
      {beat !== null && (
        <div className="text-right">
          <p
            className={`text-xs font-bold ${
              beat ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {beat ? "超预期 ✓" : "不及预期"}
          </p>
        </div>
      )}
    </div>
  );
}

function InsiderTradeItem({ event }: { event: StockEvent }) {
  return (
    <div className="relative">
      <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
      <p className="text-xs font-bold">{event.title}</p>
      {event.description && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {event.description}
        </p>
      )}
    </div>
  );
}

/* ─── main page ─── */

export default function Dashboard() {
  const { data: upcoming, isLoading: loadingUpcoming } = useQuery({
    queryKey: ["upcoming"],
    queryFn: api.getUpcoming,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["daily-summary"],
    queryFn: api.getDailySummary,
  });

  const { data: yesterday, isLoading: loadingYesterday } = useQuery({
    queryKey: ["yesterday-events"],
    queryFn: api.getYesterday,
  });

  // Group yesterday's events by type
  const earningsReview = yesterday?.filter(
    (e) => e.event_type === "earnings"
  ) ?? [];
  const macroReview = yesterday?.filter(
    (e) => e.event_type === "macro"
  ) ?? [];
  const insiderReview = yesterday?.filter(
    (e) => e.event_type === "insider"
  ) ?? [];

  const todayEvents = summary?.events ?? [];

  return (
    <div className="space-y-8 pb-8">
      {/* ─── Section 1: Portfolio Events Table ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-primary text-xl">📋</span>
            <h2 className="text-xl font-bold">
              持仓事件{" "}
              <span className="text-muted-foreground font-normal text-sm ml-2">
                (实时更新)
              </span>
            </h2>
          </div>
          <Link
            href="/macro"
            className="text-sm text-primary flex items-center gap-1 hover:underline"
          >
            查看日历 →
          </Link>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-3 sm:col-span-2">股票代码</div>
            <div className="col-span-1 text-center">类型</div>
            <div className="col-span-5 sm:col-span-7">事件简述</div>
            <div className="col-span-3 sm:col-span-2 text-right">重要性</div>
          </div>

          {/* Rows */}
          {loadingUpcoming ? (
            <div className="space-y-0 divide-y divide-border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-6 py-5">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                </div>
              ))}
            </div>
          ) : upcoming && upcoming.length > 0 ? (
            <div className="divide-y divide-border">
              {upcoming.slice(0, 10).map((e) => (
                <EventTableRow key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
              暂无持仓相关事件。前往{" "}
              <Link
                href="/settings"
                className="text-primary hover:underline font-medium"
              >
                持仓管理
              </Link>{" "}
              添加股票。
            </div>
          )}

          {/* Load more */}
          {upcoming && upcoming.length > 10 && (
            <div className="px-6 py-3 bg-muted/30 text-center border-t border-border">
              <Link
                href="/today"
                className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                查看全部 {upcoming.length} 个事件...
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ─── Section 2 + 3: Two-Column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Today's Focus (AI Cards) */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-primary text-xl">🧠</span>
            <h2 className="text-xl font-bold">
              今日关注{" "}
              <span className="text-primary text-xs font-medium ml-2 border border-primary/30 px-2 py-0.5 rounded-full bg-primary/5">
                AI 实时解读
              </span>
            </h2>
          </div>

          {loadingSummary ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-6"
                >
                  <div className="h-4 bg-muted rounded animate-pulse w-1/3 mb-3" />
                  <div className="h-5 bg-muted rounded animate-pulse w-2/3 mb-3" />
                  <div className="h-3 bg-muted rounded animate-pulse w-full" />
                </div>
              ))}
            </div>
          ) : todayEvents.length > 0 ? (
            <div className="space-y-4">
              {todayEvents.slice(0, 5).map((e) => (
                <TodayFocusCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              今日暂无持仓相关事件。
            </div>
          )}
        </div>

        {/* Right: Yesterday Review */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-0">
            <span className="text-primary text-xl">🕐</span>
            <h2 className="text-xl font-bold">昨夜回顾</h2>
          </div>

          {loadingYesterday ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2 mb-3" />
                  <div className="h-3 bg-muted rounded animate-pulse w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Earnings Review */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
                    📊 财报总结
                  </h3>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    Last 24h
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {earningsReview.length > 0 ? (
                    earningsReview
                      .slice(0, 4)
                      .map((e) => (
                        <EarningsReviewItem key={e.id} event={e} />
                      ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      暂无财报数据
                    </p>
                  )}
                </div>
              </div>

              {/* Macro Data Review */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
                    🌐 宏观数据
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  {macroReview.length > 0 ? (
                    macroReview.slice(0, 4).map((e) => (
                      <div
                        key={e.id}
                        className="flex justify-between items-center text-xs"
                      >
                        <span className="text-muted-foreground">
                          {e.macro_event_name || e.title}
                        </span>
                        <div className="flex items-center gap-2 font-medium">
                          {e.actual_value && <span>{e.actual_value}</span>}
                          {e.consensus && (
                            <span className="text-[10px] text-muted-foreground">
                              (预期 {e.consensus})
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      暂无宏观数据
                    </p>
                  )}
                </div>
              </div>

              {/* Insider Trades Review */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
                    ⚖️ 内部人交易
                  </h3>
                </div>
                <div className="p-4">
                  {insiderReview.length > 0 ? (
                    <div className="relative pl-6 border-l-2 border-border space-y-6">
                      {insiderReview.slice(0, 4).map((e) => (
                        <InsiderTradeItem key={e.id} event={e} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      暂无内部人交易
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
