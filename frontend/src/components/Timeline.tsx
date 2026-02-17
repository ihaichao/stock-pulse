"use client";

import { StockEvent } from "@/lib/api";
import { importanceEmoji, eventTypeIcon } from "@/lib/utils";
import { format, parseISO, isToday } from "date-fns";
import Link from "next/link";

interface TimelineProps {
  events: StockEvent[];
}

export default function Timeline({ events }: TimelineProps) {
  // Group events by date
  const grouped = events.reduce<Record<string, StockEvent[]>>((acc, e) => {
    const day = format(parseISO(e.event_date), "yyyy-MM-dd");
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});

  const days = Object.keys(grouped).sort();

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {days.map((day) => {
        const dayDate = parseISO(day);
        const today = isToday(dayDate);
        return (
          <div
            key={day}
            className={`flex-shrink-0 w-48 rounded-lg border p-3 ${
              today ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"
            }`}
          >
            <div
              className={`text-xs font-semibold mb-2 ${
                today ? "text-brand-700" : "text-gray-500"
              }`}
            >
              {format(dayDate, "MM/dd EEE")}
              {today && (
                <span className="ml-1 bg-brand-600 text-white px-1.5 py-0.5 rounded text-[10px]">
                  TODAY
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {grouped[day].slice(0, 5).map((e) => (
                <Link key={e.id} href={`/event/${e.id}`}>
                  <div className="text-xs hover:bg-gray-100 rounded p-1 cursor-pointer truncate">
                    <span>{eventTypeIcon(e.event_type)}</span>{" "}
                    <span className="font-medium">{e.ticker || e.macro_event_name}</span>{" "}
                    <span className="text-gray-500">{importanceEmoji(e.importance)}</span>
                  </div>
                </Link>
              ))}
              {grouped[day].length > 5 && (
                <div className="text-[10px] text-gray-400 pl-1">
                  +{grouped[day].length - 5} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
