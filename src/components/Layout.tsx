import { useAuth } from "@/hooks/useAuth";
import { Outlet, useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect, useRef } from "react";
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
  HelpCircle,
  Settings,
  Search,
  CheckSquare,
} from "lucide-react";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: MessageSquare, label: "Conversations", path: "/conversations" },
  { icon: Users, label: "Leads", path: "/leads" },
  { icon: Phone, label: "Calls", path: "/calls" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: CheckSquare, label: "Tasks", path: "/tasks" },
];

export default function Layout() {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { data: subscription, isLoading: subLoading } = trpc.organization.getDefaultSubscription.useQuery(undefined, {
    enabled: !!user,
  });

  const getTrialDays = () => {
    if (subLoading) return { label: "loading...", percent: 0 };
    if (!subscription) return { label: "No Active Plan", percent: 0 };

    const end = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : new Date(new Date(subscription.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);

    const diffTime = end.getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const percent = Math.min(100, Math.max(0, (daysRemaining / 30) * 100));

    return {
      label: `${daysRemaining} days left`,
      percent,
    };
  };
  const trialDays = getTrialDays();

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

  if (isLoading) {
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
    navigate("/login");
    return null;
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
                  {item.label === "Conversations" && (
                    <Badge
                      variant="secondary"
                      className="ml-auto text-[10px] font-bold h-5 px-1.5 bg-indigo-600 text-white rounded-full border-none shadow-[0_1px_4px_rgba(79,70,229,0.2)]"
                    >
                      3
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
          {/* Trial Status Widget */}
          <div className="mx-3.5 mt-4 p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
            <div className="flex justify-between text-xs font-semibold text-zinc-500 mb-1.5">
              <span>Trial Status</span>
              <span className="text-indigo-600">{trialDays.label}</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all duration-350" style={{ width: `${trialDays.percent}%` }} />
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
            
            <button className="relative p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </button>
            
            <button className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors">
              <HelpCircle className="w-5 h-5" />
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

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[#fcfcfd]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
