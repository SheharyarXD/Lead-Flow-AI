import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Users,
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  ArrowRight,
  TrendingUp,
  UserPlus,
} from "lucide-react";

const ORG_ID = 1;

const statusColors: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  proposal: "bg-violet-50 text-violet-700 border-violet-200",
  negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
  archived: "bg-gray-50 text-gray-500 border-gray-200",
};

const priorityColors: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

export default function Leads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: leads, isLoading } = trpc.lead.list.useQuery({
    organizationId: ORG_ID,
    status: statusFilter || undefined,
    source: sourceFilter || undefined,
    search: search || undefined,
    limit: 50,
  });

  const { data: stats } = trpc.lead.stats.useQuery({ organizationId: ORG_ID });

  const utils = trpc.useUtils();
  const createLead = trpc.lead.create.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      utils.lead.stats.invalidate();
      setAddOpen(false);
    },
  });

  const [addOpen, setAddOpen] = useState(false);
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
      organizationId: ORG_ID,
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

  const statCards = [
    { label: "Total Leads", value: stats?.total ?? 0, icon: Users },
    { label: "New", value: stats?.new ?? 0, icon: UserPlus },
    { label: "Qualified", value: stats?.qualified ?? 0, icon: TrendingUp },
    { label: "Won", value: stats?.won ?? 0, icon: TrendingUp },
    { label: "Pipeline Value", value: `$${(stats?.totalValue ?? 0).toLocaleString()}`, icon: TrendingUp },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage your leads from AI conversations and calls.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={newLead.firstName} onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={newLead.lastName} onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={newLead.title} onChange={(e) => setNewLead({ ...newLead, title: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={newLead.source} onValueChange={(v) => setNewLead({ ...newLead, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
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
                  <Label>Priority</Label>
                  <Select value={newLead.priority} onValueChange={(v) => setNewLead({ ...newLead, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estimated Value ($)</Label>
                <Input value={newLead.estimatedValue} onChange={(e) => setNewLead({ ...newLead, estimatedValue: e.target.value })} />
              </div>
              <Button className="w-full" onClick={handleCreateLead} disabled={createLead.isPending || !newLead.firstName || !newLead.lastName}>
                {createLead.isPending ? "Creating..." : "Create Lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-muted">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <stat.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name, email, phone, company..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sources</SelectItem>
                  <SelectItem value="ai_call">AI Call</SelectItem>
                  <SelectItem value="ai_chat">AI Chat</SelectItem>
                  <SelectItem value="website_form">Website Form</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={() => { setStatusFilter(""); setSourceFilter(""); setSearch(""); }}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">All Leads ({leads?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase border-b">
                <div className="col-span-3">Lead</div>
                <div className="col-span-2">Contact</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1">Priority</div>
                <div className="col-span-1">Value</div>
                <div className="col-span-1">Date</div>
                <div className="col-span-1"></div>
              </div>

              {/* Rows */}
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b">
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))
              ) : leads?.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No leads found matching your criteria.
                </div>
              ) : (
                leads?.map((lead) => (
                  <div
                    key={lead.id}
                    className="grid grid-cols-12 gap-2 px-4 py-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors items-center"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {lead.firstName[0]}{lead.lastName[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{lead.firstName} {lead.lastName}</p>
                          {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="space-y-0.5">
                        {lead.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className="text-[10px]">
                        {lead.source}
                      </Badge>
                    </div>
                    <div className="col-span-1">
                      <Badge variant="outline" className={`text-[10px] ${statusColors[lead.status ?? ""] || ""}`}>
                        {lead.status}
                      </Badge>
                    </div>
                    <div className="col-span-1">
                      <span className={`text-xs font-medium ${priorityColors[lead.priority ?? ""] || ""}`}>
                        {lead.priority}
                      </span>
                    </div>
                    <div className="col-span-1 text-sm">
                      {lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : "-"}
                    </div>
                    <div className="col-span-1 text-xs text-muted-foreground">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : ""}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
