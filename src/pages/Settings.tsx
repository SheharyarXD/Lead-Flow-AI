import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Bot,
  Users,
  Link2,
  Key,
  Save,
  CreditCard,
  UserPlus,
  X,
} from "lucide-react";

function formatZodError(message: string): string {
  try {
    if (message.startsWith("[")) {
      const parsed = JSON.parse(message);
      if (Array.isArray(parsed)) {
        return parsed.map((issue: { path?: string[]; message: string }) => {
          const field = issue.path?.join(".") || "Field";
          const fieldFormatted = field.replace(/([A-Z])/g, " $1");
          const fieldCapitalized = fieldFormatted.charAt(0).toUpperCase() + fieldFormatted.slice(1);
          return `${fieldCapitalized}: ${issue.message}`;
        }).join(" | ");
      }
    }
  } catch {
    // Not a JSON-encoded validation array — fall through and return the raw message.
  }
  return message;
}

const ORG_ROLE_RANK: Record<string, number> = { owner: 3, admin: 2, manager: 1, member: 0 };
const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", manager: "Manager", member: "Agent" };

export default function Settings() {
  const { organizationId } = useOrganization();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: org } = trpc.organization.getById.useQuery({ id: organizationId! }, { enabled: !!organizationId });
  const { data: members } = trpc.organization.members.useQuery({ organizationId: organizationId! }, { enabled: !!organizationId });
  const myRole = members?.find((m) => m.user?.id === user?.id)?.role;
  const canManageTeam = myRole === "owner" || myRole === "admin";

  const usageQuery = trpc.billing.getUsage.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );
  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation();

  const { data: invitations } = trpc.organization.listInvitations.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId && canManageTeam }
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "member">("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const inviteMutation = trpc.organization.inviteMember.useMutation({
    onSuccess: () => {
      utils.organization.listInvitations.invalidate({ organizationId: organizationId! });
      setInviteEmail("");
      setInviteError(null);
      setInviteSuccess(`Invitation sent to ${inviteEmail}.`);
      setTimeout(() => setInviteSuccess(null), 4000);
    },
    onError: (err) => setInviteError(err.message || "Failed to send invite."),
  });

  const revokeInviteMutation = trpc.organization.revokeInvitation.useMutation({
    onSuccess: () => utils.organization.listInvitations.invalidate({ organizationId: organizationId! }),
  });

  const changeRoleMutation = trpc.organization.changeRole.useMutation({
    onSuccess: () => utils.organization.members.invalidate({ organizationId: organizationId! }),
  });

  const removeMemberMutation = trpc.organization.removeMember.useMutation({
    onSuccess: () => utils.organization.members.invalidate({ organizationId: organizationId! }),
  });

  const handleInvite = () => {
    if (!inviteEmail.trim() || !organizationId) return;
    inviteMutation.mutate({ organizationId, email: inviteEmail.trim(), role: inviteRole });
  };

  // Real Knowledge Base State
  const [kbQuestion, setKbQuestion] = useState("");
  const [kbAnswer, setKbAnswer] = useState("");
  const [kbCategory, setKbCategory] = useState("General");
  const [kbError, setKbError] = useState<string | null>(null);

  const { data: kbEntries, isLoading: kbLoading } = trpc.knowledgeBase.list.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );

  const createKBEntryMutation = trpc.knowledgeBase.create.useMutation({
    onSuccess: () => {
      utils.knowledgeBase.list.invalidate();
      setKbQuestion("");
      setKbAnswer("");
      setKbCategory("General");
      setKbError(null);
    },
    onError: (err) => {
      setKbError(err.message || "Failed to add FAQ entry.");
    },
  });

  const deleteKBEntryMutation = trpc.knowledgeBase.delete.useMutation({
    onSuccess: () => {
      utils.knowledgeBase.list.invalidate();
    },
  });

  const handleAddKB = () => {
    if (!kbQuestion.trim() || !kbAnswer.trim()) {
      setKbError("Both Question and Answer are required.");
      return;
    }
    setKbError(null);
    createKBEntryMutation.mutate({
      organizationId: organizationId!,
      type: "faq",
      title: kbQuestion.trim(),
      content: kbAnswer.trim(),
      category: kbCategory,
      aiEnabled: true,
    });
  };

  const [businessError, setBusinessError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [twilioError, setTwilioError] = useState<string | null>(null);
  const [smtpError, setSmtpError] = useState<string | null>(null);

  const [twilioForm, setTwilioForm] = useState({
    accountSid: "",
    authToken: "",
    phoneNumber: "",
  });

  const [smtpForm, setSmtpForm] = useState({
    host: "",
    port: 587,
    user: "",
    pass: "",
    fromEmail: "",
  });

  const [saveTwilioSuccess, setSaveTwilioSuccess] = useState(false);
  const [saveSmtpSuccess, setSaveSmtpSuccess] = useState(false);

  const [businessForm, setBusinessForm] = useState({
    name: "",
    industry: "",
    phone: "",
    email: "",
    website: "",
    timezone: "America/Los_Angeles",
  });

  const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };
  const [businessHours, setBusinessHours] = useState<Record<string, { open: string; close: string }>>({});
  const [hoursSaveSuccess, setHoursSaveSuccess] = useState(false);

  const [aiForm, setAiForm] = useState({
    aiEnabled: true,
    greetingMessage: "",
    aiInstructions: "",
    openaiApiKey: "",
  });

  const [saveBusinessSuccess, setSaveBusinessSuccess] = useState(false);
  const [saveAiSuccess, setSaveAiSuccess] = useState(false);

  // Update forms when org data loads
  useEffect(() => {
    if (org) {
      setBusinessForm({
        name: org.name || "",
        industry: org.industry || "",
        phone: org.phone || "",
        email: org.email || "",
        website: org.website || "",
        timezone: org.timezone || "America/Los_Angeles",
      });
      setAiForm({
        aiEnabled: org.aiEnabled ?? true,
        greetingMessage: org.greetingMessage || "",
        aiInstructions: org.aiInstructions || "",
        // The real key is never sent back from the server once saved — only a
        // hasOpenaiApiKey flag is. The field starts blank; leaving it blank on
        // save keeps whatever is already configured (see handleSaveAi).
        openaiApiKey: "",
      });
      setTwilioForm({
        accountSid: org.twilioAccountSid || "",
        // Secret — never round-tripped from the server. Blank = unchanged.
        authToken: "",
        phoneNumber: org.twilioPhoneNumber || "",
      });
      setSmtpForm({
        host: org.smtpHost || "",
        port: org.smtpPort || 587,
        user: org.smtpUser || "",
        // Secret — never round-tripped from the server. Blank = unchanged.
        pass: "",
        fromEmail: org.smtpFromEmail || "",
      });
      setBusinessHours(
        org.businessHours && Object.keys(org.businessHours).length > 0
          ? org.businessHours
          : Object.fromEntries(DAY_KEYS.map((d) => [d, { open: "09:00", close: "17:00" }]))
      );
    }
  }, [org]);

  const updateOrg = trpc.organization.update.useMutation({
    onSuccess: () => {
      if (organizationId) utils.organization.getById.invalidate({ id: organizationId });
    },
  });

  const handleSaveTwilio = () => {
    setTwilioError(null);
    updateOrg.mutate({
      id: organizationId!,
      twilioAccountSid: twilioForm.accountSid.trim() || undefined,
      twilioAuthToken: twilioForm.authToken.trim() || undefined,
      twilioPhoneNumber: twilioForm.phoneNumber.trim() || undefined,
    }, {
      onSuccess: () => {
        setSaveTwilioSuccess(true);
        setTimeout(() => setSaveTwilioSuccess(false), 3000);
      },
      onError: (err) => {
        setTwilioError(formatZodError(err.message || "Failed to save Twilio settings."));
      }
    });
  };

  const handleSaveSmtp = () => {
    setSmtpError(null);
    updateOrg.mutate({
      id: organizationId!,
      smtpHost: smtpForm.host.trim() || undefined,
      smtpPort: smtpForm.port,
      smtpUser: smtpForm.user.trim() || undefined,
      smtpPass: smtpForm.pass.trim() || undefined,
      smtpFromEmail: smtpForm.fromEmail.trim() || undefined,
    }, {
      onSuccess: () => {
        setSaveSmtpSuccess(true);
        setTimeout(() => setSaveSmtpSuccess(false), 3000);
      },
      onError: (err) => {
        setSmtpError(formatZodError(err.message || "Failed to save SMTP settings."));
      }
    });
  };

  const handleSaveBusiness = () => {
    setBusinessError(null);
    updateOrg.mutate({
      id: organizationId!,
      name: businessForm.name,
      industry: businessForm.industry,
      phone: businessForm.phone,
      email: businessForm.email || undefined,
      website: businessForm.website || undefined,
    }, {
      onSuccess: () => {
        setSaveBusinessSuccess(true);
        setTimeout(() => setSaveBusinessSuccess(false), 3000);
      },
      onError: (err) => {
        setBusinessError(formatZodError(err.message || "Failed to save business settings."));
      }
    });
  };

  const handleSaveAi = () => {
    setAiError(null);
    updateOrg.mutate({
      id: organizationId!,
      aiEnabled: aiForm.aiEnabled,
      greetingMessage: aiForm.greetingMessage,
      aiInstructions: aiForm.aiInstructions,
      openaiApiKey: aiForm.openaiApiKey.trim() || undefined,
    }, {
      onSuccess: () => {
        setSaveAiSuccess(true);
        setTimeout(() => setSaveAiSuccess(false), 3000);
      },
      onError: (err) => {
        setAiError(formatZodError(err.message || "Failed to save AI settings."));
      }
    });
  };

  const handleToggleAi = (checked: boolean) => {
    setAiForm((prev) => ({ ...prev, aiEnabled: checked }));
    updateOrg.mutate({
      id: organizationId!,
      aiEnabled: checked,
    });
  };

  const handleHourChange = (day: string, field: "open" | "close", value: string) => {
    setBusinessHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const toggleDayClosed = (day: string) => {
    setBusinessHours((prev) => {
      const isClosed = prev[day]?.open === "closed";
      return {
        ...prev,
        [day]: isClosed ? { open: "09:00", close: "17:00" } : { open: "closed", close: "closed" },
      };
    });
  };

  const handleSaveHours = () => {
    updateOrg.mutate(
      { id: organizationId!, businessHours },
      {
        onSuccess: () => {
          setHoursSaveSuccess(true);
          setTimeout(() => setHoursSaveSuccess(false), 3000);
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your business profile, AI settings, team, and integrations.
        </p>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="w-4 h-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="w-4 h-4" />
            AI Agent
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="w-4 h-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Business Settings */}
        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Profile</CardTitle>
              <CardDescription>Update your company information visible to customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {businessError && (
                <div className="bg-red-50 border border-red-150 text-red-800 text-xs font-bold p-3 rounded-lg mb-2 text-left">
                  {businessError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={businessForm.name} onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input value={businessForm.industry} onChange={(e) => setBusinessForm({ ...businessForm, industry: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={businessForm.phone} onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={businessForm.email} onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Website</Label>
                  <Input value={businessForm.website} onChange={(e) => setBusinessForm({ ...businessForm, website: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Timezone</Label>
                  <Input value={businessForm.timezone} disabled />
                  <p className="text-xs text-muted-foreground">Contact support to change timezone.</p>
                </div>
              </div>
              <Button onClick={handleSaveBusiness} disabled={updateOrg.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {updateOrg.isPending ? "Saving..." : saveBusinessSuccess ? "Saved!" : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Hours</CardTitle>
              <CardDescription>Set your operating hours for the AI receptionist.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DAY_KEYS.map((day) => {
                  const hours = businessHours[day] ?? { open: "09:00", close: "17:00" };
                  const isClosed = hours.open === "closed";
                  return (
                    <div key={day} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                      <span className="text-sm font-medium w-32">{DAY_LABELS[day]}</span>
                      <div className="flex items-center gap-2">
                        {!isClosed && (
                          <>
                            <Input
                              type="time"
                              value={hours.open}
                              onChange={(e) => handleHourChange(day, "open", e.target.value)}
                              className="w-28 h-8 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={hours.close}
                              onChange={(e) => handleHourChange(day, "close", e.target.value)}
                              className="w-28 h-8 text-xs"
                            />
                          </>
                        )}
                        {isClosed && <Badge variant="secondary" className="text-[10px]">Closed</Badge>}
                        <Switch checked={!isClosed} onCheckedChange={() => toggleDayClosed(day)} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={handleSaveHours} disabled={updateOrg.isPending} className="mt-4">
                <Save className="w-4 h-4 mr-2" />
                {updateOrg.isPending ? "Saving..." : hoursSaveSuccess ? "Saved!" : "Save Hours"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">AI Receptionist</CardTitle>
                  <CardDescription>Configure how your AI handles calls and conversations.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ai-toggle" className="text-sm">Enabled</Label>
                  <Switch
                    id="ai-toggle"
                    checked={aiForm.aiEnabled}
                    onCheckedChange={handleToggleAi}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiError && (
                <div className="bg-red-50 border border-red-150 text-red-800 text-xs font-bold p-3 rounded-lg mb-2 text-left">
                  {aiError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Greeting Message</Label>
                <Input
                  value={aiForm.greetingMessage}
                  onChange={(e) => setAiForm({ ...aiForm, greetingMessage: e.target.value })}
                  placeholder="Hello! Thank you for calling..."
                />
                <p className="text-xs text-muted-foreground">This is the first message your AI says when answering a call.</p>
              </div>

              <div className="space-y-2">
                <Label>AI Instructions / Personality</Label>
                <textarea
                  className="w-full min-h-[120px] px-3 py-2 rounded-md border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  value={aiForm.aiInstructions}
                  onChange={(e) => setAiForm({ ...aiForm, aiInstructions: e.target.value })}
                  placeholder="Describe how the AI should behave..."
                />
                <p className="text-xs text-muted-foreground">Detailed instructions help the AI represent your business accurately.</p>
              </div>

              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <h4 className="text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  AI Provider Settings
                </h4>
                <div className="space-y-3">
                  <div className="space-y-2 text-left">
                    <Label className="text-amber-800">OpenAI API Key</Label>
                    <Input
                      placeholder={org?.hasOpenaiApiKey ? "•••••••••••••••••••• (configured — enter a new key to replace)" : "sk-..."}
                      type="password"
                      value={aiForm.openaiApiKey}
                      onChange={(e) => setAiForm({ ...aiForm, openaiApiKey: e.target.value })}
                      className="bg-white border-amber-200 focus-visible:ring-amber-400 text-xs shadow-none"
                    />
                    <p className="text-[10px] text-amber-700 leading-normal">
                      Entering your API key allows your business to run custom GPT responses. Leave blank to use server fallback.
                    </p>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label className="text-amber-800">Voice Provider</Label>
                    <Input value="OpenAI Realtime API" disabled className="bg-white/50 text-xs" />
                  </div>
                  <p className="text-xs text-amber-700 leading-normal">
                    Configure your AI voice provider to enable AI calls. Support for Twilio, Vapi, and Bland coming soon.
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveAi} disabled={updateOrg.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {updateOrg.isPending ? "Saving..." : saveAiSuccess ? "Saved AI Receptionist!" : "Save AI Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Knowledge Base FAQs</CardTitle>
              <CardDescription>Add questions and answers so the AI Virtual Assistant can use them to reply to customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Add New FAQ Form */}
              <div className="border border-zinc-150 p-4 rounded-xl space-y-3 bg-zinc-50/20">
                <h4 className="text-xs font-bold text-zinc-950">Add New FAQ Response</h4>
                {kbError && (
                  <div className="bg-red-50 border border-red-150 text-red-800 text-[11px] font-bold p-2.5 rounded-lg">
                    {kbError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-left">
                    <Label className="text-xs font-bold text-zinc-600">Question / Keyword</Label>
                    <Input 
                      placeholder="e.g. Do you have parking?" 
                      value={kbQuestion} 
                      onChange={(e) => setKbQuestion(e.target.value)} 
                      className="bg-white border-zinc-200 text-xs shadow-none h-9"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <Label className="text-xs font-bold text-zinc-600">Category</Label>
                    <Select value={kbCategory} onValueChange={setKbCategory}>
                      <SelectTrigger className="bg-white border-zinc-200 text-xs shadow-none h-9">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-zinc-200">
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Pricing">Pricing / Booking</SelectItem>
                        <SelectItem value="Services">Services</SelectItem>
                        <SelectItem value="Location">Location / Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5 text-left">
                  <Label className="text-xs font-bold text-zinc-600">Answer / AI Response Content</Label>
                  <textarea
                    placeholder="e.g. Yes, we have free validation parking in the rear lot."
                    value={kbAnswer}
                    onChange={(e) => setKbAnswer(e.target.value)}
                    className="w-full min-h-[70px] p-2.5 rounded-lg border bg-white text-xs resize-y focus:outline-none focus:ring-1 focus:ring-zinc-400 border-zinc-200 shadow-none font-medium leading-relaxed"
                  />
                </div>
                <div className="text-left">
                  <Button 
                    onClick={handleAddKB} 
                    disabled={createKBEntryMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg text-xs font-bold shadow-sm"
                  >
                    {createKBEntryMutation.isPending ? "Adding..." : "+ Add to AI Knowledge Base"}
                  </Button>
                </div>
              </div>

              {/* FAQ List Display */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-zinc-600 flex text-left">Saved Responses ({kbEntries?.length ?? 0})</Label>
                <div className="divide-y divide-zinc-100 border border-zinc-150 rounded-xl overflow-hidden bg-white">
                  {kbLoading ? (
                    <div className="p-4 text-center text-xs text-zinc-400 font-medium">Loading answers...</div>
                  ) : !kbEntries || kbEntries.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400 font-medium leading-relaxed bg-white">
                      No FAQ responses found. Add a response above so the AI agent knows what to reply!
                    </div>
                  ) : (
                    kbEntries.map((kb) => (
                      <div key={kb.id} className="p-3.5 flex items-start justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                        <div className="min-w-0 space-y-1 text-left">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-bold py-0.5 bg-zinc-50 border-zinc-200">
                              {kb.category || "General"}
                            </Badge>
                            <span className="text-xs font-bold text-zinc-950 truncate">{kb.title}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 font-medium leading-relaxed pl-1">
                            {kb.content}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteKBEntryMutation.mutate({ id: kb.id })}
                          disabled={deleteKBEntryMutation.isPending}
                          className="text-zinc-400 hover:text-red-500 p-1.5 h-8 w-8 rounded-lg shrink-0 font-extrabold text-lg"
                        >
                          ×
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="space-y-4">
          {canManageTeam && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invite a Team Member</CardTitle>
                <CardDescription>Send an email invite to add an Admin, Manager, or Agent to your organization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
                {inviteSuccess && <p className="text-sm text-emerald-600">{inviteSuccess}</p>}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["admin", "manager", "member"] as const)
                        .filter((r) => ORG_ROLE_RANK[r] < ORG_ROLE_RANK[myRole ?? "member"])
                        .map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInvite} disabled={inviteMutation.isPending || !inviteEmail.trim()}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {canManageTeam && invitations && invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending Invitations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invitations.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">Invited as {ROLE_LABEL[invite.role]} · expires {new Date(invite.expiresAt).toLocaleDateString()}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeInviteMutation.mutate({ organizationId: organizationId!, invitationId: invite.id })}
                        disabled={revokeInviteMutation.isPending}
                      >
                        <X className="w-4 h-4 mr-1" /> Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Members</CardTitle>
              <CardDescription>Manage who has access to your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members?.map((member) => {
                  const isSelf = member.user?.id === user?.id;
                  const canAct =
                    canManageTeam &&
                    !isSelf &&
                    member.role !== "owner" &&
                    ORG_ROLE_RANK[member.role] < ORG_ROLE_RANK[myRole ?? "member"];
                  const assignableRoles = (["admin", "manager", "member"] as const).filter(
                    (r) => ORG_ROLE_RANK[r] < ORG_ROLE_RANK[myRole ?? "member"]
                  );
                  return (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {member.user?.name?.charAt(0).toUpperCase() || "U"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.user?.name || "Unknown"}{isSelf ? " (You)" : ""}</p>
                          <p className="text-xs text-muted-foreground">{member.user?.email || ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 select-none">
                        {canAct ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) =>
                              changeRoleMutation.mutate({ organizationId: organizationId!, userId: member.user!.id, role: v as "admin" | "manager" | "member" })
                            }
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {assignableRoles.map((r) => (
                                <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={member.role === "owner" || member.role === "admin" ? "default" : "outline"} className="text-[10px]">
                            {ROLE_LABEL[member.role]}
                          </Badge>
                        )}
                        {canAct && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMemberMutation.mutate({ organizationId: organizationId!, userId: member.user!.id })}
                            disabled={removeMemberMutation.isPending}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!members || members.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No team members found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          
          {/* Twilio SMS settings card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Twilio SMS Configuration</CardTitle>
              <CardDescription>Enter your Twilio API credentials to send SMS messages from your own business number.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {twilioError && (
                <div className="bg-red-50 border border-red-150 text-red-800 text-xs font-bold p-3 rounded-lg mb-2 text-left">
                  {twilioError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 text-left">
                  <Label>Twilio Account SID</Label>
                  <Input 
                    placeholder="AC..." 
                    value={twilioForm.accountSid} 
                    onChange={(e) => setTwilioForm({ ...twilioForm, accountSid: e.target.value })} 
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <Label>Twilio Auth Token</Label>
                  <Input
                    placeholder={org?.hasTwilioAuthToken ? "•••••••••••••••••••• (configured — enter a new token to replace)" : "Auth Token"}
                    type="password"
                    value={twilioForm.authToken}
                    onChange={(e) => setTwilioForm({ ...twilioForm, authToken: e.target.value })} 
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                </div>
                <div className="space-y-2 text-left sm:col-span-2">
                  <Label>Twilio Phone Number (Sender)</Label>
                  <Input 
                    placeholder="e.g. +15551234567" 
                    value={twilioForm.phoneNumber} 
                    onChange={(e) => setTwilioForm({ ...twilioForm, phoneNumber: e.target.value })} 
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                </div>
              </div>
              <div className="text-left pt-2">
                <Button onClick={handleSaveTwilio} disabled={updateOrg.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm h-9 px-4">
                  <Save className="w-4 h-4 mr-2" />
                  {updateOrg.isPending ? "Saving..." : saveTwilioSuccess ? "Saved Twilio Settings!" : "Save Twilio Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SMTP Email settings card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SMTP Email Configuration</CardTitle>
              <CardDescription>Configure your outgoing SMTP server credentials to send emails from your own domain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {smtpError && (
                <div className="bg-red-50 border border-red-150 text-red-800 text-xs font-bold p-3 rounded-lg mb-2 text-left">
                  {smtpError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 text-left sm:col-span-2">
                  <Label>SMTP Host</Label>
                  <Input 
                    placeholder="e.g. smtp.mailgun.org" 
                    value={smtpForm.host} 
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })} 
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <Label>SMTP Port</Label>
                  <Input 
                    placeholder="587" 
                    type="number" 
                    value={smtpForm.port} 
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) || 587 })} 
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                </div>
                <div className="space-y-2 text-left sm:col-span-2">
                  <Label>SMTP Username</Label>
                  <Input 
                    placeholder="username" 
                    value={smtpForm.user} 
                    onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })} 
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <Label>SMTP Password</Label>
                  <Input
                    placeholder={org?.hasSmtpPassword ? "•••••••••••••••••••• (configured — enter a new password to replace)" : "Password"}
                    type="password"
                    value={smtpForm.pass}
                    onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })} 
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                </div>
                <div className="space-y-2 text-left sm:col-span-3">
                  <Label>Sender Email Address (From)</Label>
                  <Input 
                    placeholder="e.g. notifications@yourdomain.com" 
                    value={smtpForm.fromEmail} 
                    onChange={(e) => setSmtpForm({ ...smtpForm, fromEmail: e.target.value })} 
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                </div>
              </div>
              <div className="text-left pt-2">
                <Button onClick={handleSaveSmtp} disabled={updateOrg.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm h-9 px-4">
                  <Save className="w-4 h-4 mr-2" />
                  {updateOrg.isPending ? "Saving..." : saveSmtpSuccess ? "Saved SMTP Settings!" : "Save Email Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Keys</CardTitle>
              <CardDescription>Manage API access for custom integrations.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-muted/50 border border-dashed">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">API Access</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Generate API keys to connect your own systems with LeadFlow AI.
                </p>
                <Button variant="outline" size="sm" disabled>
                  Generate API Key
                </Button>
                <p className="text-[10px] text-muted-foreground mt-2">Available on Professional and Enterprise plans.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Plan & Usage</CardTitle>
              <CardDescription>Your active subscription tier and quota usage metrics.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-indigo-50/50 border border-indigo-150">
                <div>
                  <p className="text-lg font-bold text-indigo-950 capitalize">{usageQuery.data?.plan || "Starter"} Plan</p>
                  <p className="text-xs text-indigo-700 font-medium mt-0.5">
                    Status: <span className="font-extrabold uppercase">{usageQuery.data?.status || "Active"}</span>
                  </p>
                </div>
                <Badge className="bg-indigo-600 text-white font-bold text-xs px-3 py-1 capitalize">
                  {usageQuery.data?.plan || "Starter"}
                </Badge>
              </div>

              {/* Real Quotas Usage Progress Gauges */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-zinc-700">AI Call Minutes</span>
                    <span className="text-zinc-500">
                      {usageQuery.data?.minutesUsed ?? 0} / {usageQuery.data?.minutesLimit ?? 100} min
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((usageQuery.data?.minutesUsed ?? 0) / (usageQuery.data?.minutesLimit ?? 100)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-zinc-700">Leads Capacity</span>
                    <span className="text-zinc-500">
                      {usageQuery.data?.leadsUsed ?? 0} / {usageQuery.data?.leadsLimit ?? 100}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((usageQuery.data?.leadsUsed ?? 0) / (usageQuery.data?.leadsLimit ?? 100)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-zinc-700">Team Members</span>
                    <span className="text-zinc-500">
                      {usageQuery.data?.usersUsed ?? 1} / {usageQuery.data?.usersLimit ?? 5}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((usageQuery.data?.usersUsed ?? 1) / (usageQuery.data?.usersLimit ?? 5)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Subscription Plan Tiers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    id: "starter" as const,
                    name: "Starter",
                    price: "$97/mo",
                    features: ["100 Call Minutes", "100 Leads", "5 Team Members", "Standard Support"],
                  },
                  {
                    id: "professional" as const,
                    name: "Professional",
                    price: "$297/mo",
                    features: ["1,000 Call Minutes", "1,000 Leads", "20 Team Members", "Priority AI Queue"],
                  },
                  {
                    id: "enterprise" as const,
                    name: "Enterprise",
                    price: "$997/mo",
                    features: ["5,000 Call Minutes", "10,000 Leads", "Unlimited Team", "Custom AI Voice Training"],
                  },
                ].map((planItem) => {
                  const isCurrent = (usageQuery.data?.plan || "starter") === planItem.id;
                  return (
                    <div
                      key={planItem.id}
                      className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
                        isCurrent
                          ? "border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20 shadow-sm"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-zinc-950 text-sm">{planItem.name}</span>
                          {isCurrent && (
                            <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold">
                              Current Plan
                            </Badge>
                          )}
                        </div>
                        <p className="text-xl font-extrabold text-zinc-950 mb-3">{planItem.price}</p>
                        <ul className="space-y-1.5 mb-4">
                          {planItem.features.map((f) => (
                            <li key={f} className="text-xs text-zinc-600 flex items-center gap-1.5 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Button
                        variant={isCurrent ? "outline" : "default"}
                        size="sm"
                        disabled={isCurrent || checkoutMutation.isPending}
                        onClick={async () => {
                          if (!organizationId) return;
                          const res = await checkoutMutation.mutateAsync({
                            organizationId,
                            plan: planItem.id,
                          });
                          if (res.url) {
                            window.location.href = res.url;
                          }
                        }}
                        className={`w-full text-xs font-bold h-9 rounded-lg ${
                          isCurrent
                            ? "border-zinc-200 text-zinc-500"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                        }`}
                      >
                        {isCurrent
                          ? "Current Plan"
                          : checkoutMutation.isPending
                          ? "Redirecting..."
                          : `Upgrade to ${planItem.name}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
