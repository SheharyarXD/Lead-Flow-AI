import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Filter,
  Plus,
  Calendar,
  User,
} from "lucide-react";

const ORG_ID = 1;

const priorityConfig: Record<string, { color: string; dot: string }> = {
  urgent: { color: "text-red-600 bg-red-50 border-red-200", dot: "bg-red-500" },
  high: { color: "text-orange-600 bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  medium: { color: "text-blue-600 bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  low: { color: "text-gray-500 bg-gray-50 border-gray-200", dot: "bg-gray-300" },
};

const typeIcons: Record<string, string> = {
  follow_up: "Follow-up",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  demo: "Demo",
  reminder: "Reminder",
  other: "Other",
};

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: tasks, isLoading } = trpc.task.list.useQuery({
    organizationId: ORG_ID,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    limit: 50,
  });

  const { data: stats } = trpc.task.stats.useQuery({ organizationId: ORG_ID });
  const utils = trpc.useUtils();

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.stats.invalidate();
    },
  });

  const handleComplete = (taskId: number) => {
    updateTask.mutate({ id: taskId, status: "completed", completedAt: new Date() });
  };

  const groupedTasks = {
    pending: tasks?.filter((t) => t.status === "pending" || t.status === "in_progress") || [],
    completed: tasks?.filter((t) => t.status === "completed") || [],
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage follow-ups, reminders, and team tasks.
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: CheckSquare },
          { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-600" },
          { label: "Overdue", value: stats?.overdue ?? 0, icon: AlertCircle, color: "text-red-600" },
          { label: "Completed", value: stats?.completed ?? 0, icon: CheckSquare, color: "text-emerald-600" },
        ].map((stat) => (
          <Card key={stat.label} className="border-muted">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <stat.icon className={`w-4 h-4 ${stat.color || "text-muted-foreground"}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold mt-1 ${stat.color || ""}`}>{stat.value}</p>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={() => { setStatusFilter(""); setPriorityFilter(""); }}>Clear</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pending ({groupedTasks.pending.length})</CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                <Clock className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </div>
          </CardHeader>
          <ScrollArea className="h-[450px]">
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : groupedTasks.pending.length === 0 ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                  <CheckSquare className="w-4 h-4" />
                  All caught up!
                </div>
              ) : (
                groupedTasks.pending.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group">
                    <Checkbox
                      className="mt-1"
                      onCheckedChange={() => handleComplete(task.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] h-4 ${priorityConfig[task.priority || "medium"]?.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1 ${priorityConfig[task.priority || "medium"]?.dot}`} />
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-4">{typeIcons[task.type || "other"]}</Badge>
                        {task.dueDate && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {task.customer && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {task.customer.firstName} {task.customer.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Completed ({groupedTasks.completed.length})</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                <CheckSquare className="w-3 h-3 mr-1" />
                Done
              </Badge>
            </div>
          </CardHeader>
          <ScrollArea className="h-[450px]">
            <CardContent className="space-y-2">
              {groupedTasks.completed.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No completed tasks yet</p>
              ) : (
                groupedTasks.completed.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border opacity-60">
                    <CheckSquare className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-through">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          Completed {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
