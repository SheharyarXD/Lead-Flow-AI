import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!isAuthLoading && user) {
      navigate("/");
    }
  }, [user, isAuthLoading, navigate]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (err) => {
      setError(err.message || "Invalid email or password");
    },
  });

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: async (data) => {
      setSuccessMessage("Account created successfully! Please sign in with your credentials.");
      setActiveTab("login");
      // Pre-fill the email address they registered with
      setEmail(data.email || "");
      setPassword("");
      setName("");
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to register. Please try again.");
    },
  });

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) {
      return "Password must be at least 6 characters long.";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one capital (uppercase) letter.";
    }
    if (!/\d/.test(pwd)) {
      return "Password must contain at least one number.";
    }
    return null;
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    loginMutation.mutate({ email, password });
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password || !name) {
      setError("Please fill in all fields.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    signupMutation.mutate({ email, password, name });
  };

  const isMutating = loginMutation.isPending || signupMutation.isPending;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        <p className="mt-4 text-sm text-zinc-400">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-slate-100 px-4 select-none">
      <Card className="w-full max-w-md bg-[#0c0c0e] border border-zinc-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.8)] rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        {/* Glow effect decorative element */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <CardHeader className="text-center pt-6 pb-8">
          <div className="flex justify-center mb-4">
            {/* Elegant glowing SVG logo */}
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" className="text-emerald-400 stroke-[1.5] opacity-80 animate-pulse" />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">LeadFlow AI</CardTitle>
          <CardDescription className="text-zinc-500 mt-2 text-sm leading-relaxed">
            AI Receptionist & Customer Relationship Manager
          </CardDescription>
        </CardHeader>

        <CardContent className="px-2 pb-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as "login" | "signup");
              setError(null);
              setSuccessMessage(null);
              setPassword("");
            }}
            className="w-full"
          >
            {/* Vercel-style clean underline tabs to prevent merging layout */}
            <TabsList className="flex border-b border-zinc-800/80 w-full bg-transparent p-0 mb-8 rounded-none h-auto">
              <TabsTrigger
                value="login"
                disabled={isMutating}
                className="flex-1 text-center pb-3 text-zinc-400 border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-400 data-[state=active]:font-semibold rounded-none bg-transparent hover:text-emerald-400 transition-all text-sm font-medium"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                disabled={isMutating}
                className="flex-1 text-center pb-3 text-zinc-400 border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-400 data-[state=active]:font-semibold rounded-none bg-transparent hover:text-emerald-400 transition-all text-sm font-medium"
              >
                Register
              </TabsTrigger>
            </TabsList>

            {successMessage && (
              <Alert className="mb-6 bg-emerald-950/20 border-emerald-900/30 text-emerald-400 rounded-xl py-3 px-4 shadow-md">
                <AlertDescription className="text-xs font-semibold leading-relaxed">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="mb-6 bg-red-950/25 border-red-900/30 text-red-300 rounded-xl py-3 px-4 shadow-md">
                <AlertDescription className="text-xs font-medium leading-relaxed">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-zinc-400">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isMutating}
                    required
                    className="bg-[#09090b] border-zinc-800 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 rounded-xl text-slate-100 placeholder:text-zinc-600 h-10 px-3.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-xs font-medium text-zinc-400">
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isMutating}
                    required
                    className="bg-[#09090b] border-zinc-800 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 rounded-xl text-slate-100 placeholder:text-zinc-600 h-10 px-3.5"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isMutating}
                  className="w-full h-10 rounded-xl font-semibold mt-8 bg-slate-100 text-slate-900 hover:bg-slate-200 transition-all duration-200 active:scale-[0.98] shadow-md text-sm"
                >
                  {isMutating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignupSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-xs font-medium text-zinc-400">
                    Your Name
                  </Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isMutating}
                    required
                    className="bg-[#09090b] border-zinc-800 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 rounded-xl text-slate-100 placeholder:text-zinc-600 h-10 px-3.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-xs font-medium text-zinc-400">
                    Email Address
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isMutating}
                    required
                    className="bg-[#09090b] border-zinc-800 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 rounded-xl text-slate-100 placeholder:text-zinc-600 h-10 px-3.5"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="signup-password" className="text-xs font-medium text-zinc-400">
                      Password
                    </Label>
                    <span className="text-[10px] text-zinc-500 font-semibold tracking-wide">Min. 6 chars, 1 Capital, 1 Number</span>
                  </div>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isMutating}
                    required
                    className="bg-[#09090b] border-zinc-800 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 rounded-xl text-slate-100 placeholder:text-zinc-600 h-10 px-3.5"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isMutating}
                  className="w-full h-10 rounded-xl font-semibold mt-8 bg-slate-100 text-slate-900 hover:bg-slate-200 transition-all duration-200 active:scale-[0.98] shadow-md text-sm"
                >
                  {isMutating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
