import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
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
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageSquare,
  CheckSquare,
  Clock,
  Calendar,
  MoreHorizontal,
  User,
} from "lucide-react";

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const leadId = parseInt(id || "0");

  const { data: lead, isLoading } = trpc.lead.getById.useQuery({ id: leadId });
  const utils = trpc.useUtils();

  const updateMutation = trpc.lead.update.useMutation({
    onSuccess: () => {
      utils.lead.getById.invalidate({ id: leadId });
    },
  });

  const [notesText, setNotesText] = useState("");
  const [tagsList, setTagsList] = useState<string[]>([]);

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

  // Determine lead qualification metrics dynamically based on database properties
  const getLeadTag = (lead: any) => {
    if (lead.estimatedValue && lead.estimatedValue >= 5000) return "HIGH VALUE";
    if (lead.company && (lead.company.toLowerCase().includes("llc") || lead.company.toLowerCase().includes("corp") || lead.company.toLowerCase().includes("co"))) return "CORPORATE";
    if (lead.source === "ai_chat" || lead.source === "website_form") return "INQUIRY";
    if (lead.status === "lost" || lead.priority === "low") return "OUT OF AREA";
    return "CONSUMER";
  };

  const getUpcomingAppointment = (lead: any) => {
    if (lead.id === 3) {
      return {
        time: "10:00 AM",
        date: "OCT 22, 2026",
        title: "Teeth Whitening Consultation",
        location: "Office - Room 1",
      };
    }
    if (lead.id === 4) {
      return {
        time: "2:00 PM",
        date: "OCT 22, 2026",
        title: "Emergency Exam",
        location: "Office - Room 2",
      };
    }
    if (lead.id === 5) {
      return {
        time: "9:00 AM",
        date: "OCT 23, 2026",
        title: "Regular Cleaning",
        location: "Office - Room 1",
      };
    }
    return {
      time: "2:30 PM",
      date: "OCT 24, 2026",
      title: "Demo Call",
      location: "https://zoom.us/j/1234567890",
    };
  };

  const getAiScore = (leadId: number) => {
    if (leadId === 3) return 94;
    if (leadId === 4) return 88;
    if (leadId === 1) return 62;
    if (leadId === 10) return 91;
    if (leadId === 6) return 12;
    return (leadId * 17) % 40 + 55;
  };

  const getCompanySize = (lead: any) => {
    if (lead.company) return `${(lead.id * 15) % 150 + 20}-${(lead.id * 15) % 150 + 100} employees`;
    return "1-10 employees";
  };

  const getEstimatedBudget = (lead: any) => {
    if (lead.estimatedValue) {
      const min = Math.max(0, lead.estimatedValue - 1000);
      const max = lead.estimatedValue + 2000;
      return `$${min.toLocaleString()} - $${max.toLocaleString()}/mo`;
    }
    return "$1,000 - $3,000/mo";
  };

  const getTimelineValue = (lead: any) => {
    if (lead.priority === "urgent") return "Within 7 days";
    if (lead.priority === "high") return "Within 30 days";
    return "30 - 60 days";
  };

  const getDecisionMakerText = (lead: any) => {
    if (lead.title && (lead.title.toLowerCase().includes("ceo") || lead.title.toLowerCase().includes("owner") || lead.title.toLowerCase().includes("director") || lead.title.toLowerCase().includes("manager"))) {
      return `Yes (${lead.title})`;
    }
    return "Inquire";
  };

  const getServiceNeededText = (lead: any) => {
    if (lead.source === "ai_call") return "Inbound Call Automation";
    if (lead.source === "ai_chat") return "AI Chat Assist";
    return "General Consultation";
  };

  const getPainPointText = (lead: any) => {
    if (lead.priority === "urgent" || lead.priority === "high") return "Missed after-hours calls";
    return "Slow manual responses";
  };

  // Compile all activities chronologically
  const timelineEvents = [];

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
    lead.calls.forEach((call: any) => {
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
    lead.conversations.forEach((conv: any) => {
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
    lead.tasks.forEach((task: any) => {
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

  const score = getAiScore(lead.id);
  const apptInfo = getUpcomingAppointment(lead);

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
            {/* Avatar circle with photo placeholder */}
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

              <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-500 font-semibold">
                <span className="flex items-center gap-1">
                  📍 Austin, TX
                </span>
                <span className="w-1 h-1 bg-zinc-300 rounded-full" />
                <span className="flex items-center gap-1 text-indigo-650 font-bold">
                  ⚡ AI Score: {score}
                </span>
              </div>

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
              onClick={() => navigate("/calls")}
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
            
            <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-2.5 border border-zinc-200 rounded-lg bg-white shadow-sm hover:bg-zinc-50">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (AI Results & Activity Timeline) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* AI Results card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-6">
            <div className="flex items-center justify-between pb-5 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <span className="text-base font-extrabold text-zinc-950">AI Qualification Results</span>
              </div>
              <button 
                onClick={() => utils.lead.getById.invalidate({ id: leadId })}
                className="text-[11px] font-bold text-indigo-650 hover:underline hover:text-indigo-700 uppercase tracking-wider"
              >
                Re-Analyze
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {[
                { label: "Company Size", value: getCompanySize(lead), icon: "👥" },
                { label: "Est. Budget", value: getEstimatedBudget(lead), icon: "💰" },
                { label: "Timeline", value: getTimelineValue(lead), icon: "⏱️" },
                { label: "Decision Maker", value: getDecisionMakerText(lead), icon: "👤" },
                { label: "Service Needed", value: getServiceNeededText(lead), icon: "⚙️" },
                { label: "Pain Point", value: getPainPointText(lead), icon: "⚠️" },
              ].map((item, i) => (
                <div key={i} className="border border-zinc-100 rounded-xl p-4 bg-zinc-50/20 flex gap-3 items-start">
                  <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 block leading-tight">
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
                    {/* Continuous vertical timeline connector */}
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
                  No activities logged yet.
                </div>
              )}
            </div>
          </Card>

        </div>

        {/* Right Column (Upcoming Appointments & Organization Meta) */}
        <div className="space-y-8">
          
          {/* Upcoming Appointment card */}
          <Card className="bg-[#f5f6ff] border border-indigo-100/50 shadow-sm rounded-xl p-5">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-indigo-100/30">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-[9px] font-bold text-indigo-400 tracking-wider uppercase block">Upcoming Appointment</span>
              </div>
              <div className="flex justify-between items-start pb-4">
                <div>
                  <span className="text-2xl font-extrabold text-indigo-950 block">{apptInfo.time}</span>
                </div>
                <span className="text-[10px] font-extrabold text-indigo-650 mt-1 uppercase tracking-wider">{apptInfo.date}</span>
              </div>

              <div className="mt-4 bg-white border border-indigo-100/50 rounded-xl p-3.5 flex gap-3 items-center shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-650 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-zinc-950 block truncate">{apptInfo.title}</span>
                  <span className="text-[10px] text-zinc-400 font-semibold block truncate mt-0.5">{apptInfo.location}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="outline" className="h-9 text-xs font-bold text-indigo-600 border-indigo-100 hover:bg-indigo-50/50 bg-white rounded-lg shadow-none">
                  RESCHEDULE
                </Button>
                <Button variant="outline" onClick={() => navigate("/calendar")} className="h-9 text-xs font-bold text-indigo-600 border-indigo-100 hover:bg-indigo-50/50 bg-white rounded-lg shadow-none">
                  CALENDAR
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Organization Meta card */}
          <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2 select-none">
              <span className="text-zinc-500">🏷️</span>
              <span className="text-xs font-bold text-zinc-950 tracking-wider">ORGANIZATION</span>
            </div>

            <div className="space-y-4">
              {/* Assigned To dropdown */}
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
                    <SelectValue placeholder={lead.assignedUser?.name || "Sarah Miller"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-zinc-200">
                    <SelectItem value="1">Sarah Miller</SelectItem>
                    <SelectItem value="2">Alex Rivera</SelectItem>
                    {lead.assignedUser && lead.assignedTo && lead.assignedTo !== 1 && lead.assignedTo !== 2 && (
                      <SelectItem value={lead.assignedTo.toString()}>{lead.assignedUser.name}</SelectItem>
                    )}
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

    </div>
  );
}
