import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  RefreshCw,
  HelpCircle,
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

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "business";
  const checkoutParam = searchParams.get("checkout");
  const onboardingParam = searchParams.get("onboarding");

  // Cancellation Survey State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<
    "too_expensive" | "not_enough_value" | "missing_feature" | "too_difficult" | "business_circumstances_changed" | "not_enough_leads" | "technical_problems" | "other"
  >("not_enough_value");
  const [cancelReasonDetails, setCancelReasonDetails] = useState("");
  const [cancelWhatBetter, setCancelWhatBetter] = useState("");
  const [cancelMissingFeature, setCancelMissingFeature] = useState("");
  const [cancelLikelihood, setCancelLikelihood] = useState<"very_likely" | "likely" | "neutral" | "unlikely" | "very_unlikely">("neutral");
  const [cancelComments, setCancelComments] = useState("");
  const [cancelFeedbackSuccess, setCancelFeedbackSuccess] = useState<string | null>(null);
  const [billingActionError, setBillingActionError] = useState<string | null>(null);

  const cancelMutation = trpc.billing.submitCancellationSurveyAndCancel.useMutation({
    onSuccess: (data) => {
      setCancelModalOpen(false);
      setCancelFeedbackSuccess(data.message || "Your cancellation request has been recorded.");
      usageQuery.refetch();
    },
    onError: (err) => {
      setBillingActionError(err.message || "Failed to process cancellation.");
    },
  });

  const resumeMutation = trpc.billing.resumeSubscription.useMutation({
    onSuccess: () => {
      setBillingActionError(null);
      usageQuery.refetch();
    },
    onError: (err) => {
      setBillingActionError(err.message || "Failed to resume subscription.");
    },
  });

  const portalMutation = trpc.billing.createCustomerPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => {
      setBillingActionError(err.message || "Stripe Customer Portal is unavailable.");
    },
  });

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
    twimlAppSid: "",
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
        twimlAppSid: org.twilioTwimlAppSid || "",
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
      twilioTwimlAppSid: twilioForm.twimlAppSid.trim() || undefined,
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

      <Tabs
        value={["business", "ai", "team", "integrations", "billing"].includes(currentTab) ? currentTab : "business"}
        onValueChange={(val) => setSearchParams({ tab: val })}
        className="space-y-6"
      >
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
          {canManageTeam && (
            <TabsTrigger value="integrations" className="gap-2">
              <Link2 className="w-4 h-4" />
              Integrations
            </TabsTrigger>
          )}
          {canManageTeam && (
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Billing
            </TabsTrigger>
          )}
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
                <div className="space-y-2 text-left sm:col-span-2">
                  <Label>TwiML Application SID</Label>
                  <Input
                    placeholder="AP..."
                    value={twilioForm.twimlAppSid}
                    onChange={(e) => setTwilioForm({ ...twilioForm, twimlAppSid: e.target.value })}
                    className="bg-white border-zinc-200 text-xs shadow-none h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Required for click-to-call from the browser when using your own Twilio account. Create a TwiML App in your Twilio console with its Voice URL set to this server's <code>/api/webhooks/voice</code> endpoint.
                  </p>
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
        <TabsContent value="billing" className="space-y-6">
          {/* Checkout / Action Notifications */}
          {checkoutParam === "success" && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">Subscription Activated!</p>
                <p className="text-emerald-700">
                  Welcome to LeadFlow Pro. Your 30-day free trial has started. You will not be charged until your trial concludes.
                </p>
              </div>
            </div>
          )}

          {checkoutParam === "cancelled" && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-800">
              <AlertTriangle className="w-5 h-5 text-zinc-500 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">Checkout Not Completed</p>
                <p className="text-zinc-600">
                  Your checkout session was cancelled. No charges were made to your account.
                </p>
              </div>
            </div>
          )}

          {cancelFeedbackSuccess && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">Cancellation Feedback Received</p>
                <p className="text-amber-700">{cancelFeedbackSuccess}</p>
              </div>
            </div>
          )}

          {billingActionError && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div className="text-xs font-semibold">{billingActionError}</div>
            </div>
          )}

          {/* Current Plan Overview Card */}
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-zinc-950">Subscription Overview</CardTitle>
                  <CardDescription className="text-xs text-zinc-500 mt-0.5">
                    Manage your LeadFlow Pro tier, trial duration, and monthly quotas.
                  </CardDescription>
                </div>
                {usageQuery.data?.status === "trialing" && (
                  <Badge className="bg-indigo-600 text-white font-bold text-xs px-3 py-1 shadow-sm">
                    30-Day Free Trial
                  </Badge>
                )}
                {usageQuery.data?.status === "active" && (
                  <Badge className="bg-emerald-600 text-white font-bold text-xs px-3 py-1 shadow-sm">
                    Active ($197/mo)
                  </Badge>
                )}
                {usageQuery.data?.status === "past_due" && (
                  <Badge className="bg-red-600 text-white font-bold text-xs px-3 py-1 shadow-sm">
                    Payment Past Due
                  </Badge>
                )}
                {usageQuery.data?.status === "cancelled" && (
                  <Badge className="bg-zinc-500 text-white font-bold text-xs px-3 py-1 shadow-sm">
                    Cancelled
                  </Badge>
                )}
                {usageQuery.data?.status === "incomplete" && (
                  <Badge className="bg-amber-500 text-white font-bold text-xs px-3 py-1 shadow-sm">
                    Trial Available
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/70 via-indigo-50/40 to-white border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="font-extrabold text-zinc-900 text-base">LeadFlow Pro</span>
                    <span className="text-xs text-zinc-500 font-semibold">• $197 USD / month</span>
                  </div>

                  {usageQuery.data?.status === "trialing" && (
                    <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                      Your 30-day free trial is active with{" "}
                      <span className="font-bold text-indigo-700">
                        {usageQuery.data.daysRemainingInTrial} {usageQuery.data.daysRemainingInTrial === 1 ? "day" : "days"} remaining
                      </span>
                      . You will be charged <span className="font-bold">$197/month</span> starting on{" "}
                      <span className="font-bold text-zinc-900">
                        {usageQuery.data.trialEndsAt
                          ? new Date(usageQuery.data.trialEndsAt).toLocaleDateString("en-US", { dateStyle: "long" })
                          : usageQuery.data.currentPeriodEnd
                          ? new Date(usageQuery.data.currentPeriodEnd).toLocaleDateString("en-US", { dateStyle: "long" })
                          : "end of trial"}
                      </span>{" "}
                      unless you cancel before then.
                    </p>
                  )}

                  {usageQuery.data?.status === "active" && (
                    <p className="text-xs text-zinc-600 font-medium">
                      {usageQuery.data.cancelAtPeriodEnd ? (
                        <span className="text-amber-700 font-semibold">
                          Cancellation scheduled. Access remains available until{" "}
                          {usageQuery.data.currentPeriodEnd
                            ? new Date(usageQuery.data.currentPeriodEnd).toLocaleDateString("en-US", { dateStyle: "long" })
                            : "the end of your period"}
                          . You will not be charged again.
                        </span>
                      ) : (
                        <span>
                          Subscription is active. Next recurring charge:{" "}
                          <span className="font-bold text-zinc-900">
                            {usageQuery.data.currentPeriodEnd
                              ? new Date(usageQuery.data.currentPeriodEnd).toLocaleDateString("en-US", { dateStyle: "long" })
                              : "next billing cycle"}
                          </span>{" "}
                          at $197 USD / month.
                        </span>
                      )}
                    </p>
                  )}

                  {usageQuery.data?.status === "past_due" && (
                    <p className="text-xs text-red-700 font-semibold">
                      Your latest invoice payment failed. Please update your payment method to maintain full access.
                    </p>
                  )}

                  {usageQuery.data?.status === "cancelled" && (
                    <p className="text-xs text-zinc-600 font-medium">
                      Your subscription is currently cancelled. Start a new subscription below to reactivate your features.
                    </p>
                  )}

                  {usageQuery.data?.status === "incomplete" && (
                    <p className="text-xs text-zinc-600 font-medium">
                      Your account is ready. Activate your <span className="font-bold text-zinc-900">30-day completely free trial</span> below. No charge today.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {usageQuery.data?.cancelAtPeriodEnd && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => organizationId && resumeMutation.mutate({ organizationId })}
                      disabled={resumeMutation.isPending}
                      className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold text-xs h-9"
                    >
                      {resumeMutation.isPending ? "Resuming..." : "Resume Subscription"}
                    </Button>
                  )}

                  {usageQuery.data?.stripeCustomerId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => organizationId && portalMutation.mutate({ organizationId })}
                      disabled={portalMutation.isPending}
                      className="text-xs h-9 font-semibold text-zinc-700 hover:bg-zinc-50 border-zinc-200 flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Manage Invoices
                    </Button>
                  )}
                </div>
              </div>

              {/* Active Stripe Coupon Discount Display */}
              {usageQuery.data?.discountSummary && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                  <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <span>🎉</span> Active Discount Applied: {usageQuery.data.discountSummary}
                  </p>
                  {usageQuery.data.discountEndsAt && (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      Valid through {new Date(usageQuery.data.discountEndsAt).toLocaleDateString("en-US", { dateStyle: "long" })}
                    </p>
                  )}
                </div>
              )}

              {/* Monthly Quota Gauges */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Plan Quota Usage</h3>
                  <span className="text-[11px] text-zinc-400 font-semibold">Refreshes monthly</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Minutes */}
                  <div className="p-4 rounded-xl border border-zinc-150 bg-zinc-50/50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" /> AI Call Minutes
                      </span>
                      <span className="font-extrabold text-zinc-950">
                        {usageQuery.data?.minutesUsed ?? 0} / {usageQuery.data?.minutesLimit ?? 1000}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            ((usageQuery.data?.minutesUsed ?? 0) / (usageQuery.data?.minutesLimit ?? 1000)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-400 font-medium">Billed by whole minutes rounded up</p>
                  </div>

                  {/* Leads */}
                  <div className="p-4 rounded-xl border border-zinc-150 bg-zinc-50/50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-800 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-600" /> Active Leads
                      </span>
                      <span className="font-extrabold text-zinc-950">
                        {usageQuery.data?.leadsUsed ?? 0} / {usageQuery.data?.leadsLimit ?? 1000}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            ((usageQuery.data?.leadsUsed ?? 0) / (usageQuery.data?.leadsLimit ?? 1000)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-400 font-medium">Includes active inbound and imported leads</p>
                  </div>

                  {/* Team Members */}
                  <div className="p-4 rounded-xl border border-zinc-150 bg-zinc-50/50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Team Seats
                      </span>
                      <span className="font-extrabold text-zinc-950">
                        {usageQuery.data?.usersUsed ?? 1} / {usageQuery.data?.usersLimit ?? 20}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            ((usageQuery.data?.usersUsed ?? 1) / (usageQuery.data?.usersLimit ?? 20)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-400 font-medium">Owners, admins, managers, and agents</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Approved Production Plan Card */}
              <div>
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-zinc-950">Approved Subscription Plan</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    LeadFlow AI all-in-one conversational lead engine for your organization.
                  </p>
                </div>

                <div className="max-w-xl mx-auto rounded-2xl border-2 border-indigo-600 bg-white p-6 shadow-md shadow-indigo-100 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-bl-xl shadow-sm">
                    30-Day Free Trial
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-extrabold text-zinc-950">LeadFlow Pro</h4>
                    </div>

                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-black text-zinc-950 tracking-tight">$197</span>
                      <span className="text-xs font-semibold text-zinc-500">USD / month</span>
                      <Badge variant="outline" className="ml-2 border-indigo-200 text-indigo-700 bg-indigo-50/50 text-[10px] font-bold">
                        First 30 Days Free
                      </Badge>
                    </div>

                    {/* Clear, transparent trial terms required by client */}
                    <div className="mt-3 p-3 rounded-lg bg-zinc-50 border border-zinc-150 text-xs text-zinc-700 leading-relaxed font-medium">
                      <p className="font-semibold text-zinc-900">30-Day Free Trial Guarantee:</p>
                      Your first 30 days are completely free. You will be charged $197/month after your trial unless you cancel. Cancel anytime with zero penalty.
                    </div>

                    <div className="mt-5 space-y-2.5">
                      <p className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Everything included:</p>
                      <ul className="space-y-2">
                        {[
                          "30-day completely free trial (no charge today)",
                          "1,000 AI Voice Call Minutes / month included",
                          "1,000 Active Leads & full CRM pipeline",
                          "Up to 20 Team Members with role management",
                          "Autonomous AI Voice Receptionist with BYOK & call routing",
                          "Two-Way SMS, MMS & Email Conversations",
                          "Calendar integration & automated appointment booking",
                          "Knowledge Base FAQ and custom prompt tuning",
                          "Workflow Automations & Instant notifications",
                          "Stripe promotion code discounts & flexible cancellation",
                        ].map((feat) => (
                          <li key={feat} className="text-xs text-zinc-700 flex items-center gap-2 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-zinc-150 space-y-3">
                    {usageQuery.data?.hasAccess && !usageQuery.data.cancelAtPeriodEnd ? (
                      <div className="space-y-3">
                        <Button
                          disabled
                          className="w-full bg-zinc-100 text-zinc-600 border border-zinc-200 h-10 rounded-xl text-xs font-bold"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                          Current Plan ({usageQuery.data.status === "trialing" ? "Trial Active" : "Active"})
                        </Button>
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setCancelFeedbackSuccess(null);
                              setBillingActionError(null);
                              setCancelModalOpen(true);
                            }}
                            className="text-xs font-semibold text-zinc-400 hover:text-red-600 hover:underline transition-colors"
                          >
                            Need to cancel? Click here to manage cancellation
                          </button>
                        </div>
                      </div>
                    ) : usageQuery.data?.cancelAtPeriodEnd ? (
                      <div className="space-y-3">
                        <Button
                          onClick={() => organizationId && resumeMutation.mutate({ organizationId })}
                          disabled={resumeMutation.isPending}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-10 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
                        >
                          {resumeMutation.isPending ? "Resuming..." : "Resume LeadFlow Pro Subscription"}
                        </Button>
                        <p className="text-[11px] text-zinc-500 text-center">
                          Your cancellation is currently pending for the end of the period.
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={async () => {
                          if (!organizationId) return;
                          setBillingActionError(null);
                          try {
                            const res = await checkoutMutation.mutateAsync({
                              organizationId,
                              plan: "professional",
                              originUrl: window.location.origin,
                            });
                            if (res.simulated) {
                              usageQuery.refetch();
                            } else if (res.url) {
                              window.location.href = res.url;
                            }
                          } catch (err: unknown) {
                            setBillingActionError((err as { message?: string }).message || "Failed to initiate checkout.");
                          }
                        }}
                        disabled={checkoutMutation.isPending}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2"
                      >
                        {checkoutMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Connecting to Stripe Checkout...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Start 30-Day Free Trial ($0.00 Today)
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cancellation Survey & Exit Feedback Dialog */}
          <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-zinc-950 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Subscription Cancellation Survey
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 leading-relaxed">
                  We're truly sorry to see you go. Before cancelling, please take a moment to answer these questions so our product team can understand how to serve you better.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Question 1: Main reason */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-800">
                    1. What is the primary reason you're cancelling? <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={cancelReason}
                    onValueChange={(val) => setCancelReason(val as typeof cancelReason)}
                  >
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Select primary reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="too_expensive">Too expensive ($197/mo doesn't fit my budget)</SelectItem>
                      <SelectItem value="not_enough_value">Not getting enough value</SelectItem>
                      <SelectItem value="missing_feature">Missing a feature I need</SelectItem>
                      <SelectItem value="too_difficult">Too difficult to set up or use</SelectItem>
                      <SelectItem value="business_circumstances_changed">Business circumstances changed</SelectItem>
                      <SelectItem value="not_enough_leads">Not enough customer calls / leads</SelectItem>
                      <SelectItem value="technical_problems">Technical bugs or reliability issues</SelectItem>
                      <SelectItem value="other">Other reason</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Additional elaboration for reason */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-700">
                    Could you share a little more detail about this reason?
                  </Label>
                  <Textarea
                    placeholder="Elaborate on why this influenced your decision..."
                    value={cancelReasonDetails}
                    onChange={(e) => setCancelReasonDetails(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                </div>

                {/* Question 2: What could we have done better? */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-800">
                    2. What could we have done better?
                  </Label>
                  <Textarea
                    placeholder="Onboarding, AI call quality, SMS workflows, customer support, pricing..."
                    value={cancelWhatBetter}
                    onChange={(e) => setCancelWhatBetter(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                </div>

                {/* Question 3: Missing features */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-800">
                    3. What feature were you expecting that was missing?
                  </Label>
                  <Textarea
                    placeholder="Specific CRM integrations, voice accents, scheduling tools, analytics..."
                    value={cancelMissingFeature}
                    onChange={(e) => setCancelMissingFeature(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                </div>

                {/* Question 4: Likelihood to return */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-800">
                    4. How likely are you to consider returning to LeadFlow in the future?
                  </Label>
                  <Select
                    value={cancelLikelihood}
                    onValueChange={(val) => setCancelLikelihood(val as typeof cancelLikelihood)}
                  >
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Select likelihood" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="very_likely">Very Likely</SelectItem>
                      <SelectItem value="likely">Likely</SelectItem>
                      <SelectItem value="neutral">Neutral / Unsure</SelectItem>
                      <SelectItem value="unlikely">Unlikely</SelectItem>
                      <SelectItem value="very_unlikely">Very Unlikely</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Question 5: Additional comments */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-800">
                    5. Additional comments or feedback for our team (optional)
                  </Label>
                  <Textarea
                    placeholder="Any final thoughts or suggestions..."
                    value={cancelComments}
                    onChange={(e) => setCancelComments(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                </div>

                {/* Cancellation Timing / Notice */}
                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold text-amber-950">Important Billing Notice:</p>
                  Your cancellation will stop all future renewals. You will retain full access until{" "}
                  <span className="font-semibold text-zinc-950">
                    {usageQuery.data?.currentPeriodEnd
                      ? new Date(usageQuery.data.currentPeriodEnd).toLocaleDateString("en-US", { dateStyle: "long" })
                      : "the end of your current period"}
                  </span>
                  . No further charges will be made.
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelModalOpen(false)}
                  className="text-xs font-semibold"
                >
                  Keep My Subscription
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    if (!organizationId) return;
                    cancelMutation.mutate({
                      organizationId,
                      reason: cancelReason,
                      reasonDetails: cancelReasonDetails || undefined,
                      whatCouldBeBetter: cancelWhatBetter || undefined,
                      missingFeatureExpected: cancelMissingFeature || undefined,
                      likelihoodToReturn: cancelLikelihood,
                      additionalComments: cancelComments || undefined,
                      cancelImmediately: false,
                    });
                  }}
                  className="text-xs font-bold"
                >
                  {cancelMutation.isPending ? "Processing Cancellation..." : "Submit Feedback & Confirm Cancellation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
