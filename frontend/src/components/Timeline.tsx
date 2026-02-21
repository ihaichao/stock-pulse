import { StockEvent } from "@/lib/api";
import { importanceEmoji, eventTypeIcon } from "@/lib/utils";
import { format, parseISO, isToday } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
      <div className="flex w-max space-x-4 p-4">
        {days.map((day) => {
          const dayDate = parseISO(day);
          const today = isToday(dayDate);
          return (
            <Card
              key={day}
              className={`w-[200px] shrink-0 ${
                today ? "border-primary bg-primary/5" : ""
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {format(dayDate, "MM/dd EEE")}
                  {today && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">
                      今天
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                {grouped[day].slice(0, 5).map((e) => (
                  <Link key={e.id} href={`/event/${e.id}`} className="block">
                    <div className="flex items-center gap-2 text-sm hover:bg-accent hover:text-accent-foreground rounded p-1 transition-colors cursor-pointer">
                      <span className="text-base">{eventTypeIcon(e.event_type)}</span>
                      <span className="font-medium truncate flex-1">
                        {e.ticker || e.macro_event_name}
                      </span>
                      <span className="text-xs text-muted-foreground mr-1">
                        {importanceEmoji(e.importance)}
                      </span>
                    </div>
                  </Link>
                ))}
                {grouped[day].length > 5 && (
                  <div className="text-xs text-muted-foreground pl-1 pt-1">
                    还有 {grouped[day].length - 5} 个
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
