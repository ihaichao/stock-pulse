"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, StockEvent } from "@/lib/api";
import { format, parseISO, isPast } from "date-fns";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Calendar, Star, Newspaper, FileText } from "lucide-react";

/* ── Helpers ── */

function eventIcon(type: string) {
  switch (type) {
    case "earnings": return "📊";
    case "insider": return "🤝";
    case "macro": return "🌍";
    default: return "📰";
  }
}

function eventLabel(type: string) {
  switch (type) {
    case "earnings": return "财报";
    case "insider": return "内部交易";
    case "macro": return "宏观事件";
    default: return type;
  }
}

/* ── Main Component ── */

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const symbol = ticker?.toUpperCase() || "";

  const { data: events, isLoading } = useQuery({
    queryKey: ["stock-events", symbol],
    queryFn: () => api.getStockEvents(symbol),
    enabled: !!symbol,
  });

  // Separate upcoming vs past events
  const now = new Date();
  const upcoming = (events || []).filter((e) => !isPast(parseISO(e.event_date)));
  const past = (events || []).filter((e) => isPast(parseISO(e.event_date)));

  return (
    <div className="pb-8 max-w-[1200px] mx-auto">
      {/* ── Stock Header ── */}
      <section className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 p-6 rounded-xl bg-card/50 border border-border">
        <div className="flex gap-5 items-center">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-primary flex items-center justify-center text-white shadow-lg">
            <span className="text-2xl font-black">{symbol.slice(0, 2)}</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{symbol}</h1>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold uppercase">
                NASDAQ
              </span>
            </div>
            <p className="text-muted-foreground mt-1">事件时间线与分析</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-border font-bold text-sm hover:bg-muted transition-colors"
          >
            ← 返回
          </Link>
          <Link
            href="/settings"
            className="px-5 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
          >
            管理自选
          </Link>
        </div>
      </section>

      {/* ── Tab Navigation ── */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        <span className="px-6 py-3 border-b-2 border-primary text-primary font-bold whitespace-nowrap text-sm">
          事件时间线
        </span>
        <span className="px-6 py-3 border-b-2 border-transparent text-muted-foreground whitespace-nowrap text-sm cursor-default">
          财务数据
        </span>
        <span className="px-6 py-3 border-b-2 border-transparent text-muted-foreground whitespace-nowrap text-sm cursor-default">
          分析师预测
        </span>
        <span className="px-6 py-3 border-b-2 border-transparent text-muted-foreground whitespace-nowrap text-sm cursor-default">
          新闻动态
        </span>
      </div>

      {/* ── Timeline Filter Chips ── */}
      <div className="flex flex-wrap gap-2 mb-8">
        <span className="px-4 py-1.5 rounded-full bg-primary text-white text-xs font-bold">全部事件</span>
        <span className="px-4 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">财报</span>
        <span className="px-4 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">内部交易</span>
        <span className="px-4 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">重大新闻</span>
      </div>

      {/* ── Event Timeline ── */}
      {isLoading ? (
        <div className="space-y-6 pl-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse bg-muted rounded-xl" />
          ))}
        </div>
      ) : (events?.length ?? 0) === 0 ? (
        <div className="text-muted-foreground text-sm rounded-xl border border-dashed border-border p-12 text-center bg-muted/10">
          暂无 {symbol} 的事件记录。前往{" "}
          <Link href="/settings" className="text-primary hover:underline font-medium">持仓管理</Link>{" "}
          添加更多股票。
        </div>
      ) : (
        <div className="relative pl-10 md:pl-16 pb-20">
          {/* Timeline Vertical Line */}
          <div className="absolute left-5 md:left-5 top-0 bottom-0 w-0.5 bg-primary/20" />

          <div className="space-y-8">
            {/* Upcoming Events */}
            {upcoming.map((e) => (
              <TimelineCard key={e.id} event={e} isUpcoming />
            ))}

            {/* Past Events */}
            {past.map((e) => (
              <TimelineCard key={e.id} event={e} isUpcoming={false} />
            ))}
          </div>
        </div>
      )}

      {/* ── AI Footer Quote ── */}
      {events && events.length > 0 && (
        <div className="mt-8 p-6 rounded-xl bg-muted/40 border border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-sm text-muted-foreground italic">
              &quot;{symbol} 事件时间线由 Stock Pulse AI 自动整理，仅供参考。&quot;
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase">总事件</p>
              <p className="font-bold">{events.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">即将到来</p>
              <p className="font-bold text-primary">{upcoming.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Timeline Card Sub-component ── */

function TimelineCard({ event, isUpcoming }: { event: StockEvent; isUpcoming: boolean }) {
  const date = parseISO(event.event_date);
  const dateStr = format(date, "yyyy年M月d日");
  const timeStr = event.report_time === "BMO" ? "(盘前)" : event.report_time === "AMC" ? "(盘后)" : "";

  return (
    <div className="relative group">
      {/* Timeline Dot */}
      <div
        className={`absolute -left-[30px] md:-left-[36px] top-0 w-10 h-10 rounded-full border-4 border-background flex items-center justify-center z-10 ${
          isUpcoming
            ? "bg-primary shadow-[0_0_15px_rgba(36,172,235,0.5)] animate-pulse"
            : "bg-muted-foreground/30"
        }`}
      >
        <span className="text-sm">{eventIcon(event.event_type)}</span>
      </div>

      {/* Card */}
      <Link href={`/event/${event.id}`} className="block">
        <div
          className={`rounded-xl p-6 transition-all hover:shadow-lg border ${
            isUpcoming
              ? "bg-primary/5 border-primary/30"
              : "bg-card/50 border-border hover:border-muted-foreground/30"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              {isUpcoming && (
                <span className="px-2 py-1 rounded bg-primary text-white text-[10px] font-bold uppercase tracking-widest">
                  即将到来
                </span>
              )}
              <h3 className="text-lg font-bold">{event.title}</h3>
            </div>
            <div className="text-primary font-bold text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {dateStr} {timeStr}
            </div>
          </div>

          {/* Description / AI Summary */}
          {(event.ai_summary || event.description) && (
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              {event.ai_summary ? (
                <>
                  <div className="flex items-center gap-2 mb-2 text-primary text-sm">
                    <span>✨</span>
                    <span className="font-bold">AI 摘要</span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{event.ai_summary}</p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>
              )}
            </div>
          )}

          {/* Earnings Data */}
          {event.event_type === "earnings" && (event.eps_actual != null || event.eps_estimate != null) && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">每股收益 (EPS)</span>
                  {event.eps_actual != null && event.eps_estimate != null && (
                    <span className={`font-bold text-xs ${
                      event.eps_actual >= event.eps_estimate ? "text-green-500" : "text-red-500"
                    }`}>
                      {event.eps_actual >= event.eps_estimate ? "超出预期 ✅" : "低于预期 ❌"}
                    </span>
                  )}
                </div>
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: "80%" }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>预期: {event.eps_estimate?.toFixed(2) ?? "—"}</span>
                  <span className="text-primary font-bold">实际: {event.eps_actual?.toFixed(2) ?? "—"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">总营收 (Revenue)</span>
                </div>
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: "75%" }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>预期: {event.revenue_estimate != null ? `${(event.revenue_estimate / 1e9).toFixed(1)}B` : "—"}</span>
                  <span className="text-primary font-bold">实际: {event.revenue_actual != null ? `${(event.revenue_actual / 1e9).toFixed(1)}B` : "—"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
