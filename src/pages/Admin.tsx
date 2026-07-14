import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  Search,
  ArrowLeft,
  Download,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
  Smartphone,
  Mail,
  Zap,
} from "lucide-react";

type AdminOrg = {
  id: number;
  name: string;
  slug: string;
  status: string;
  phone?: string | null;
  email?: string | null;
  aiEnabled?: boolean | null;
  createdAt: string | Date;
  subscription?: {
    plan: string;
    status: string;
    currentPeriodEnd?: string | Date | null;
    createdAt: string | Date;
    minutesIncluded?: number | null;
    minutesUsed?: number | null;
    leadsLimit?: number | null;
    usersLimit?: number | null;
  } | null;
  members?: Array<{ role: string; user?: { id: number; name: string | null; email: string } | null }>;
};

const SUBSCRIPTION_STATUS_STYLE: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
  active: { label: "Active", class: "text-emerald-700 bg-emerald-50 border-emerald-100", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> },
  trialing: { label: "Trialing", class: "text-amber-700 bg-amber-50 border-amber-100", icon: <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" /> },
  past_due: { label: "Past Due", class: "text-red-750 bg-red-50 border-red-100", icon: <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" /> },
  cancelled: { label: "Cancelled", class: "text-zinc-600 bg-zinc-100 border-zinc-200", icon: <XCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> },
  paused: { label: "Paused", class: "text-zinc-600 bg-zinc-100 border-zinc-200", icon: <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> },
};

function getOwner(org: AdminOrg) {
  const owner = org.members?.find((m) => m.role === "owner")?.user;
  if (!owner) return { name: "No owner assigned", email: "—", avatar: "?" };
  const name = owner.name || owner.email;
  return {
    name,
    email: owner.email,
    avatar: name.slice(0, 2).toUpperCase(),
  };
}

function getTrialLabel(sub?: AdminOrg["subscription"]) {
  if (!sub) return "No Plan";
  if (sub.status !== "trialing") return sub.status === "active" ? "Active" : sub.status;
  const end = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd)
    : new Date(new Date(sub.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  return days > 0 ? `${days} days left` : "Expired";
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const { data: organizations, isLoading: orgsLoading } = trpc.admin.organizations.useQuery({}, { enabled: user?.role === "admin" });

  const [selectedOrg, setSelectedOrg] = useState<AdminOrg | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "suspended" | "trialing">("all");
  const [detailTab, setDetailTab] = useState<"subscription" | "activity">("subscription");

  const { data: activityLog, isLoading: activityLoading } = trpc.admin.organizationActivity.useQuery(
    { organizationId: selectedOrg?.id ?? 0 },
    { enabled: !!selectedOrg && detailTab === "activity" }
  );

  useEffect(() => {
    if (organizations && organizations.length > 0 && !selectedOrg) {
      setSelectedOrg(organizations[0] as AdminOrg);
    }
  }, [organizations, selectedOrg]);

  const filteredOrgs = (organizations as AdminOrg[] | undefined)?.filter((org) => {
    const owner = getOwner(org);
    const matchesSearch =
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      owner.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === "active" && org.status !== "active") return false;
    if (activeTab === "suspended" && org.status !== "suspended") return false;
    if (activeTab === "trialing" && org.subscription?.status !== "trialing") return false;

    return true;
  });

  const handleExport = () => {
    if (!organizations || organizations.length === 0) return;
    const headers = ["Name", "Slug", "Status", "Plan", "Subscription Status", "Owner Email", "Created At"];
    const rows = (organizations as AdminOrg[]).map((org) => [
      org.name,
      org.slug,
      org.status,
      org.subscription?.plan ?? "",
      org.subscription?.status ?? "",
      getOwner(org).email,
      new Date(org.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tenants-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatRelativeTime = (dateInput?: Date | string | null): string => {
    if (!dateInput) return "just now";
    const date = new Date(dateInput);
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return "just now";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (authLoading) return null;
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="h-[calc(100vh-64px)] w-full flex overflow-hidden bg-white select-none">

      {/* LEFT PANEL: Business Directory Table */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fcfcfd] p-8 space-y-6 overflow-y-auto">

        {/* Header navigation bar */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg h-8 w-8 shadow-none">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-zinc-400 font-extrabold uppercase tracking-wider">Superadmin Panel</span>
        </div>

        {/* Directory Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950">Business Directory</h1>
            <p className="text-zinc-500 text-sm mt-1 font-medium">
              Manage all LeadFlow AI tenant accounts and subscription status.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!organizations || organizations.length === 0}
              className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-semibold hover:bg-zinc-50 flex items-center gap-1.5 shadow-none"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              Export Data
            </Button>
          </div>
        </div>

        {/* Filters and search inline controls row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">

          {/* Tabs Filter Selection Row */}
          <div className="flex items-center gap-5 text-xs font-bold text-zinc-500 select-none">
            {(["all", "active", "suspended", "trialing"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 capitalize transition-all border-b-2 -mb-0.5 relative ${
                  activeTab === tab
                    ? "border-indigo-600 text-indigo-600 font-extrabold"
                    : "border-transparent hover:text-zinc-950"
                }`}
              >
                {tab === "all" ? "All Businesses" : tab}
                {tab === "all" && organizations && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-zinc-100 text-zinc-500">
                    {organizations.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search box inline filter */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Search business, owner, or email..."
              className="pl-9 bg-white border-zinc-200 text-xs placeholder:text-zinc-400 h-9 rounded-lg focus-visible:ring-zinc-400 focus-visible:border-zinc-400 shadow-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

        </div>

        {/* Business Directory Records Card */}
        <div className="border border-zinc-200/80 bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="min-w-[850px] overflow-x-auto">

            {/* Header Row */}
            <div className="grid grid-cols-12 gap-2 px-6 py-3.5 text-xs font-bold text-zinc-400 uppercase border-b border-zinc-100 bg-zinc-50/20 select-none">
              <div className="col-span-3">Business & Owner</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Plan</div>
              <div className="col-span-2">Subscription</div>
              <div className="col-span-2">Members</div>
              <div className="col-span-1 text-right pr-2">Created</div>
            </div>

            {/* List Content Rows */}
            <div className="divide-y divide-zinc-100">
              {orgsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-zinc-100 items-center">
                    <div className="col-span-3 flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-full bg-zinc-100" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-28 bg-zinc-100" />
                        <Skeleton className="h-3 w-16 bg-zinc-100" />
                      </div>
                    </div>
                    <div className="col-span-2"><Skeleton className="h-4 w-16 bg-zinc-100" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-12 bg-zinc-100" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-20 bg-zinc-100" /></div>
                    <div className="col-span-2"><Skeleton className="h-5 w-24 rounded-md bg-zinc-100" /></div>
                    <div className="col-span-1"><Skeleton className="h-4 w-12 bg-zinc-100" /></div>
                  </div>
                ))
              ) : !filteredOrgs || filteredOrgs.length === 0 ? (
                <div className="px-6 py-12 text-center text-xs text-zinc-400 font-semibold bg-white select-none">
                  No businesses found.
                </div>
              ) : (
                filteredOrgs.map((org) => {
                  const owner = getOwner(org);
                  const subStyle = SUBSCRIPTION_STATUS_STYLE[org.subscription?.status ?? ""] ?? {
                    label: "No Plan",
                    class: "text-zinc-600 bg-zinc-100 border-zinc-200",
                    icon: <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
                  };
                  const isSel = selectedOrg && selectedOrg.id === org.id;

                  return (
                    <div
                      key={org.id}
                      onClick={() => setSelectedOrg(org)}
                      className={`grid grid-cols-12 gap-2 px-6 py-4 items-center cursor-pointer transition-colors text-xs text-zinc-950 font-semibold border-l-2 ${
                        isSel
                          ? "bg-zinc-50/40 border-l-indigo-650"
                          : "border-l-transparent hover:bg-zinc-50/50"
                      }`}
                    >
                      {/* Business & Owner Info */}
                      <div className="col-span-3 flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-zinc-650 text-xs shrink-0 select-none">
                          {owner.avatar}
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-zinc-950 block truncate">
                            {org.name}
                          </span>
                          <span className="text-[10px] font-semibold text-zinc-400 block mt-0.5 truncate">
                            {owner.email}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="col-span-2 select-none">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          org.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            org.status === "active" ? "bg-emerald-500" : "bg-red-500"
                          }`} />
                          <span className="capitalize">{org.status}</span>
                        </span>
                      </div>

                      {/* Plan details */}
                      <div className="col-span-2 select-none text-zinc-700 capitalize">
                        {org.subscription?.plan ?? "—"}
                      </div>

                      {/* Subscription state */}
                      <div className="col-span-2 select-none">
                        <Badge variant="outline" className={`text-[9px] font-bold px-2 py-0.5 rounded shadow-none ${subStyle.class}`}>
                          {getTrialLabel(org.subscription)}
                        </Badge>
                      </div>

                      {/* Members count */}
                      <div className="col-span-2 select-none flex items-center gap-1.5 text-zinc-700">
                        {org.members?.length ?? 0} member{(org.members?.length ?? 0) === 1 ? "" : "s"}
                      </div>

                      {/* Created */}
                      <div className="col-span-1 text-right pr-2 text-zinc-400 font-medium select-none">
                        {new Date(org.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Table pagination footer */}
            <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-zinc-400 select-none">
              <span>Showing 1 to {filteredOrgs?.length ?? 0} of {organizations?.length ?? 0} businesses</span>
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
        </div>

      </div>

      {/* RIGHT PANEL: Account Details Sidebar */}
      <div className="w-88 border-l border-zinc-200/80 bg-white flex flex-col shrink-0 overflow-y-auto select-none">
        {selectedOrg ? (
          <div className="p-6 space-y-6">

            {/* Header Close Row */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 select-none">
              <span className="text-sm font-extrabold text-zinc-950">Account Detail</span>
              <button
                onClick={() => setSelectedOrg(null)}
                className="text-zinc-400 hover:text-zinc-900 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Identity Details block */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-extrabold text-zinc-650 text-sm shrink-0 select-none">
                {getOwner(selectedOrg).avatar}
              </div>
              <div className="min-w-0">
                <span className="text-base font-extrabold text-zinc-950 block truncate leading-tight">
                  {selectedOrg.name}
                </span>
                <span className="text-[10px] font-semibold text-zinc-400 block mt-0.5">
                  Owner: {getOwner(selectedOrg).name}
                </span>
              </div>
            </div>

            {/* Plan / Status details inline grid */}
            <div className="grid grid-cols-2 gap-3.5 select-none pb-4 border-b border-zinc-100">
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Plan</span>
                <span className="text-sm font-extrabold text-zinc-950 mt-1 block capitalize">{selectedOrg.subscription?.plan ?? "No plan"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Status</span>
                <Badge className={`mt-1 font-bold text-[10px] px-2 py-0.5 rounded shadow-none select-none border ${
                  selectedOrg.status === "active"
                    ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                    : "text-red-750 bg-red-50 border-red-100"
                }`}>
                  {selectedOrg.status}
                </Badge>
              </div>
            </div>

            {/* Configuration Status — real signals only */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 select-none">
                <span className="text-zinc-500">⚙️</span>
                <span className="text-xs font-bold text-zinc-950 tracking-wider">Configuration Status</span>
              </div>

              <div className="space-y-2 text-xs font-bold text-zinc-700">
                {[
                  { label: "SMS Number", icon: Smartphone, active: !!selectedOrg.phone },
                  { label: "Email Routing", icon: Mail, active: !!selectedOrg.email },
                  { label: "AI Auto-Reply", icon: Zap, active: !!selectedOrg.aiEnabled },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center border border-zinc-100 rounded-xl p-3 bg-zinc-50/20">
                    <span className="flex items-center gap-2">
                      <item.icon className="w-3.5 h-3.5 text-zinc-400" />
                      {item.label}
                    </span>
                    <Badge className={`text-[9px] font-extrabold px-2 py-0.5 rounded shadow-none border ${item.active ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-zinc-500 bg-zinc-100 border-zinc-200"}`}>
                      {item.active ? "Configured" : "Not Set"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Selection (Subscription / Activity) */}
            <div className="bg-zinc-100 p-0.5 rounded-lg grid grid-cols-2 text-center text-xs font-bold text-zinc-500">
              <button
                onClick={() => setDetailTab("subscription")}
                className={`py-1.5 rounded-md transition-colors ${
                  detailTab === "subscription" ? "bg-white text-zinc-950 shadow-xs" : "hover:text-zinc-900"
                }`}
              >
                Subscription
              </button>
              <button
                onClick={() => setDetailTab("activity")}
                className={`py-1.5 rounded-md transition-colors ${
                  detailTab === "activity" ? "bg-white text-zinc-950 shadow-xs" : "hover:text-zinc-900"
                }`}
              >
                Activity Log
              </button>
            </div>

            {/* Detail panel */}
            {detailTab === "subscription" ? (
              selectedOrg.subscription ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                    <span className="text-zinc-500 font-semibold">Minutes Used</span>
                    <span className="font-extrabold text-zinc-950">{selectedOrg.subscription.minutesUsed ?? 0} / {selectedOrg.subscription.minutesIncluded ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                    <span className="text-zinc-500 font-semibold">Leads Limit</span>
                    <span className="font-extrabold text-zinc-950">{selectedOrg.subscription.leadsLimit ?? "Unlimited"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                    <span className="text-zinc-500 font-semibold">Users Limit</span>
                    <span className="font-extrabold text-zinc-950">{selectedOrg.subscription.usersLimit ?? "Unlimited"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-zinc-500 font-semibold">Current Period Ends</span>
                    <span className="font-extrabold text-zinc-950">
                      {selectedOrg.subscription.currentPeriodEnd
                        ? new Date(selectedOrg.subscription.currentPeriodEnd).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 font-semibold text-center py-6">No subscription on record.</p>
              )
            ) : (
              <div className="space-y-3.5 text-xs text-zinc-500 font-semibold leading-relaxed">
                {activityLoading ? (
                  <Skeleton className="h-16 w-full rounded-xl" />
                ) : !activityLog || activityLog.length === 0 ? (
                  <p className="text-xs text-zinc-400 font-semibold text-center py-6">No activity recorded for this organization yet.</p>
                ) : (
                  activityLog.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-zinc-200 pl-3">
                      <span className="font-extrabold text-zinc-950 block">{entry.action}</span>
                      {entry.description && <span className="text-zinc-500 block mt-0.5">{entry.description}</span>}
                      <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">{formatRelativeTime(entry.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        ) : (
          <div className="p-6 h-full flex flex-col items-center justify-center text-center space-y-4 select-none">
            <div className="w-12 h-12 rounded-full border border-zinc-150 bg-zinc-50 flex items-center justify-center text-zinc-400 shadow-sm">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-zinc-950 block">Select a Business</span>
              <p className="text-[10px] text-zinc-400 font-semibold leading-relaxed max-w-[200px] mt-1 mx-auto">
                Click on any tenant row in the directory table to inspect configuration, subscription, and activity.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
