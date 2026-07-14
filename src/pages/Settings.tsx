import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
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
  Calendar,
  Phone,
} from "lucide-react";

export default function Settings() {
  const { organizationId } = useOrganization();
  const utils = trpc.useUtils();
  const { data: org } = trpc.organization.getById.useQuery({ id: organizationId! }, { enabled: !!organizationId });
  const { data: members } = trpc.organization.members.useQuery({ organizationId: organizationId! }, { enabled: !!organizationId });

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

  const [businessForm, setBusinessForm] = useState({
    name: "",
    industry: "",
    phone: "",
    email: "",
    website: "",
    timezone: "America/Los_Angeles",
  });

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
        openaiApiKey: (org as any).openaiApiKey || "",
      });
    }
  }, [org]);

  const updateOrg = trpc.organization.update.useMutation({
    onSuccess: () => {
      if (organizationId) utils.organization.getById.invalidate({ id: organizationId });
    },
  });

  const handleSaveBusiness = () => {
    updateOrg.mutate({
      id: organizationId!,
      name: businessForm.name,
      industry: businessForm.industry,
      phone: businessForm.phone,
      email: businessForm.email,
      website: businessForm.website,
    }, {
      onSuccess: () => {
        setSaveBusinessSuccess(true);
        setTimeout(() => setSaveBusinessSuccess(false), 3000);
      }
    });
  };

  const handleSaveAi = () => {
    updateOrg.mutate({
      id: organizationId!,
      aiEnabled: aiForm.aiEnabled,
      greetingMessage: aiForm.greetingMessage,
      aiInstructions: aiForm.aiInstructions,
      openaiApiKey: aiForm.openaiApiKey.trim() || null,
    }, {
      onSuccess: () => {
        setSaveAiSuccess(true);
        setTimeout(() => setSaveAiSuccess(false), 3000);
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
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, i) => (
                  <div key={day} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                    <span className="text-sm font-medium w-32">{day}</span>
                    <div className="flex items-center gap-2">
                      {i < 5 ? (
                        <>
                          <Badge variant="outline" className="text-[10px]">8:00 AM - 6:00 PM</Badge>
                          <Switch defaultChecked />
                        </>
                      ) : i === 5 ? (
                        <>
                          <Badge variant="outline" className="text-[10px]">9:00 AM - 2:00 PM</Badge>
                          <Switch defaultChecked />
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-[10px]">Closed</Badge>
                          <Switch />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                      placeholder="sk-..." 
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Members</CardTitle>
              <CardDescription>Manage who has access to your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members?.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {member.user?.name?.charAt(0).toUpperCase() || "U"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.user?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{member.user?.email || ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 select-none">
                      <Badge variant={member.role === "owner" || member.role === "admin" ? "default" : "outline"} className="text-[10px] capitalize">
                        {member.role === "owner" || member.role === "admin" ? "Admin" : member.role === "manager" ? "Manager" : "Collector"}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!members || members.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No team members found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Services</CardTitle>
              <CardDescription>Integrate with your existing tools and services.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Twilio", desc: "Phone numbers & SMS", status: "coming_soon", icon: Phone },
                { name: "OpenAI", desc: "AI voice & chat processing", status: "coming_soon", icon: Bot },
                { name: "Google Calendar", desc: "Sync appointments", status: "coming_soon", icon: Calendar },
                { name: "Stripe", desc: "Payment processing", status: "coming_soon", icon: CreditCard },
                { name: "Slack", desc: "Team notifications", status: "coming_soon", icon: Link2 },
                { name: "Zapier", desc: "Workflow automation", status: "coming_soon", icon: Link2 },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <integration.icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{integration.desc}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                </div>
              ))}
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
              <CardTitle className="text-base">Current Plan</CardTitle>
              <CardDescription>Your subscription and usage details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div>
                  <p className="text-lg font-bold text-primary">Professional Plan</p>
                  <p className="text-sm text-muted-foreground">$297/month billed annually</p>
                </div>
                <Badge className="text-[10px]">Active</Badge>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>AI Call Minutes</span>
                    <span className="text-muted-foreground">142 / 500 min</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "28%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Leads</span>
                    <span className="text-muted-foreground">10 / 500</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "2%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Team Members</span>
                    <span className="text-muted-foreground">1 / 5</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "20%" }} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: "Starter", price: "$97/mo", features: ["100 min", "100 leads", "2 users"], current: false },
                  { name: "Professional", price: "$297/mo", features: ["500 min", "500 leads", "5 users", "Priority support"], current: true },
                  { name: "Enterprise", price: "Custom", features: ["Unlimited", "Unlimited", "Unlimited", "Custom AI training"], current: false },
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className={`p-4 rounded-lg border ${plan.current ? "border-primary ring-1 ring-primary/20" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{plan.name}</span>
                      {plan.current && <Badge className="text-[10px]">Current</Badge>}
                    </div>
                    <p className="text-lg font-bold mb-2">{plan.price}</p>
                    <ul className="space-y-1">
                      {plan.features.map((f) => (
                        <li key={f} className="text-xs text-muted-foreground">{f}</li>
                      ))}
                    </ul>
                    {!plan.current && (
                      <Button variant="outline" size="sm" className="w-full mt-3" disabled={plan.name === "Enterprise"}>
                        {plan.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
