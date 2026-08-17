import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  GitPullRequest,
  CheckCircle,
  MessageSquare,
  Mail,
  ListTodo,
} from "lucide-react";

type ActionType = "send_sms" | "send_email" | "create_task";

interface ActionItem {
  type: ActionType;
  body?: string;
  subject?: string;
  title?: string;
  daysLater?: number;
}

export default function Workflows() {
  const { organizationId } = useOrganization();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("lead_created");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [newActionType, setNewActionType] = useState<ActionType>("send_sms");
  const [actionBody, setActionBody] = useState("");
  const [actionSubject, setActionSubject] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionDays, setActionDays] = useState(1);

  const utils = trpc.useUtils();

  // Queries
  const { data: workflows, isLoading: workflowsLoading } = trpc.automation.list.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );

  const { data: stats, isLoading: statsLoading } = trpc.automation.stats.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );

  // Mutations
  const createMutation = trpc.automation.create.useMutation({
    onSuccess: () => {
      toast.success("Automation rule created");
      setIsCreateOpen(false);
      resetForm();
      utils.automation.list.invalidate();
      utils.automation.stats.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create rule");
    },
  });

  const updateMutation = trpc.automation.update.useMutation({
    onSuccess: () => {
      toast.success("Rule status updated");
      utils.automation.list.invalidate();
      utils.automation.stats.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Update failed");
    },
  });

  const deleteMutation = trpc.automation.delete.useMutation({
    onSuccess: () => {
      toast.success("Automation deleted");
      utils.automation.list.invalidate();
      utils.automation.stats.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Delete failed");
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setTrigger("lead_created");
    setActions([]);
    setActionBody("");
    setActionSubject("");
    setActionTitle("");
    setActionDays(1);
  };

  const handleAddAction = () => {
    const newItem: ActionItem = { type: newActionType };
    if (newActionType === "send_sms") {
      if (!actionBody.trim()) {
        toast.error("SMS message content cannot be empty.");
        return;
      }
      newItem.body = actionBody;
    } else if (newActionType === "send_email") {
      if (!actionSubject.trim() || !actionBody.trim()) {
        toast.error("Subject and body cannot be empty.");
        return;
      }
      newItem.subject = actionSubject;
      newItem.body = actionBody;
    } else if (newActionType === "create_task") {
      if (!actionTitle.trim()) {
        toast.error("Task title cannot be empty.");
        return;
      }
      newItem.title = actionTitle;
      newItem.daysLater = Number(actionDays);
    }

    setActions([...actions, newItem]);
    setActionBody("");
    setActionSubject("");
    setActionTitle("");
    setActionDays(1);
    toast.success("Action appended to rule sequence");
  };

  const handleSaveRule = () => {
    if (!name.trim()) {
      toast.error("Automation name is required");
      return;
    }
    if (actions.length === 0) {
      toast.error("Add at least one action to the rule sequence");
      return;
    }

    createMutation.mutate({
      organizationId: organizationId!,
      name,
      description,
      trigger,
      actions: actions as any,
      status: "active",
    });
  };

  const toggleRuleStatus = (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    updateMutation.mutate({
      id,
      status: nextStatus,
    });
  };

  const handleDeleteRule = (id: number) => {
    if (confirm("Are you sure you want to delete this automation?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 bg-[#fcfcfd]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            Workflows & Automations
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Build and trigger auto-pilot scripts to manage communication sequences and assign leads.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Create Rule
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Rules</span>
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-6 w-16" /> : <p className="text-2xl font-extrabold text-zinc-950">{(stats as any)?.total ?? 0}</p>}
          </CardContent>
        </Card>

        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-emerald-600">Active Rules</span>
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-6 w-16" /> : <p className="text-2xl font-extrabold text-emerald-600">{(stats as any)?.active ?? 0}</p>}
          </CardContent>
        </Card>

        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-amber-600">Paused Rules</span>
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-6 w-16" /> : <p className="text-2xl font-extrabold text-amber-600">{(stats as any)?.paused ?? 0}</p>}
          </CardContent>
        </Card>

        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-indigo-600">Total Run Counts</span>
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-6 w-16" /> : <p className="text-2xl font-extrabold text-indigo-600">{(stats as any)?.totalRuns ?? 0}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Rules Dashboard Panel */}
      <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-zinc-100">
          <CardTitle className="text-sm font-bold text-zinc-950">Active Rules Pipeline</CardTitle>
          <CardDescription className="text-xs text-zinc-400">Rules executed on system trigger hooks.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-150 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">Rule Name</th>
                  <th className="py-3 px-4">Event Trigger</th>
                  <th className="py-3 px-4">Actions Configured</th>
                  <th className="py-3 px-4">Executions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {workflowsLoading ? (
                  [1, 2].map((i) => (
                    <tr key={i}>
                      <td className="py-4 px-6"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-4 px-6 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : !workflows || workflows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400">
                      No automation workflows configured. Click "Create Rule" to begin.
                    </td>
                  </tr>
                ) : (
                  workflows.map((wf) => (
                    <tr key={wf.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-zinc-950">{wf.name}</div>
                        {wf.description && <div className="text-[10px] text-zinc-400 mt-0.5">{wf.description}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100 border border-zinc-200 text-[10px] font-semibold rounded-md">
                          {wf.trigger.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {((wf.actions as unknown) as ActionItem[])?.map((act, idx) => (
                            <Badge
                              key={idx}
                              className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 text-[9px] font-medium py-0.5 px-1.5"
                            >
                              {act.type === "send_sms" && "Send SMS"}
                              {act.type === "send_email" && "Send Email"}
                              {act.type === "create_task" && "Create Task"}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-zinc-600">{wf.runCount ?? 0} runs</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={
                            wf.status === "active"
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 text-[10px] font-bold"
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border border-zinc-200 text-[10px] font-bold"
                          }
                        >
                          {wf.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-2">
                        <Button
                          onClick={() => toggleRuleStatus(wf.id, wf.status)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-950"
                          title={wf.status === "active" ? "Pause workflow" : "Activate workflow"}
                        >
                          {wf.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-600" />}
                        </Button>
                        <Button
                          onClick={() => handleDeleteRule(wf.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Visual Rule Builder Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-1.5">
                  <GitPullRequest className="w-4 h-4 text-indigo-600" />
                  New Automation Sequence
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Define events that trigger automatic client responses.</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-zinc-400 hover:text-zinc-900 text-sm">
                ✕
              </button>
            </div>

            {/* Step 1: Meta */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Rule Details</label>
              <Input
                placeholder="Rule Name (e.g., Lead Onboarding Text Sequence)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs h-9"
              />
              <Textarea
                placeholder="Description of when this automation is used..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Step 2: Trigger */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">1. When this event occurs (Trigger)</label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full h-9 rounded-lg border border-zinc-200 px-3 text-xs bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="lead_created">New Lead Created</option>
                <option value="lead_status_changed">Lead Status Shifts</option>
                <option value="conversation_started">Unified Chat Thread Opened</option>
                <option value="call_completed">Voice Call Finished</option>
                <option value="appointment_scheduled">Booking Scheduled</option>
                <option value="task_due">Action Task Deadline Reached</option>
                <option value="follow_up_needed">Lead Gone Cold (3+ Days No Activity)</option>
                <option value="no_response">No Reply From Customer (24+ Hours)</option>
              </select>
            </div>

            {/* Step 3: Add Action */}
            <div className="space-y-3 bg-zinc-50 border border-zinc-150 p-4 rounded-xl">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">2. Perform these Actions (Sequence)</label>
              
              <div className="grid grid-cols-3 gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => setNewActionType("send_sms")}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-center transition-all ${
                    newActionType === "send_sms"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-[10px]">Send SMS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewActionType("send_email")}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-center transition-all ${
                    newActionType === "send_email"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-[10px]">Send Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewActionType("create_task")}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-center transition-all ${
                    newActionType === "create_task"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  <ListTodo className="w-4 h-4" />
                  <span className="text-[10px]">Create Task</span>
                </button>
              </div>

              {/* Action Details Input */}
              {newActionType === "send_sms" && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">SMS Text Message</span>
                  <Textarea
                    placeholder="Hello! Thanks for connecting. How can we help you today?"
                    value={actionBody}
                    onChange={(e) => setActionBody(e.target.value)}
                    className="text-xs bg-white min-h-[50px]"
                  />
                </div>
              )}

              {newActionType === "send_email" && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Email Subject</span>
                    <Input
                      placeholder="Welcome to LeadFlow AI"
                      value={actionSubject}
                      onChange={(e) => setActionSubject(e.target.value)}
                      className="text-xs bg-white h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Email Body Content</span>
                    <Textarea
                      placeholder="Hi there, thanks for checking us out..."
                      value={actionBody}
                      onChange={(e) => setActionBody(e.target.value)}
                      className="text-xs bg-white min-h-[60px]"
                    />
                  </div>
                </div>
              )}

              {newActionType === "create_task" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Task Title</span>
                    <Input
                      placeholder="Call client back"
                      value={actionTitle}
                      onChange={(e) => setActionTitle(e.target.value)}
                      className="text-xs bg-white h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Schedule (Days Later)</span>
                    <Input
                      type="number"
                      value={actionDays}
                      onChange={(e) => setActionDays(Number(e.target.value))}
                      className="text-xs bg-white h-8"
                    />
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={handleAddAction}
                variant="outline"
                className="w-full border-zinc-200 text-zinc-700 font-bold hover:bg-zinc-100 text-xs h-8 shadow-sm"
              >
                Add Action to Sequence
              </Button>
            </div>

            {/* List of currently added actions */}
            {actions.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Rule Sequence Preview</label>
                <div className="space-y-1.5 border border-zinc-100 rounded-xl p-3 bg-zinc-50/50">
                  {actions.map((act, index) => (
                    <div key={index} className="flex justify-between items-center text-[11px] font-semibold text-zinc-700 bg-white border border-zinc-150 p-2 rounded-lg shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="capitalize">{act.type.replace("_", " ")}</span>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {act.type === "create_task" ? `(${act.title} in ${act.daysLater}d)` : `(${act.body?.substring(0, 20)}...)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActions(actions.filter((_, idx) => idx !== index))}
                        className="text-zinc-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 justify-end">
              <Button
                onClick={() => setIsCreateOpen(false)}
                variant="ghost"
                className="text-zinc-500 font-bold text-xs h-9 px-4 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveRule}
                disabled={createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5 rounded-lg shadow-sm"
              >
                Save Automation
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
