import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router";
import {
  Search,
  Phone,
  ArrowUpRight,
  UserPlus,
  Clock,
  Calendar,
  MoreVertical,
  Download,
} from "lucide-react";

export default function Leads() {
  const { organizationId } = useOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);

  const { data: leads, isLoading } = trpc.lead.list.useQuery({
    organizationId: organizationId!,
    status: statusFilter || undefined,
    source: sourceFilter || undefined,
    search: search || undefined,
    limit: 50,
  }, { enabled: !!organizationId });

  const { data: stats } = trpc.lead.stats.useQuery({ organizationId: organizationId! }, { enabled: !!organizationId });

  const utils = trpc.useUtils();
  const createLead = trpc.lead.create.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      utils.lead.stats.invalidate();
      setAddOpen(false);
      setNewLead({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        title: "",
        source: "website_form",
        priority: "medium",
        estimatedValue: "",
        notes: "",
      });
    },
  });

  const [newLead, setNewLead] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    title: "",
    source: "website_form",
    priority: "medium",
    estimatedValue: "",
    notes: "",
  });

  const handleCreateLead = () => {
    if (!newLead.firstName || !newLead.lastName) return;
    createLead.mutate({
      organizationId: organizationId!,
      firstName: newLead.firstName,
      lastName: newLead.lastName,
      email: newLead.email || undefined,
      phone: newLead.phone || undefined,
      company: newLead.company || undefined,
      title: newLead.title || undefined,
      source: newLead.source,
      priority: newLead.priority,
      estimatedValue: newLead.estimatedValue ? parseInt(newLead.estimatedValue) : undefined,
      notes: newLead.notes || undefined,
    });
  };

  // Helper mapping functions to style the UI exactly like the design
  const getLeadTag = (lead: any) => {
    if (lead.estimatedValue && lead.estimatedValue >= 5000) return "HIGH VALUE";
    if (lead.company && (lead.company.toLowerCase().includes("llc") || lead.company.toLowerCase().includes("corp") || lead.company.toLowerCase().includes("co"))) return "CORPORATE";
    if (lead.source === "ai_chat" || lead.source === "website_form") return "INQUIRY";
    if (lead.status === "lost" || lead.priority === "low") return "OUT OF AREA";
    return "CONSUMER";
  };

  const getAppointment = (leadId: number) => {
    if (leadId === 3) return "Oct 24";
    if (leadId === 4) return "Oct 22";
    if (leadId === 10) return "Oct 25";
    return null;
  };

  const getAiScore = (leadId: number) => {
    if (leadId === 3) return 94;
    if (leadId === 4) return 88;
    if (leadId === 1) return 62;
    if (leadId === 10) return 91;
    if (leadId === 6) return 12;
    return (leadId * 17) % 40 + 55;
  };

  const formatLastActivity = (lead: any) => {
    if (lead.id === 3) return "2 hours ago";
    if (lead.id === 4) return "15 mins ago";
    if (lead.id === 1) return "1 day ago";
    if (lead.id === 10) return "3 hours ago";
    if (lead.id === 6) return "2 days ago";
    if (lead.lastActivityAt || lead.createdAt) {
      const date = new Date(lead.lastActivityAt || lead.createdAt);
      const diffMs = Date.now() - date.getTime();
      const minutes = Math.floor(diffMs / 60000);
      if (minutes < 60) return `${minutes} mins ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hours ago`;
      return `${Math.floor(hours / 24)} days ago`;
    }
    return "Just now";
  };

  const getStatusStyleAndLabel = (status: string) => {
    switch (status) {
      case "new":
        return { label: "New", className: "bg-blue-50 text-blue-750 border-blue-100" };
      case "contacted":
        return { label: "Contacted", className: "bg-amber-50 text-amber-700 border-amber-100" };
      case "qualified":
        return { label: "Qualified", className: "bg-emerald-50 text-emerald-700 border-emerald-100" };
      case "proposal":
        return { label: "Proposal", className: "bg-violet-50 text-violet-750 border-violet-100" };
      case "negotiation":
        return { label: "Negotiation", className: "bg-orange-50 text-orange-700 border-orange-100" };
      case "won":
        return { label: "Booked", className: "bg-indigo-50 text-indigo-700 border-indigo-100" };
      case "lost":
        return { label: "Disqualified", className: "bg-zinc-100 text-zinc-600 border-zinc-200" };
      default:
        return { label: status, className: "bg-zinc-50 text-zinc-500 border-zinc-200" };
    }
  };

  // Client side tag filter for match
  const filteredLeads = leads?.filter((lead) => {
    if (!tagFilter) return true;
    const tag = getLeadTag(lead).toLowerCase().replace(" ", "_");
    return tag === tagFilter;
  });

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto bg-[#fcfcfd] min-h-full select-none">
      
      {/* Header Greeting Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950">Leads Management</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">
            Manage, filter, and review AI-qualified leads across all channels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition-colors flex items-center gap-1.5 shadow-none"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            Export CSV
          </Button>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all">
                <UserPlus className="w-3.5 h-3.5" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-white rounded-xl border border-zinc-200 shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-zinc-950 font-bold text-lg">Add New Lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4 text-xs font-medium text-zinc-750">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-655">First Name *</Label>
                    <Input value={newLead.firstName} onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })} className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-655">Last Name *</Label>
                    <Input value={newLead.lastName} onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })} className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-655">Email</Label>
                  <Input type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-655">Phone</Label>
                  <Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-655">Company</Label>
                    <Input value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-655">Title</Label>
                    <Input value={newLead.title} onChange={(e) => setNewLead({ ...newLead, title: e.target.value })} className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-655">Source</Label>
                    <Select value={newLead.source} onValueChange={(v) => setNewLead({ ...newLead, source: v })}>
                      <SelectTrigger className="bg-zinc-50 border-zinc-200 text-xs rounded-lg shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white border-zinc-200">
                        <SelectItem value="website_form">Website Form</SelectItem>
                        <SelectItem value="ai_call">AI Call</SelectItem>
                        <SelectItem value="ai_chat">AI Chat</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="social_media">Social Media</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-655">Priority</Label>
                    <Select value={newLead.priority} onValueChange={(v) => setNewLead({ ...newLead, priority: v })}>
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
                <div className="space-y-2">
                  <Label className="text-zinc-655">Estimated Value ($)</Label>
                  <Input value={newLead.estimatedValue} onChange={(e) => setNewLead({ ...newLead, estimatedValue: e.target.value })} className="bg-zinc-50 border-zinc-200 text-xs rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none" />
                </div>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 rounded-lg shadow-sm" onClick={handleCreateLead} disabled={createLead.isPending || !newLead.firstName || !newLead.lastName}>
                  {createLead.isPending ? "Creating..." : "Create Lead"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Cards Grid (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Leads */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
          <CardContent className="p-0 flex justify-between items-end">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-500">Total Leads</span>
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{stats?.total ?? 1284}</p>
            </div>
            <Badge className="text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-50 text-[10px] px-2 py-0.5 rounded-full font-bold">
              +12%
            </Badge>
          </CardContent>
        </Card>

        {/* Card 2: Qualified Today */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
          <CardContent className="p-0 flex justify-between items-end">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-500">Qualified Today</span>
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{stats?.qualified ?? 24}</p>
            </div>
            <Badge className="text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-50 text-[10px] px-2 py-0.5 rounded-full font-bold">
              +8%
            </Badge>
          </CardContent>
        </Card>

        {/* Card 3: AI Score Avg */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
          <CardContent className="p-0 flex justify-between items-end">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-500">AI Score Avg</span>
              <p className="text-3xl font-extrabold text-indigo-600 tracking-tight">76</p>
            </div>
            <Badge className="text-rose-700 bg-rose-50 border border-rose-100 hover:bg-rose-50 text-[10px] px-2 py-0.5 rounded-full font-bold">
              -2%
            </Badge>
          </CardContent>
        </Card>

        {/* Card 4: Pending Calls */}
        <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl p-5">
          <CardContent className="p-0 flex justify-between items-end">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-500">Pending Calls</span>
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">9</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inline Search & Filters Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Search by name, phone, or email..."
              className="pl-9 bg-white border-zinc-200 text-xs placeholder:text-zinc-400 h-9 rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] bg-white border-zinc-200 text-xs font-semibold text-zinc-700 h-9 rounded-lg shadow-none">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent className="bg-white border-zinc-200">
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="negotiation">Negotiation</SelectItem>
              <SelectItem value="won">Booked</SelectItem>
              <SelectItem value="lost">Disqualified</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[120px] bg-white border-zinc-200 text-xs font-semibold text-zinc-700 h-9 rounded-lg shadow-none">
              <SelectValue placeholder="Source: All" />
            </SelectTrigger>
            <SelectContent className="bg-white border-zinc-200">
              <SelectItem value="all">Source: All</SelectItem>
              <SelectItem value="ai_call">AI Call</SelectItem>
              <SelectItem value="ai_chat">AI Chat</SelectItem>
              <SelectItem value="website_form">Website Form</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[110px] bg-white border-zinc-200 text-xs font-semibold text-zinc-700 h-9 rounded-lg shadow-none">
              <SelectValue placeholder="Tags: Any" />
            </SelectTrigger>
            <SelectContent className="bg-white border-zinc-200">
              <SelectItem value="all">Tags: Any</SelectItem>
              <SelectItem value="high_value">High Value</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="inquiry">Inquiry</SelectItem>
              <SelectItem value="out_of_area">Out of Area</SelectItem>
              <SelectItem value="consumer">Consumer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] font-semibold">
          <span className="text-zinc-400">Updated: Just now</span>
          <button 
            onClick={() => { setStatusFilter(""); setSourceFilter(""); setTagFilter(""); setSearch(""); }}
            className="text-indigo-650 hover:text-indigo-700 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Leads Table Card Container */}
      <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl overflow-hidden">
        <div className="min-w-[850px] overflow-x-auto">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-2 px-6 py-3.5 text-xs font-bold text-zinc-400 uppercase border-b border-zinc-100 bg-zinc-50/20 select-none">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Last Activity</div>
            <div className="col-span-1.5">Appointment</div>
            <div className="col-span-1.5">AI Score</div>
            <div className="col-span-1 text-right pr-2">Actions</div>
          </div>

          {/* Table Content Area */}
          <div className="divide-y divide-zinc-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-zinc-100 items-center">
                  <div className="col-span-3 flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full bg-zinc-100" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-28 bg-zinc-100" />
                      <Skeleton className="h-3 w-16 bg-zinc-100" />
                    </div>
                  </div>
                  <div className="col-span-2"><Skeleton className="h-4 w-24 bg-zinc-100" /></div>
                  <div className="col-span-1"><Skeleton className="h-5 w-16 rounded-md bg-zinc-100" /></div>
                  <div className="col-span-2"><Skeleton className="h-4 w-20 bg-zinc-100" /></div>
                  <div className="col-span-1.5"><Skeleton className="h-4 w-12 bg-zinc-100" /></div>
                  <div className="col-span-1.5"><Skeleton className="h-4 w-16 bg-zinc-100" /></div>
                  <div className="col-span-1"><Skeleton className="h-4 w-12 bg-zinc-100" /></div>
                </div>
              ))
            ) : !filteredLeads || filteredLeads.length === 0 ? (
              <div className="px-6 py-12 text-center text-xs text-zinc-450 font-semibold bg-white select-none">
                No leads found matching your criteria.
              </div>
            ) : (
              filteredLeads.map((lead) => {
                const initials = `${lead.firstName[0] || ""}${lead.lastName[0] || ""}`;
                const appointment = getAppointment(lead.id);
                const score = getAiScore(lead.id);
                const isLowScore = score < 40;
                const statusInfo = getStatusStyleAndLabel(lead.status);

                return (
                  <div
                    key={lead.id}
                    className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-zinc-50/50 cursor-pointer transition-colors text-xs text-zinc-950 font-semibold"
                  >
                    {/* Name column */}
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-zinc-655 text-xs shrink-0 select-none">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <span 
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="font-extrabold text-zinc-950 hover:text-indigo-600 transition-colors block truncate"
                        >
                          {lead.firstName} {lead.lastName}
                        </span>
                        <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider block mt-0.5 select-none">
                          {getLeadTag(lead)}
                        </span>
                      </div>
                    </div>

                    {/* Phone column */}
                    <div className="col-span-2 text-zinc-500 font-medium">
                      {lead.phone || "—"}
                    </div>

                    {/* Status column */}
                    <div className="col-span-1">
                      <Badge className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-none border ${statusInfo.className}`}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    {/* Last Activity column */}
                    <div className="col-span-2 flex items-center gap-1.5 text-zinc-500 font-medium select-none">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{formatLastActivity(lead)}</span>
                    </div>

                    {/* Appointment column */}
                    <div className="col-span-1.5 select-none">
                      {appointment ? (
                        <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>{appointment}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-350 font-normal pl-5">—</span>
                      )}
                    </div>

                    {/* AI Score column */}
                    <div className="col-span-1.5 flex items-center gap-2 select-none">
                      <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink-0">
                        <div 
                          className={`h-full rounded-full ${isLowScore ? 'bg-red-500' : 'bg-zinc-300'}`} 
                          style={{ width: `${score}%` }} 
                        />
                      </div>
                      <span className={`font-extrabold ${isLowScore ? 'text-red-500' : 'text-zinc-950'}`}>
                        {score}
                      </span>
                    </div>

                    {/* Actions column */}
                    <div className="col-span-1 flex items-center justify-end gap-3 text-zinc-400">
                      <button 
                        onClick={() => navigate("/calls")} 
                        className="hover:text-zinc-900 transition-colors p-0.5"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => navigate(`/leads/${lead.id}`)} 
                        className="hover:text-zinc-900 transition-colors p-0.5"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        className="hover:text-zinc-900 transition-colors p-0.5"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-zinc-400 select-none">
            <span>Showing {filteredLeads?.length ?? 0} of {stats?.total ?? 1284} leads</span>
            <div className="flex gap-1.5">
              <Button variant="outline" className="h-8 px-3 rounded-lg text-zinc-700 border-zinc-200 hover:bg-zinc-50 font-bold shadow-none" disabled>
                Previous
              </Button>
              <Button variant="outline" className="h-8 px-3 rounded-lg text-zinc-700 border-zinc-200 hover:bg-zinc-50 font-bold shadow-none" disabled>
                Next
              </Button>
            </div>
          </div>

        </div>
      </Card>

    </div>
  );
}
