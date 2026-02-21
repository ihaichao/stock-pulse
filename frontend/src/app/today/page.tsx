"use client";

import { useQuery } from "@tanstack/react-query";
import { api, StockEvent } from "@/lib/api";
import { importanceColor } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";

/* ── Helpers ── */

function getImportanceBadge(imp: string) {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: "重要", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
    medium: { label: "中等", cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
    low: { label: "普通", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  };
  return map[imp] ?? map.low;
}

function eventTypeLabel(type: string) {
  const map: Record<string, string> = {
    earnings: "公司财报",
    macro: "宏观数据",
    insider: "内部交易",
    fda: "FDA 审批",
  };
  return map[type] || type;
}

function sessionLabel(time: string | null): "pre" | "mid" | "post" {
  if (!time) return "mid";
  if (time === "BMO") return "pre";
  if (time === "AMC") return "post";
  return "mid";
}

const sessions = {
  pre: { label: "盘前 PRE-MARKET", cls: "bg-primary/20 text-primary border-primary/30" },
  mid: { label: "盘中 IN-TRADING", cls: "bg-green-500/20 text-green-500 border-green-500/30" },
  post: { label: "盘后 AFTER-HOURS", cls: "bg-orange-500/20 text-orange-500 border-orange-500/30" },
};

/* ── Main Component ── */

export default function TodayPage() {
  const [tab, setTab] = useState<"preview" | "recap">("preview");

  const { data: todayEvents, isLoading: loadingToday } = useQuery({
    queryKey: ["today"],
    queryFn: api.getToday,
  });

  const { data: yesterdayEvents, isLoading: loadingYesterday } = useQuery({
    queryKey: ["yesterday"],
    queryFn: api.getYesterday,
  });

  const todayStr = format(new Date(), "yyyy年M月d日", { locale: zhCN });

  // Group today's events by session
  const grouped = { pre: [] as StockEvent[], mid: [] as StockEvent[], post: [] as StockEvent[] };
  (todayEvents || []).forEach((e) => {
    const s = e.event_type === "earnings" ? sessionLabel(e.report_time) : "mid";
    grouped[s].push(e);
  });

  // Separate yesterday events by type
  const yEarnings = (yesterdayEvents || []).filter((e) => e.event_type === "earnings");
  const yMacro = (yesterdayEvents || []).filter((e) => e.event_type === "macro");
  const yInsider = (yesterdayEvents || []).filter((e) => e.event_type === "insider");

  return (
    <div className="pb-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">今日事件预览</h1>
          <p className="text-muted-foreground">
            实时跟踪全球市场关键经济事件与财报动态 · {todayStr}
          </p>
        </div>
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          <button
            onClick={() => setTab("preview")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === "preview" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            今日预览
          </button>
          <button
            onClick={() => setTab("recap")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === "recap" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            历史回顾
          </button>
        </div>
      </div>

      {/* ── Two-column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Timeline */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="text-primary">⏰</span>
              今日预览 (盘前/盘中/盘后)
            </h3>
            <div className="flex gap-3">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-red-500" /> 高重要性
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-yellow-500" /> 中重要性
              </span>
            </div>
          </div>

          {loadingToday ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse bg-muted rounded-xl" />
              ))}
            </div>
          ) : (todayEvents?.length ?? 0) === 0 ? (
            <div className="text-muted-foreground text-sm rounded-xl border border-dashed border-border p-12 text-center bg-muted/10">
              今日暂无事件。前往{" "}
              <Link href="/settings" className="text-primary hover:underline font-medium">持仓管理</Link>{" "}
              添加股票。
            </div>
          ) : (
            <div className="space-y-8">
              {(["pre", "mid", "post"] as const).map(
                (session) =>
                  grouped[session].length > 0 && (
                    <section key={session}>
                      {/* Session Header */}
                      <div className="flex items-center gap-4 mb-4">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${sessions[session].cls}`}>
                          {sessions[session].label}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      {/* Event Cards */}
                      <div className="space-y-3">
                        {grouped[session].map((e) => {
                          const badge = getImportanceBadge(e.importance);
                          return (
                            <Link key={e.id} href={`/event/${e.id}`} className="block">
                              <div className="bg-card/30 border border-border rounded-xl p-4 hover:border-primary/50 transition-colors group">
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex gap-4">
                                    <div className="text-primary font-mono font-bold pt-1 text-sm">
                                      {format(parseISO(e.event_date), "HH:mm")}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold">{e.ticker || e.title}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 border rounded font-bold ${badge.cls}`}>
                                          {badge.label}
                                        </span>
                                      </div>
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {e.description || e.title}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="text-xs text-muted-foreground mb-1">类型</div>
                                    <div className="text-xs font-semibold bg-muted px-2 py-1 rounded">
                                      {eventTypeLabel(e.event_type)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  )
              )}
            </div>
          )}
        </div>

        {/* Right Column: Yesterday Recap */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-primary">🔄</span>
            <h3 className="text-xl font-bold">昨夜复盘</h3>
          </div>

          {/* Earnings Recap Table */}
          <div className="bg-card/20 border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/50 border-b border-border flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">📊 公司财报</span>
              <span className="text-[10px] text-muted-foreground">单位: USD</span>
            </div>
            {loadingYesterday ? (
              <div className="h-24 animate-pulse bg-muted" />
            ) : yEarnings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2 font-medium">代码</th>
                      <th className="px-4 py-2 font-medium">EPS (实/预)</th>
                      <th className="px-4 py-2 font-medium text-right">营收</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {yEarnings.slice(0, 5).map((e) => (
                      <tr key={e.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-bold">
                          <Link href={`/stock/${e.ticker}`} className="hover:text-primary">{e.ticker}</Link>
                        </td>
                        <td className="px-4 py-3">
                          {e.eps_actual != null ? e.eps_actual.toFixed(2) : "—"}{" "}
                          / <span className="text-muted-foreground">{e.eps_estimate != null ? e.eps_estimate.toFixed(2) : "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {e.revenue_actual != null ? `${(e.revenue_actual / 1e9).toFixed(1)}B` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">昨日无财报数据</div>
            )}
          </div>

          {/* Macro Data Recap */}
          <div className="bg-card/20 border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/50 border-b border-border flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">🌍 宏观数据</span>
              <span className="text-[10px] text-muted-foreground font-mono">Live Reaction</span>
            </div>
            {loadingYesterday ? (
              <div className="h-24 animate-pulse bg-muted" />
            ) : yMacro.length > 0 ? (
              <div className="p-4 space-y-4">
                {yMacro.slice(0, 3).map((e) => (
                  <Link key={e.id} href={`/event/${e.id}`} className="block">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">{e.macro_event_name || e.title}</span>
                        {e.actual_value && (
                          <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">利好</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-border/30">
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground uppercase">实际</div>
                          <div className="text-sm font-bold">{e.actual_value || "—"}</div>
                        </div>
                        <div className="text-center border-x border-border/30">
                          <div className="text-[10px] text-muted-foreground uppercase">预期</div>
                          <div className="text-sm font-medium">{e.consensus || "—"}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground uppercase">前值</div>
                          <div className="text-sm font-medium">{e.previous_value || "—"}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">昨日无宏观数据</div>
            )}
          </div>

          {/* Insider Trading Recap */}
          <div className="bg-card/20 border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/50 border-b border-border flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">🛡️ 内部人交易</span>
              <Link href="/settings" className="text-[10px] text-primary hover:underline">查看全部</Link>
            </div>
            {loadingYesterday ? (
              <div className="h-24 animate-pulse bg-muted" />
            ) : yInsider.length > 0 ? (
              <div className="p-4 space-y-3">
                {yInsider.slice(0, 4).map((e) => (
                  <Link key={e.id} href={`/event/${e.id}`} className="block">
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-background flex items-center justify-center font-bold text-primary text-xs">
                          {(e.ticker || "??").slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{e.title}</div>
                          <div className="text-[10px] text-muted-foreground">{e.ticker}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-bold uppercase ${
                          e.filing_type?.toLowerCase().includes("sell") ? "text-red-500" : "text-green-500"
                        }`}>
                          {e.filing_type || "Form 4"}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">昨日无内部人交易</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
