"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Timeline from "@/components/Timeline";
import EventCard from "@/components/EventCard";

export default function Dashboard() {
  const { data: upcoming, isLoading: loadingUpcoming } = useQuery({
    queryKey: ["upcoming"],
    queryFn: api.getUpcoming,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["daily-summary"],
    queryFn: api.getDailySummary,
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-gray-500 mt-1">未来 7 天与你持仓相关的事件</p>
      </div>

      {/* 7-day Timeline */}
      <section>
        <h2 className="text-lg font-semibold mb-3">📅 事件时间线</h2>
        {loadingUpcoming ? (
          <div className="text-gray-400 text-sm">加载中...</div>
        ) : upcoming && upcoming.length > 0 ? (
          <Timeline events={upcoming} />
        ) : (
          <div className="text-gray-400 text-sm rounded-lg border border-dashed p-6 text-center">
            暂无事件。去{" "}
            <a href="/settings" className="text-brand-600 underline">
              持仓管理
            </a>{" "}
            添加你关注的股票。
          </div>
        )}
      </section>

      {/* Today's Summary */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          🔔 今日关注
          {summary && summary.high_importance > 0 && (
            <span className="ml-2 text-sm text-red-600">
              {summary.high_importance} 个重要事件
            </span>
          )}
        </h2>
        {loadingSummary ? (
          <div className="text-gray-400 text-sm">加载中...</div>
        ) : summary && summary.events.length > 0 ? (
          <div className="space-y-2">
            {summary.events.slice(0, 10).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-sm">今天没有需要关注的事件</div>
        )}
      </section>
    </div>
  );
}
