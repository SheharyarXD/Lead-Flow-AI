import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useNavigate } from "react-router";
import {
  MessageSquare,
  Search,
  MoreVertical,
  Plus,
  AlertCircle,
  Bot,
  Zap,
  ArrowRight,
} from "lucide-react";

export default function Conversations() {
  const { organizationId } = useOrganization();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "AI Handled" | "Urgent">("All");

  const { data: conversations, isLoading } = trpc.conversation.list.useQuery({
    organizationId: organizationId!,
    limit: 50,
  }, { enabled: !!organizationId });

  // New Message Modal states
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [searchLeadQuery, setSearchLeadQuery] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [modalTab, setModalTab] = useState<"select" | "create">("select");
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Fetch leads list
  const { data: leadsList, isLoading: leadsLoading } = trpc.lead.list.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId && isNewMessageOpen }
  );

  const utils = trpc.useUtils();

  const createConversationMutation = trpc.conversation.create.useMutation({
    onSuccess: (newConv) => {
      if (!newConv) {
        setDialogError("Failed to start conversation. Please try again.");
        return;
      }
      utils.conversation.list.invalidate();
      setIsNewMessageOpen(false);
      navigate(`/conversations/${newConv.id}`);
    },
    onError: (err) => {
      setDialogError(err.message || "Failed to create conversation.");
    },
  });

  const createLeadMutation = trpc.lead.create.useMutation({
    onSuccess: (newLead) => {
      if (!newLead) {
        setDialogError("Failed to create lead. Please try again.");
        return;
      }
      createConversationMutation.mutate({
        organizationId: organizationId!,
        leadId: newLead.id,
        channel: "sms",
      });
    },
    onError: (err) => {
      setDialogError(err.message || "Failed to create lead.");
    },
  });

  const handleCreateAndStart = () => {
    if (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim()) {
      setDialogError("First name, last name, and phone number are required.");
      return;
    }
    setDialogError(null);
    createLeadMutation.mutate({
      organizationId: organizationId!,
      firstName: newFirstName,
      lastName: newLastName,
      phone: newPhone,
      email: newEmail || undefined,
    });
  };

  // Dynamic Relative Time Formatter
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

  // Client-side filtering to ensure zero-latency feedback
  const filteredConversations = conversations?.filter((conv) => {
    // 1. Search Query Filter
    const contact = conv.customer || conv.lead;
    const fullName = `${contact?.firstName || ""} ${contact?.lastName || ""}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
      (conv.lastMessagePreview && conv.lastMessagePreview.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;

    // 2. Category Tab Filters
    if (activeTab === "AI Handled") return conv.aiHandled;
    if (activeTab === "Urgent") return conv.priority === "urgent";

    return true;
  });

  return (
    <div className="h-[calc(100vh-64px)] w-full flex overflow-hidden bg-white select-none">
      
      {/* COLUMN 1: Inbox List Panel */}
      <div className="w-80 border-r border-zinc-200/80 flex flex-col shrink-0 bg-white">
        
        {/* Inbox Header */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold text-zinc-950">Messages</h1>
            <Badge className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border-none font-bold text-[10px] py-1 px-2.5 rounded-full shadow-none shrink-0">
              {conversations?.length ?? 24} Total
            </Badge>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
            {(["All", "AI Handled", "Urgent"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${
                  activeTab === tab
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List Scroll area */}
        <div className="flex-1 overflow-y-auto border-t border-zinc-100">
          <div className="flex flex-col gap-2 p-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-xl space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-8" /></div>
                  <Skeleton className="h-3.5 w-full" />
                </div>
              ))
            ) : !filteredConversations || filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 font-semibold leading-relaxed">
                No conversations found.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const contact = conv.customer || conv.lead;
                const customerInitials = contact
                  ? `${contact.firstName[0] || ""}${contact.lastName[0] || ""}`
                  : "U";
                const customerName = contact
                  ? `${contact.firstName} ${contact.lastName}`
                  : "Unknown Customer";
                
                const isUnread = (conv.unreadCount ?? 0) > 0 || conv.status === "open";

                return (
                  <div
                    key={conv.id}
                    onClick={() => navigate(`/conversations/${conv.id}`)}
                    className="p-3 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-200 rounded-xl cursor-pointer flex gap-3 relative transition-all group"
                  >
                    {/* Active/Unread blue dot */}
                    {isUnread && (
                      <div className="absolute left-1 top-[18px] w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                    )}

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-300 flex items-center justify-center font-bold text-zinc-600 text-xs shrink-0 select-none">
                      {customerInitials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-950 truncate pr-2">
                          {customerName}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400 shrink-0">
                          {formatRelativeTime(conv.lastMessageAt || conv.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {conv.aiHandled && conv.status === "open" ? (
                          <Badge className="text-[9px] font-bold h-4.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-50 text-indigo-600 rounded-md shadow-none px-1 py-0.5">
                            AI Active
                          </Badge>
                        ) : conv.status === "pending" || conv.priority === "urgent" ? (
                          <Badge className="text-[9px] font-bold h-4.5 bg-red-50 border border-red-150 hover:bg-red-50 text-red-500 rounded-md shadow-none px-1 py-0.5">
                            Manual
                          </Badge>
                        ) : (
                          <Badge className="text-[9px] font-bold h-4.5 bg-zinc-100 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 rounded-md shadow-none px-1 py-0.5">
                            Intervened
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[8px] font-bold h-4.5 bg-zinc-50 border-zinc-200 hover:bg-zinc-50 text-zinc-500 rounded-md shadow-none px-1.5 py-0.5 uppercase">
                          {conv.channel === "ai_chat" ? "web" : conv.channel}
                        </Badge>
                      </div>
                      
                      <p className="text-[11px] text-zinc-500 truncate leading-relaxed">
                        {conv.lastMessagePreview || "No messages sent yet."}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Inbox Footer status indicator */}
        <div className="p-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-[10px] text-zinc-400 font-semibold shrink-0">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>AI Engine Online</span>
          </div>
          <span>v2.4.1</span>
        </div>
      </div>

      {/* COLUMN 2: Message Detail Panel (Placeholder when no conversation selected) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fcfcfd] justify-center items-center p-8 relative">
        <div className="flex flex-col items-center max-w-md text-center">
          
          {/* Centered chat bubble bot avatar layout */}
          <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center relative mb-5 shadow-sm">
            <MessageSquare className="w-7 h-7 text-zinc-400" />
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
              <Bot className="w-3.5 h-3.5" />
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-zinc-950 tracking-tight">
            No Conversation Selected
          </h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-[320px] font-medium">
            Select a thread from the list to view the message history, qualification status, and lead details.
          </p>

          {/* Quick Action cards */}
          <div className="grid grid-cols-2 gap-4 w-full mt-8">
            <div 
              onClick={() => {
                setDialogError(null);
                setNewFirstName("");
                setNewLastName("");
                setNewPhone("");
                setNewEmail("");
                setIsNewMessageOpen(true);
              }}
              className="bg-white border border-zinc-200 hover:border-indigo-200 rounded-xl p-4 text-left cursor-pointer transition-colors shadow-sm group"
            >
              <span className="text-xs font-bold text-zinc-950 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                + New Message
              </span>
              <p className="text-[10px] text-zinc-400 mt-1 font-medium leading-relaxed">
                Initiate a new SMS thread with a lead.
              </p>
            </div>

            <div 
              onClick={() => setActiveTab("Urgent")}
              className="bg-white border border-zinc-200 hover:border-indigo-200 rounded-xl p-4 text-left cursor-pointer transition-colors shadow-sm group"
            >
              <span className="text-xs font-bold text-zinc-950 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                <AlertCircle className="w-3 h-3 text-red-500" />
                Flagged AI
              </span>
              <p className="text-[10px] text-zinc-400 mt-1 font-medium leading-relaxed">
                Review AI interactions that need help.
              </p>
            </div>
          </div>

          {/* View all leads redirect */}
          <button 
            onClick={() => navigate("/leads")}
            className="mt-6 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 transition-colors"
          >
            View all leads <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Floating Utilities */}
        <div className="absolute bottom-6 right-6 flex items-center gap-3">
          <button className="bg-white hover:bg-zinc-50 border border-zinc-200 shadow-sm text-indigo-600 px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 transition-all active:scale-[0.98]">
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            AI Insights
          </button>
          <button 
            onClick={() => {
              setDialogError(null);
              setNewFirstName("");
              setNewLastName("");
              setNewPhone("");
              setNewEmail("");
              setIsNewMessageOpen(true);
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-all active:scale-[0.95]"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </div>
      </div>

      {/* COLUMN 3: Lead Context Sidebar (Placeholder when no conversation selected) */}
      <div className="w-72 border-l border-zinc-200/80 bg-white flex flex-col shrink-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <span className="text-sm font-extrabold text-zinc-950">Lead Context</span>
          <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 rounded-lg">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Silhouette avatar content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 flex flex-col items-center text-center space-y-6">
            
            {/* Silhouette circle */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-20 h-20 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center shadow-inner relative overflow-hidden">
                <svg className="w-12 h-12 text-zinc-300 mt-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-zinc-950">Select a Lead</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">No conversation active</p>
              </div>
            </div>

            {/* Profile / Tasks Tabs */}
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 text-xs font-bold text-zinc-700 h-9 border-zinc-200 hover:bg-zinc-50 rounded-lg shadow-none">
                Profile
              </Button>
              <Button variant="outline" className="flex-1 text-xs font-bold text-zinc-700 h-9 border-zinc-200 hover:bg-zinc-50 rounded-lg shadow-none">
                Tasks
              </Button>
            </div>

            {/* Qualification Stats placeholders */}
            <div className="w-full space-y-3 pt-2 text-left">
              <p className="text-[10px] font-bold text-zinc-400 tracking-wider">QUALIFICATION STATS</p>
              <div className="space-y-3 pl-0.5">
                {[1, 2, 3].map((val) => (
                  <div key={val} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-zinc-200 rounded-full shrink-0" />
                    <Skeleton className="h-2 w-full bg-zinc-100 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            {/* Active Integrations pills */}
            <div className="w-full space-y-3 pt-4 text-left border-t border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 tracking-wider">ACTIVE INTEGRATIONS</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge className="text-[9px] font-bold h-5 bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-50 shadow-none px-2 rounded-md">
                  Twilio SMS
                </Badge>
                <Badge className="text-[9px] font-bold h-5 bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-50 shadow-none px-2 rounded-md">
                  Stripe
                </Badge>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* New Message Dialog Modal */}
      {isNewMessageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-sm font-extrabold text-zinc-950">Start New Message</h3>
              <button 
                onClick={() => {
                  setIsNewMessageOpen(false);
                  setDialogError(null);
                }}
                className="text-zinc-400 hover:text-zinc-950 p-1 font-bold text-lg leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-zinc-100">
              <button
                onClick={() => setModalTab("select")}
                className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                  modalTab === "select"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/10"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Select Existing Lead
              </button>
              <button
                onClick={() => setModalTab("create")}
                className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                  modalTab === "create"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/10"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Add New Contact
              </button>
            </div>

            {/* Error Message */}
            {dialogError && (
              <div className="px-4 py-2.5 bg-red-50 text-red-800 text-[10px] font-bold border-b border-red-100">
                {dialogError}
              </div>
            )}

            {/* Body */}
            <div className="p-4 flex-1 overflow-y-auto min-h-0">
              {modalTab === "select" ? (
                <div className="space-y-3">
                  {/* Search leads input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search leads by name or number..."
                      value={searchLeadQuery}
                      onChange={(e) => setSearchLeadQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Leads List */}
                  <div className="space-y-1 max-h-[250px] overflow-y-auto border border-zinc-150 rounded-xl divide-y divide-zinc-100 bg-white">
                    {leadsLoading ? (
                      <div className="p-4 text-center text-xs text-zinc-400 font-medium">Loading leads...</div>
                    ) : !leadsList || leadsList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-400 font-medium">No leads found.</div>
                    ) : (
                      leadsList
                        .filter(lead => 
                          `${lead.firstName || ""} ${lead.lastName || ""}`.toLowerCase().includes(searchLeadQuery.toLowerCase()) ||
                          (lead.phone && lead.phone.includes(searchLeadQuery))
                        )
                        .map((lead) => (
                          <div
                            key={lead.id}
                            onClick={() => {
                              setDialogError(null);
                              createConversationMutation.mutate({
                                organizationId: organizationId!,
                                leadId: lead.id,
                                channel: "sms",
                              });
                            }}
                            className="p-3 text-left hover:bg-zinc-50 cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div>
                              <span className="text-xs font-bold text-zinc-950 block group-hover:text-indigo-600 transition-colors">
                                {lead.firstName} {lead.lastName}
                              </span>
                              {lead.phone && (
                                <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">
                                  {lead.phone}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] bg-indigo-50 border border-indigo-150 text-indigo-600 font-bold px-2 py-0.5 rounded-full capitalize">
                              {lead.status}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold text-zinc-655">First Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. John"
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-none"
                      />
                    </div>
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold text-zinc-655">Last Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Doe"
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-zinc-655">Phone Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. +15551234567"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-none"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-zinc-655">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-none"
                    />
                  </div>

                  <Button
                    onClick={handleCreateAndStart}
                    disabled={createLeadMutation.isPending || createConversationMutation.isPending}
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs rounded-lg shadow-sm flex items-center justify-center gap-1 transition-colors"
                  >
                    {createLeadMutation.isPending || createConversationMutation.isPending
                      ? "Starting..."
                      : "Create Lead & Start Chat"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
