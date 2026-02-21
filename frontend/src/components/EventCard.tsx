import { StockEvent } from "@/lib/api";
import { importanceEmoji, eventTypeIcon, importanceColor } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, DollarSign } from "lucide-react";

export default function EventCard({ event }: { event: StockEvent }) {
  const date = parseISO(event.event_date);

  return (
    <Link href={`/event/${event.id}`} className="block">
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
              {eventTypeIcon(event.event_type)}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {event.ticker && (
                    <Badge variant="outline" className="font-bold text-primary border-primary/30">
                      {event.ticker}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(date, "MM/dd HH:mm")}
                  </span>
                </div>
                <Badge 
                  variant={event.importance === "high" ? "destructive" : "secondary"}
                  className="text-[10px] h-5"
                >
                  {importanceEmoji(event.importance)} {event.importance === "high" ? "高" : event.importance === "medium" ? "中" : "低"}
                </Badge>
              </div>

              {/* Title & Desc */}
              <h4 className="text-sm font-semibold leading-tight truncate pr-2">
                {event.title}
              </h4>
              {event.ai_summary && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {event.ai_summary}
                </p>
              )}

              {/* Specific Data stats */}
              {(event.event_type === "earnings" || event.event_type === "macro") && (
                <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
                  {event.eps_estimate && (
                     <div className="flex items-center gap-1">
                       <DollarSign className="h-3 w-3" />
                       <span>预期 EPS: {event.eps_estimate}</span>
                     </div>
                  )}
                  {event.actual_value && (
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      <span>实际: {event.actual_value}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
