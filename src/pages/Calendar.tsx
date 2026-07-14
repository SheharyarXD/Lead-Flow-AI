import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Phone,
  Calendar,
  Trash2,
  RefreshCw,
  Tag,
  X,
} from "lucide-react";

export default function CalendarPage() {
  const { organizationId } = useOrganization();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<any>(null);

  // Filters state — populated once real org members load (see effect below)
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ startTime: "", endTime: "" });

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startOfWeek = new Date(startOfMonth);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const { data: appointments, isLoading } = trpc.appointment.list.useQuery({
    organizationId: organizationId!,
    startDate: startOfWeek,
    endDate: new Date(endOfMonth.getTime() + 14 * 24 * 60 * 60 * 1000), // extend range to cover grid
    limit: 100,
  }, { enabled: !!organizationId });

  const { data: stats } = trpc.appointment.stats.useQuery({ organizationId: organizationId! }, { enabled: !!organizationId });
  const { data: members } = trpc.organization.members.useQuery({ organizationId: organizationId! }, { enabled: !!organizationId });
  const { data: customers } = trpc.customer.list.useQuery({ organizationId: organizationId!, limit: 100 }, { enabled: !!organizationId });

  const UNASSIGNED = "unassigned";

  // Default to showing every real team member, plus unassigned/AI-handled appointments
  useEffect(() => {
    if (members) {
      setSelectedTeam([...members.map((m) => String(m.user!.id)), UNASSIGNED]);
    }
  }, [members]);

  const createAppointment = trpc.appointment.create.useMutation({
    onSuccess: () => {
      utils.appointment.list.invalidate();
      utils.appointment.stats.invalidate();
      setAddOpen(false);
      toast.success("Appointment scheduled");
      setNewAppt({
        title: "",
        description: "",
        location: "",
        startTime: "",
        endTime: "",
        type: "meeting",
        customerId: "none",
      });
    },
    onError: (err) => toast.error(err.message || "Failed to schedule appointment"),
  });

  const deleteMutation = trpc.appointment.delete.useMutation({
    onSuccess: () => {
      utils.appointment.list.invalidate();
      utils.appointment.stats.invalidate();
      setSelectedAppt(null);
      setCancelConfirmOpen(false);
      toast.success("Appointment cancelled");
    },
    onError: (err) => toast.error(err.message || "Failed to cancel appointment"),
  });

  const updateMutation = trpc.appointment.update.useMutation({
    onSuccess: (updated) => {
      utils.appointment.list.invalidate();
      setSelectedAppt(updated);
      setRescheduleOpen(false);
      toast.success("Appointment rescheduled");
    },
    onError: (err) => toast.error(err.message || "Failed to reschedule appointment"),
  });

  const [newAppt, setNewAppt] = useState({
    title: "",
    description: "",
    location: "",
    startTime: "",
    endTime: "",
    type: "meeting",
    customerId: "none",
  });

  // Automatically select the first appointment on selected date if available
  useEffect(() => {
    if (appointments && appointments.length > 0) {
      const dayAppts = appointments.filter((a) => {
        if (!a.startTime) return false;
        const d = new Date(a.startTime);
        return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
      });
      if (dayAppts.length > 0) {
        setSelectedAppt(dayAppts[0]);
      } else {
        setSelectedAppt(null);
      }
    }
  }, [selectedDate, appointments]);

  const monthName = currentDate.toLocaleString("en", { month: "long", year: "numeric" });

  const prevMonth = () => {
    const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(prev);
    setSelectedDate(prev);
  };
  
  const nextMonth = () => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(next);
    setSelectedDate(next);
  };

  const handleCreateAppointment = () => {
    if (!newAppt.title || !newAppt.startTime || !newAppt.endTime) return;
    createAppointment.mutate({
      organizationId: organizationId!,
      title: newAppt.title,
      description: newAppt.description || undefined,
      location: newAppt.location || undefined,
      startTime: new Date(newAppt.startTime),
      endTime: new Date(newAppt.endTime),
      type: newAppt.type,
      customerId: newAppt.customerId && newAppt.customerId !== "none" ? parseInt(newAppt.customerId) : undefined,
    });
  };

  const openReschedule = () => {
    if (!selectedAppt) return;
    const toLocalInput = (d: string | Date) => {
      const date = new Date(d);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      return date.toISOString().slice(0, 16);
    };
    setRescheduleForm({
      startTime: toLocalInput(selectedAppt.startTime),
      endTime: toLocalInput(selectedAppt.endTime),
    });
    setRescheduleOpen(true);
  };

  const handleReschedule = () => {
    if (!selectedAppt || !rescheduleForm.startTime || !rescheduleForm.endTime) return;
    updateMutation.mutate({
      id: selectedAppt.id,
      startTime: new Date(rescheduleForm.startTime),
      endTime: new Date(rescheduleForm.endTime),
      status: "rescheduled",
    });
  };

  const handleCancelAppointment = () => {
    if (!selectedAppt) return;
    deleteMutation.mutate({ id: selectedAppt.id });
  };

  // Build calendar grids (42 days)
  const mainDays: Date[] = [];
  const mainDayIter = new Date(startOfWeek);
  for (let i = 0; i < 42; i++) {
    mainDays.push(new Date(mainDayIter));
    mainDayIter.setDate(mainDayIter.getDate() + 1);
  }

  const miniDays: Date[] = [];
  const miniStartOfWeek = new Date(startOfMonth);
  miniStartOfWeek.setDate(miniStartOfWeek.getDate() - miniStartOfWeek.getDay());
  const miniDayIter = new Date(miniStartOfWeek);
  for (let i = 0; i < 42; i++) {
    miniDays.push(new Date(miniDayIter));
    miniDayIter.setDate(miniDayIter.getDate() + 1);
  }

  // Real assignment: the appointment's assignedUser relation, or "unassigned"
  const getApptAgentId = (appt: any) => (appt.assignedTo ? String(appt.assignedTo) : UNASSIGNED);

  const getFilteredApptsForDay = (date: Date) => {
    return appointments?.filter((a) => {
      if (!a.startTime) return false;
      const d = new Date(a.startTime);
      const isSameDay = d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
      if (!isSameDay) return false;

      // Filter by team
      const agent = getApptAgentId(a);
      if (!selectedTeam.includes(agent)) return false;

      // Filter by type
      if (selectedTypes.length > 0) {
        let mappedType = "other";
        if (a.type === "consultation" || a.type === "call") mappedType = "sales";
        if (a.type === "demo") mappedType = "demo";
        if (a.type === "meeting") mappedType = "onboarding";
        if (a.type === "follow_up" || a.type === "other") mappedType = "support";
        if (!selectedTypes.includes(mappedType)) return false;
      }

      return true;
    }) || [];
  };

  const isToday = (date: Date) => {
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  };

  const isSelectedDate = (date: Date) => {
    return date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear();
  };

  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  const getUpcomingAppointmentDetails = (appt: any) => {
    if (!appt) return null;
    const start = new Date(appt.startTime);
    const timeString = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateString = start.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

    return {
      time: timeString,
      date: dateString,
      title: appt.title,
      location: appt.location || "No location set",
      intent: appt.description || null,
      status: appt.lead?.status || appt.status,
      phone: appt.customer?.phone || appt.lead?.phone || null,
      source: appt.customer?.source || appt.lead?.source || null,
    };
  };

  const apptDetails = getUpcomingAppointmentDetails(selectedAppt);

  const toggleTeamFilter = (team: string) => {
    if (selectedTeam.includes(team)) {
      setSelectedTeam(selectedTeam.filter(t => t !== team));
    } else {
      setSelectedTeam([...selectedTeam, team]);
    }
  };

  const toggleTypeFilter = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full flex overflow-hidden bg-white select-none">
      
      {/* COLUMN 1: Mini Calendar & Filters Sidebar */}
      <div className="w-72 border-r border-zinc-200/80 flex flex-col shrink-0 bg-white p-5 space-y-6 overflow-y-auto">
        
        {/* Title */}
        <div>
          <h1 className="text-xl font-extrabold text-zinc-950">Calendar</h1>
          <p className="text-zinc-400 text-[10px] font-bold mt-1 uppercase tracking-wider">
            Manage your AI-booked appointments. {stats?.upcoming ? `(${stats.upcoming} upcoming)` : ""}
          </p>
        </div>

        {/* Mini Month widget card */}
        <div className="border border-zinc-150 rounded-xl p-3 bg-zinc-50/20">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <span className="text-xs font-bold text-zinc-800">{monthName}</span>
            <div className="flex gap-1.5">
              <button onClick={prevMonth} className="p-0.5 hover:bg-zinc-100 rounded text-zinc-500">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={nextMonth} className="p-0.5 hover:bg-zinc-100 rounded text-zinc-500">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Day initials */}
          <div className="grid grid-cols-7 gap-1 mt-2 text-center text-[9px] font-extrabold text-zinc-400">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
              <span key={idx}>{day}</span>
            ))}
          </div>
          {/* Days numbers */}
          <div className="grid grid-cols-7 gap-1 mt-1 text-center">
            {miniDays.map((day, idx) => {
              const isSel = isSelectedDate(day);
              const isTodayDay = isToday(day);
              const isCurrMonth = isCurrentMonth(day);

              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedDate(day);
                    setCurrentDate(day);
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isSel 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : isTodayDay 
                      ? "border border-indigo-600 text-indigo-600 font-extrabold" 
                      : isCurrMonth 
                      ? "text-zinc-800 hover:bg-zinc-100" 
                      : "text-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Team members checkbox filter list — real org members */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Team Members</span>
          <div className="space-y-2 text-xs font-semibold text-zinc-700">
            {members?.map((member) => (
              <label key={member.user!.id} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTeam.includes(String(member.user!.id))}
                  onChange={() => toggleTeamFilter(String(member.user!.id))}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span>{member.user?.name || member.user?.email}</span>
              </label>
            ))}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTeam.includes(UNASSIGNED)}
                onChange={() => toggleTeamFilter(UNASSIGNED)}
                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              <span>Unassigned</span>
            </label>
          </div>
        </div>

        {/* Appointment type filter pills */}
        <div className="space-y-2.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Appt. Type</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "sales", label: "Sales" },
              { id: "demo", label: "Demo" },
              { id: "onboarding", label: "Onboarding" },
              { id: "support", label: "Support" },
            ].map((type) => {
              const isAct = selectedTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => toggleTypeFilter(type.id)}
                  className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full border transition-all ${
                    isAct 
                      ? "bg-indigo-50 border-indigo-200 text-indigo-650"
                      : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                  }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add custom event trigger button */}
        <div className="pt-2">
          <Button 
            onClick={() => setAddOpen(true)}
            className="w-full bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-none transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-500" />
            Add Custom Event
          </Button>
        </div>

      </div>

      {/* COLUMN 2: Main Monthly Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fcfcfd]">
        
        {/* Main Grid Header */}
        <div className="px-6 py-4 border-b border-zinc-250 bg-white flex items-center justify-between shrink-0 select-none">
          <h2 className="text-base font-extrabold text-zinc-950 tracking-tight">{monthName}</h2>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 border border-zinc-200 bg-white shadow-sm transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <Button 
              variant="outline" 
              onClick={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedDate(today);
              }}
              className="text-zinc-700 border-zinc-200 h-8 px-3 rounded-lg text-xs font-semibold hover:bg-zinc-50 shadow-none"
            >
              Today
            </Button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 border border-zinc-200 bg-white shadow-sm transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Grid Day headers row */}
        <div className="grid grid-cols-7 border-b border-zinc-200/80 bg-zinc-50/20 text-center text-[10px] font-extrabold text-zinc-400 uppercase py-2 select-none">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
            <span key={idx}>{day}</span>
          ))}
        </div>

        {/* Day Cells grid scroll body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 grid-rows-6 h-full min-h-[500px]">
            {isLoading ? (
              Array.from({ length: 42 }).map((_, idx) => (
                <div key={idx} className="border-r border-b border-zinc-100 p-2 space-y-1.5 bg-white min-h-[80px]">
                  <Skeleton className="h-3 w-6 bg-zinc-100" />
                  <Skeleton className="h-4 w-full bg-zinc-100 rounded" />
                </div>
              ))
            ) : (
              mainDays.map((day, idx) => {
                const isSel = isSelectedDate(day);
                const isTodayDay = isToday(day);
                const isCurrMonth = isCurrentMonth(day);
                const dayAppts = getFilteredApptsForDay(day);

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={`border-r border-b border-zinc-200/80 p-2 flex flex-col gap-1 min-h-[80px] cursor-pointer transition-all ${
                      isSel 
                        ? "bg-zinc-50/40 ring-1 ring-inset ring-indigo-500/20" 
                        : isCurrMonth 
                        ? "bg-white" 
                        : "bg-zinc-50/30"
                    }`}
                  >
                    {/* Day number cell badge */}
                    <div className="flex justify-end select-none">
                      <span className={`text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isTodayDay 
                          ? "bg-indigo-600 text-white font-extrabold shadow-sm" 
                          : isCurrMonth 
                          ? "text-zinc-800" 
                          : "text-zinc-300"
                      }`}>
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Appointment blocks */}
                    <div className="space-y-1 overflow-y-auto max-h-[70px]">
                      {dayAppts.map((appt) => {
                        const start = new Date(appt.startTime);
                        const timeStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                        // Block color: assigned appointments in indigo, unassigned in zinc
                        const blockStyle = appt.assignedTo
                          ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                          : "bg-zinc-100 border-zinc-200 text-zinc-600";

                        const isSelectedAppt = selectedAppt && selectedAppt.id === appt.id;

                        return (
                          <div
                            key={appt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppt(appt);
                              setSelectedDate(day);
                            }}
                            className={`text-[9px] font-bold p-1 rounded border leading-none truncate transition-all ${blockStyle} ${
                              isSelectedAppt ? "ring-1 ring-zinc-400 scale-[0.98]" : "hover:opacity-80"
                            }`}
                          >
                            {timeStr} {appt.title}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* COLUMN 3: Appointment Details Sidebar */}
      <div className="w-80 border-l border-zinc-200/80 bg-white flex flex-col shrink-0 overflow-y-auto">
        {selectedAppt && apptDetails ? (
          <div className="p-5 space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 select-none">
              <span className="text-sm font-extrabold text-zinc-950">Appointment Details</span>
              <button 
                onClick={() => setSelectedAppt(null)} 
                className="text-zinc-400 hover:text-zinc-900 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Identity info */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-extrabold text-zinc-650 text-sm shrink-0 select-none">
                {selectedAppt.customer 
                  ? `${selectedAppt.customer.firstName[0] || ""}${selectedAppt.customer.lastName[0] || ""}`
                  : "U"}
              </div>
              <div className="min-w-0">
                <span className="text-base font-extrabold text-zinc-950 block truncate leading-tight">
                  {selectedAppt.customer 
                    ? `${selectedAppt.customer.firstName} ${selectedAppt.customer.lastName}`
                    : selectedAppt.title}
                </span>
                <div className="flex items-center gap-1.5 mt-1 select-none">
                  {apptDetails.status && (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-none capitalize">
                      {apptDetails.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Date & Time display blocks */}
            <div className="grid grid-cols-2 gap-3.5 select-none">
              <div className="border border-zinc-100 bg-zinc-50/20 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                  <Calendar className="w-3 h-3" />
                  <span>Date</span>
                </div>
                <p className="text-xs font-extrabold text-zinc-900 mt-1">{apptDetails.date}</p>
              </div>
              <div className="border border-zinc-100 bg-zinc-50/20 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                  <Clock className="w-3 h-3" />
                  <span>Time</span>
                </div>
                <p className="text-xs font-extrabold text-zinc-900 mt-1">{apptDetails.time}</p>
              </div>
            </div>

            {/* Meeting description */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block select-none">Description</span>
              <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 text-xs text-zinc-650 leading-relaxed font-semibold">
                {apptDetails.intent || "No description provided."}
              </div>
            </div>

            {/* View conversation thread CTA */}
            <div className="pt-2 select-none">
              <Button
                onClick={() => {
                  if (selectedAppt.leadId || selectedAppt.customerId) {
                    navigate(`/conversations/${selectedAppt.leadId || selectedAppt.customerId}`);
                  } else {
                    navigate("/conversations");
                  }
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all"
              >
                <span>💬</span>
                View Full Conversation
              </Button>
            </div>

            {/* Reschedule/Cancel operations */}
            <div className="grid grid-cols-2 gap-2 select-none pt-2 border-t border-zinc-100">
              <Button
                variant="outline"
                onClick={openReschedule}
                className="h-9 text-xs font-bold text-zinc-700 border-zinc-200 hover:bg-zinc-50 bg-white rounded-lg shadow-none flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                Reschedule
              </Button>
              <Button
                variant="outline"
                onClick={() => setCancelConfirmOpen(true)}
                disabled={deleteMutation.isPending}
                className="h-9 text-xs font-bold text-red-600 border-zinc-200 hover:bg-red-50/50 hover:border-red-150 bg-white rounded-lg shadow-none flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                Cancel
              </Button>
            </div>

            {/* Contact details metadata */}
            <div className="space-y-3 pt-4 border-t border-zinc-100 select-none">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Contact Details</span>
              <div className="space-y-2.5 pl-0.5 text-xs text-zinc-700 font-semibold">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{apptDetails.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Source: {apptDetails.source || "—"}</span>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="p-6 h-full flex flex-col items-center justify-center text-center space-y-4 select-none">
            <div className="w-12 h-12 rounded-full border border-zinc-150 bg-zinc-50 flex items-center justify-center text-zinc-400 shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-zinc-950 block">Select an Appointment</span>
              <p className="text-[10px] text-zinc-400 font-semibold leading-relaxed max-w-[200px] mt-1 mx-auto">
                Click on any appointment cell in the calendar grid to audit reschedule details and conversational intent.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Scheduler Appointment Creation Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg bg-white rounded-xl border border-zinc-200 shadow-lg text-xs font-medium text-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-950 font-bold text-lg">New Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-zinc-655">Title *</Label>
              <Input 
                value={newAppt.title} 
                onChange={(e) => setNewAppt({ ...newAppt, title: e.target.value })} 
                className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-655">Start Time *</Label>
                <Input 
                  type="datetime-local" 
                  value={newAppt.startTime} 
                  onChange={(e) => setNewAppt({ ...newAppt, startTime: e.target.value })} 
                  className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-655">End Time *</Label>
                <Input 
                  type="datetime-local" 
                  value={newAppt.endTime} 
                  onChange={(e) => setNewAppt({ ...newAppt, endTime: e.target.value })} 
                  className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-655">Appointment Type</Label>
                <Select value={newAppt.type} onValueChange={(v) => setNewAppt({ ...newAppt, type: v })}>
                  <SelectTrigger className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-zinc-200">
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="consultation">Consultation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-655">Customer</Label>
                <Select value={newAppt.customerId} onValueChange={(v) => setNewAppt({ ...newAppt, customerId: v })}>
                  <SelectTrigger className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none">
                    <SelectValue placeholder="Select Customer (Optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-zinc-200">
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
            <div className="space-y-2">
              <Label className="text-zinc-655">Location</Label>
              <Input 
                value={newAppt.location} 
                onChange={(e) => setNewAppt({ ...newAppt, location: e.target.value })} 
                className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-655">AI Meeting Intent / Description</Label>
              <Input 
                value={newAppt.description} 
                onChange={(e) => setNewAppt({ ...newAppt, description: e.target.value })} 
                className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" 
              />
            </div>
            <Button 
              onClick={handleCreateAppointment} 
              disabled={createAppointment.isPending || !newAppt.title || !newAppt.startTime || !newAppt.endTime}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 rounded-lg shadow-sm"
            >
              {createAppointment.isPending ? "Scheduling..." : "Schedule Appointment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl border border-zinc-200 shadow-lg text-xs font-medium text-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-950 font-bold text-lg">Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-zinc-655">New Start Time *</Label>
              <Input
                type="datetime-local"
                value={rescheduleForm.startTime}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })}
                className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-655">New End Time *</Label>
              <Input
                type="datetime-local"
                value={rescheduleForm.endTime}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })}
                className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none"
              />
            </div>
            <Button
              onClick={handleReschedule}
              disabled={updateMutation.isPending || !rescheduleForm.startTime || !rescheduleForm.endTime}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 rounded-lg shadow-sm"
            >
              {updateMutation.isPending ? "Saving..." : "Confirm Reschedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAppt && `"${selectedAppt.title}" will be cancelled and removed from the calendar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAppointment} className="bg-red-600 hover:bg-red-700">
              Cancel Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
