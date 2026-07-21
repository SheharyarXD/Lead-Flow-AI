import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { AttachmentsSection } from "@/components/AttachmentsSection";
import { CallDialerModal } from "@/components/CallDialerModal";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageSquare,
  CheckSquare,
  MoreHorizontal,
  User,
  ExternalLink,
  Trash2,
  Activity as ActivityIcon,
} from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = parseInt(id || "0");

  const { data: customer, isLoading } = trpc.customer.getById.useQuery({ id: customerId });
  const utils = trpc.useUtils();
  const { organizationId } = useOrganization();

  const { data: activityLog } = trpc.activity.list.useQuery(
    { organizationId: organizationId!, entityType: "customer", entityId: customerId },
    { enabled: !!organizationId }
  );

  const createConversation = trpc.conversation.create.useMutation({
    onSuccess: (newConv) => {
      if (newConv) {
        navigate(`/conversations/${newConv.id}`);
      }
    },
    onError: (err) => toast.error(err.message || "Failed to start conversation"),
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      utils.customer.getById.invalidate({ id: customerId });
    },
    onError: (err) => toast.error(err.message || "Failed to update customer"),
  });

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      toast.success("Customer deleted");
      navigate("/leads");
    },
    onError: (err) => toast.error(err.message || "Failed to delete customer"),
  });

  const updateTaskMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.customer.getById.invalidate({ id: customerId });
    },
    onError: (err) => toast.error(err.message || "Failed to update task"),
  });

  const [notesText, setNotesText] = useState("");
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [statusVal, setStatusVal] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [activeCallId, setActiveCallId] = useState<number | null>(null);

  const initiateCallMutation = trpc.calls.initiateCall.useMutation({
    onSuccess: (data) => {
      if (data?.call?.id) {
        setActiveCallId(data.call.id);
      }
      utils.calls.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to start call"),
  });

  useEffect(() => {
    if (customer) {
      setNotesText(customer.notes || "");
      setTagsList(customer.tags || []);
      setStatusVal(customer.status || "active");
    }
  }, [customer]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-28 w-full rounded-xl bg-zinc-100" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-100" />
            <Skeleton className="h-80 w-full rounded-xl bg-zinc-100" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-44 w-full rounded-xl bg-zinc-100" />
            <Skeleton className="h-80 w-full rounded-xl bg-zinc-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center bg-white min-h-screen">
        <Button variant="ghost" onClick={() => navigate(-1)} className="hover:bg-zinc-50">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <p className="text-zinc-500 mt-8 font-semibold">Customer not found</p>
      </div>
    );
  }

  const initials = `${customer.firstName[0] || ""}${customer.lastName[0] || ""}`;

  // Formats relative times for activity timeline
  const formatRelativeTime = (dateInput?: Date | string | null): string => {
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
  };

  // Compile all activities chronologically
  const timelineEvents = [];

  if (customer.createdAt) {
    timelineEvents.push({
      id: "created",
      type: "created",
      title: "Customer Profile Created",
      description: `Customer account registered via ${customer.source || "inbound"}.`,
      date: new Date(customer.createdAt),
      badge: "System",
    });
  }

  if (customer.calls) {
    customer.calls.forEach((call) => {
      timelineEvents.push({
        id: `call-${call.id}`,
        type: "call",
        title: `Inbound Call: ${call.status === "completed" ? "Service Inquiry" : "Missed Call"}`,
        description: call.aiSummary || `Call handled by Voice AI. Direction: ${call.direction}. Duration: ${call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "0s"}.`,
        date: new Date(call.createdAt || call.startedAt || customer.createdAt),
        badge: call.aiHandled ? "AI Handled" : "Completed",
      });
    });
  }

  if (customer.conversations) {
    customer.conversations.forEach((conv) => {
      timelineEvents.push({
        id: `conv-${conv.id}`,
        type: "conversation",
        title: `Conversation (${conv.channel}): ${conv.subject || "Chat Inquiry"}`,
        description: conv.lastMessagePreview || `Conversation thread started via ${conv.channel}. AI auto-reply: ${conv.aiHandled ? "Active" : "Disabled"}.`,
        date: new Date(conv.lastMessageAt || conv.createdAt || customer.createdAt),
        badge: conv.status === "open" ? "Open" : "Closed",
      });
    });
  }

  if (customer.tasks) {
    customer.tasks.forEach((task) => {
      timelineEvents.push({
        id: `task-${task.id}`,
        type: "task",
        title: `Task Logged: ${task.title}`,
        description: task.description || `Task priority: ${task.priority}. Status: ${task.status}.`,
        date: new Date(task.createdAt || customer.createdAt),
        badge: task.status === "completed" ? "Completed" : "Pending",
      });
    });
  }

  if (activityLog) {
    activityLog.forEach((entry) => {
      timelineEvents.push({
        id: `activity-${entry.id}`,
        type: "activity",
        title: entry.action,
        description: entry.description || "",
        date: new Date(entry.createdAt),
        badge: entry.actorType,
      });
    });
  }

  timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  const handleSendSMS = () => {
    if (customer.conversations && customer.conversations.length > 0) {
      navigate(`/conversations/${customer.conversations[0].id}`);
    } else {
      createConversation.mutate({
        organizationId: organizationId!,
        customerId: customerId,
        channel: "sms",
      });
    }
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({
      id: customerId,
      notes: notesText,
    });
  };

  const handleStatusChange = (val: string) => {
    setStatusVal(val);
    updateMutation.mutate({
      id: customerId,
      status: val,
    });
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    const newTags = [...tagsList, tag.trim()];
    setTagsList(newTags);
    updateMutation.mutate({
      id: customerId,
      tags: newTags,
    });
  };

  const toggleTaskStatus = (task: { id: number; status: string }) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTaskMutation.mutate({
      id: task.id,
      status: newStatus,
      completedAt: newStatus === "completed" ? new Date() : undefined,
    });
  };

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto bg-[#fcfcfd] min-h-full select-none">
      
      {/* Back button */}
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg text-xs font-semibold px-3 h-8 shadow-none">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
      </div>

      {/* Profile Header Identity Card */}
      <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center font-extrabold text-zinc-655 text-2xl shadow-sm relative overflow-hidden select-none">
                {initials}
              </div>
              <span className={`absolute bottom-0 right-1 w-5 h-5 rounded-full border-[3px] border-white ${customer.status === "active" ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center flex-wrap gap-2.5">
                <h1 className="text-2xl font-extrabold text-zinc-950 tracking-tight leading-none">
                  {customer.firstName} {customer.lastName}
                </h1>
                <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-none capitalize ${customer.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-50' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'}`}>
                  {customer.status}
                </Badge>
                <Badge variant="outline" className="bg-zinc-50 text-zinc-500 border border-zinc-200 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase shadow-none select-none">
                  Source: {customer.source || "inbound"}
                </Badge>
              </div>

              <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-500 font-semibold pt-1 border-t border-zinc-100">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <a href={`mailto:${customer.email}`} className="hover:underline hover:text-indigo-650 transition-colors">{customer.email || "—"}</a>
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{customer.phone || "—"}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(`mailto:${customer.email}`)}
              className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 shadow-none"
            >
              <Mail className="w-3.5 h-3.5 text-zinc-550" />
              Email
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsCallModalOpen(true);
                if (customer.phone && organizationId) {
                  initiateCallMutation.mutate({
                    organizationId,
                    phoneNumber: customer.phone,
                    customerId: customerId,
                  });
                }
              }}
              className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 shadow-none"
            >
              <Phone className="w-3.5 h-3.5 text-zinc-550" />
              Call
            </Button>
            <Button
              onClick={handleSendSMS}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Send SMS
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-2.5 border border-zinc-200 rounded-lg bg-white shadow-sm hover:bg-zinc-50">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Metadata & Activity Timeline) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Customer profile data card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
            <div className="flex items-center justify-between pb-5 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <span className="text-base font-extrabold text-zinc-950">Customer Profile</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Customer Status</span>
                <Select value={statusVal} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full bg-white border-zinc-200 text-xs font-semibold text-zinc-700 h-10 rounded-lg shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-zinc-200">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Account Created</span>
                <div className="h-10 border border-zinc-250/20 bg-zinc-50/50 rounded-lg flex items-center px-3.5 text-xs text-zinc-700 font-semibold leading-none">
                  {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-US", { dateStyle: "long" }) : "—"}
                </div>
              </div>
            </div>

            {/* Tags section */}
            <div className="space-y-2 mt-6 pt-5 border-t border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block select-none">Customer Tags</span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {tagsList.map((tag) => (
                  <Badge key={tag} className="bg-zinc-50 text-zinc-650 border border-zinc-200 font-bold text-[10px] px-2 py-0.5 rounded shadow-none select-none">
                    {tag}
                  </Badge>
                ))}
                <Button 
                  variant="outline"
                  onClick={() => {
                    const tag = prompt("Enter new tag:");
                    if (tag) handleAddTag(tag);
                  }}
                  className="h-6 text-[9px] font-bold text-zinc-500 border-dashed border-zinc-200 px-2 rounded hover:bg-zinc-50 shadow-none"
                >
                  + Add Tag
                </Button>
              </div>
            </div>

            {/* Internal notes editor */}
            <div className="space-y-2 mt-6 pt-5 border-t border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block select-none">Customer Notes</span>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Add customer background details, preferences, or important notes..."
                className="w-full h-24 p-3 bg-zinc-50/50 border border-zinc-200 text-xs rounded-lg placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all resize-none font-medium"
              />
              <div className="flex justify-end select-none">
                <Button 
                  onClick={handleSaveNotes}
                  disabled={updateMutation.isPending || notesText === (customer.notes || "")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold h-7 px-3 rounded shadow-none uppercase tracking-wider transition-colors"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Notes"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Activity Timeline Card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
            <div className="flex items-center justify-between pb-5 border-b border-zinc-100 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <span className="text-base font-extrabold text-zinc-950">Activity Timeline</span>
              </div>
            </div>

            <div className="space-y-0 pl-1">
              {timelineEvents.map((event, index) => {
                const relativeTime = formatRelativeTime(event.date);

                return (
                  <div key={event.id} className="flex gap-4 relative group">
                    {index < timelineEvents.length - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-zinc-100 group-hover:bg-zinc-200 transition-colors" />
                    )}
                    <div className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-200 bg-white z-10 shrink-0 shadow-sm text-zinc-500">
                      {event.type === "call" ? (
                        <Phone className="w-3.5 h-3.5" />
                      ) : event.type === "conversation" ? (
                        <MessageSquare className="w-3.5 h-3.5" />
                      ) : event.type === "task" ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : event.type === "activity" ? (
                        <ActivityIcon className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 pb-6 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-xs font-extrabold text-zinc-900 leading-snug">
                          {event.title}
                        </p>
                        <span className="text-[10px] font-semibold text-zinc-400 shrink-0">
                          {relativeTime}
                        </span>
                      </div>
                      
                      <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed font-medium">
                        {event.description}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-[9px] font-bold bg-zinc-150/40 hover:bg-zinc-150 text-zinc-650 border border-zinc-200 shadow-none py-0.5 rounded">
                          {event.badge}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
              {timelineEvents.length === 0 && (
                <div className="py-8 text-center text-xs text-zinc-400 font-semibold leading-relaxed">
                  No interaction history recorded yet.
                </div>
              )}
            </div>
          </Card>

          {/* Attachments & Documents */}
          <AttachmentsSection customerId={customerId} />

        </div>

        {/* Right Column (Leads, Appointments, Tasks lists) */}
        <div className="space-y-8">
          
          {/* Linked Sales Leads Card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Sales Leads</span>
              <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 font-bold text-[10px] rounded px-1.5">
                {customer.leads?.length ?? 0}
              </Badge>
            </div>
            
            <div className="space-y-3">
              {customer.leads?.map((lead) => (
                <div key={lead.id} className="border border-zinc-100 rounded-xl p-3.5 hover:bg-zinc-50/50 transition-colors flex justify-between items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <span onClick={() => navigate(`/leads/${lead.id}`)} className="text-xs font-bold text-zinc-950 block truncate hover:text-indigo-600 cursor-pointer flex items-center gap-1">
                      {lead.firstName} {lead.lastName}
                      <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                    </span>
                    <span className="text-[10px] text-zinc-400 font-semibold block truncate mt-0.5 capitalize">{lead.status} · {lead.priority} Priority</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-zinc-900 block">{lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : "—"}</span>
                  </div>
                </div>
              ))}
              {(!customer.leads || customer.leads.length === 0) && (
                <span className="text-zinc-400 text-xs font-semibold block py-4 text-center leading-relaxed">No sales leads active.</span>
              )}
            </div>
          </Card>

          {/* Customer Appointments Card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Appointments</span>
              <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 font-bold text-[10px] rounded px-1.5">
                {customer.appointments?.length ?? 0}
              </Badge>
            </div>

            <div className="space-y-3">
              {customer.appointments?.map((appt) => {
                const date = new Date(appt.startTime);
                const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                return (
                  <div key={appt.id} className="border border-zinc-100 rounded-xl p-3.5 bg-zinc-50/20 flex gap-3 items-center">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100/50 flex flex-col items-center justify-center text-indigo-650 shrink-0 select-none">
                      <span className="text-[8px] font-black uppercase leading-none">{date.toLocaleDateString("en-US", { month: "short" })}</span>
                      <span className="text-xs font-extrabold leading-none mt-0.5">{date.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-zinc-950 block truncate">{appt.title}</span>
                      <span className="text-[10px] text-zinc-400 font-semibold block truncate mt-0.5">{timeStr} · {appt.location || "Online"}</span>
                    </div>
                  </div>
                );
              })}
              {(!customer.appointments || customer.appointments.length === 0) && (
                <span className="text-zinc-400 text-xs font-semibold block py-4 text-center leading-relaxed">No appointments scheduled.</span>
              )}
            </div>
          </Card>

          {/* Customer Tasks Card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Pending Tasks</span>
              <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 font-bold text-[10px] rounded px-1.5">
                {customer.tasks?.filter((t) => t.status !== "completed").length ?? 0}
              </Badge>
            </div>

            <div className="space-y-3">
              {customer.tasks?.map((task) => (
                <div key={task.id} className="flex items-start gap-3 border border-zinc-100 rounded-xl p-3.5 hover:bg-zinc-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={task.status === "completed"}
                    onChange={() => toggleTaskStatus(task)}
                    className="mt-0.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-bold block leading-snug ${task.status === "completed" ? "line-through text-zinc-400" : "text-zinc-950"}`}>
                      {task.title}
                    </span>
                    {task.dueDate && (
                      <span className="text-[9px] font-semibold text-zinc-400 block mt-1">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
              {(!customer.tasks || customer.tasks.length === 0) && (
                <span className="text-zinc-400 text-xs font-semibold block py-4 text-center leading-relaxed">No linked tasks.</span>
              )}
            </div>
          </Card>

        </div>

      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              {customer.firstName} {customer.lastName} and their linked records will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: customerId })} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CallDialerModal
        isOpen={isCallModalOpen}
        organizationId={organizationId!}
        phoneNumber={customer.phone || "Unknown"}
        contactName={`${customer.firstName} ${customer.lastName}`}
        callId={activeCallId}
        onClose={() => {
          setIsCallModalOpen(false);
          setActiveCallId(null);
        }}
      />

    </div>
  );
}
