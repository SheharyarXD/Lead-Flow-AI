import { useSearchParams, useNavigate, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PhoneCall } from "lucide-react";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", member: "Agent" };

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: preview, isLoading: previewLoading } = trpc.organization.previewInvite.useQuery(
    { token },
    { enabled: token.length >= 32 }
  );

  const acceptMutation = trpc.organization.acceptInvite.useMutation({
    onSuccess: async () => {
      await utils.organization.list.invalidate();
      navigate("/");
    },
  });

  const wrap = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfcfd] text-zinc-900 px-4">
      <Card className="w-full max-w-md bg-white border border-zinc-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.02)] rounded-2xl p-4 sm:p-6">
        <CardHeader className="text-center pt-6 pb-2">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600">
              <PhoneCall className="w-7 h-7 stroke-[2.5]" />
            </div>
          </div>
          <CardTitle className="text-xl font-extrabold tracking-tight text-zinc-950">Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-6 text-center">{children}</CardContent>
      </Card>
    </div>
  );

  if (token.length < 32) {
    return wrap(<p className="text-sm text-zinc-500">This invite link is missing or malformed.</p>);
  }

  if (previewLoading || authLoading) {
    return wrap(<Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />);
  }

  if (!preview?.valid) {
    return wrap(<p className="text-sm text-zinc-500">This invite is invalid, has already been used, or has expired. Ask your team owner to send a new one.</p>);
  }

  if (!user) {
    return wrap(
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          You've been invited to join <span className="font-bold">{preview.organizationName}</span> as{" "}
          <span className="font-bold">{ROLE_LABEL[preview.role] ?? preview.role}</span>.
        </p>
        <p className="text-xs text-zinc-500">Log in or create an account with <span className="font-semibold">{preview.email}</span> to accept.</p>
        <Link to={`/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`}>
          <Button className="w-full h-10 rounded-xl font-bold bg-indigo-650 hover:bg-indigo-700 text-white">
            Log In / Sign Up
          </Button>
        </Link>
      </div>
    );
  }

  if (user.email.toLowerCase() !== preview.email.toLowerCase()) {
    return wrap(
      <p className="text-sm text-zinc-500">
        This invite was sent to <span className="font-semibold">{preview.email}</span>, but you're logged in as{" "}
        <span className="font-semibold">{user.email}</span>. Log out and sign in with the invited email to accept.
      </p>
    );
  }

  return wrap(
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Join <span className="font-bold">{preview.organizationName}</span> as{" "}
        <span className="font-bold">{ROLE_LABEL[preview.role] ?? preview.role}</span>?
      </p>
      {acceptMutation.error && <p className="text-sm text-red-600">{acceptMutation.error.message}</p>}
      <Button
        onClick={() => acceptMutation.mutate({ token })}
        disabled={acceptMutation.isPending}
        className="w-full h-10 rounded-xl font-bold bg-indigo-650 hover:bg-indigo-700 text-white"
      >
        {acceptMutation.isPending ? "Joining..." : "Accept Invitation"}
      </Button>
    </div>
  );
}
