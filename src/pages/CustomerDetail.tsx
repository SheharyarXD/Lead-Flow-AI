import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const navigate = useNavigate();
  const { data: customer, isLoading } = trpc.customer.getById.useQuery({ id: customerId });

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!customer) return <div className="p-8"><Button variant="ghost" onClick={() => navigate(-1)}>Back</Button><p className="mt-6 text-zinc-500">Customer not found.</p></div>;
  const name = `${customer.firstName} ${customer.lastName}`;
  return <div className="p-8 space-y-6 max-w-5xl mx-auto">
    <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
    <div><h1 className="text-2xl font-bold">{name}</h1><p className="text-sm text-zinc-500">{customer.email || "No email"} · {customer.phone || "No phone"}</p></div>
    <div className="grid gap-5 md:grid-cols-2">
      <Card><CardHeader><CardTitle>Customer information</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Status: {customer.status}</p><p>Source: {customer.source || "other"}</p><p>Notes: {customer.notes || "No notes"}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Related records</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Leads: {customer.leads.length}</p><p>Conversations: {customer.conversations.length}</p><p>Tasks: {customer.tasks.length}</p><p>Appointments: {customer.appointments.length}</p><p>Calls: {customer.calls.length}</p></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Timeline</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
      {customer.conversations.map((item) => <button className="block text-left w-full hover:text-indigo-600" key={`c-${item.id}`} onClick={() => navigate(`/conversations/${item.id}`)}>Conversation: {item.subject || item.channel} ({item.status})</button>)}
      {customer.tasks.map((item) => <p key={`t-${item.id}`}>Task: {item.title} ({item.status})</p>)}
      {customer.appointments.map((item) => <p key={`a-${item.id}`}>Appointment: {item.title}</p>)}
      {customer.calls.map((item) => <p key={`call-${item.id}`}>Call: {item.direction} ({item.status})</p>)}
      {!customer.conversations.length && !customer.tasks.length && !customer.appointments.length && !customer.calls.length && <p className="text-zinc-500">No customer history yet.</p>}
    </CardContent></Card>
  </div>;
}
