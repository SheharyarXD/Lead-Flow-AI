import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Bot,
  Send,
  User,
  Phone,
  MessageCircle,
  StickyNote,
  Clock,
} from "lucide-react";

const channelLabels: Record<string, string> = {
  ai_chat: "AI Chat",
  web_chat: "Web Chat",
  sms: "SMS",
  phone: "Phone",
  email: "Email",
  whatsapp: "WhatsApp",
};

export default function ConversationThread() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const convId = parseInt(id || "0");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  const { data: conversation, isLoading } = trpc.conversation.getById.useQuery({ id: convId });
  const utils = trpc.useUtils();

  const sendMessage = trpc.conversation.sendMessage.useMutation({
    onSuccess: () => {
      utils.conversation.getById.invalidate({ id: convId });
      setMessage("");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/conversations")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <p className="text-muted-foreground mt-8 text-center">Conversation not found</p>
      </div>
    );
  }

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({
      conversationId: convId,
      content: message,
      senderType: "agent",
    });
  };

  const customerName = conversation.customer
    ? `${conversation.customer.firstName} ${conversation.customer.lastName}`
    : "Unknown";

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/conversations")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold truncate">{conversation.subject || customerName}</h1>
            <Badge variant="outline" className="text-[10px] shrink-0">{channelLabels[conversation.channel] || conversation.channel}</Badge>
            {conversation.aiHandled && (
              <Badge variant="secondary" className="text-[10px] shrink-0 bg-emerald-50 text-emerald-700">
                <Bot className="w-3 h-3 mr-1" />
                AI Handled
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground">{customerName}</span>
            <Badge variant={conversation.status === "open" ? "default" : "secondary"} className="text-[10px] h-4">
              {conversation.status}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-4 capitalize">{conversation.priority} priority</Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs defaultValue="messages" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-3 shrink-0 w-fit">
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="flex-1 flex flex-col mt-0 min-h-0">
              {/* Messages */}
              <ScrollArea className="flex-1 px-6" ref={scrollRef}>
                <div className="py-4 space-y-4">
                  {conversation.messages?.map((msg) => {
                    const isCustomer = msg.senderType === "customer";
                    const isAI = msg.senderType === "ai";
                    const isSystem = msg.senderType === "system";

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                        <div className={`flex gap-2 max-w-[70%] ${isCustomer ? "flex-row" : "flex-row-reverse"}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            isAI ? "bg-emerald-100" : isCustomer ? "bg-muted" : "bg-primary"
                          }`}>
                            {isAI ? <Bot className="w-3.5 h-3.5 text-emerald-600" /> :
                             isCustomer ? <User className="w-3.5 h-3.5" /> :
                             <Send className="w-3.5 h-3.5 text-primary-foreground" />}
                          </div>
                          <div>
                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                              isCustomer
                                ? "bg-muted rounded-tl-sm"
                                : isAI
                                ? "bg-emerald-50 text-emerald-900 rounded-tr-sm border border-emerald-200"
                                : "bg-primary text-primary-foreground rounded-tr-sm"
                            }`}>
                              {msg.content}
                            </div>
                            <p className={`text-[10px] text-muted-foreground mt-1 ${isCustomer ? "" : "text-right"}`}>
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                              {isInternalNote(msg) && <span className="ml-1 text-amber-600">Internal Note</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!conversation.messages || conversation.messages.length === 0) && (
                    <div className="text-center py-12">
                      <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="px-6 py-3 border-t bg-background shrink-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={sendMessage.isPending || !message.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Press Enter to send. Use @ to mention team members.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="info" className="mt-0 px-6 py-4 overflow-auto">
              <div className="max-w-lg space-y-6">
                {conversation.aiSummary && (
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-medium text-emerald-900">AI Summary</h4>
                    </div>
                    <p className="text-sm text-emerald-800">{conversation.aiSummary}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium mb-3">Conversation Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Channel</span><span className="capitalize">{conversation.channel}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="capitalize">{conversation.status}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span className="capitalize">{conversation.priority}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Messages</span><span>{conversation.messageCount}</span></div>
                  </div>
                </div>

                {conversation.customer && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-3">Customer</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{conversation.customer.firstName} {conversation.customer.lastName}</span></div>
                        {conversation.customer.email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{conversation.customer.email}</span></div>}
                        {conversation.customer.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{conversation.customer.phone}</span></div>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="w-72 border-l bg-muted/30 hidden xl:block shrink-0 overflow-auto">
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Customer</h4>
              {conversation.customer ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {conversation.customer.firstName[0]}{conversation.customer.lastName[0]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{conversation.customer.firstName} {conversation.customer.lastName}</p>
                    {conversation.customer.phone && <p className="text-xs text-muted-foreground">{conversation.customer.phone}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No customer linked</p>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate(`/leads`)}>
                  <StickyNote className="w-3.5 h-3.5 mr-2" />
                  View Lead
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Phone className="w-3.5 h-3.5 mr-2" />
                  Call Customer
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Clock className="w-3.5 h-3.5 mr-2" />
                  Add Reminder
                </Button>
              </div>
            </div>

            {conversation.aiSummary && (
              <>
                <Separator />
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-semibold text-emerald-900">AI Summary</h4>
                  </div>
                  <p className="text-xs text-emerald-800">{conversation.aiSummary}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function isInternalNote(msg: { isInternalNote?: boolean | null }): boolean {
  return !!msg.isInternalNote;
}
