import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Plus,
  Calendar,
  User,
} from "lucide-react";

const ORG_ID = 1;

const priorityConfig: Record<string, { color: string; dot: string }> = {
  urgent: { color: "text-red-600 bg-red-50 border-red-200", dot: "bg-red-500" },
  high: { color: "text-orange-600 bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  medium: { color: "text-blue-600 bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  low: { color: "text-zinc-500 bg-zinc-50 border-zinc-200", dot: "bg-zinc-300" },
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
  const [addOpen, setAddOpen] = useState(false);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    type: "follow_up",
    priority: "medium",
    dueDate: "",
    customerId: "none",
  });

  const { data: tasks, isLoading } = trpc.task.list.useQuery({
    organizationId: ORG_ID,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    limit: 50,
  });

  const { data: customers } = trpc.customer.list.useQuery({
    organizationId: ORG_ID,
    limit: 100,
  });

  const { data: stats } = trpc.task.stats.useQuery({ organizationId: ORG_ID });
  const utils = trpc.useUtils();

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.stats.invalidate();
    },
  });

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.stats.invalidate();
      setAddOpen(false);
      setNewTask({
        title: "",
        description: "",
        type: "follow_up",
        priority: "medium",
        dueDate: "",
        customerId: "none",
      });
    },
  });

  const handleComplete = (taskId: number) => {
    updateTask.mutate({ id: taskId, status: "completed", completedAt: new Date() });
  };

  const handleCreateTask = () => {
    if (!newTask.title) return;
    createTask.mutate({
      organizationId: ORG_ID,
      title: newTask.title,
      description: newTask.description || undefined,
      type: newTask.type,
      priority: newTask.priority,
      dueDate: newTask.dueDate ? new Date(newTask.dueDate) : undefined,
      customerId: newTask.customerId && newTask.customerId !== "none" ? parseInt(newTask.customerId) : undefined,
    });
  };

  const groupedTasks = {
    pending: tasks?.filter((t) => t.status === "pending" || t.status === "in_progress") || [],
    completed: tasks?.filter((t) => t.status === "completed") || [],
  };

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto bg-[#fcfcfd] min-h-full select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950">Tasks</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">
            Manage follow-ups, reminders, and team tasks.
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all">
              <Plus className="w-3.5 h-3.5" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white rounded-xl border border-zinc-200 shadow-lg text-xs font-medium text-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-zinc-950 font-bold text-lg">Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-zinc-655 font-bold">Title *</Label>
                <Input 
                  value={newTask.title} 
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} 
                  className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" 
                  placeholder="e.g. Schedule whitening check-up"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-655 font-bold">Description</Label>
                <textarea 
                  value={newTask.description} 
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} 
                  className="w-full h-20 p-2.5 bg-zinc-50 border border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400" 
                  placeholder="Task details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-655 font-bold">Type</Label>
                  <Select value={newTask.type} onValueChange={(v) => setNewTask({ ...newTask, type: v })}>
                    <SelectTrigger className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white border-zinc-200">
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-655 font-bold">Priority</Label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                    <SelectTrigger className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white border-zinc-200">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-655 font-bold">Due Date</Label>
                  <Input 
                    type="date" 
                    value={newTask.dueDate} 
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} 
                    className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-655 font-bold">Related Lead / Customer</Label>
                  <Select 
                    value={newTask.customerId} 
                    onValueChange={(v) => setNewTask({ ...newTask, customerId: v })}
                  >
                    <SelectTrigger className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none">
                      <SelectValue placeholder="Select Customer (Optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-zinc-250">
                      <SelectItem value="none">None / Unlinked</SelectItem>
                      {customers?.map((cust) => (
                        <SelectItem key={cust.id} value={cust.id.toString()}>
                          {cust.firstName} {cust.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleCreateTask} 
                disabled={createTask.isPending || !newTask.title}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 rounded-lg shadow-sm mt-2"
              >
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: CheckSquare },
          { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-600" },
          { label: "Overdue", value: stats?.overdue ?? 0, icon: AlertCircle, color: "text-red-600" },
          { label: "Completed", value: stats?.completed ?? 0, icon: CheckSquare, color: "text-emerald-600" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
            <CardContent className="p-0 flex justify-between items-center">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-500">{stat.label}</span>
                <p className={`text-3xl font-extrabold tracking-tight ${stat.color || "text-zinc-950"}`}>{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0">
                <stat.icon className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Box */}
      <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-4">
        <CardContent className="p-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 w-full">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] bg-zinc-50 border-zinc-200 text-xs font-semibold text-zinc-700 h-9 rounded-lg shadow-none">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200">
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px] bg-zinc-50 border-zinc-200 text-xs font-semibold text-zinc-700 h-9 rounded-lg shadow-none">
                <SelectValue placeholder="Priority: All" />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200">
                <SelectItem value="all">Priority: All</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => { setStatusFilter(""); setPriorityFilter(""); }}
              className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-semibold hover:bg-zinc-50 flex items-center gap-1.5 shadow-none ml-auto sm:ml-0"
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Task Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Pending Queue */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
          <CardHeader className="p-0 pb-5 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <span className="text-base font-extrabold text-zinc-950">Pending Tasks ({groupedTasks.pending.length})</span>
            </div>
            <Badge variant="secondary" className="text-[10px] bg-indigo-50 border border-indigo-100/50 text-indigo-600 font-bold px-2 py-0.5 rounded-full select-none">
              Active Queue
            </Badge>
          </CardHeader>
          <ScrollArea className="h-[450px] pr-2">
            <CardContent className="p-0 space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl bg-zinc-100" />)
              ) : groupedTasks.pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-zinc-400 font-semibold border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50 select-none">
                  <CheckSquare className="w-5 h-5 mb-2 text-zinc-300" />
                  All caught up! No pending tasks in this queue.
                </div>
              ) : (
                groupedTasks.pending.map((task) => (
                  <div key={task.id} className="flex items-start gap-3.5 p-4 rounded-xl border border-zinc-150 hover:bg-zinc-50/40 transition-colors shadow-sm bg-white">
                    <Checkbox
                      className="mt-0.5"
                      onCheckedChange={() => handleComplete(task.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-zinc-950 leading-snug">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed font-semibold">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2.5 mt-2.5 flex-wrap select-none text-[9px] font-bold">
                        <Badge variant="outline" className={`h-5 border ${priorityConfig[task.priority || "medium"]?.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${priorityConfig[task.priority || "medium"]?.dot}`} />
                          <span className="capitalize">{task.priority}</span>
                        </Badge>
                        <Badge variant="outline" className="text-zinc-500 border-zinc-200 h-5 px-2 bg-zinc-50/20">{typeIcons[task.type || "other"]}</Badge>
                        {task.dueDate && (
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {task.customer && (
                          <span className="text-zinc-400 flex items-center gap-1 font-semibold">
                            <User className="w-3 h-3 text-zinc-400" />
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

        {/* Completed Queue */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
          <CardHeader className="p-0 pb-5 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="text-base font-extrabold text-zinc-950">Completed Tasks ({groupedTasks.completed.length})</span>
            </div>
            <Badge variant="outline" className="text-[10px] text-zinc-400 border border-zinc-200 px-2 py-0.5 rounded-full select-none">
              Archived
            </Badge>
          </CardHeader>
          <ScrollArea className="h-[450px] pr-2">
            <CardContent className="p-0 space-y-3">
              {groupedTasks.completed.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 font-semibold border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50 select-none">
                  No completed tasks yet.
                </div>
              ) : (
                groupedTasks.completed.map((task) => (
                  <div key={task.id} className="flex items-start gap-3.5 p-4 rounded-xl border border-zinc-150 opacity-60 bg-zinc-50/20">
                    <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-zinc-950 line-through leading-snug">{task.title}</p>
                      <div className="flex items-center gap-2 mt-2 select-none text-[9px] font-bold text-zinc-400">
                        <span>
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
