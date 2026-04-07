"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const { data: pref } = useQuery({ queryKey: ["preferences"], queryFn: () => api.get("/api/v1/auto-apply/preferences").then((r) => r.data) });
  const { data: apps } = useQuery({ queryKey: ["applications-summary"], queryFn: () => api.get("/api/v1/applications?limit=100").then((r) => r.data) });
  const { data: notifCount } = useQuery({ queryKey: ["notif-count"], queryFn: () => api.get("/api/v1/notifications/unread/count").then((r) => r.data) });

  const byStatus = (s: string) => apps?.data?.filter((a: any) => a.status === s).length ?? 0;

  const stats = [
    { label: "Status", value: pref?.enabled ? "ON" : "OFF", color: pref?.enabled ? "text-green-600" : "text-red-500", bg: "bg-green-50" },
    { label: "Needs Review", value: byStatus("needs_review"), color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Scheduled", value: byStatus("scheduled"), color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Submitted", value: byStatus("submitted"), color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Failed", value: byStatus("failed"), color: "text-red-600", bg: "bg-red-50" },
    { label: "Skipped", value: byStatus("skipped"), color: "text-gray-500", bg: "bg-gray-50" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-8">Your auto-apply pipeline at a glance</p>

      {(notifCount ?? 0) > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{notifCount}</span>
          <span className="text-sm text-blue-700">unread notifications</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.bg} border border-gray-100`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">Auto Apply Config</h2>
          {pref ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Mode</dt><dd>{pref.fullyAutomatic ? "Fully Automatic" : "Semi-Automatic"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Daily Limit</dt><dd>{pref.maxApplicationsPerDay} apps/day</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Min Score</dt><dd>{pref.minimumMatchScore}%</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Roles</dt><dd className="text-right text-xs max-w-[160px] truncate">{pref.targetRoles?.join(", ")}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No preferences set. <a href="/settings" className="text-blue-600">Configure →</a></p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { href: "/review", label: "Review pending jobs", badge: byStatus("needs_review"), bg: "bg-yellow-50 hover:bg-yellow-100", text: "text-yellow-800" },
              { href: "/jobs", label: "Browse matched jobs", bg: "bg-blue-50 hover:bg-blue-100", text: "text-blue-800" },
              { href: "/applications", label: "View all applications", bg: "bg-gray-50 hover:bg-gray-100", text: "text-gray-700" },
              { href: "/settings", label: "Manage preferences", bg: "bg-gray-50 hover:bg-gray-100", text: "text-gray-700" },
            ].map((a) => (
              <a key={a.href} href={a.href} className={`flex items-center justify-between p-3 ${a.bg} rounded-lg transition-colors`}>
                <span className={`text-sm font-medium ${a.text}`}>{a.label}</span>
                {a.badge !== undefined && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">{a.badge}</span>}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
