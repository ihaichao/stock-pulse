"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import EventCard from "@/components/EventCard";

type Tab = "preview" | "recap";

export default function TodayPage() {
  const [tab, setTab] = useState<Tab>("preview");

  const { data: todayEvents, isLoading: loadingToday } = useQuery({
    queryKey: ["today"],
    queryFn: api.getToday,
  });

  const { data: yesterdayEvents, isLoading: loadingYesterday } = useQuery({
    queryKey: ["yesterday"],
    queryFn: api.getYesterday,
  });

  const events = tab === "preview" ? todayEvents : yesterdayEvents;
  const loading = tab === "preview" ? loadingToday : loadingYesterday;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">今日事件</h1>
        <p className="text-gray-500 mt-1">掌握今天和昨晚发生的重要事件</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("preview")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "preview"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 今日预览
        </button>
        <button
          onClick={() => setTab("recap")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "recap"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🔄 昨夜复盘
        </button>
      </div>

      {/* Event list */}
      {loading ? (
        <div className="text-gray-400 text-sm">加载中...</div>
      ) : events && events.length > 0 ? (
        <div className="space-y-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-sm rounded-lg border border-dashed p-8 text-center">
          {tab === "preview" ? "今天暂时没有事件" : "昨天没有记录到的事件"}
        </div>
      )}
    </div>
  );
}
