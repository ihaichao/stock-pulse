"use client";

import { StockEvent } from "@/lib/api";
import { importanceEmoji, eventTypeIcon, importanceColor } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import Link from "next/link";

export default function EventCard({ event }: { event: StockEvent }) {
  const date = parseISO(event.event_date);

  return (
    <Link href={`/event/${event.id}`}>
      <div className="flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50 transition cursor-pointer">
        {/* Type icon */}
        <span className="text-xl mt-0.5">{eventTypeIcon(event.event_type)}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {event.ticker && (
              <span className="font-semibold text-brand-600">{event.ticker}</span>
            )}
            <span className="text-sm text-gray-500">
              {format(date, "MM/dd HH:mm")}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded border ${importanceColor(
                event.importance
              )}`}
            >
              {importanceEmoji(event.importance)}{" "}
              {event.importance === "high"
                ? "重要"
                : event.importance === "medium"
                ? "关注"
                : "一般"}
            </span>
          </div>

          <p className="mt-1 text-sm font-medium text-gray-900 truncate">
            {event.title}
          </p>

          {event.ai_summary && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
              {event.ai_summary}
            </p>
          )}

          {/* Earnings specific */}
          {event.event_type === "earnings" && (
            <div className="mt-1.5 flex gap-3 text-xs text-gray-500">
              {event.eps_estimate != null && (
                <span>预期 EPS: {event.eps_estimate.toFixed(2)}</span>
              )}
              {event.eps_actual != null && (
                <span>
                  实际 EPS: {event.eps_actual.toFixed(2)}{" "}
                  {event.eps_estimate != null &&
                    (event.eps_actual >= event.eps_estimate ? "✅ Beat" : "❌ Miss")}
                </span>
              )}
              {event.report_time && <span>{event.report_time}</span>}
            </div>
          )}

          {/* Macro specific */}
          {event.event_type === "macro" && (
            <div className="mt-1.5 flex gap-3 text-xs text-gray-500">
              {event.consensus && <span>预期: {event.consensus}</span>}
              {event.previous_value && <span>前值: {event.previous_value}</span>}
              {event.actual_value && (
                <span className="font-medium text-gray-700">
                  实际: {event.actual_value}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
