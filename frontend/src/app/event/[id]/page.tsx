"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, StockEvent } from "@/lib/api";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { TrendingUp, TrendingDown, Share2, Plus, ChevronRight, Sparkles, Zap, CheckCircle } from "lucide-react";

/* ── Helpers ── */

function formatRevenue(val: number | null) {
  if (val == null) return "—";
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toFixed(2)}`;
}

function surprisePercent(actual: number | null, estimate: number | null): string {
  if (actual == null || estimate == null || estimate === 0) return "—";
  return ((actual - estimate) / Math.abs(estimate) * 100).toFixed(2) + "%";
}

/* ── Main Component ── */

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-detail", id],
    queryFn: () => api.getEventDetail(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-8 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-7xl mx-auto py-8 text-center text-muted-foreground">
        事件不存在或已被删除。
        <Link href="/" className="text-primary hover:underline ml-2">返回首页</Link>
      </div>
    );
  }

  const date = parseISO(event.event_date);
  const isEarnings = event.event_type === "earnings";
  const isMacro = event.event_type === "macro";
  const isBeat = isEarnings && event.eps_actual != null && event.eps_estimate != null && event.eps_actual >= event.eps_estimate;
  const epsSurprise = surprisePercent(event.eps_actual, event.eps_estimate);
  const revSurprise = surprisePercent(event.revenue_actual, event.revenue_estimate);

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* ── Breadcrumbs ── */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary transition-colors">首页</Link>
        <ChevronRight className="h-3 w-3" />
        {event.ticker ? (
          <>
            <Link href={`/stock/${event.ticker}`} className="hover:text-primary transition-colors">
              {event.ticker}
            </Link>
            <ChevronRight className="h-3 w-3" />
          </>
        ) : (
          <>
            <Link href="/today" className="hover:text-primary transition-colors">事件日历</Link>
            <ChevronRight className="h-3 w-3" />
          </>
        )}
        <span className="text-foreground font-medium truncate">{event.title}</span>
      </nav>

      {/* ── Hero Section ── */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{event.title}</h2>
            {isEarnings && event.eps_actual != null && (
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full border uppercase ${
                  isBeat
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                }`}
              >
                {isBeat ? "Earnings Beat" : "Earnings Miss"}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-lg">
            {event.ticker && `${event.ticker} — `}
            {event.description || format(date, "yyyy年M月d日")}
          </p>
        </div>
        <div className="flex gap-3">
          {event.ticker && (
            <Link
              href={`/stock/${event.ticker}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm"
            >
              <TrendingUp className="h-4 w-4" />
              查看个股
            </Link>
          )}
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 bg-muted font-semibold rounded-lg hover:bg-muted/70 transition-all text-sm"
          >
            返回首页
          </Link>
        </div>
      </div>

      {/* ── Key Metrics Grid (Earnings Only) ── */}
      {isEarnings && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* EPS Card */}
          <div className="bg-card/50 p-6 rounded-xl border border-border flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-muted-foreground font-medium">每股收益 (EPS)</span>
                {event.eps_actual != null && event.eps_estimate != null && (
                  <span className={`text-sm font-bold flex items-center gap-1 ${
                    isBeat ? "text-green-500" : "text-red-500"
                  }`}>
                    {isBeat ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {isBeat ? "+" : ""}{epsSurprise} vs 预期
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black">
                  {event.eps_actual != null ? `$${event.eps_actual.toFixed(2)}` : "—"}
                </span>
                {event.eps_estimate != null && (
                  <span className="text-muted-foreground text-sm line-through">
                    ${event.eps_estimate.toFixed(2)} (预期)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Revenue Card */}
          <div className="bg-card/50 p-6 rounded-xl border border-border flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-muted-foreground font-medium">总营收 (Revenue)</span>
                {event.revenue_actual != null && event.revenue_estimate != null && (
                  <span className={`text-sm font-bold flex items-center gap-1 ${
                    event.revenue_actual >= event.revenue_estimate ? "text-green-500" : "text-red-500"
                  }`}>
                    {event.revenue_actual >= event.revenue_estimate ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {event.revenue_actual >= event.revenue_estimate ? "+" : ""}{revSurprise} vs 预期
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black">
                  {formatRevenue(event.revenue_actual)}
                </span>
                {event.revenue_estimate != null && (
                  <span className="text-muted-foreground text-sm line-through">
                    {formatRevenue(event.revenue_estimate)} (预期)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Macro Data Grid ── */}
      {isMacro && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-xl border border-border bg-card/50 text-center">
            <p className="text-xs text-muted-foreground uppercase mb-2">前值</p>
            <p className="text-2xl font-black">{event.previous_value || "—"}</p>
          </div>
          <div className="p-5 rounded-xl border border-border bg-card/50 text-center">
            <p className="text-xs text-muted-foreground uppercase mb-2">预测值</p>
            <p className="text-2xl font-black">{event.consensus || "—"}</p>
          </div>
          <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 text-center">
            <p className="text-xs text-primary uppercase mb-2">公布值</p>
            <p className="text-2xl font-black text-primary">{event.actual_value || "待公布"}</p>
          </div>
        </div>
      )}

      {/* ── Two-Column: AI Summary + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: AI Summary */}
        <div className="lg:col-span-2 space-y-8">
          {/* AI Summary */}
          {event.ai_summary && (
            <section className="bg-primary/5 border border-primary/20 p-6 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="h-16 w-16" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold">AI 事件总结</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">{event.ai_summary}</p>
            </section>
          )}

          {/* AI Detail */}
          {event.ai_detail && (
            <section className="bg-primary/5 border border-primary/20 p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold">AI 详细解读</h3>
              </div>
              <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm">
                {event.ai_detail}
              </div>
            </section>
          )}

          {/* Description Fallback */}
          {!event.ai_summary && !event.ai_detail && event.description && (
            <section className="bg-card/50 border border-border p-6 rounded-xl">
              <h3 className="text-xl font-bold mb-4">事件描述</h3>
              <p className="text-muted-foreground leading-relaxed">{event.description}</p>
            </section>
          )}
        </div>

        {/* Right: Metadata */}
        <div className="space-y-6">
          {/* Event Info */}
          <section className="bg-card/50 border border-border p-6 rounded-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              事件信息
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-muted-foreground text-sm">事件类型</span>
                <span className="font-bold text-sm capitalize">{event.event_type}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-muted-foreground text-sm">事件日期</span>
                <span className="font-bold text-sm">{format(date, "yyyy-MM-dd")}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-muted-foreground text-sm">重要性</span>
                <span className={`font-bold text-sm ${
                  event.importance === "high" ? "text-red-500" :
                  event.importance === "medium" ? "text-amber-500" : "text-slate-400"
                }`}>
                  {event.importance === "high" ? "🔴 高" : event.importance === "medium" ? "🟡 中" : "⚪ 低"}
                </span>
              </div>
              {event.report_time && (
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-muted-foreground text-sm">发布时间</span>
                  <span className="font-bold text-sm">
                    {event.report_time === "BMO" ? "盘前" : event.report_time === "AMC" ? "盘后" : event.report_time}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* SEC Filing Link */}
          {event.filing_url && (
            <a
              href={event.filing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors border border-primary/20 text-center"
            >
              📄 查看 SEC 原文 →
            </a>
          )}
        </div>
      </div>

      {/* ── Financial Data Table (Earnings) ── */}
      {isEarnings && (event.eps_actual != null || event.revenue_actual != null) && (
        <section className="mt-8 bg-card/50 border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h3 className="font-bold">详细财务数据对照表</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/20 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">指标名称</th>
                  <th className="px-6 py-3 font-medium">实际 (Actual)</th>
                  <th className="px-6 py-3 font-medium">预测 (Forecast)</th>
                  <th className="px-6 py-3 font-medium">惊奇度 (Surprise)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {event.eps_actual != null && (
                  <tr>
                    <td className="px-6 py-4 font-semibold">每股收益 (EPS)</td>
                    <td className="px-6 py-4">${event.eps_actual.toFixed(2)}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {event.eps_estimate != null ? `$${event.eps_estimate.toFixed(2)}` : "—"}
                    </td>
                    <td className={`px-6 py-4 font-bold ${isBeat ? "text-green-500" : "text-red-500"}`}>
                      {isBeat ? "+" : ""}{epsSurprise}
                    </td>
                  </tr>
                )}
                {event.revenue_actual != null && (
                  <tr>
                    <td className="px-6 py-4 font-semibold">总营收 (Revenue)</td>
                    <td className="px-6 py-4">{formatRevenue(event.revenue_actual)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatRevenue(event.revenue_estimate)}</td>
                    <td className={`px-6 py-4 font-bold ${
                      event.revenue_actual >= (event.revenue_estimate ?? 0) ? "text-green-500" : "text-red-500"
                    }`}>
                      {event.revenue_actual >= (event.revenue_estimate ?? 0) ? "+" : ""}{revSurprise}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Disclaimer ── */}
      <div className="mt-8 text-xs text-muted-foreground border-t border-border pt-4 text-center">
        ⚠️ 以上内容由 AI 自动生成，仅供信息参考，不构成投资建议。数据来源：Yahoo Finance, SEC EDGAR
      </div>
    </div>
  );
}
