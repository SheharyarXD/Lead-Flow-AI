import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router";
import {
  MessageSquare,
  Filter,
  Bot,
  ArrowRight,
  MessageCircle,
  Phone,
  Mail,
  Globe,
} from "lucide-react";

const ORG_ID = 1;

const channelIcons: Record<string, React.ReactNode> = {
  ai_chat: <Bot className="w-4 h-4" />,
  web_chat: <Globe className="w-4 h-4" />,
  sms: <MessageCircle className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
};

export default function Conversations() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: conversations, isLoading } = trpc.conversation.list.useQuery({
    organizationId: ORG_ID,
    status: statusFilter || undefined,
    channel: channelFilter || undefined,
    limit: 50,
  });

  const { data: stats } = trpc.conversation.stats.useQuery({ organizationId: ORG_ID });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all customer conversations across channels.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: MessageSquare },
          { label: "Open", value: stats?.open ?? 0, icon: MessageCircle },
          { label: "AI Handled", value: stats?.aiHandled ?? 0, icon: Bot },
          { label: "Pending", value: (stats?.total ?? 0) - (stats?.open ?? 0), icon: Filter },
        ].map((stat) => (
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="ai_chat">AI Chat</SelectItem>
                  <SelectItem value="web_chat">Web Chat</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={() => { setStatusFilter(""); setChannelFilter(""); }}>
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Conversations</CardTitle>
          </CardHeader>
          <ScrollArea className="h-[600px]">
            <CardContent className="p-0">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b">
                    <Skeleton className="h-12 w-full" />
                  </div>
                ))
              ) : conversations?.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No conversations found.
                </div>
              ) : (
                <div className="divide-y">
                  {conversations?.map((conv) => (
                    <div
                      key={conv.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/conversations/${conv.id}`)}
                    >
                      <div className="mt-0.5 p-1.5 rounded-md bg-muted">
                        {channelIcons[conv.channel] || <MessageSquare className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {conv.customer?.firstName} {conv.customer?.lastName}
                          </span>
                          {conv.aiHandled && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-emerald-50 text-emerald-700">
                              AI
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.lastMessagePreview || conv.subject || "No messages"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4">{conv.channel}</Badge>
                          <Badge
                            variant={conv.status === "open" ? "default" : "secondary"}
                            className="text-[10px] h-4"
                          >
                            {conv.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground">
                          {conv.lastMessageAt
                            ? new Date(conv.lastMessageAt).toLocaleDateString()
                            : ""}
                        </p>
                        {conv.unreadCount ? (
                          <Badge className="text-[10px] h-4 px-1.5 mt-1">{conv.unreadCount}</Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Detail Preview */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Select a Conversation</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Click on a conversation from the list to view the full thread, send messages, and manage the conversation.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/conversations/1")}>
              Open First Conversation
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
