"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Building,
  FileText,
  Home,
  LogOut,
  Settings,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  Shield,
  Calculator,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "admin" | "accountant";
}

const API_BASE = "http://192.168.1.16:8000/api";

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/profile-web`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { name } = await res.json();
        const [firstName, lastName = ""] = (name || "").split(" ", 2);
        setUser({ firstName, lastName });
        sessionStorage.setItem("user", JSON.stringify({ firstName, lastName }));
      } catch (err) {
        console.warn("Impossible de récupérer le profil :", err);
        // fallback sur sessionStorage
        const stored = sessionStorage.getItem("user");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setUser({
              firstName: parsed.firstName || "",
              lastName: parsed.lastName || "",
            });
          } catch {
            setUser(null);
          }
        }
      } finally {
        setLoadingUser(false);
      }
    })();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userRole");
    router.push("/login");
  };

  const adminMenuItems = [
    { title: "Tableau de bord", icon: Home, href: "/admin/dashboard" },
    { title: "Comptables", icon: Users, href: "/admin/accountants" },
    { title: "Entreprises", icon: Building, href: "/admin/companies" },
    { title: "Abonnements", icon: Calendar, href: "/admin/subscriptions" },
    { title: "Validation Entreprises", icon: CheckCircle, href: "/admin/companies/validation" },
    { title: "Demandes Suppression", icon: XCircle, href: "/admin/companies/deletion-requests" },
    { title: "Paramètres", icon: Settings, href: "/admin/settings" },
  ];

  const accountantMenuItems = [
    { title: "Tableau de bord", icon: Home, href: "/accountant/dashboard" },
    { title: "Entreprises", icon: Building, href: "/accountant/companies" },
    { title: "Documents", icon: FileText, href: "/accountant/documents" },
    { title: "Abonnements", icon: Calendar, href: "/accountant/subscriptions" },
    { title: "Paramètres", icon: Settings, href: "/accountant/settings" },
  ];

  const menuItems = role === "admin" ? adminMenuItems : accountantMenuItems;

  const fullName = loadingUser
    ? "Chargement..."
    : user && (user.firstName || user.lastName)
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Utilisateur";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/40">
      <SidebarProvider defaultOpen={open} onOpenChange={setOpen}>
        <div className="flex h-screen w-full overflow-hidden relative">
          <Sidebar className="backdrop-blur-md bg-white/90 border-0 shadow-xl shadow-blue-200/20">
        <SidebarHeader className="flex h-16 items-center border-b border-blue-100/50 px-6 bg-gradient-to-r from-blue-50/60 to-indigo-50/60">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {role === "admin" ? (
                    <div className="rounded-xl p-2.5 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                  ) : (
                    <div className="rounded-xl p-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg">
                      <Calculator className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-lg font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Cleverbills
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {role === "admin" ? "Super Admin" : "Comptable"}
                  </div>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="bg-gradient-to-b from-white/95 to-blue-50/30 backdrop-blur-sm">
              <SidebarMenu className="p-4 space-y-2">
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.title}
                      className={`
                        h-12 rounded-xl transition-all duration-300 font-medium ${
                          pathname === item.href
                            ? role === "admin"
                              ? "bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-200/50"
                              : "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-200/50"
                            : "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 text-gray-600 hover:text-gray-800 hover:shadow-md"
                        }
                      `}
                    >
                      <Link href={item.href} className="flex items-center gap-3 px-3">
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>

            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                    <span>Déconnexion</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>

          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-16 items-center gap-4 border-b border-blue-100/50 backdrop-blur-md bg-white/90 px-6 shadow-sm">
              <SidebarTrigger className="rounded-xl p-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200" />
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {role === "admin" ? "Panneau d'Administration" : "Espace Comptable"}
                  </h1>
                  <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent mt-1"></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-700">
                      {fullName}
                    </div>
                 
                  </div>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                      role === "admin"
                        ? "bg-gradient-to-r from-blue-400 to-indigo-500"
                        : "bg-gradient-to-r from-emerald-400 to-teal-500"
                    }`}
                  >
                    {role === "admin" ? (
                      <Shield className="w-5 h-5 text-white" />
                    ) : (
                      <Calculator className="w-5 h-5 text-white" />
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-auto relative">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}
