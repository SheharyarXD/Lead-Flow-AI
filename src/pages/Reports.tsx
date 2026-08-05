import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BarChart3,
  Download,
  Users,
  PhoneCall,
  CheckSquare,
  TrendingUp,
  FileSpreadsheet,
  Clock,
  Briefcase,
  UserCheck,
} from "lucide-react";

export default function Reports() {
  const { organizationId } = useOrganization();
  const [isExportingLeads, setIsExportingLeads] = useState(false);
  const [isExportingCalls, setIsExportingCalls] = useState(false);

  // Fetch report metrics
  const { data: reportData, isLoading: reportsLoading } = trpc.dashboard.reports.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );

  // Fetch lists for CSV exports
  const { data: leadsData } = trpc.lead.list.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );

  const { data: callsData } = trpc.calls.list.useQuery(
    { organizationId: organizationId!, limit: 500 },
    { enabled: !!organizationId }
  );

  const formatDuration = (secondsNum: number) => {
    const m = Math.floor(secondsNum / 60);
    const s = secondsNum % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const convertToCSV = (headers: string[], rows: string[][]) => {
    return [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${(val || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
  };

  const handleExportLeads = () => {
    if (!leadsData || leadsData.length === 0) {
      toast.error("No leads available to export.");
      return;
    }
    setIsExportingLeads(true);
    try {
      const headers = ["ID", "First Name", "Last Name", "Email", "Phone", "Status", "Estimated Value", "Created At"];
      const rows = leadsData.map((l) => [
        String(l.id),
        l.firstName || "",
        l.lastName || "",
        l.email || "",
        l.phone || "",
        l.status || "new",
        String(l.estimatedValue || 0),
        l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "",
      ]);
      const csv = convertToCSV(headers, rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `leadflow_leads_${Date.now()}.csv`;
      link.click();
      toast.success("Leads data exported to CSV");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExportingLeads(false);
    }
  };

  const handleExportCalls = () => {
    if (!callsData || callsData.length === 0) {
      toast.error("No call history available to export.");
      return;
    }
    setIsExportingCalls(true);
    try {
      const headers = ["ID", "Phone Number", "Direction", "Duration (seconds)", "Status", "AI Handled", "Timestamp"];
      const rows = callsData.map((c) => [
        String(c.id),
        c.phoneNumber || "",
        c.direction || "outbound",
        String(c.duration || 0),
        c.status || "queued",
        c.aiHandled ? "Yes" : "No",
        c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
      ]);
      const csv = convertToCSV(headers, rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `leadflow_calls_${Date.now()}.csv`;
      link.click();
      toast.success("Calls data exported to CSV");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExportingCalls(false);
    }
  };

  const totalCalls = reportData?.callOutcomes.reduce((acc, curr) => acc + curr.count, 0) ?? 0;
  const totalLeads = reportData?.leadsByStatus.reduce((acc, curr) => acc + curr.count, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 bg-[#fcfcfd]">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Analytics & Reports
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Track call performance metrics, leads pipeline, and team task resolution rates.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            onClick={handleExportLeads}
            disabled={isExportingLeads}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none border-zinc-200 text-zinc-700 font-bold hover:bg-zinc-50 hover:text-zinc-900 text-xs h-9 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Export Leads
          </Button>
          <Button
            onClick={handleExportCalls}
            disabled={isExportingCalls}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none border-zinc-200 text-zinc-700 font-bold hover:bg-zinc-50 hover:text-zinc-900 text-xs h-9 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Export Call Logs
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Leads Managed</span>
            <Users className="w-4 h-4 text-indigo-600 shrink-0" />
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-extrabold text-zinc-950">{totalLeads}</p>
            )}
            <p className="text-[10px] text-zinc-400 mt-1">Leads active across pipelines</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Call Volume</span>
            <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0" />
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-extrabold text-zinc-950">{totalCalls}</p>
            )}
            <p className="text-[10px] text-zinc-400 mt-1">Calls handled by agents and AI</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Conversion Efficiency</span>
            <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-extrabold text-zinc-950">
                {totalLeads > 0
                  ? Math.round(
                      ((reportData?.leadsByStatus.find((l) => l.status === "won")?.count ?? 0) / totalLeads) * 100
                    )
                  : 0}
                %
              </p>
            )}
            <p className="text-[10px] text-zinc-400 mt-1">Percentage of won lead contracts</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Call Outcomes Bar Chart */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-indigo-600" />
              Call Outcome Distribution
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Overview of connected vs. missed calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : !reportData || reportData.callOutcomes.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No calls logged yet.</p>
            ) : (
              reportData.callOutcomes.map((c) => {
                const percentage = totalCalls > 0 ? Math.round((c.count / totalCalls) * 100) : 0;
                return (
                  <div key={c.status} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-zinc-700">
                      <span className="capitalize">{c.status.replace("_", " ")}</span>
                      <span>
                        {c.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Lead Pipelines */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              Lead Status Metrics
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Active tracking of lead progression.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : !reportData || reportData.leadsByStatus.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No leads created yet.</p>
            ) : (
              reportData.leadsByStatus.map((l) => {
                const percentage = totalLeads > 0 ? Math.round((l.count / totalLeads) * 100) : 0;
                return (
                  <div key={l.status} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-zinc-700">
                      <span className="capitalize">{l.status}</span>
                      <span>
                        {l.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Activity and Performance */}
      <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-zinc-100 pb-4">
          <CardTitle className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            Agent & Collector Performance
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Performance metrics tracked per team member.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-150 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 sm:px-6">Team Member</th>
                  <th className="py-3 px-4">Leads Assigned</th>
                  <th className="py-3 px-4">Calls Completed</th>
                  <th className="py-3 px-4">Total Talk Time</th>
                  <th className="py-3 px-4">Tasks Completed</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Activity Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reportsLoading ? (
                  [1, 2].map((i) => (
                    <tr key={i}>
                      <td className="py-4 px-6"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-4 px-6 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : !reportData || reportData.teamPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-400">
                      No team members configured yet.
                    </td>
                  </tr>
                ) : (
                  reportData.teamPerformance.map((member) => (
                    <tr key={member.userId} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="font-bold text-zinc-950">{member.name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{member.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-700">{member.leadsAssigned}</td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-700">{member.callsCompleted}</td>
                      <td className="py-3.5 px-4 font-medium text-zinc-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          {formatDuration(member.totalTalkTime)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-700">
                        <div className="flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{member.tasksCompleted}</span>
                          <span className="text-[10px] text-zinc-400">({member.tasksPending} pending)</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <Badge className="bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border border-zinc-200 capitalize font-bold text-[10px] px-2 py-0.5 rounded-md">
                          {member.role}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
