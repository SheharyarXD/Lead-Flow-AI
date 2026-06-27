import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MessageSquare,
  PhoneCall,
  CheckSquare,
  Edit,
  User,
} from "lucide-react";

const statusColors: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  proposal: "bg-violet-50 text-violet-700 border-violet-200",
  negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const leadId = parseInt(id || "0");

  const { data: lead, isLoading } = trpc.lead.getById.useQuery({ id: leadId });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/leads")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Leads
        </Button>
        <div className="mt-8 text-center">
          <p className="text-muted-foreground">Lead not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/leads")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{lead.firstName} {lead.lastName}</h1>
            <Badge variant="outline" className={`${statusColors[lead.status] || ""}`}>
              {lead.status}
            </Badge>
          </div>
          {lead.company && (
            <p className="text-sm text-muted-foreground mt-1">{lead.title} at {lead.company}</p>
          )}
        </div>
        <Button variant="outline" size="sm">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Contact Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lead.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{lead.phone}</span>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{lead.company}</span>
              </div>
            )}
            {lead.title && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{lead.title}</span>
              </div>
            )}
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Source</span>
                <Badge variant="outline" className="text-[10px]">{lead.source}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Priority</span>
                <span className="font-medium capitalize">{lead.priority}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Value</span>
                <span className="font-medium">{lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "-"}</span>
              </div>
            </div>
            {lead.tags && lead.tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            {lead.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{lead.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="activity">
            <TabsList className="w-full">
              <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
              <TabsTrigger value="conversations" className="flex-1">
                Conversations ({lead.conversations?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">
                Tasks ({lead.tasks?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="calls" className="flex-1">
                Calls ({lead.calls?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-blue-50">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Lead Created</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>
                    {lead.status !== "new" && (
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-amber-50">
                          <PhoneCall className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Status changed to {lead.status}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : ""}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conversations" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {lead.conversations && lead.conversations.length > 0 ? (
                    <div className="divide-y">
                      {lead.conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/conversations/${conv.id}`)}
                        >
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{conv.subject || "No subject"}</p>
                            <p className="text-xs text-muted-foreground">{conv.channel} - {conv.status}</p>
                          </div>
                          <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No conversations yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {lead.tasks && lead.tasks.length > 0 ? (
                    <div className="divide-y">
                      {lead.tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-4 px-4 py-3">
                          <CheckSquare className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{task.status} - {task.priority}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No tasks yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calls" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {lead.calls && lead.calls.length > 0 ? (
                    <div className="divide-y">
                      {lead.calls.map((call) => (
                        <div key={call.id} className="flex items-center gap-4 px-4 py-3">
                          <PhoneCall className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{call.phoneNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {call.direction} - {call.status} - {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "0s"}
                            </p>
                          </div>
                          {call.aiHandled && (
                            <Badge variant="secondary" className="text-[10px]">AI</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No calls yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
