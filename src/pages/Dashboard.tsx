import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  MessageSquare,
  Phone,
  TrendingUp,
  Clock,
  CheckSquare,
  Calendar,
  ArrowRight,
  Bot,
  PhoneCall,
  AlertCircle,
} from "lucide-react";

const ORG_ID = 1; // Demo organization

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery({ organizationId: ORG_ID });
  const { data: recentActivity, isLoading: activityLoading } = trpc.dashboard.activity.useQuery({ organizationId: ORG_ID, limit: 8 });
  const { data: upcomingTasks, isLoading: tasksLoading } = trpc.dashboard.upcomingTasks.useQuery({ organizationId: ORG_ID, limit: 5 });
  const { data: upcomingAppts, isLoading: apptsLoading } = trpc.dashboard.upcomingAppointments.useQuery({ organizationId: ORG_ID, limit: 3 });
  const { data: conversations } = trpc.conversation.list.useQuery({ organizationId: ORG_ID, limit: 5 });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const statCards = [
    {
      title: "Total Leads",
      value: stats?.totalLeads ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      path: "/leads",
    },
    {
      title: "Conversations",
      value: stats?.totalConversations ?? 0,
      icon: MessageSquare,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      path: "/conversations",
    },
    {
      title: "Calls Today",
      value: stats?.completedCalls ?? 0,
      icon: Phone,
      color: "text-violet-600",
      bg: "bg-violet-50",
      path: "/calls",
    },
    {
      title: "Conversion Rate",
      value: `${stats?.conversionRate ?? 0}%`,
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
      path: "/leads",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {user?.name?.split(" ")[0] || "Admin"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your AI receptionist today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <Bot className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">AI Online</span>
          </div>
          <Button size="sm" onClick={() => navigate("/leads")}>
            <Users className="w-4 h-4 mr-2" />
            View Leads
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(stat.path)}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Conversations & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Conversations */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Conversations</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/conversations")}>
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {conversations?.slice(0, 5).map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/conversations/${conv.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {conv.customer?.firstName} {conv.customer?.lastName}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {conv.channel}
                        </Badge>
                        {conv.aiHandled && (
                          <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-50 text-emerald-700">
                            <Bot className="w-3 h-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {conv.lastMessagePreview || conv.subject || "No messages"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={conv.status === "open" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {conv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!conversations || conversations.length === 0) && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No conversations yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity?.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 rounded-full bg-muted">
                        {activity.entityType === "lead" && <Users className="w-3.5 h-3.5" />}
                        {activity.entityType === "conversation" && <MessageSquare className="w-3.5 h-3.5" />}
                        {activity.entityType === "call" && <Phone className="w-3.5 h-3.5" />}
                        {activity.entityType === "appointment" && <Calendar className="w-3.5 h-3.5" />}
                        {activity.entityType === "task" && <CheckSquare className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!recentActivity || recentActivity.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tasks & Appointments */}
        <div className="space-y-6">
          {/* Upcoming Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Pending Tasks</CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  {stats?.pendingTasks ?? 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingTasks?.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/tasks")}
                    >
                      <div className={`mt-0.5 w-2 h-2 rounded-full mt-2 ${
                        task.priority === "urgent" ? "bg-red-500" :
                        task.priority === "high" ? "bg-orange-500" :
                        task.priority === "medium" ? "bg-blue-500" : "bg-gray-300"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
                          </span>
                          {task.customer && (
                            <span className="text-xs text-muted-foreground">
                              {task.customer.firstName} {task.customer.lastName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!upcomingTasks || upcomingTasks.length === 0) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                      <CheckSquare className="w-4 h-4" />
                      All caught up!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Today&apos;s Appointments</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>
                  <Calendar className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {apptsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAppts?.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/calendar")}
                    >
                      <div className="flex flex-col items-center px-2 py-1 rounded bg-primary/10">
                        <span className="text-[10px] font-medium text-primary uppercase">
                          {appt.startTime ? new Date(appt.startTime).toLocaleString("en", { month: "short" }) : ""}
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {appt.startTime ? new Date(appt.startTime).getDate() : ""}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{appt.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {appt.startTime ? new Date(appt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                      </div>
                      <Badge variant={appt.status === "confirmed" ? "default" : "outline"} className="text-[10px]">
                        {appt.status}
                      </Badge>
                    </div>
                  ))}
                  {(!upcomingAppts || upcomingAppts.length === 0) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                      <AlertCircle className="w-4 h-4" />
                      No appointments today
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <PhoneCall className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AI Call Minutes</p>
                  <p className="text-xs text-muted-foreground">This billing period</p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">142</span>
                <span className="text-sm text-muted-foreground mb-1">/ 500 min</span>
              </div>
              <div className="mt-3 h-2 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: "28%" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">28% of plan used</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
