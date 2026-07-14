import { Routes, Route } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Conversations from "./pages/Conversations";
import ConversationThread from "./pages/ConversationThread";
import Calls from "./pages/Calls";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import CustomerDetail from "./pages/CustomerDetail";
import Onboarding from "./pages/Onboarding";
import AcceptInvite from "./pages/AcceptInvite";

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/conversations/:id" element={<ConversationThread />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
