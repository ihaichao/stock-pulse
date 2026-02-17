"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import EventCard from "@/components/EventCard";

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const symbol = ticker?.toUpperCase() || "";

  const { data: events, isLoading } = useQuery({
    queryKey: ["stock-events", symbol],
    queryFn: () => api.getStockEvents(symbol),
    enabled: !!symbol,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{symbol} 事件时间线</h1>
        <p className="text-gray-500 mt-1">
          {symbol} 的历史和未来事件（财报、内部人交易、分析师评级等）
        </p>
      </div>

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
          暂无 {symbol} 的事件记录
        </div>
      )}
    </div>
  );
}
