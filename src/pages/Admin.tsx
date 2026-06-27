import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Users,
  Building2,
  UserCheck,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router";

export default function Admin() {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: users, isLoading: usersLoading } = trpc.admin.users.useQuery({});
  const { data: organizations, isLoading: orgsLoading } = trpc.admin.organizations.useQuery({});

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Super Admin</h1>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Platform-wide administration and business management.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-600" },
          { label: "Organizations", value: stats?.totalOrganizations ?? 0, icon: Building2, color: "text-emerald-600" },
          { label: "Members", value: stats?.totalMembers ?? 0, icon: UserCheck, color: "text-violet-600" },
          { label: "Active Today", value: "—", icon: BarChart3, color: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label} className="border-muted">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              {statsLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Businesses Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              All Businesses
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">{organizations?.length ?? 0} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase border-b">
                <div className="col-span-3">Name</div>
                <div className="col-span-2">Industry</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Plan</div>
                <div className="col-span-2">Created</div>
                <div className="col-span-1">AI</div>
              </div>
              {orgsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 border-b">
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))
              ) : organizations?.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No organizations yet.</div>
              ) : (
                organizations?.map((org) => (
                  <div key={org.id} className="grid grid-cols-12 gap-2 px-5 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors items-center">
                    <div className="col-span-3">
                      <p className="text-sm font-medium">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.slug}</p>
                    </div>
                    <div className="col-span-2 text-sm">{org.industry || "-"}</div>
                    <div className="col-span-2">
                      <Badge variant={org.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">
                        {org.status}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className="text-[10px]">Professional</Badge>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : ""}
                    </div>
                    <div className="col-span-1">
                      {org.aiEnabled ? (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">On</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Off</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              All Users
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">{users?.length ?? 0} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase border-b">
                <div className="col-span-4">Name</div>
                <div className="col-span-4">Email</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2">Joined</div>
              </div>
              {usersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 border-b">
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))
              ) : users?.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No users yet.</div>
              ) : (
                users?.map((user) => (
                  <div key={user.id} className="grid grid-cols-12 gap-2 px-5 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors items-center">
                    <div className="col-span-4 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {user.name?.charAt(0).toUpperCase() || "U"}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{user.name || "Unknown"}</span>
                    </div>
                    <div className="col-span-4 text-sm text-muted-foreground">{user.email || "-"}</div>
                    <div className="col-span-2">
                      <Badge variant={user.role === "admin" ? "default" : "outline"} className="text-[10px] capitalize">
                        {user.role}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
