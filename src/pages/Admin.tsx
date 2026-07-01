import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router";
import {
  Search,
  ArrowLeft,
  MoreVertical,
  Download,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
} from "lucide-react";

export default function Admin() {
  const navigate = useNavigate();

  const { data: organizations, isLoading: orgsLoading } = trpc.admin.organizations.useQuery({});
  
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "suspended" | "trialing">("all");
  const [billingTab, setBillingTab] = useState<"billing" | "audit">("billing");

  // Automatically select the first organization on load if available
  useEffect(() => {
    if (organizations && organizations.length > 0) {
      setSelectedOrg(organizations[0]);
    }
  }, [organizations]);

  const getOrgOwnerInfo = (slug: string) => {
    if (slug === "zenith-real-estate") return { owner: "Sarah Jenkins", email: "sarah@zenith.com", avatar: "SJ" };
    if (slug === "pulse-fitness") return { owner: "Michael Chen", email: "m.chen@pulse.fit", avatar: "MC" };
    if (slug === "aura-spa") return { owner: "Elena Rodriguez", email: "elena@aura.spa", avatar: "ER" };
    if (slug === "lumina-solar") return { owner: "David Miller", email: "d.miller@lumina.io", avatar: "DM" };
    if (slug === "vortex-tech") return { owner: "Jessica Wu", email: "jess@vortex.consulting", avatar: "JW" };
    return { owner: "Platform Administrator", email: "admin@platform.com", avatar: "PA" };
  };

  const getOrgMetadata = (org: any) => {
    const slug = org.slug || "";
    if (slug === "zenith-real-estate") {
      return {
        plan: "Pro Plan",
        trial: "Expired",
        trialClass: "bg-zinc-100 text-zinc-400 border-zinc-200",
        billing: "Paid",
        billingClass: "text-emerald-700 bg-emerald-50 border-emerald-100",
        billingIcon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
        activity: "2 mins ago",
      };
    }
    if (slug === "pulse-fitness") {
      return {
        plan: "Basic Plan",
        trial: "3 days left",
        trialClass: "border-zinc-200 text-zinc-650",
        billing: "Pending",
        billingClass: "text-amber-700 bg-amber-50 border-amber-100",
        billingIcon: <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
        activity: "45 mins ago",
      };
    }
    if (slug === "aura-spa") {
      return {
        plan: "Pro Plan",
        trial: "Expired",
        trialClass: "bg-zinc-100 text-zinc-400 border-zinc-200",
        billing: "Failed",
        billingClass: "text-red-750 bg-red-50 border-red-100",
        billingIcon: <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
        activity: "2 days ago",
      };
    }
    if (slug === "lumina-solar") {
      return {
        plan: "Enterprise",
        trial: "N/A",
        trialClass: "bg-zinc-100 text-zinc-400 border-zinc-200",
        billing: "Paid",
        billingClass: "text-emerald-700 bg-emerald-50 border-emerald-100",
        billingIcon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
        activity: "1 hour ago",
      };
    }
    if (slug === "vortex-tech") {
      return {
        plan: "Pro Plan",
        trial: "12 days left",
        trialClass: "border-zinc-200 text-zinc-650",
        billing: "Paid",
        billingClass: "text-emerald-700 bg-emerald-50 border-emerald-100",
        billingIcon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
        activity: "12 days left",
      };
    }
    return {
      plan: org.aiEnabled ? "Pro Plan" : "Basic Plan",
      trial: "N/A",
      trialClass: "bg-zinc-100 text-zinc-400 border-zinc-200",
      billing: org.status === "active" ? "Paid" : "Failed",
      billingClass: org.status === "active" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-red-750 bg-red-50 border-red-100",
      billingIcon: org.status === "active" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
      activity: "1 day ago",
    };
  };

  const getIntegrationStatuses = (org: any) => {
    const slug = org.slug || "";
    if (slug === "aura-spa") {
      return {
        twilio: { label: "CONNECTED", class: "text-emerald-700 bg-emerald-50 border-emerald-100" },
        claude: { label: "OPERATIONAL", class: "text-emerald-700 bg-emerald-50 border-emerald-100" },
        stripe: { label: "FAILED", class: "text-red-700 bg-red-50 border-red-100" },
      };
    }
    if (slug === "zenith-real-estate") {
      return {
        twilio: { label: "CONNECTED", class: "text-emerald-700 bg-emerald-50 border-emerald-100" },
        claude: { label: "OPERATIONAL", class: "text-emerald-700 bg-emerald-50 border-emerald-100" },
        stripe: { label: "ACTION REQ.", class: "text-red-750 bg-red-50 border-red-100" },
      };
    }
    return {
      twilio: { label: "CONNECTED", class: "text-emerald-700 bg-emerald-50 border-emerald-100" },
      claude: { label: "OPERATIONAL", class: "text-emerald-700 bg-emerald-50 border-emerald-100" },
      stripe: { label: "CONNECTED", class: "text-emerald-700 bg-emerald-50 border-emerald-100" },
    };
  };

  const getBillingHistory = (org: any) => {
    const history = [];
    const date = new Date(org.createdAt || "2023-08-01");
    // Generate up to 3 past monthly invoices
    for (let i = 0; i < 3; i++) {
      const billingDate = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const dateString = billingDate.toLocaleDateString("en", { month: "short", day: "2-digit", year: "numeric" });
      const amount = org.id % 2 === 0 ? "$97.00" : "$297.00";
      history.push({
        date: dateString,
        label: "Monthly Subscription",
        amount,
        status: org.status === "suspended" && i === 0 ? "Failed" : "Success",
      });
    }
    return history;
  };

  // Filter organizations dynamically
  const filteredOrgs = organizations?.filter((org) => {
    const ownerInfo = getOrgOwnerInfo(org.slug);
    const matchesSearch = 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerInfo.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerInfo.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const meta = getOrgMetadata(org);
    if (activeTab === "active" && org.status !== "active") return false;
    if (activeTab === "suspended" && org.status !== "suspended") return false;
    if (activeTab === "trialing" && !meta.trial.includes("left")) return false;

    return true;
  });

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
              Manage all LeadFlow AI tenant accounts and billing status.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => alert("Exporting Directory...")}
              className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-semibold hover:bg-zinc-50 flex items-center gap-1.5 shadow-none"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              Export Data
            </Button>
            <Button
              onClick={() => alert("Creating a new tenant profile is disabled in demo mode.")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              New Business
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
              <div className="col-span-2">Trial State</div>
              <div className="col-span-2">Billing</div>
              <div className="col-span-1 text-right pr-2">Last Activity</div>
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
                  const owner = getOrgOwnerInfo(org.slug);
                  const meta = getOrgMetadata(org);
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
                      <div className="col-span-2 select-none text-zinc-700">
                        {meta.plan}
                      </div>

                      {/* Trial State Badge */}
                      <div className="col-span-2 select-none">
                        <Badge variant="outline" className={`text-[9px] font-bold px-2 py-0.5 rounded shadow-none ${meta.trialClass}`}>
                          {meta.trial}
                        </Badge>
                      </div>

                      {/* Billing details */}
                      <div className="col-span-2 select-none flex items-center gap-1.5">
                        {meta.billingIcon}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${meta.billingClass}`}>
                          {meta.billing}
                        </span>
                      </div>

                      {/* Last Activity */}
                      <div className="col-span-1 text-right pr-2 text-zinc-400 font-medium select-none">
                        {meta.activity}
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
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-extrabold text-zinc-650 text-sm shrink-0 select-none">
                  {getOrgOwnerInfo(selectedOrg.slug).avatar}
                </div>
                <div className="min-w-0">
                  <span className="text-base font-extrabold text-zinc-950 block truncate leading-tight">
                    {selectedOrg.name}
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-400 block mt-0.5">
                    Owner: {getOrgOwnerInfo(selectedOrg.slug).owner}
                  </span>
                </div>
              </div>
              <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-1.5">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {/* Plan / Status details inline grid */}
            <div className="grid grid-cols-2 gap-3.5 select-none pb-4 border-b border-zinc-100">
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Plan</span>
                <span className="text-sm font-extrabold text-zinc-950 mt-1 block">{getOrgMetadata(selectedOrg).plan}</span>
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

            {/* Integration Status indicators Card */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 select-none">
                <span className="text-zinc-500">⚙️</span>
                <span className="text-xs font-bold text-zinc-950 tracking-wider">Integration Status</span>
              </div>

              <div className="space-y-2 text-xs font-bold text-zinc-700">
                {[
                  { label: "Twilio API (Voice/SMS)", val: getIntegrationStatuses(selectedOrg).twilio },
                  { label: "Claude AI Engine", val: getIntegrationStatuses(selectedOrg).claude },
                  { label: "Stripe Connect", val: getIntegrationStatuses(selectedOrg).stripe },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center border border-zinc-100 rounded-xl p-3 bg-zinc-50/20">
                    <span>{item.label}</span>
                    <Badge className={`text-[9px] font-extrabold px-2 py-0.5 rounded shadow-none border ${item.val.class}`}>
                      {item.val.label}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Selection (Billing / Audit Log) */}
            <div className="bg-zinc-100 p-0.5 rounded-lg grid grid-cols-2 text-center text-xs font-bold text-zinc-500">
              <button
                onClick={() => setBillingTab("billing")}
                className={`py-1.5 rounded-md transition-colors ${
                  billingTab === "billing" ? "bg-white text-zinc-950 shadow-xs" : "hover:text-zinc-900"
                }`}
              >
                Billing
              </button>
              <button
                onClick={() => setBillingTab("audit")}
                className={`py-1.5 rounded-md transition-colors ${
                  billingTab === "audit" ? "bg-white text-zinc-950 shadow-xs" : "hover:text-zinc-900"
                }`}
              >
                Audit Log
              </button>
            </div>

            {/* History Feed List */}
            {billingTab === "billing" ? (
              <div className="space-y-3">
                {getBillingHistory(selectedOrg).map((invoice, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2.5 border-b border-zinc-100 last:border-0">
                    <div>
                      <span className="text-xs font-extrabold text-zinc-950 block">{invoice.date}</span>
                      <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">{invoice.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-zinc-950 block">{invoice.amount}</span>
                      <Badge className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-none mt-0.5 border ${
                        invoice.status === "Success"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                          : "text-red-750 bg-red-50 border-red-100"
                      }`}>
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                <div className="pt-2 text-center select-none">
                  <a href="#full-history" onClick={(e) => { e.preventDefault(); alert("Viewing complete billing transaction ledger."); }} className="text-indigo-650 hover:text-indigo-700 text-xs font-extrabold hover:underline">
                    View Full History
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 text-xs text-zinc-500 font-semibold leading-relaxed">
                <div className="border-l-2 border-zinc-200 pl-3">
                  <span className="font-extrabold text-zinc-950 block">Admin session initialized</span>
                  <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Today at 10:42 AM</span>
                </div>
                <div className="border-l-2 border-zinc-200 pl-3">
                  <span className="font-extrabold text-zinc-950 block">AI phone trigger updated</span>
                  <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Yesterday at 2:15 PM</span>
                </div>
                <div className="border-l-2 border-zinc-200 pl-3">
                  <span className="font-extrabold text-zinc-950 block">Subscription plan upgraded</span>
                  <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Jun 24, 2026</span>
                </div>
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
                Click on any tenant row in the directory table to inspect integrations, subscription history, and administrative activity audit logs.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
