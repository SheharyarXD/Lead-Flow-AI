import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Clock,
  Settings,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Plus,
  Trash,
} from "lucide-react";

export default function Onboarding() {
  const { organizationId, refreshOrganizations } = useOrganization();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");

  const [businessHours, setBusinessHours] = useState<Record<string, { open: string; close: string }>>({
    monday: { open: "09:00", close: "17:00" },
    tuesday: { open: "09:00", close: "17:00" },
    wednesday: { open: "09:00", close: "17:00" },
    thursday: { open: "09:00", close: "17:00" },
    friday: { open: "09:00", close: "17:00" },
    saturday: { open: "10:00", close: "14:00" },
    sunday: { open: "closed", close: "closed" },
  });

  const [serviceInput, setServiceInput] = useState("");
  const [services, setServices] = useState<string[]>([]);

  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  const [aiInstructions, setAiInstructions] = useState(
    "You are a helpful and polite virtual receptionist. Answer customers' questions accurately using the knowledge base, gather their name and phone number if they wish to book an appointment, and offer to schedule a slot during business hours."
  );

  // Autosave: rehydrate any progress saved on a previous visit, so closing the
  // tab mid-onboarding never loses work.
  const hydratedRef = useRef(false);
  const { data: existingOrg } = trpc.organization.getById.useQuery(
    { id: organizationId! },
    { enabled: !!organizationId }
  );
  const { data: faqEntries, refetch: refetchFaqs } = trpc.knowledgeBase.list.useQuery(
    { organizationId: organizationId!, type: "faq" },
    { enabled: !!organizationId }
  );
  const faqs = (faqEntries ?? []).map((f) => ({ id: f.id, question: f.title, answer: f.content }));

  useEffect(() => {
    if (hydratedRef.current || !existingOrg) return;
    hydratedRef.current = true;
    if (existingOrg.name) setBusinessName(existingOrg.name);
    if (existingOrg.industry) setIndustry(existingOrg.industry);
    if (existingOrg.phone) setPhone(existingOrg.phone);
    if (existingOrg.businessHours) setBusinessHours(existingOrg.businessHours);
    if (existingOrg.services?.length) setServices(existingOrg.services);
    if (existingOrg.aiInstructions) setAiInstructions(existingOrg.aiInstructions);
  }, [existingOrg]);

  const saveProgress = trpc.organization.saveProgress.useMutation();

  const persistProgress = () => {
    if (!organizationId) return;
    saveProgress.mutate({
      organizationId,
      name: businessName || undefined,
      industry: industry || undefined,
      phone: phone || undefined,
      businessHours,
      services,
      aiInstructions,
    });
  };

  const createFaq = trpc.knowledgeBase.create.useMutation({ onSuccess: () => refetchFaqs() });
  const deleteFaq = trpc.knowledgeBase.delete.useMutation({ onSuccess: () => refetchFaqs() });

  const completeOnboarding = trpc.organization.completeOnboarding.useMutation({
    onSuccess: async () => {
      setError(null);
      await refreshOrganizations();
      navigate("/");
    },
    onError: (err) => {
      setError(err.message || "Failed to complete onboarding. Please check your connection and try again.");
    },
  });

  const handleHourChange = (day: string, type: "open" | "close", value: string) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: value,
      },
    }));
  };

  const toggleDayClosed = (day: string) => {
    setBusinessHours((prev) => {
      const isClosed = prev[day].open === "closed";
      return {
        ...prev,
        [day]: isClosed
          ? { open: "09:00", close: "17:00" }
          : { open: "closed", close: "closed" },
      };
    });
  };

  const addService = () => {
    if (serviceInput.trim() && !services.includes(serviceInput.trim())) {
      setServices([...services, serviceInput.trim()]);
      setServiceInput("");
    }
  };

  const removeService = (indexToRemove: number) => {
    setServices(services.filter((_, idx) => idx !== indexToRemove));
  };

  const addFaq = () => {
    if (newQuestion.trim() && newAnswer.trim() && organizationId) {
      createFaq.mutate({
        organizationId,
        type: "faq",
        title: newQuestion.trim(),
        content: newAnswer.trim(),
        aiEnabled: true,
      });
      setNewQuestion("");
      setNewAnswer("");
    }
  };

  const removeFaq = (id: number) => {
    deleteFaq.mutate({ id });
  };

  const goToStep = (nextStep: number) => {
    persistProgress();
    setStep(nextStep);
  };

  const handleSubmit = () => {
    if (!businessName || !industry || !phone || !organizationId) return;
    completeOnboarding.mutate({
      organizationId,
      name: businessName,
      industry,
      phone,
      businessHours,
      services,
      aiInstructions,
    });
  };

  const isStepValid = () => {
    if (step === 1) return businessName.trim() !== "" && industry.trim() !== "" && phone.trim() !== "";
    if (step === 3) return services.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col items-center justify-center p-6 md:p-12 font-sans select-none">
      <div className="w-full max-w-2xl space-y-8">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-xl shadow-md">
            LF
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 mt-4">
            Welcome to LeadFlow AI
          </h1>
          <p className="text-sm text-zinc-550 font-medium max-w-md mx-auto">
            Let's configure your business console and AI agent receptionist in a few quick steps.
          </p>
        </div>

        {/* Progress Timeline Header */}
        <div className="flex justify-between items-center px-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                  step === s
                    ? "bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-50"
                    : step > s
                    ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                    : "bg-white text-zinc-400 border-zinc-200"
                }`}
              >
                {step > s ? <CheckCircle className="w-4 h-4 text-indigo-600" /> : s}
              </div>
              {s < 5 && (
                <div
                  className={`h-0.5 flex-1 mx-2 transition-all ${
                    step > s ? "bg-indigo-500" : "bg-zinc-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form panel Card */}
        <Card className="bg-white border-zinc-200 shadow-xl rounded-2xl overflow-hidden p-8">
          <CardContent className="p-0 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-150 text-red-800 rounded-xl py-3 px-4 shadow-sm text-xs font-semibold leading-relaxed animate-fade-in">
                {error}
              </div>
            )}

            {/* STEP 1: Business Profile */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-zinc-900">Step 1: Business Profile</h2>
                </div>
                <div className="space-y-4 pt-2 text-xs font-semibold text-zinc-700">
                  <div className="space-y-2">
                    <Label htmlFor="biz-name" className="text-zinc-600">Business/Organization Name *</Label>
                    <Input
                      id="biz-name"
                      placeholder="e.g. Acme Dental Group"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="bg-zinc-50 border-zinc-200 text-xs rounded-lg h-10 shadow-none focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry" className="text-zinc-600">Industry *</Label>
                    <Input
                      id="industry"
                      placeholder="e.g. Healthcare, Dental, Real Estate"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="bg-zinc-50 border-zinc-200 text-xs rounded-lg h-10 shadow-none focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-zinc-600">Phone Number *</Label>
                    <Input
                      id="phone"
                      placeholder="e.g. +15551234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-zinc-50 border-zinc-200 text-xs rounded-lg h-10 shadow-none focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Business Hours */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-zinc-900">Step 2: Business Hours</h2>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  Configure when your team is available. The AI receptionist will use these hours to coordinate user requests.
                </p>
                <div className="space-y-3 pt-2 text-xs font-semibold text-zinc-700">
                  {Object.keys(businessHours).map((day) => {
                    const times = businessHours[day];
                    const isClosed = times.open === "closed";

                    return (
                      <div key={day} className="flex items-center justify-between gap-4 p-3 border border-zinc-100 rounded-lg hover:bg-zinc-50/50 transition-colors">
                        <span className="capitalize w-24 text-zinc-900 font-bold">{day}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleDayClosed(day)}
                            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                              isClosed
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                            }`}
                          >
                            {isClosed ? "Closed" : "Open"}
                          </button>
                          {!isClosed && (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="time"
                                value={times.open}
                                onChange={(e) => handleHourChange(day, "open", e.target.value)}
                                className="w-24 h-8 bg-zinc-50 border-zinc-200 text-xs rounded shadow-none"
                              />
                              <span className="text-zinc-400 font-medium">to</span>
                              <Input
                                type="time"
                                value={times.close}
                                onChange={(e) => handleHourChange(day, "close", e.target.value)}
                                className="w-24 h-8 bg-zinc-50 border-zinc-200 text-xs rounded shadow-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: Services Tags */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-zinc-900">Step 3: Services Offered</h2>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  Add the services or products your business provides. This helps the AI agent categorize lead intent.
                </p>
                <div className="space-y-4 pt-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Teeth Whitening, General Cleaning, Invisalign"
                      value={serviceInput}
                      onChange={(e) => setServiceInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addService()}
                      className="bg-zinc-50 border-zinc-200 text-xs rounded-lg h-10 shadow-none focus-visible:ring-indigo-500"
                    />
                    <Button onClick={addService} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-4 rounded-lg text-xs">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {services.map((svc, index) => (
                      <Badge key={svc} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold border border-zinc-200 px-2.5 py-1 rounded-lg text-xs shadow-none flex items-center gap-1.5">
                        {svc}
                        <button onClick={() => removeService(index)} className="text-zinc-400 hover:text-red-500 font-black text-xs">×</button>
                      </Badge>
                    ))}
                    {services.length === 0 && (
                      <span className="text-zinc-400 text-xs font-semibold leading-relaxed block py-4">No services added yet. Please add at least one.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Knowledge Base FAQs */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-zinc-900">Step 4: Seed Knowledge Base FAQs</h2>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  Provide standard answers to common client questions. The AI receptionist will reply automatically using these details.
                </p>
                <div className="space-y-4 pt-2 text-xs font-semibold text-zinc-700">
                  <div className="space-y-2 border border-zinc-100 p-4 rounded-xl bg-zinc-50/20">
                    <div className="space-y-2">
                      <Label htmlFor="faq-q">Question</Label>
                      <Input
                        id="faq-q"
                        placeholder="e.g. Do you accept insurance?"
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        className="bg-white border-zinc-200 text-xs rounded-lg shadow-none"
                      />
                    </div>
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="faq-a">Answer</Label>
                      <Textarea
                        id="faq-a"
                        placeholder="e.g. Yes, we accept all major PPO insurance plans."
                        value={newAnswer}
                        onChange={(e) => setNewAnswer(e.target.value)}
                        className="bg-white border-zinc-200 text-xs rounded-lg shadow-none min-h-[60px]"
                      />
                    </div>
                    <Button onClick={addFaq} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 mt-3 w-full rounded-lg text-xs shadow-sm">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add FAQ Entry
                    </Button>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-zinc-600">Saved FAQs ({faqs.length})</Label>
                    <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                      {faqs.map((faq) => (
                        <div key={faq.id} className="p-3.5 flex items-start justify-between gap-4 bg-white hover:bg-zinc-50/30 transition-colors">
                          <div className="min-w-0">
                            <span className="text-zinc-950 font-bold block truncate">{faq.question}</span>
                            <span className="text-zinc-500 font-medium block truncate mt-0.5">{faq.answer}</span>
                          </div>
                          <button onClick={() => removeFaq(faq.id)} className="text-zinc-400 hover:text-red-500 p-1 shrink-0">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {faqs.length === 0 && (
                        <span className="text-zinc-450 text-xs font-semibold leading-relaxed block py-6 text-center bg-white">No FAQ entries added. You can skip or add entries.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: AI instructions */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-zinc-900">Step 5: AI Receptionist Behavior</h2>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  Provide custom prompts to dictate how the AI receptionist should welcome clients, speak, and qualify incoming messages.
                </p>
                <div className="space-y-2 pt-2 text-xs font-semibold text-zinc-700">
                  <Label htmlFor="ai-prompt" className="text-zinc-600">Receptionist Custom Rules</Label>
                  <Textarea
                    id="ai-prompt"
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    className="bg-zinc-50 border-zinc-200 text-xs rounded-lg min-h-[160px] shadow-none leading-relaxed focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-zinc-100">
              {step > 1 ? (
                <Button
                  variant="outline"
                  onClick={() => goToStep(step - 1)}
                  className="text-zinc-700 border-zinc-200 h-10 px-4 rounded-lg text-xs font-bold hover:bg-zinc-50 shadow-none flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <Button
                  disabled={!isStepValid()}
                  onClick={() => goToStep(step + 1)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={completeOnboarding.isPending || !isStepValid()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-6 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-md shadow-indigo-600/20"
                >
                  {completeOnboarding.isPending ? "Configuring..." : "Complete Setup & Dashboard"}
                  <CheckCircle className="w-4 h-4" />
                </Button>
              )}
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
