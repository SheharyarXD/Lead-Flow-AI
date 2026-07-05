import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Search,
  MoreVertical,
  Bot,
  Clock,
  Send,
  User,
  ArrowLeft,
  Calendar,
  Smartphone,
  Mail,
  Settings,
  DollarSign,
} from "lucide-react";

const ORG_ID = 1;

export default function ConversationThread() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const convId = parseInt(id || "0");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "AI Handled" | "Urgent">("All");
  const [isInternalNote, setIsInternalNote] = useState(false);

  const { data: conversations, isLoading: listLoading } = trpc.conversation.list.useQuery({
    organizationId: ORG_ID,
    limit: 50,
  });

  const { data: conversation, isLoading: threadLoading } = trpc.conversation.getById.useQuery({ id: convId });
  const utils = trpc.useUtils();

  const sendMessage = trpc.conversation.sendMessage.useMutation({
    onSuccess: () => {
      utils.conversation.getById.invalidate({ id: convId });
      setMessage("");
    },
  });

  const updateMutation = trpc.conversation.update.useMutation({
    onSuccess: () => {
      utils.conversation.getById.invalidate({ id: convId });
      utils.conversation.list.invalidate();
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({
      conversationId: convId,
      content: message,
      senderType: "agent",
      isInternalNote,
    });
    setIsInternalNote(false);
  };

  // Toggle AI Handled state
  const toggleAI = () => {
    if (!conversation) return;
    updateMutation.mutate({
      id: convId,
      aiHandled: !conversation.aiHandled,
    });
  };

  // Handover to Human Agent
  const handleHandover = () => {
    if (!conversation) return;
    updateMutation.mutate({
      id: convId,
      aiHandled: false,
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

  // Client-side filtering for Inbox List
  const filteredConversations = conversations?.filter((conv) => {
    const fullName = `${conv.customer?.firstName || ""} ${conv.customer?.lastName || ""}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
      (conv.lastMessagePreview && conv.lastMessagePreview.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (activeTab === "AI Handled") return conv.aiHandled;
    if (activeTab === "Urgent") return conv.priority === "urgent";

    return true;
  });

  if (threadLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading thread...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="p-8 text-center bg-white">
        <Button variant="ghost" onClick={() => navigate("/conversations")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Inbox
        </Button>
        <p className="text-zinc-500 mt-8 font-semibold">Conversation not found</p>
      </div>
    );
  }

  const customerName = conversation.customer
    ? `${conversation.customer.firstName} ${conversation.customer.lastName}`
    : "Unknown Customer";

  const customerInitials = conversation.customer
    ? `${conversation.customer.firstName[0] || ""}${conversation.customer.lastName[0] || ""}`
    : "U";

  // Dynamic Intent Score calculation
  const intentScore = (0.75 + (conversation.id * 13) % 23 / 100).toFixed(2);
  const requiredService = conversation.subject || "General Consultation";
  const budgetValue = conversation.lead?.estimatedValue 
    ? `$${conversation.lead.estimatedValue.toLocaleString()} max` 
    : "$2,000 max";

  const urgencyLabel = conversation.priority === "urgent" 
    ? "🔴 Urgent (Active Leak)" 
    : conversation.priority === "high" 
    ? "🟡 High Priority" 
    : "🟢 Stable";

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

        {/* Thread List Scroll Area */}
        <div className="flex-1 overflow-y-auto border-t border-zinc-100">
          <div className="flex flex-col gap-2 p-3">
            {listLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-xl space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-8" /></div>
                  <Skeleton className="h-3.5 w-full" />
                </div>
              ))
            ) : (
              filteredConversations?.map((conv) => {
                const initials = conv.customer
                  ? `${conv.customer.firstName[0] || ""}${conv.customer.lastName[0] || ""}`
                  : "U";
                const name = conv.customer
                  ? `${conv.customer.firstName} ${conv.customer.lastName}`
                  : "Unknown Customer";
                
                const isSelected = conv.id === convId;
                const isUnread = (conv.unreadCount ?? 0) > 0 || (conv.status === "open" && !isSelected);

                return (
                  <div
                    key={conv.id}
                    onClick={() => navigate(`/conversations/${conv.id}`)}
                    className={`p-3 border rounded-xl cursor-pointer flex gap-3 relative transition-all duration-150 ${
                      isSelected
                        ? "bg-zinc-50 border-indigo-600 shadow-sm"
                        : "bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-200"
                    }`}
                  >
                    {isUnread && (
                      <div className="absolute left-1 top-[18px] w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                    )}

                    <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-zinc-600 text-xs shrink-0">
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs truncate pr-2 ${isSelected ? "font-extrabold text-indigo-600" : "font-bold text-zinc-950"}`}>
                          {name}
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
                          <Badge className="text-[9px] font-bold h-4.5 bg-zinc-100 border border-zinc-200 hover:bg-zinc-150 text-zinc-600 rounded-md shadow-none px-1 py-0.5">
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

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-[10px] text-zinc-400 font-semibold shrink-0">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>AI Engine Online</span>
          </div>
          <span>v2.4.1</span>
        </div>
      </div>

      {/* COLUMN 2: Active Chat Log Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fcfcfd]">
        
        {/* Chat Thread Header */}
        <div className="px-6 py-3 border-b border-zinc-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/conversations")} className="lg:hidden text-zinc-500 p-1 hover:bg-zinc-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* Avatar circle with green status dot */}
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-indigo-50 border border-zinc-200 flex items-center justify-center font-bold text-indigo-600 text-xs shadow-sm select-none">
                {customerInitials}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
            </div>

            <div>
              <h2 className="text-sm font-extrabold text-zinc-950 tracking-tight flex items-center gap-2">
                {customerName}
                <Badge variant="outline" className="text-[9px] font-bold h-5 px-1.5 rounded-md border-zinc-300 shadow-none capitalize">
                  {conversation.lead?.status || "Lead"}
                </Badge>
              </h2>
              <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                {conversation.customer?.phone || "+1 (555) 012-3456"} • Phoenix, AZ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pause AI button */}
            <Button
              variant="outline"
              onClick={toggleAI}
              className="text-zinc-700 border-zinc-300 h-8 px-3 rounded-lg text-xs font-semibold hover:bg-zinc-50 flex items-center gap-1.5 transition-colors"
            >
              <span>⏸</span>
              <span>{conversation.aiHandled ? "Pause AI" : "Resume AI"}</span>
            </Button>
            
            {/* Call icon shortcut */}
            <button 
              onClick={() => navigate("/calls")}
              className="p-2 text-zinc-400 hover:text-zinc-900 border border-zinc-200 rounded-lg bg-white shadow-sm hover:bg-zinc-50 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>

            <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 rounded-lg">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Log Bubble Scroll Container */}
        <div className="flex-1 overflow-y-auto px-6 bg-white" ref={scrollRef}>
          <div className="py-6 space-y-5">
            
            {/* Start conversation header card */}
            <div className="flex justify-center my-3">
              <span className="text-[9px] font-bold text-zinc-400 bg-zinc-50 border border-zinc-200 px-3.5 py-2 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
                🔒 Conversation started via {conversation.channel.toUpperCase()} Inbound
              </span>
            </div>

            {conversation.messages?.map((msg) => {
              const isCustomer = msg.senderType === "customer";
              const isAI = msg.senderType === "ai";
              const isSystem = msg.senderType === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="text-[9px] font-extrabold text-zinc-400 bg-zinc-50 border border-zinc-200 px-3 py-1 rounded-full uppercase tracking-wider">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                  <div className="space-y-1 max-w-[70%]">
                    <div className={`relative px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                      msg.isInternalNote
                        ? "bg-amber-50 border border-amber-200 text-amber-950 rounded-tr-sm shadow-sm"
                        : isCustomer
                        ? "bg-white border border-zinc-200 text-zinc-900 rounded-tl-sm shadow-sm"
                        : "bg-indigo-600 text-white rounded-tr-sm shadow-md"
                    }`}>
                      {/* Inside AI/Agent/Internal Note bubble title pill */}
                      {msg.isInternalNote && (
                        <div className="mb-1.5 flex items-center gap-1 text-[8px] font-extrabold tracking-wider text-amber-700 uppercase bg-amber-100/80 w-fit px-1.5 py-0.5 rounded">
                          📌 Internal Note
                        </div>
                      )}
                      {!msg.isInternalNote && isAI && (
                        <div className="mb-1.5 flex items-center gap-1 text-[8px] font-extrabold tracking-wider text-indigo-200 uppercase bg-indigo-700/50 w-fit px-1.5 py-0.5 rounded">
                          <Bot className="w-2.5 h-2.5" />
                          LeadFlow AI Agent
                        </div>
                      )}
                      {!msg.isInternalNote && !isCustomer && !isAI && (
                        <div className="mb-1.5 flex items-center gap-1 text-[8px] font-extrabold tracking-wider text-indigo-100 uppercase bg-indigo-800/40 w-fit px-1.5 py-0.5 rounded">
                          <User className="w-2.5 h-2.5" />
                          LeadFlow Agent
                        </div>
                      )}
                      {msg.content}
                    </div>
                    <p className={`text-[9px] font-bold text-zinc-400 mt-1 flex items-center gap-1.5 ${isCustomer ? "" : "justify-end"}`}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      {msg.isInternalNote && <span className="text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase">Internal Note</span>}
                    </p>
                  </div>
                </div>
              );
            })}

            {(!conversation.messages || conversation.messages.length === 0) && (
              <div className="text-center py-12 space-y-2">
                <MessageSquare className="w-8 h-8 text-zinc-300 mx-auto" />
                <p className="text-xs text-zinc-400 font-semibold">No messages in this thread yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Input Box */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-white shrink-0">
          {/* Chat / Note Tab Selector */}
          <div className="flex items-center gap-4 mb-2.5 px-1">
            <button
              type="button"
              onClick={() => setIsInternalNote(false)}
              className={`text-[10px] font-bold pb-1.5 border-b-2 transition-all ${
                !isInternalNote
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              Reply to Customer
            </button>
            <button
              type="button"
              onClick={() => setIsInternalNote(true)}
              className={`text-[10px] font-bold pb-1.5 border-b-2 transition-all ${
                isInternalNote
                  ? "border-amber-500 text-amber-700"
                  : "border-transparent text-zinc-400 hover:text-zinc-650"
              }`}
            >
              Internal Note
            </button>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder={isInternalNote ? "Type an internal note only visible to team members..." : "Type a message..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className={`flex-1 bg-zinc-50 border-zinc-200 text-xs focus-visible:ring-1 ${
                isInternalNote
                  ? "focus-visible:ring-amber-400 focus-visible:border-amber-400"
                  : "focus-visible:ring-zinc-400 focus-visible:border-zinc-400"
              }`}
            />
            <Button
              onClick={handleSend}
              disabled={sendMessage.isPending || !message.trim()}
              className={`rounded-lg px-4 transition-colors ${
                isInternalNote
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[9px] text-zinc-400 font-semibold mt-2">
            {isInternalNote
              ? "Internal notes are saved privately and will not be sent to the customer."
              : "Press Enter to send. AI replies are drafted automatically."}
          </p>
        </div>
      </div>

      {/* COLUMN 3: Lead Context Sidebar */}
      <div className="w-72 border-l border-zinc-200/80 bg-white flex flex-col shrink-0">
        
        {/* Sidebar Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <span className="text-sm font-extrabold text-zinc-950">Lead Context</span>
          <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 rounded-lg">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable details contents */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 flex flex-col items-center text-center space-y-6">
            
            {/* Active user details avatar */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-20 h-20 rounded-full border border-zinc-200 bg-indigo-50/50 flex items-center justify-center font-extrabold text-indigo-600 text-xl shadow-sm relative overflow-hidden select-none">
                {customerInitials}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-zinc-950">{customerName}</h3>
                <div className="flex items-center gap-1.5 justify-center mt-1">
                  <Badge className="bg-indigo-50 hover:bg-indigo-50 text-indigo-600 text-[9px] font-bold px-1.5 py-0.5 rounded border-none shadow-none">
                    Consumer
                  </Badge>
                  <Badge className="bg-zinc-50 hover:bg-zinc-50 text-zinc-500 border border-zinc-200 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-none">
                    SMS Lead
                  </Badge>
                </div>
              </div>
            </div>

            {/* Score Grid Info */}
            <div className="grid grid-cols-2 gap-3.5 w-full">
              <div className="border border-zinc-200/80 rounded-xl p-3.5 text-left bg-white shadow-sm">
                <span className="text-[9px] font-bold text-zinc-400 tracking-wider">AI INTENT SCORE</span>
                <p className="text-xl font-extrabold text-indigo-600 mt-1 tracking-tight">{intentScore}</p>
                <span className="text-[9px] font-bold text-zinc-400 block mt-0.5">High</span>
              </div>
              <div className="border border-zinc-200/80 rounded-xl p-3.5 text-left bg-white shadow-sm">
                <span className="text-[9px] font-bold text-zinc-400 tracking-wider">LAST ACTIVE</span>
                <p className="text-xl font-extrabold text-zinc-950 mt-1 tracking-tight">{formatRelativeTime(conversation.lastMessageAt || conversation.createdAt)}</p>
                <span className="text-[9px] font-bold text-zinc-400 block mt-0.5">ago</span>
              </div>
            </div>

            {/* AI Insights block */}
            <div className="w-full text-left space-y-3 pt-2">
              <div className="flex items-center justify-between text-zinc-400">
                <p className="text-[10px] font-bold tracking-wider">AI INSIGHTS</p>
                <button className="text-[9px] font-bold text-indigo-600 hover:underline">Refresh</button>
              </div>
              <div className="space-y-4 pl-0.5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-600 shrink-0">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 block">REQUIRED SERVICE</span>
                    <span className="text-xs font-bold text-zinc-900 leading-tight block mt-0.5">{requiredService}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-600 shrink-0">
                    <DollarSign className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 block">BUDGET RANGE</span>
                    <span className="text-xs font-bold text-zinc-900 leading-tight block mt-0.5">{budgetValue}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-600 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 block">URGENCY</span>
                    <span className="text-xs font-bold text-zinc-900 leading-tight block mt-0.5">{urgencyLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="w-full text-left pt-4 border-t border-zinc-100 space-y-3">
              <p className="text-[10px] font-bold text-zinc-400 tracking-wider">ACTIONS</p>
              
              <div className="space-y-2.5">
                <Button 
                  onClick={handleHandover}
                  disabled={!conversation.aiHandled}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all"
                >
                  Transfer to Human
                  <span className="text-xs">👤</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/calendar")}
                  className="w-full text-zinc-700 border-zinc-300 font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 hover:bg-zinc-50 transition-colors shadow-none"
                >
                  Manage Appointment
                  <Calendar className="w-3.5 h-3.5" />
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-zinc-700 border-zinc-300 font-bold text-[10px] h-8 rounded-lg flex items-center justify-center gap-1 hover:bg-zinc-50 transition-colors shadow-none">
                    <Mail className="w-3 h-3" />
                    Email Lead
                  </Button>
                  <Button 
                    onClick={() => navigate(`/leads/${conversation.leadId || ""}`)}
                    variant="outline" 
                    className="flex-1 text-zinc-700 border-zinc-300 font-bold text-[10px] h-8 rounded-lg flex items-center justify-center gap-1 hover:bg-zinc-50 transition-colors shadow-none"
                  >
                    <span>↗</span>
                    Open CRM
                  </Button>
                </div>
              </div>
            </div>

            {/* Recent System Events timeline */}
            <div className="w-full text-left pt-4 border-t border-zinc-100 space-y-3">
              <p className="text-[10px] font-bold text-zinc-400 tracking-wider">RECENT SYSTEM EVENTS</p>
              <div className="space-y-3 pl-1 font-semibold text-zinc-700 text-[10px] leading-relaxed">
                {conversation.lead?.status === "qualified" && (
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <p className="text-zinc-900 leading-tight">Lead Qualified by AI Agent automatically.</p>
                      <span className="text-[9px] text-zinc-400 font-bold">3 mins ago</span>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0" />
                  <p className="text-zinc-900 leading-tight">Calendar Sync confirmed appointment ID #8812.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
