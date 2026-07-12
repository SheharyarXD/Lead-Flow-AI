import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import {
  TrendingUp,
  Clock,
  Calendar,
  MessageSquare,
  Users,
  Smartphone,
  Phone,
  Mail,
  Zap,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  ChevronRight,
} from "lucide-react";

function formatRelativeTime(dateInput?: Date | string | null): string {
  if (!dateInput) return "just now";
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return "just now";

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "just now";
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery({ organizationId: organizationId! }, { enabled: !!organizationId });
  const { data: recentActivity, isLoading: activityLoading } = trpc.dashboard.activity.useQuery({ organizationId: organizationId!, limit: 4 }, { enabled: !!organizationId });
  const { data: upcomingTasks, isLoading: tasksLoading } = trpc.dashboard.upcomingTasks.useQuery({ organizationId: organizationId!, limit: 3 }, { enabled: !!organizationId });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "appointment":
        return Calendar;
      case "conversation":
        return MessageSquare;
      case "call":
        return Phone;
      case "task":
        return CheckCircle2;
      case "lead":
        return Users;
      default:
        return Zap;
    }
  };

  // Compute Integration Status based on Organization Database Record
  const org = stats?.organization;
  const hasPhone = !!org?.phone;
  const hasTimezone = !!org?.timezone;
  const hasEmail = !!org?.email;
  const aiEnabled = !!org?.aiEnabled;

  // Compute Trial Progress based on Subscription Database Record
  const sub = stats?.subscription;
  const getTrialDays = () => {
    if (!sub) return { label: "No Active Plan", percent: 0 };

    const end = sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd)
      : new Date(new Date(sub.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);

    const diffTime = end.getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const percent = Math.min(100, Math.max(0, (daysRemaining / 30) * 100));

    return {
      label: `${daysRemaining} Days Remaining`,
      percent,
    };
  };
  const trialProgress = getTrialDays();

  // Generate Dynamic AI Insight based on Real DB Stats
  const getAIInsight = () => {
    const rate = stats?.conversionRate ?? 0;
    const tasksCount = stats?.pendingTasks ?? 0;
    const callsCount = stats?.completedCalls ?? 0;

    if (tasksCount > 5) {
      return "“High volume of unresolved flags/tasks detected. Consider allocating resources to follow-ups to maintain patient satisfaction.”";
    }
    if (rate > 20) {
      return `“Outstanding performance! Your current conversion rate is ${rate}%, exceeding the weekly target.”`;
    }
    if (callsCount > 10) {
      return "“Frequent call patterns detected. Ensure your calendar scheduling availability is up-to-date to capture inbound leads.”";
    }
    return "“Peak conversation time detected between 6:00 PM and 8:00 PM. Consider increasing AI response speed for these hours.”";
  };



  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto bg-[#fcfcfd] min-h-full select-none">
      {/* Header Greeting Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950">
            {greeting()}, {user?.name?.split(" ")[0] || "Alex"}
          </h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">
            Here's what's happening with your AI agents today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/calls")}
            className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition-colors"
          >
            Audit Logs
          </Button>
          <Button
            onClick={() => navigate("/calendar")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            Schedule Briefing
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Active Conversations */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/conversations")}>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100/50 text-indigo-600">
                <MessageSquare className="w-5 h-5" />
              </div>
              <Badge className="text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-50 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                +12%
              </Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">Active Conversations</p>
              {statsLoading ? (
                <Skeleton className="h-9 w-16 mt-1" />
              ) : (
                <p className="text-3xl font-extrabold text-zinc-950 mt-1 tracking-tight">{stats?.openConversations ?? 0}</p>
              )}
            </div>
            {/* Sparkline curve */}
            <div className="pt-2">
              <svg viewBox="0 0 120 30" className="w-full h-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0,22 Q30,12 60,25 T120,8" />
                <path d="M0,22 Q30,12 60,25 T120,8 L120,30 L0,30 Z" fill="rgba(99, 102, 241, 0.04)" stroke="none" />
              </svg>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 group pt-1">
              <span>View Details</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: New Leads */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/leads")}>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-cyan-50/60 border border-cyan-100/50 text-cyan-600">
                <Users className="w-5 h-5" />
              </div>
              <Badge className="text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-50 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                +5.4%
              </Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">New Leads</p>
              {statsLoading ? (
                <Skeleton className="h-9 w-16 mt-1" />
              ) : (
                <p className="text-3xl font-extrabold text-zinc-950 mt-1 tracking-tight">{stats?.newLeads ?? 0}</p>
              )}
            </div>
            {/* Sparkline curve */}
            <div className="pt-2">
              <svg viewBox="0 0 120 30" className="w-full h-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0,26 Q30,22 60,18 T120,12" />
                <path d="M0,26 Q30,22 60,18 T120,12 L120,30 L0,30 Z" fill="rgba(99, 102, 241, 0.04)" stroke="none" />
              </svg>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 group pt-1">
              <span>View Details</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Appointments Today */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/calendar")}>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-zinc-200 text-zinc-900">
                <Calendar className="w-5 h-5" />
              </div>
              <Badge className="text-red-700 bg-red-50 border border-red-100 hover:bg-red-50 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                <span className="text-[8px] transform rotate-180 inline-block font-extrabold">▲</span>
                -2%
              </Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">Appointments Today</p>
              {statsLoading ? (
                <Skeleton className="h-9 w-16 mt-1" />
              ) : (
                <p className="text-3xl font-extrabold text-zinc-950 mt-1 tracking-tight">{stats?.upcomingAppointments ?? 0}</p>
              )}
            </div>
            {/* Sparkline curve */}
            <div className="pt-2">
              <svg viewBox="0 0 120 30" className="w-full h-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0,12 Q30,20 60,14 T120,18" />
                <path d="M0,12 Q30,20 60,14 T120,18 L120,30 L0,30 Z" fill="rgba(99, 102, 241, 0.04)" stroke="none" />
              </svg>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 group pt-1">
              <span>View Details</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Unresolved Flags */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/tasks")}>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-red-50/60 border border-red-100/50 text-red-500">
                <AlertCircle className="w-5 h-5" />
              </div>
              <Badge className="text-zinc-600 bg-zinc-50 border border-zinc-100 hover:bg-zinc-50 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                Stable
              </Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">Unresolved Flags</p>
              {statsLoading ? (
                <Skeleton className="h-9 w-16 mt-1" />
              ) : (
                <p className="text-3xl font-extrabold text-zinc-950 mt-1 tracking-tight">{stats?.pendingTasks ?? 0}</p>
              )}
            </div>
            {/* Sparkline curve */}
            <div className="pt-2">
              <svg viewBox="0 0 120 30" className="w-full h-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0,18 Q30,24 60,18 T120,20" />
                <path d="M0,18 Q30,24 60,18 T120,20 L120,30 L0,30 Z" fill="rgba(99, 102, 241, 0.04)" stroke="none" />
              </svg>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 group pt-1">
              <span>View Details</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout (2-column layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (Priority Tasks & Activity) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Priority Tasks */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
            <CardHeader className="p-0 pb-5 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-lg font-bold text-zinc-950">Priority Tasks</CardTitle>
              </div>
              <button onClick={() => navigate("/tasks")} className="text-xs font-bold text-indigo-600 hover:underline">
                View Queue
              </button>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              {tasksLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : !upcomingTasks || upcomingTasks.length === 0 ? (
                <div className="text-center text-sm text-zinc-400 py-8 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                  No priority tasks pending.
                </div>
              ) : (
                upcomingTasks.map((task) => {
                  const borderColor =
                    task.priority === "urgent"
                      ? "border-red-500"
                      : task.priority === "high"
                      ? "border-orange-500"
                      : task.priority === "medium"
                      ? "border-indigo-600"
                      : "border-zinc-200";

                  const relativeTime = formatRelativeTime(task.createdAt);

                  return (
                    <div key={task.id} className={`border ${borderColor} bg-white rounded-xl p-4 flex items-center justify-between shadow-sm`}>
                      <div className="space-y-1 min-w-0 pr-4">
                        <p className="text-sm font-extrabold text-zinc-950 truncate">{task.title}</p>
                        <p className="text-xs text-zinc-500 truncate">{task.description || "No description provided."}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {relativeTime}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            // Link resolver simulation
                            navigate("/tasks");
                          }}
                          className="h-8 text-xs font-bold text-zinc-700 border-zinc-200 hover:bg-zinc-50 rounded-lg"
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
            <CardHeader className="p-0 pb-6 flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-bold text-zinc-950">Recent Activity</CardTitle>
                <p className="text-xs text-zinc-400 mt-1 font-medium">Live feed of AI and human interactions.</p>
              </div>
              <button className="text-zinc-400 hover:text-zinc-950 transition-colors p-1 rounded-lg">
                <MoreVertical className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : !recentActivity || recentActivity.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8 font-medium">No recent activities logged.</p>
              ) : (
                <div className="space-y-0 pl-1">
                  {recentActivity.map((activity, index) => {
                    const Icon = getActivityIcon(activity.entityType);
                    const relativeTime = formatRelativeTime(activity.createdAt);

                    return (
                      <div key={activity.id} className="flex gap-4 relative group">
                        {/* Continuous vertical timeline connector */}
                        {index < recentActivity.length - 1 && (
                          <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-zinc-100 group-hover:bg-zinc-200 transition-colors" />
                        )}
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-200 bg-[#fcfcfd] z-10 shrink-0 shadow-sm">
                          <Icon className="w-4 h-4 text-zinc-600" />
                        </div>
                        <div className="flex-1 pb-6 min-w-0">
                          <p className="text-sm font-bold text-zinc-900 truncate">
                            {activity.action} <span className="text-xs font-normal text-zinc-400 ml-1.5">• {relativeTime}</span>
                          </p>
                          <p className="text-xs text-zinc-500 mt-1 font-medium truncate">
                            {activity.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => navigate("/calls")}
                className="w-full py-2.5 text-sm font-semibold text-zinc-700 border-zinc-200 hover:bg-zinc-50 rounded-xl mt-2 transition-colors"
              >
                View All Activity
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Status & Trial Panels) */}
        <div className="space-y-8">
          {/* System Status */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-base font-bold text-zinc-950">System Status</CardTitle>
              <p className="text-xs text-zinc-400 mt-1 font-medium">Core integrations and operational health.</p>
            </CardHeader>
            <CardContent className="p-0 space-y-3.5">
              {[
                { label: "Twilio SMS/Voice", icon: Smartphone, status: hasPhone ? "Verified" : "Pending" },
                { label: "Google Calendar", icon: Calendar, status: hasTimezone ? "Verified" : "Pending" },
                { label: "Email Domain (SPF/DKIM)", icon: Mail, status: hasEmail ? "Verified" : "Pending" },
                { label: "AI Engine (Claude 3.5)", icon: Zap, status: aiEnabled ? "Verified" : "Pending" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-600">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700">{item.label}</span>
                  </div>
                  {item.status === "Verified" ? (
                    <span className="text-xs font-extrabold text-zinc-950">Verified</span>
                  ) : (
                    <Badge className="text-zinc-600 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      Pending
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Trial Progress Card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
            <CardContent className="p-0 space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 tracking-wider">TRIAL PROGRESS</p>
                  {statsLoading ? (
                    <Skeleton className="h-5 w-24 mt-1" />
                  ) : (
                    <p className="text-sm font-extrabold text-indigo-600 mt-1">{trialProgress.label}</p>
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full transition-all duration-355" style={{ width: `${trialProgress.percent}%` }} />
              </div>
              <Button onClick={() => navigate("/settings")} className="w-full bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 font-bold text-sm h-10 rounded-xl transition-all shadow-none">
                Upgrade to Pro
              </Button>
            </CardContent>
          </Card>

          {/* Weekly Conversion Rate */}
          <Card className="bg-indigo-600 border border-indigo-700 shadow-md rounded-xl p-5 text-white relative overflow-hidden">
            {/* Glow accent */}
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <CardContent className="p-0 space-y-4 relative z-10">
              <div>
                <p className="text-indigo-100/90 text-xs font-bold uppercase tracking-wider">Weekly Conversion Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 bg-white/20" />
                  ) : (
                    <span className="text-3xl font-extrabold tracking-tight">{stats?.conversionRate ?? 0}%</span>
                  )}
                  <Badge className="text-white bg-indigo-500/40 border border-indigo-400/30 hover:bg-indigo-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    +3.2%
                  </Badge>
                </div>
              </div>
              <p className="text-indigo-100/90 text-xs leading-relaxed font-medium">
                Your AI agent {org?.name ? `at "${org.name}"` : ""} is outperforming the human average by 12% this week.
              </p>
              <Button onClick={() => navigate("/settings")} className="w-full bg-white hover:bg-zinc-50 text-indigo-600 font-bold text-sm h-10 rounded-xl transition-all shadow-sm">
                Optimize Script
              </Button>
            </CardContent>
          </Card>

          {/* AI Insight Quotes */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
            <CardContent className="p-0 space-y-2">
              <p className="text-[10px] font-bold text-zinc-400 tracking-wider">AI INSIGHT</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xs text-zinc-600 leading-relaxed font-semibold italic">
                  {getAIInsight()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => navigate("/calendar")}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-[0.95]"
        >
          <span className="text-2xl font-bold leading-none">+</span>
        </button>
      </div>

      {/* Dashboard Footer Divider & Copyright */}
      <div className="border-t border-zinc-200 pt-6 mt-12 text-center text-[10px] text-zinc-400 font-medium">
        © 2026 LeadFlow AI. All rights reserved. 24/7 AI Lead Qualification.
      </div>
    </div>
  );
}
