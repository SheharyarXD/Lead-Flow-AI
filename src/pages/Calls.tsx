import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Voicemail,
  Bot,
  Clock,
  Filter,
  BarChart3,
  Mic,
} from "lucide-react";

const ORG_ID = 1;

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <Phone className="w-4 h-4" /> },
  missed: { label: "Missed", color: "bg-red-50 text-red-700 border-red-200", icon: <PhoneMissed className="w-4 h-4" /> },
  voicemail: { label: "Voicemail", color: "bg-violet-50 text-violet-700 border-violet-200", icon: <Voicemail className="w-4 h-4" /> },
  in_progress: { label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200", icon: <Phone className="w-4 h-4" /> },
  queued: { label: "Queued", color: "bg-gray-50 text-gray-500 border-gray-200", icon: <Clock className="w-4 h-4" /> },
  failed: { label: "Failed", color: "bg-red-50 text-red-700 border-red-200", icon: <PhoneMissed className="w-4 h-4" /> },
};

export default function Calls() {
  const [statusFilter, setStatusFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: calls, isLoading } = trpc.call.list.useQuery({
    organizationId: ORG_ID,
    status: statusFilter || undefined,
    direction: directionFilter || undefined,
    limit: 50,
  });

  const { data: stats } = trpc.call.stats.useQuery({ organizationId: ORG_ID });

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Call History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage all AI and manual calls.
          </p>
        </div>
        <Button variant="outline">
          <Mic className="w-4 h-4 mr-2" />
          Call Settings
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Calls", value: stats?.total ?? 0, icon: Phone },
          { label: "Completed", value: stats?.completed ?? 0, icon: PhoneIncoming },
          { label: "Missed", value: stats?.missed ?? 0, icon: PhoneMissed },
          { label: "Avg Duration", value: `${stats?.avgDuration ?? 0}s`, icon: Clock },
        ].map((stat) => (
          <Card key={stat.label} className="border-muted">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <stat.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger><SelectValue placeholder="Direction" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={() => { setStatusFilter(""); setDirectionFilter(""); }}>Clear</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Call Records ({calls?.length ?? 0})</CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              <BarChart3 className="w-3 h-3 mr-1" />
              {Math.floor((stats?.totalDuration ?? 0) / 60)}m total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="min-w-[700px]">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase border-b">
                <div className="col-span-1">Dir</div>
                <div className="col-span-2">Phone</div>
                <div className="col-span-2">Customer</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Duration</div>
                <div className="col-span-2">AI Summary</div>
                <div className="col-span-1">Date</div>
                <div className="col-span-1">Recording</div>
              </div>

              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 border-b">
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))
              ) : calls?.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No calls found.
                </div>
              ) : (
                calls?.map((call) => {
                  const status = statusConfig[call.status];
                  return (
                    <div key={call.id} className="grid grid-cols-12 gap-2 px-5 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors items-center">
                      <div className="col-span-1">
                        {call.direction === "inbound" ? (
                          <PhoneIncoming className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="col-span-2 text-sm font-medium">{call.phoneNumber}</div>
                      <div className="col-span-2 text-sm">
                        {call.customer ? `${call.customer.firstName} ${call.customer.lastName}` : "-"}
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className={`text-[10px] ${status?.color || ""}`}>
                          {status?.label || call.status}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-sm text-muted-foreground">
                        {formatDuration(call.duration)}
                      </div>
                      <div className="col-span-2">
                        {call.aiHandled ? (
                          <div className="flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs text-muted-foreground truncate">{call.aiSummary || "AI Handled"}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Manual</span>
                        )}
                      </div>
                      <div className="col-span-1 text-xs text-muted-foreground">
                        {call.createdAt ? new Date(call.createdAt).toLocaleDateString() : ""}
                      </div>
                      <div className="col-span-1">
                        {call.recordingUrl ? (
                          <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-secondary/80">
                            <Mic className="w-3 h-3 mr-1" />
                            Play
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
