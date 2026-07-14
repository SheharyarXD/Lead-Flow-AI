import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Search,
  Filter,
  Clock,
  Mic,
  Calendar,
  Play,
} from "lucide-react";

export default function Calls() {
  const { organizationId } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [aiHandledFilter, setAiHandledFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "missed" | "voicemail">("all");

  const { data: calls, isLoading } = trpc.calls.list.useQuery({
    organizationId: organizationId!,
    limit: 50,
  }, { enabled: !!organizationId });

  const { data: stats } = trpc.calls.stats.useQuery({ organizationId: organizationId! }, { enabled: !!organizationId });

  const formatDurationMinSec = (secondsNum?: number | null) => {
    if (!secondsNum) return "00:00";
    const m = Math.floor(secondsNum / 60);
    const s = secondsNum % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatCallTimestamp = (dateInput?: Date | string | null) => {
    if (!dateInput) return "—";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const isToday = new Date().toDateString() === date.toDateString();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = yesterday.toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

    if (isToday) return `Today ${timeStr}`;
    if (isYesterday) return `Yesterday ${timeStr}`;
    
    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
  };

  const getAiOutcome = (call: { status: string; aiHandled?: boolean | null; aiSummary?: string | null }) => {
    if (call.status === "missed") {
      return { label: "No AI Interaction", className: "bg-zinc-50 border-zinc-200 text-zinc-500" };
    }
    if (call.status === "voicemail") {
      return { label: "Voicemail Transcribed", className: "bg-zinc-50 border-zinc-200 text-zinc-500" };
    }
    if (!call.aiHandled) {
      return { label: "No AI Interaction", className: "bg-zinc-50 border-zinc-200 text-zinc-500" };
    }
    const summary = call.aiSummary?.toLowerCase() || "";
    if (summary.includes("book") || summary.includes("appoint")) {
      return { label: "Appointment Booked", className: "bg-emerald-50 border-emerald-150 text-emerald-700" };
    }
    if (summary.includes("sched")) {
      return { label: "Follow-up Scheduled", className: "bg-indigo-50 border-indigo-150 text-indigo-700" };
    }
    return { label: "Qualification Complete", className: "bg-emerald-50 border-emerald-150 text-emerald-700" };
  };

  // Compute stats dynamically from the actual calls database data
  const totalCallsCount = stats?.total ?? 0;
  const missedCallsCount = stats?.missed ?? 0;
  const completedCallsCount = stats?.completed ?? 0;
  const avgDurationFormatted = formatDurationMinSec(stats?.avgDuration ?? 0);

  const aiHandledCount = calls?.filter(c => c.aiHandled).length ?? 0;
  const aiHandledRate = calls && calls.length > 0 ? Math.round((aiHandledCount / calls.length) * 100) : 0;

  const successOutcomeCount = calls?.filter(
    c => c.aiHandled && (c.aiSummary?.toLowerCase().includes("book") || c.aiSummary?.toLowerCase().includes("schedule") || c.aiSummary?.toLowerCase().includes("appoint"))
  ).length ?? 0;

  // Filter call list dynamically based on search, tab, direction, and AI handler filters
  const filteredCalls = calls?.filter((call) => {
    const matchesSearch = 
      call.phoneNumber.includes(searchQuery) ||
      (call.customer && `${call.customer.firstName} ${call.customer.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (call.aiSummary && call.aiSummary.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (activeTab === "completed" && call.status !== "completed") return false;
    if (activeTab === "missed" && call.status !== "missed") return false;
    if (activeTab === "voicemail" && call.status !== "voicemail") return false;

    if (directionFilter && directionFilter !== "all" && call.direction !== directionFilter) return false;

    if (aiHandledFilter && aiHandledFilter !== "all") {
      const isAI = call.aiHandled;
      if (aiHandledFilter === "ai" && !isAI) return false;
      if (aiHandledFilter === "manual" && isAI) return false;
    }

    return true;
  });

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto bg-[#fcfcfd] min-h-full select-none">
      
      {/* Header section with advanced search & export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950">Call History</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">
            Review AI-handled voice interactions and outcomes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Search calls..."
              className="pl-9 bg-white border-zinc-200 text-xs placeholder:text-zinc-400 h-9 rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-semibold hover:bg-zinc-50 flex items-center gap-1.5 shadow-none"
          >
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            Advanced Filters
          </Button>

          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all">
            Export Logs
          </Button>
        </div>
      </div>

      {/* Advanced Filters section */}
      {showFilters && (
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-4 transition-all">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none">
                <SelectValue placeholder="Direction: All" />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200">
                <SelectItem value="all">Direction: All</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>

            <Select value={aiHandledFilter} onValueChange={setAiHandledFilter}>
              <SelectTrigger className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none">
                <SelectValue placeholder="AI Handler: All" />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200">
                <SelectItem value="all">AI Handler: All</SelectItem>
                <SelectItem value="ai">AI Handled</SelectItem>
                <SelectItem value="manual">Manual Agent</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="ghost" 
              onClick={() => { setDirectionFilter(""); setAiHandledFilter(""); setSearchQuery(""); }}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 h-9 rounded-lg"
            >
              Reset Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Metrics Cards Grid (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Calls */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-500">Total Calls</span>
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{totalCallsCount}</p>
              <span className="text-[10px] font-bold text-zinc-400 block pt-0.5">{missedCallsCount} missed</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0">
              <Phone className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: AI Handled Rate */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-500">AI Handled Rate</span>
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{aiHandledRate}%</p>
              <span className="text-[10px] font-bold text-zinc-400 block pt-0.5">{aiHandledCount} of {calls?.length ?? 0} calls</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0">
              <Mic className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Success Outcomes */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-500">Success Outcomes</span>
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{successOutcomeCount}</p>
              <span className="text-[10px] font-bold text-zinc-400 block pt-0.5">{completedCallsCount} bookings confirmed</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Avg. Duration */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-500">Avg. Duration</span>
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{avgDurationFormatted}</p>
              <span className="text-[10px] font-bold text-zinc-400 block pt-0.5">Live average</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Filter Selector Row */}
      <div className="border-b border-zinc-200 flex gap-6 text-xs font-bold text-zinc-500 select-none">
        {(["all", "completed", "missed", "voicemail"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 capitalize transition-all border-b-2 -mb-0.5 relative ${
              activeTab === tab
                ? "border-indigo-600 text-indigo-600 font-extrabold"
                : "border-transparent hover:text-zinc-950"
            }`}
          >
            {tab}
            {tab === "missed" && missedCallsCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-600">
                {missedCallsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Call History Records Card Container */}
      <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl overflow-hidden">
        <div className="min-w-[850px] overflow-x-auto">
          
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-2 px-6 py-3.5 text-xs font-bold text-zinc-400 uppercase border-b border-zinc-100 bg-zinc-50/20 select-none">
            <div className="col-span-3">Contact</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Duration</div>
            <div className="col-span-2">Timestamp</div>
            <div className="col-span-2">AI Outcome</div>
            <div className="col-span-1 text-right pr-2">Actions</div>
          </div>

          {/* Table Content List */}
          <div className="divide-y divide-zinc-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-zinc-100 items-center">
                  <div className="col-span-3 flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full bg-zinc-100" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-28 bg-zinc-100" />
                      <Skeleton className="h-3 w-16 bg-zinc-100" />
                    </div>
                  </div>
                  <div className="col-span-2"><Skeleton className="h-4 w-16 bg-zinc-100" /></div>
                  <div className="col-span-2"><Skeleton className="h-4 w-12 bg-zinc-100" /></div>
                  <div className="col-span-2"><Skeleton className="h-4 w-20 bg-zinc-100" /></div>
                  <div className="col-span-2"><Skeleton className="h-5 w-24 rounded-md bg-zinc-100" /></div>
                  <div className="col-span-1"><Skeleton className="h-4 w-12 bg-zinc-100" /></div>
                </div>
              ))
            ) : !filteredCalls || filteredCalls.length === 0 ? (
              <div className="px-6 py-12 text-center text-xs text-zinc-400 font-semibold bg-white select-none">
                No call logs found matching your filters.
              </div>
            ) : (
              filteredCalls.map((call) => {
                const customerName = call.customer 
                  ? `${call.customer.firstName} ${call.customer.lastName}`
                  : "Unknown Customer";
                const initials = call.customer
                  ? `${call.customer.firstName[0] || ""}${call.customer.lastName[0] || ""}`
                  : "U";

                const isCallInbound = call.direction === "inbound";
                const durationFormatted = formatDurationMinSec(call.duration);
                const timestampFormatted = formatCallTimestamp(call.createdAt || call.startedAt);
                const outcomeInfo = getAiOutcome(call);

                return (
                  <div
                    key={call.id}
                    className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-zinc-50/50 cursor-pointer transition-colors text-xs text-zinc-950 font-semibold"
                  >
                    {/* Contact avatar and name info */}
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-zinc-650 text-xs shrink-0 select-none">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-zinc-950 block truncate">
                          {customerName}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400 block mt-0.5">
                          {call.phoneNumber}
                        </span>
                      </div>
                    </div>

                    {/* Direction type badge column */}
                    <div className="col-span-2 select-none">
                      <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-none border ${
                        isCallInbound 
                          ? "text-indigo-650 bg-indigo-50/50 border border-indigo-100/50"
                          : "text-violet-655 bg-violet-50/50 border border-violet-100/50"
                      }`}>
                        {isCallInbound ? "📞 Inbound" : "📞 Outbound"}
                      </Badge>
                    </div>

                    {/* Duration column with clock icon */}
                    <div className="col-span-2 flex items-center gap-1.5 text-zinc-500 font-medium select-none">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{durationFormatted}</span>
                    </div>

                    {/* Timestamp column */}
                    <div className="col-span-2 text-zinc-500 font-medium">
                      {timestampFormatted}
                    </div>

                    {/* AI Outcome badges column */}
                    <div className="col-span-2">
                      <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-none border ${outcomeInfo.className}`}>
                        {outcomeInfo.label}
                      </Badge>
                    </div>

                    {/* Actions column with play triggers */}
                    <div className="col-span-1 flex items-center justify-end pr-2 text-zinc-400">
                      <button
                        disabled={!call.recordingUrl}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (call.recordingUrl) window.open(call.recordingUrl, "_blank");
                        }}
                        className={`p-2 rounded-full border transition-all ${
                          call.recordingUrl
                            ? "border-indigo-200 text-indigo-650 bg-indigo-50/30 hover:bg-indigo-50 hover:scale-[1.05]"
                            : "border-zinc-100 text-zinc-300 bg-zinc-50 cursor-not-allowed"
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* Footer Pagination Controls */}
          <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-zinc-400 select-none">
            <span>Showing 1 to {filteredCalls?.length ?? 0} of {totalCallsCount} call logs</span>
            <div className="flex gap-1.5">
              <Button variant="outline" className="h-8 px-3 rounded-lg text-zinc-700 border-zinc-200 hover:bg-zinc-50 font-bold shadow-none" disabled>
                Previous
              </Button>
              <Button variant="outline" className="h-8 px-3 rounded-lg text-zinc-700 border-zinc-200 hover:bg-zinc-50 font-bold shadow-none" disabled>
                Next
              </Button>
            </div>
          </div>

        </div>
      </Card>

    </div>
  );
}
