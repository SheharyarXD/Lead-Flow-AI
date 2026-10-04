import { useAuth } from "@/hooks/useAuth";
import { Outlet, useLocation, useNavigate, Navigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect, useRef } from "react";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Home,
  MessageSquare,
  Users,
  Phone,
  Calendar,
  Shield,
  LogOut,
  Menu,
  PhoneCall,
  Bell,
  Settings,
  Search,
  CheckSquare,
  BarChart3,
  Zap,
  Sparkles,
} from "lucide-react";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: MessageSquare, label: "Conversations", path: "/conversations" },
  { icon: Users, label: "Leads", path: "/leads" },
  { icon: Phone, label: "Calls", path: "/calls" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: CheckSquare, label: "Tasks", path: "/tasks" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Zap, label: "Workflows", path: "/workflows" },
];

export default function Layout() {
  const { user, isLoading, logout } = useAuth();
  const { organization, isLoading: orgLoading } = useOrganization() as any;
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { data: subscription, isLoading: subLoading } = trpc.organization.getDefaultSubscription.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: conversationStats } = trpc.conversation.stats.useQuery(
    { organizationId: organization?.id ?? 0 },
    { enabled: !!user && !!organization?.id, refetchInterval: 30000 }
  );
  const unreadCount = conversationStats?.unread ?? 0;

  const getSubscriptionInfo = () => {
    if (subLoading) return { label: "Loading...", statusText: "Subscription", percent: 0, isUrgent: false };
    if (!subscription) return { label: "Start 30-Day Trial", statusText: "No Plan", percent: 0, isUrgent: true };

    if (subscription.status === "trialing") {
      const trialEndDate = subscription.trialEndsAt
        ? new Date(subscription.trialEndsAt)
        : subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null;

      if (!trialEndDate) {
        return { label: "30-Day Trial", statusText: "Free Trial", percent: 100, isUrgent: false };
      }

      const diffTime = trialEndDate.getTime() - Date.now();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const percent = Math.min(100, Math.max(0, (daysRemaining / 30) * 100));

      return {
        label: `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`,
        statusText: "Free Trial",
        percent,
        isUrgent: daysRemaining <= 3,
      };
    }

    if (subscription.status === "active") {
      if (subscription.cancelAtPeriodEnd) {
        return { label: "Cancels soon", statusText: "Scheduled Cancel", percent: 100, isUrgent: true };
      }
      return { label: "LeadFlow Pro", statusText: "Active Plan", percent: 100, isUrgent: false };
    }

    if (subscription.status === "past_due") {
      return { label: "Past Due", statusText: "Billing Alert", percent: 0, isUrgent: true };
    }

    if (subscription.status === "cancelled") {
      return { label: "Cancelled", statusText: "Inactive", percent: 0, isUrgent: true };
    }

    return { label: "Activate Trial", statusText: "LeadFlow Pro", percent: 0, isUrgent: true };
  };
  const subInfo = getSubscriptionInfo();

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node) && isMobile) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  if (isLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fcfcfd]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (organization && !organization.onboardingCompletedAt && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (organization?.onboardingCompletedAt && location.pathname === "/onboarding") {
    return <Navigate to="/" replace />;
  }

  if (location.pathname === "/onboarding") {
    return (
      <div className="min-h-screen w-full bg-zinc-50/50">
        <main className="w-full h-full">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#fcfcfd]">
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-zinc-200/80 flex flex-col transition-transform duration-200 ease-in-out",
          isMobile && !sidebarOpen && "-translate-x-full",
          !isMobile && "relative translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-zinc-100 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)]">
            <PhoneCall className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <span className="text-base font-bold text-zinc-900 tracking-tight">LeadFlow AI</span>
        </div>

        {/* Nav Items */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-zinc-100 text-indigo-600 font-semibold"
                      : "text-zinc-500 hover:text-zinc-950 hover:bg-zinc-50"
                  )}
                >
                  <item.icon
                    className={cn("w-4 h-4 transition-colors", isActive ? "text-indigo-600" : "text-zinc-400")}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span>{item.label}</span>
                  {item.label === "Conversations" && unreadCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto text-[10px] font-bold h-5 px-1.5 bg-indigo-600 text-white rounded-full border-none shadow-[0_1px_4px_rgba(79,70,229,0.2)]"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </button>
              );
            })}

            {/* Admin section */}
            {user.role === "admin" && (
              <>
                <div className="pt-5 pb-1 px-3">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Administration
                  </div>
                </div>
                <button
                  onClick={() => navigate("/admin")}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    location.pathname === "/admin"
                      ? "bg-zinc-100 text-indigo-600 font-semibold"
                      : "text-zinc-500 hover:text-zinc-950 hover:bg-zinc-50"
                  )}
                >
                  <Shield
                    className={cn(
                      "w-4 h-4 transition-colors",
                      location.pathname === "/admin" ? "text-indigo-600" : "text-zinc-400"
                    )}
                    strokeWidth={location.pathname === "/admin" ? 2.5 : 2}
                  />
                  <span>Superadmin</span>
                </button>
              </>
            )}
          </nav>
        </ScrollArea>

        {/* Sidebar Footer Widgets */}
        <div className="border-t border-zinc-100 shrink-0">
          {/* Subscription Status Widget */}
          <div
            onClick={() => navigate("/settings?tab=billing")}
            className="mx-3.5 mt-4 p-3 bg-zinc-50 border border-zinc-100 rounded-xl cursor-pointer hover:bg-zinc-100/70 transition-colors"
            title="Click to manage subscription"
          >
            <div className="flex justify-between text-xs font-semibold text-zinc-500 mb-1.5">
              <span>{subInfo.statusText}</span>
              <span className={subInfo.isUrgent ? "text-amber-600 font-bold" : "text-indigo-600 font-bold"}>
                {subInfo.label}
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-350",
                  subInfo.isUrgent ? "bg-amber-500" : "bg-indigo-600"
                )}
                style={{ width: `${subInfo.percent}%` }}
              />
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-6 py-4 text-sm font-semibold text-zinc-500 hover:text-zinc-950 hover:bg-zinc-50 transition-colors w-full mt-2"
          >
            <LogOut className="w-4 h-4 text-zinc-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fcfcfd]">
        {/* Global Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-8 h-16 border-b border-zinc-200 bg-white shrink-0">
          {/* Search bar */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search leads, conversations..."
              className="w-full pl-9 pr-4 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all"
            />
          </div>

          {/* User & Utilities panel */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/calendar")}
              className="text-zinc-700 border-zinc-200 h-9 px-4 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition-colors"
            >
              + Create Appointment
            </Button>
            <div className="w-[1px] h-6 bg-zinc-200" />
            
            <button onClick={() => navigate("/conversations")} className="relative p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
            </button>
            
            <button className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </button>

            <Avatar className="w-8 h-8 cursor-pointer border border-zinc-200" onClick={() => navigate("/settings")}>
              <AvatarFallback className="text-xs bg-indigo-50 text-indigo-600 font-bold">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Mobile Header */}
        {isMobile && (
          <header className="flex items-center gap-3 px-4 h-14 border-b bg-white shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-zinc-600" />
            </Button>
            <span className="font-bold text-zinc-900 text-sm">LeadFlow AI</span>
          </header>
        )}

        {/* Unactivated / Free Trial Activation Banner */}
        {organization?.onboardingCompletedAt &&
          (subscription?.status === "incomplete" || subscription?.status === "cancelled") &&
          location.pathname !== "/settings" && (
            <div className="bg-gradient-to-r from-indigo-50 via-indigo-50/60 to-white border-b border-indigo-150 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs text-indigo-950 font-medium">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Activate your <strong className="font-bold text-indigo-900">30-day free trial</strong> of LeadFlow Pro to unlock autonomous AI calls, SMS, and lead generation.
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/settings?tab=billing")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-7 px-3 rounded-lg shrink-0 shadow-xs"
              >
                Start Free Trial
              </Button>
            </div>
          )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[#fcfcfd]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
