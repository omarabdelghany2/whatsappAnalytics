import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPlus, UserMinus, Users, MessageSquare, TrendingUp, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totalMembers: number;
  joined: number;
  left: number;
  messageCount: number;
  activeUsers: number;
}

interface AnalyticsPanelProps {
  analytics: AnalyticsData;
  translateMode: boolean;
}

export function AnalyticsPanel({ analytics, translateMode }: AnalyticsPanelProps) {
  const [mode, setMode] = useState<"all" | "specific">("all");
  const [selectedDate, setSelectedDate] = useState<Date>();

  const stats = [
    {
      title: translateMode ? "总成员" : "Total Members",
      value: analytics.totalMembers,
      icon: Users,
      color: "text-primary",
    },
    {
      title: translateMode ? "加入成员" : "Members Joined",
      value: `+${analytics.joined}`,
      icon: UserPlus,
      color: "text-primary",
    },
    {
      title: translateMode ? "离开成员" : "Members Left",
      value: `-${analytics.left}`,
      icon: UserMinus,
      color: "text-destructive",
    },
    {
      title: translateMode ? "总消息数" : "Total Messages",
      value: analytics.messageCount,
      icon: MessageSquare,
      color: "text-foreground",
    },
    {
      title: translateMode ? "活跃用户" : "Active Users",
      value: analytics.activeUsers,
      icon: TrendingUp,
      color: "text-primary",
    },
  ];

  return (
    <div className="h-full border-l border-border bg-card overflow-y-auto">
      <div className="p-4 border-b border-border space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {translateMode ? "分析" : "Analytics"}
        </h2>
        <div className="flex gap-2">
          <Button
            variant={mode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("all")}
            className="flex-1"
          >
            {translateMode ? "所有天数" : "All Days"}
          </Button>
          <Button
            variant={mode === "specific" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("specific")}
            className="flex-1"
          >
            {translateMode ? "特定日期" : "Specific Day"}
          </Button>
        </div>
        {mode === "specific" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "PPP")
                ) : (
                  <span>{translateMode ? "选择日期" : "Pick a date"}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="p-4 space-y-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                {stat.title}
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

