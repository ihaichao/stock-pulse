"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, StockEvent } from "@/lib/api";
import { importanceEmoji, eventTypeIcon, importanceColor } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import Link from "next/link";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-detail", id],
    queryFn: () => api.getEventDetail(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="text-gray-400 text-sm py-8">加载中...</div>;
  }

  if (!event) {
    return <div className="text-gray-400 text-sm py-8">事件不存在</div>;
  }

  const date = parseISO(event.event_date);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link */}
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← 返回仪表盘
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{eventTypeIcon(event.event_type)}</span>
          {event.ticker && (
            <Link
              href={`/stock/${event.ticker}`}
              className="text-xl font-bold text-brand-600 hover:underline"
            >
              {event.ticker}
            </Link>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded border ${importanceColor(
              event.importance
            )}`}
          >
            {importanceEmoji(event.importance)} {event.importance}
          </span>
          <span className="text-sm text-gray-500">
            {format(date, "yyyy-MM-dd HH:mm")}
          </span>
        </div>
        <h1 className="text-xl font-bold">{event.title}</h1>
        {event.description && (
          <p className="text-gray-600">{event.description}</p>
        )}
      </div>

      {/* Data fields */}
      {event.event_type === "earnings" && (
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="font-semibold text-sm text-gray-700">📊 财报数据</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {event.eps_estimate != null && (
              <div>
                <span className="text-gray-500">预期 EPS:</span>{" "}
                {event.eps_estimate.toFixed(2)}
              </div>
            )}
            {event.eps_actual != null && (
              <div>
                <span className="text-gray-500">实际 EPS:</span>{" "}
                <span className="font-medium">
                  {event.eps_actual.toFixed(2)}{" "}
                  {event.eps_estimate != null &&
                    (event.eps_actual >= event.eps_estimate
                      ? "✅ Beat"
                      : "❌ Miss")}
                </span>
              </div>
            )}
            {event.revenue_estimate != null && (
              <div>
                <span className="text-gray-500">预期营收:</span>{" "}
                {(event.revenue_estimate / 1e9).toFixed(2)}B
              </div>
            )}
            {event.revenue_actual != null && (
              <div>
                <span className="text-gray-500">实际营收:</span>{" "}
                {(event.revenue_actual / 1e9).toFixed(2)}B
              </div>
            )}
            {event.report_time && (
              <div>
                <span className="text-gray-500">发布时间:</span>{" "}
                {event.report_time === "BMO" ? "盘前" : event.report_time === "AMC" ? "盘后" : event.report_time}
              </div>
            )}
          </div>
        </div>
      )}

      {event.event_type === "macro" && (
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="font-semibold text-sm text-gray-700">📅 宏观数据</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {event.consensus && (
              <div>
                <span className="text-gray-500">市场预期:</span> {event.consensus}
              </div>
            )}
            {event.previous_value && (
              <div>
                <span className="text-gray-500">前值:</span> {event.previous_value}
              </div>
            )}
            {event.actual_value && (
              <div>
                <span className="text-gray-500">实际值:</span>{" "}
                <span className="font-semibold">{event.actual_value}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {event.filing_url && (
        <div>
          <a
            href={event.filing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:underline"
          >
            📄 查看 SEC 原文 →
          </a>
        </div>
      )}

      {/* AI Summary */}
      {event.ai_summary && (
        <div className="rounded-lg border bg-blue-50 border-blue-200 p-4">
          <h3 className="font-semibold text-sm text-blue-700 mb-2">
            🤖 AI 简要解读
          </h3>
          <p className="text-sm text-gray-800">{event.ai_summary}</p>
        </div>
      )}

      {/* AI Detail */}
      {event.ai_detail && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold text-sm text-gray-700">
            🔍 AI 详细解读
          </h3>
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {event.ai_detail}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 border-t pt-4">
        ⚠️ 以上内容由 AI 自动生成，仅供信息参考，不构成投资建议。
      </div>
    </div>
  );
}
