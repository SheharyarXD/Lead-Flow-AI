import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PhoneCall } from "lucide-react";

export default function Login() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // Forgot password views sub-state
  const [showForgot, setShowForgot] = useState<"forgot" | "reset" | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirection if already authenticated
  useEffect(() => {
    if (!isAuthLoading && user) {
      navigate(redirectTo);
    }
  }, [user, isAuthLoading, navigate, redirectTo]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate(redirectTo);
    },
    onError: (err) => {
      setError(err.message || "Invalid email or password");
    },
  });

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: async (data) => {
      setSuccessMessage("Account created successfully! Please sign in with your credentials.");
      setActiveTab("login");
      setEmail(data.email || "");
      setPassword("");
      setName("");
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to register. Please try again.");
    },
  });

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: (data) => {
      setSuccessMessage("Instructions sent. If in development mode, please copy the reset token below.");
      if (data && "resetToken" in data && data.resetToken) {
        setResetToken(data.resetToken);
      }
      setShowForgot("reset");
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to request password reset");
    },
  });

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccessMessage("Password reset successfully. Please sign in with your new password.");
      setShowForgot(null);
      setActiveTab("login");
      setError(null);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      setError(err.message || "Failed to reset password.");
    },
  });

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) {
      return "Password must be at least 8 characters long.";
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

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (!forgotEmail) {
      setError("Please enter your email.");
      return;
    }
    forgotMutation.mutate({ email: forgotEmail });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (!resetToken || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    resetMutation.mutate({ token: resetToken, password: newPassword });
  };

  const isMutating = loginMutation.isPending || signupMutation.isPending || forgotMutation.isPending || resetMutation.isPending;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfcfd] text-zinc-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="mt-4 text-sm text-zinc-550 font-medium">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfcfd] text-zinc-900 px-4 select-none">
      
      {/* Interactive Card container with smooth lift animation */}
      <Card className="w-full max-w-md bg-white border border-zinc-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(79,70,229,0.06)] rounded-2xl p-4 sm:p-6 transition-all duration-500 hover:-translate-y-0.5">
        
        <CardHeader className="text-center pt-6 pb-6 select-none">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 transition-transform duration-500 hover:rotate-12 hover:scale-[1.06]">
              <PhoneCall className="w-7 h-7 stroke-[2.5]" />
            </div>
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-zinc-950">LeadFlow AI</CardTitle>
          <CardDescription className="text-zinc-500 mt-2 text-xs font-semibold leading-relaxed">
            AI Receptionist & Customer Relationship Manager
          </CardDescription>
        </CardHeader>

        <CardContent className="px-2 pb-6">
          {successMessage && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-100 text-emerald-800 rounded-xl py-3 px-4 shadow-sm animate-fade-in">
              <AlertDescription className="text-xs font-semibold leading-relaxed">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-50 border-red-100 text-red-800 rounded-xl py-3 px-4 shadow-sm animate-fade-in">
              <AlertDescription className="text-xs font-semibold leading-relaxed">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {showForgot === "forgot" && (
            <form onSubmit={handleForgotSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-xs font-bold text-zinc-500">
                  Email Address
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="name@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={isMutating}
                  required
                  className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(null);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-bold text-zinc-400 hover:text-zinc-600"
                >
                  ← Back to Login
                </button>
                <Button
                  type="submit"
                  disabled={isMutating}
                  className="h-10 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-750 transition-all text-xs px-5 shadow-sm"
                >
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Token"}
                </Button>
              </div>
            </form>
          )}

          {showForgot === "reset" && (
            <form onSubmit={handleResetSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-token" className="text-xs font-bold text-zinc-500">
                  Reset Token
                </Label>
                <Input
                  id="reset-token"
                  placeholder="Enter the 64-character token"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  disabled={isMutating}
                  required
                  className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-bold text-zinc-500">
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isMutating}
                  required
                  className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-bold text-zinc-500">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isMutating}
                  required
                  className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot("forgot");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-bold text-zinc-400 hover:text-zinc-600"
                >
                  ← Request new token
                </button>
                <Button
                  type="submit"
                  disabled={isMutating}
                  className="h-10 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-750 transition-all text-xs px-5 shadow-sm"
                >
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
                </Button>
              </div>
            </form>
          )}

          {showForgot === null && (
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
              <TabsList className="flex border-b border-zinc-200 w-full bg-transparent p-0 mb-8 rounded-none h-auto select-none">
                <TabsTrigger
                  value="login"
                  disabled={isMutating}
                  className="flex-1 text-center pb-3 text-zinc-400 border-b-2 border-transparent data-[state=active]:border-indigo-650 data-[state=active]:text-indigo-600 data-[state=active]:font-extrabold rounded-none bg-transparent hover:text-indigo-600 hover:bg-zinc-50/50 transition-all duration-200 text-xs font-bold"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  disabled={isMutating}
                  className="flex-1 text-center pb-3 text-zinc-400 border-b-2 border-transparent data-[state=active]:border-indigo-655 data-[state=active]:text-indigo-600 data-[state=active]:font-extrabold rounded-none bg-transparent hover:text-indigo-600 hover:bg-zinc-50/50 transition-all duration-200 text-xs font-bold"
                >
                  Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold text-zinc-500">
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
                      className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="login-password" className="text-xs font-bold text-zinc-500">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgot("forgot");
                          setError(null);
                          setSuccessMessage(null);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isMutating}
                      required
                      className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isMutating}
                    className="w-full h-10 rounded-xl font-bold mt-8 bg-indigo-650 hover:bg-indigo-700 text-zinc-950 hover:text-white hover:scale-[1.01] hover:shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition-all duration-250 active:scale-[0.97] shadow-sm text-xs border border-indigo-800/90"
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
                    <Label htmlFor="signup-name" className="text-xs font-bold text-zinc-500">
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
                      className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-xs font-bold text-zinc-500">
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
                      className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="signup-password" className="text-xs font-bold text-zinc-500">
                        Password
                      </Label>
                      <span className="text-[10px] text-zinc-450 font-semibold tracking-wide">Min. 8 chars, 1 Capital, 1 Number</span>
                    </div>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isMutating}
                      required
                      className="bg-white border-zinc-200 text-xs rounded-xl text-zinc-950 placeholder:text-zinc-400 h-10 px-3.5 focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-500 transition-all duration-200 shadow-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isMutating}
                    className="w-full h-10 rounded-xl font-bold mt-8 bg-indigo-650 hover:bg-indigo-700 text-zinc-950 hover:text-white hover:scale-[1.01] hover:shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition-all duration-250 active:scale-[0.97] shadow-sm text-xs border border-indigo-800/90"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
