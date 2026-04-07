"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const NAV = [
  { href: "/dashboard",     label: "Dashboard",    icon: "⊞" },
  { href: "/jobs",          label: "Jobs",          icon: "🔍" },
  { href: "/review",        label: "Review Queue",  icon: "👀" },
  { href: "/applications",  label: "Applications",  icon: "📋" },
  { href: "/settings",      label: "Settings",      icon: "⚙️" },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
];

function ReviewBadge() {
  const { data } = useQuery({
    queryKey: ["review-count"],
    queryFn: () => api.get("/api/v1/applications/review").then((r) => (r.data?.length ?? 0)),
    refetchInterval: 60000,
  });
  if (!data) return null;
  return <span className="ml-auto text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold">{data}</span>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/auth");

  const { data: notifCount } = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => api.get("/api/v1/notifications/unread/count").then((r) => r.data),
    enabled: !isAuth,
    refetchInterval: 30000,
  });

  if (isAuth) return <>{children}</>;

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">HiredAI</p>
              <p className="text-xs text-gray-400 mt-0.5">Auto Apply</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.href === "/notifications" && (notifCount ?? 0) > 0 && (
                  <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">{notifCount}</span>
                )}
                {item.href === "/review" && <ReviewBadge />}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={() => { localStorage.removeItem("access_token"); window.location.href = "/auth/login"; }}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
