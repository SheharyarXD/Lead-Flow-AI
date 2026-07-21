import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
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
  Calendar,
  MoreHorizontal,
  User,
  Trash2,
  Briefcase,
  Tag as TagIcon,
  DollarSign,
} from "lucide-react";

const formatCurrency = (value?: number | null) =>
  value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const leadId = parseInt(id || "0");
  const { organizationId } = useOrganization();

  const { data: lead, isLoading } = trpc.lead.getById.useQuery({ id: leadId });
  const { data: members } = trpc.organization.members.useQuery(
    { organizationId: lead?.organizationId ?? 0 },
    { enabled: !!lead?.organizationId }
  );
  const utils = trpc.useUtils();

  const updateMutation = trpc.lead.update.useMutation({
    onSuccess: () => {
      utils.lead.getById.invalidate({ id: leadId });
    },
    onError: (err) => toast.error(err.message || "Failed to update lead"),
  });

  const deleteMutation = trpc.lead.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead deleted");
      navigate("/leads");
    },
    onError: (err) => toast.error(err.message || "Failed to delete lead"),
  });

  const [notesText, setNotesText] = useState("");
  const [tagsList, setTagsList] = useState<string[]>([]);
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
  });

  useEffect(() => {
    if (lead) {
      setNotesText(lead.notes || "");
      setTagsList(lead.tags || []);
    }
  }, [lead]);

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

  if (!lead) {
    return (
      <div className="p-8 text-center bg-white min-h-screen">
        <Button variant="ghost" onClick={() => navigate("/leads")} className="hover:bg-zinc-50">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Leads
        </Button>
        <p className="text-zinc-500 mt-8 font-semibold">Lead not found</p>
      </div>
    );
  }

  const initials = `${lead.firstName[0] || ""}${lead.lastName[0] || ""}`;

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

  // Derived label from real fields only — no fabricated data.
  const getLeadTag = (lead: { estimatedValue?: number | null; company?: string | null; source?: string | null; status: string; priority?: string | null }) => {
    if (lead.estimatedValue && lead.estimatedValue >= 5000) return "HIGH VALUE";
    if (lead.company && (lead.company.toLowerCase().includes("llc") || lead.company.toLowerCase().includes("corp") || lead.company.toLowerCase().includes("co"))) return "CORPORATE";
    if (lead.source === "ai_chat" || lead.source === "website_form") return "INQUIRY";
    if (lead.status === "lost" || lead.priority === "low") return "OUT OF AREA";
    return "CONSUMER";
  };

  const upcomingAppointment = (lead.appointments ?? [])
    .filter((a) => new Date(a.startTime).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null;

  // Compile all activities chronologically
  const timelineEvents: Array<{ id: string; type: string; title: string; description: string; date: Date; badge: string }> = [];

  if (lead.createdAt) {
    timelineEvents.push({
      id: "created",
      type: "created",
      title: "Lead Created",
      description: `Lead created from ${lead.source || "inbound"}.`,
      date: new Date(lead.createdAt),
      badge: "System",
    });
  }

  if (lead.calls) {
    lead.calls.forEach((call) => {
      timelineEvents.push({
        id: `call-${call.id}`,
        type: "call",
        title: `Inbound Call: ${call.status === "completed" ? "Service Inquiry" : "Missed Call"}`,
        description: call.aiSummary || `Call handled by Voice AI. Call direction: ${call.direction}. Duration: ${call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "0s"}.`,
        date: new Date(call.createdAt || call.startedAt || lead.createdAt),
        badge: call.aiHandled ? "AI Completed" : "Completed",
      });
    });
  }

  if (lead.conversations) {
    lead.conversations.forEach((conv) => {
      timelineEvents.push({
        id: `conv-${conv.id}`,
        type: "conversation",
        title: `Chat Conversation: ${conv.subject || "Inbound Query"}`,
        description: conv.aiSummary || `Chat conversation started via ${conv.channel}. AI handling active: ${conv.aiHandled ? "Yes" : "No"}.`,
        date: new Date(conv.createdAt || lead.createdAt),
        badge: "Open",
      });
    });
  }

  if (lead.tasks) {
    lead.tasks.forEach((task) => {
      timelineEvents.push({
        id: `task-${task.id}`,
        type: "task",
        title: `Task Assigned: ${task.title}`,
        description: task.description || `Assigned task: ${task.title}. Priority: ${task.priority}. Status: ${task.status}.`,
        date: new Date(task.createdAt || lead.createdAt),
        badge: task.status === "completed" ? "Completed" : "Pending",
      });
    });
  }

  if (lead.appointments) {
    lead.appointments.forEach((appt) => {
      timelineEvents.push({
        id: `appt-${appt.id}`,
        type: "appointment",
        title: `Appointment: ${appt.title}`,
        description: appt.description || `Scheduled for ${new Date(appt.startTime).toLocaleString()}. Status: ${appt.status}.`,
        date: new Date(appt.createdAt || lead.createdAt),
        badge: appt.status,
      });
    });
  }

  timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  const handleSendSMS = () => {
    if (lead.conversations && lead.conversations.length > 0) {
      navigate(`/conversations/${lead.conversations[0].id}`);
    } else {
      navigate("/conversations");
    }
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({
      id: leadId,
      notes: notesText,
    });
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    const newTags = [...tagsList, tag.trim()];
    setTagsList(newTags);
    updateMutation.mutate({
      id: leadId,
      tags: newTags,
    });
  };

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto bg-[#fcfcfd] min-h-full select-none">

      {/* Back button */}
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate("/leads")} className="text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg text-xs font-semibold px-3 h-8 shadow-none">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Leads
        </Button>
      </div>

      {/* Profile Identity Card */}
      <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center font-extrabold text-zinc-600 text-2xl shadow-sm relative overflow-hidden select-none">
                {initials}
              </div>
              <span className="absolute bottom-0 right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-white" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center flex-wrap gap-2.5">
                <h1 className="text-2xl font-extrabold text-zinc-950 tracking-tight leading-none">
                  {lead.firstName} {lead.lastName}
                </h1>
                <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-md shadow-none bg-zinc-50 text-zinc-500 border-zinc-200 capitalize">
                  {lead.status}
                </Badge>
                <Badge className="bg-zinc-100 text-zinc-650 border border-zinc-200 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase shadow-none select-none">
                  {getLeadTag(lead)}
                </Badge>
              </div>

              {lead.company && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold">
                  <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{lead.title ? `${lead.title} at ` : ""}{lead.company}</span>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-500 font-semibold pt-1 border-t border-zinc-100">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <a href={`mailto:${lead.email}`} className="hover:underline hover:text-indigo-650 transition-colors">{lead.email || "—"}</a>
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{lead.phone || "—"}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(`mailto:${lead.email}`)}
              className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 shadow-none"
            >
              <Mail className="w-3.5 h-3.5 text-zinc-550" />
              Email
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsCallModalOpen(true);
                if (lead.phone && organizationId) {
                  initiateCallMutation.mutate({
                    organizationId,
                    phoneNumber: lead.phone,
                    leadId,
                    customerId: lead.customerId || undefined,
                  });
                }
              }}
              className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 shadow-none"
            >
              <Phone className="w-3.5 h-3.5 text-zinc-550" />
              Call Now
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
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column (Lead Details & Activity Timeline) */}
        <div className="lg:col-span-2 space-y-8">

          {/* Lead Details card — real fields only */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
            <div className="flex items-center justify-between pb-5 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-zinc-500" />
                <span className="text-base font-extrabold text-zinc-950">Lead Details</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {[
                { label: "Source", value: lead.source ? lead.source.replace(/_/g, " ") : "—", icon: <TagIcon className="w-4 h-4" /> },
                { label: "Priority", value: lead.priority ?? "—", icon: <TagIcon className="w-4 h-4" /> },
                { label: "Estimated Value", value: formatCurrency(lead.estimatedValue), icon: <DollarSign className="w-4 h-4" /> },
                { label: "Company", value: lead.company || "—", icon: <Briefcase className="w-4 h-4" /> },
                { label: "Title", value: lead.title || "—", icon: <User className="w-4 h-4" /> },
                { label: "Created", value: new Date(lead.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }), icon: <Calendar className="w-4 h-4" /> },
              ].map((item) => (
                <div key={item.label} className="border border-zinc-100 rounded-xl p-4 bg-zinc-50/20 flex gap-3 items-start">
                  <span className="text-zinc-400 shrink-0 mt-0.5">{item.icon}</span>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 block leading-tight capitalize">
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity Timeline card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
            <div className="flex items-center justify-between pb-5 border-b border-zinc-100 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <span className="text-base font-extrabold text-zinc-950">Activity Timeline</span>
              </div>
              <button
                onClick={() => navigate("/conversations")}
                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-950 hover:underline uppercase tracking-wider border border-zinc-200 px-3 py-1.5 rounded-lg bg-zinc-50/50"
              >
                View All Threads
              </button>
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
                      ) : event.type === "appointment" ? (
                        <Calendar className="w-3.5 h-3.5" />
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
                        <Badge variant="secondary" className="text-[9px] font-bold bg-zinc-150/40 hover:bg-zinc-150 text-zinc-650 border border-zinc-200 shadow-none py-0.5 rounded capitalize">
                          {event.badge}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
              {timelineEvents.length === 0 && (
                <div className="py-8 text-center text-xs text-zinc-400 font-semibold leading-relaxed">
                  No activities logged yet.
                </div>
              )}
            </div>
          </Card>

          {/* Attachments & Documents */}
          <AttachmentsSection leadId={leadId} />

        </div>

        {/* Right Column (Upcoming Appointments & Organization Meta) */}
        <div className="space-y-8">

          {/* Upcoming Appointment card — real data, or an honest empty state */}
          <Card className="bg-[#f5f6ff] border border-indigo-100/50 shadow-sm rounded-xl p-5">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-indigo-100/30">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-[9px] font-bold text-indigo-400 tracking-wider uppercase block">Upcoming Appointment</span>
              </div>

              {upcomingAppointment ? (
                <>
                  <div className="flex justify-between items-start pb-4">
                    <span className="text-2xl font-extrabold text-indigo-950 block">
                      {new Date(upcomingAppointment.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] font-extrabold text-indigo-650 mt-1 uppercase tracking-wider">
                      {new Date(upcomingAppointment.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>

                  <div className="mt-4 bg-white border border-indigo-100/50 rounded-xl p-3.5 flex gap-3 items-center shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-650 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-zinc-950 block truncate">{upcomingAppointment.title}</span>
                      <span className="text-[10px] text-zinc-400 font-semibold block truncate mt-0.5">{upcomingAppointment.location || "No location set"}</span>
                    </div>
                  </div>

                  <Button variant="outline" onClick={() => navigate("/calendar")} className="w-full h-9 text-xs font-bold text-indigo-600 border-indigo-100 hover:bg-indigo-50/50 bg-white rounded-lg shadow-none mt-4">
                    MANAGE IN CALENDAR
                  </Button>
                </>
              ) : (
                <div className="py-2 space-y-3">
                  <p className="text-xs text-indigo-900/70 font-semibold">No upcoming appointment scheduled for this lead.</p>
                  <Button variant="outline" onClick={() => navigate("/calendar")} className="w-full h-9 text-xs font-bold text-indigo-600 border-indigo-100 hover:bg-indigo-50/50 bg-white rounded-lg shadow-none">
                    SCHEDULE IN CALENDAR
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Organization Meta card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2 select-none">
              <span className="text-zinc-500">🏷️</span>
              <span className="text-xs font-bold text-zinc-950 tracking-wider">ORGANIZATION</span>
            </div>

            <div className="space-y-4">
              {/* Assigned To dropdown — real org members */}
              <div className="space-y-1.5 px-5 pt-4">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block select-none">Assigned To</span>
                <Select
                  value={lead.assignedTo?.toString() || ""}
                  onValueChange={(val) => {
                    updateMutation.mutate({
                      id: leadId,
                      assignedTo: parseInt(val),
                    });
                  }}
                >
                  <SelectTrigger className="w-full bg-white border-zinc-200 text-xs font-semibold text-zinc-700 h-10 rounded-lg shadow-none">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-zinc-200">
                    {members?.map((m) => (
                      <SelectItem key={m.user!.id} value={String(m.user!.id)}>{m.user?.name || m.user?.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lead Tags list */}
              <div className="space-y-2 px-5 py-4 border-t border-b border-zinc-100">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block select-none">Lead Tags</span>
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
              <div className="space-y-2 px-5 pb-5 pt-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block select-none">Internal Notes</span>
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Add comments or follow-up details..."
                  className="w-full h-24 p-3 bg-zinc-50/50 border border-zinc-200 text-xs rounded-lg placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all resize-none font-medium"
                />
                <div className="flex justify-end select-none">
                  <Button
                    onClick={handleSaveNotes}
                    disabled={updateMutation.isPending || notesText === (lead?.notes || "")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold h-7 px-3 rounded shadow-none uppercase tracking-wider transition-colors"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

            </div>
          </Card>

        </div>

      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {lead.firstName} {lead.lastName} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: leadId })} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CallDialerModal
        isOpen={isCallModalOpen}
        organizationId={lead.organizationId}
        phoneNumber={lead.phone || "Unknown"}
        contactName={`${lead.firstName} ${lead.lastName}`}
        callId={activeCallId}
        onClose={() => {
          setIsCallModalOpen(false);
          setActiveCallId(null);
        }}
      />

    </div>
  );
}
