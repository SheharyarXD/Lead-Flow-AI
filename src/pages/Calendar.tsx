import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Plus,
} from "lucide-react";

const ORG_ID = 1;

const typeColors: Record<string, string> = {
  call: "bg-blue-50 text-blue-700 border-blue-200",
  meeting: "bg-violet-50 text-violet-700 border-violet-200",
  demo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  follow_up: "bg-amber-50 text-amber-700 border-amber-200",
  consultation: "bg-orange-50 text-orange-700 border-orange-200",
  other: "bg-gray-50 text-gray-500 border-gray-200",
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startOfWeek = new Date(startOfMonth);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const { data: appointments, isLoading } = trpc.appointment.list.useQuery({
    organizationId: ORG_ID,
    startDate: startOfWeek,
    endDate: new Date(endOfMonth.getTime() + 7 * 24 * 60 * 60 * 1000),
    limit: 100,
  });

  const { data: stats } = trpc.appointment.stats.useQuery({ organizationId: ORG_ID });

  const monthName = currentDate.toLocaleString("en", { month: "long", year: "numeric" });

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Build calendar grid
  const days: Date[] = [];
  const dayIter = new Date(startOfWeek);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(dayIter));
    dayIter.setDate(dayIter.getDate() + 1);
  }

  const getApptsForDay = (date: Date) => {
    return appointments?.filter((a) => {
      if (!a.startTime) return false;
      const d = new Date(a.startTime);
      return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    }) || [];
  };

  const isToday = (date: Date) => {
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  };

  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage appointments and follow-ups. ({stats?.upcoming ?? 0} upcoming today)
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Appointment
        </Button>
      </div>

      {/* Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Month View */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-semibold">{monthName}</h2>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const dayAppts = getApptsForDay(day);
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] p-1.5 rounded-lg border transition-colors ${
                      isCurrentMonth(day) ? "bg-background" : "bg-muted/30"
                    } ${isToday(day) ? "border-primary ring-1 ring-primary/20" : "border-transparent hover:border-muted"}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday(day) ? "text-primary" : isCurrentMonth(day) ? "" : "text-muted-foreground"}`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayAppts.slice(0, 2).map((appt) => (
                        <div
                          key={appt.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer ${typeColors[appt.type || "other"] || typeColors.other}`}
                        >
                          {appt.startTime ? new Date(appt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""} {appt.title}
                        </div>
                      ))}
                      {dayAppts.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1.5">+{dayAppts.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar - Upcoming */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <ScrollArea className="h-[400px]">
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                ) : appointments?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No appointments</p>
                ) : (
                  appointments?.sort((a, b) => new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime()).map((appt) => (
                    <div key={appt.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col items-center px-2 py-1 rounded bg-primary/10 shrink-0">
                        <span className="text-[10px] font-medium text-primary uppercase">
                          {appt.startTime ? new Date(appt.startTime).toLocaleString("en", { month: "short" }) : ""}
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {appt.startTime ? new Date(appt.startTime).getDate() : ""}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{appt.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {appt.startTime ? new Date(appt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            -
                            {appt.endTime ? new Date(appt.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        {appt.location && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{appt.location}</span>
                          </div>
                        )}
                        {appt.customer && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{appt.customer.firstName} {appt.customer.lastName}</span>
                          </div>
                        )}
                        <div className="mt-1.5">
                          <Badge variant="outline" className={`text-[10px] ${typeColors[appt.type || "other"]}`}>
                            {appt.type}
                          </Badge>
                          <Badge variant={appt.status === "confirmed" ? "default" : "outline"} className="text-[10px] ml-1">
                            {appt.status}
                          </Badge>
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
    </div>
  );
}
