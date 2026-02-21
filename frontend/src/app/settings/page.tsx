"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import AddTicker from "@/components/AddTicker";
import Link from "next/link";
import { Briefcase, Plus, Trash2, ExternalLink, CalendarDays } from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: api.getPortfolio,
  });

  const removeMutation = useMutation({
    mutationFn: (ticker: string) => api.removeTicker(ticker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
      queryClient.invalidateQueries({ queryKey: ["today-events"] });
      queryClient.invalidateQueries({ queryKey: ["yesterday-events"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">持仓管理</h1>
            <p className="text-sm text-muted-foreground">
              添加你持有或关注的美股，系统会自动追踪相关事件
            </p>
          </div>
        </div>
      </div>

      {/* Add Ticker Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">添加股票</h3>
        </div>
        <AddTicker />
      </div>

      {/* Portfolio List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">
            我的持仓
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {portfolio?.length || 0} 只股票
          </span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-16 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-8 w-14 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : portfolio && portfolio.length > 0 ? (
          <div className="divide-y divide-border">
            {portfolio.map((item) => (
              <div
                key={item.ticker}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  {/* Ticker Logo */}
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {item.ticker.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <Link
                      href={`/stock/${item.ticker}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {item.ticker}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <CalendarDays className="h-3 w-3" />
                      添加于 {new Date(item.added_at).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeMutation.mutate(item.ticker)}
                  disabled={removeMutation.isPending}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">还没有添加任何股票</p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              在上方输入股票代码开始追踪
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
