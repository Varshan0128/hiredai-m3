"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

const TYPE_ICONS: Record<string, string> = {
  auto_apply_enabled: "🚀",
  jobs_need_review: "👀",
  application_scheduled: "📅",
  application_submitted: "✅",
  submission_failed: "❌",
  weekly_summary: "📊",
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/api/v1/notifications").then((r) => r.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/api/v1/notifications/read-all"),
    onSuccess: () => { toast.success("All notifications marked as read"); qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  const items: any[] = notifications ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm mt-0.5">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-sm text-blue-600 hover:underline disabled:opacity-50">
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🔔</div>
          <p className="font-semibold">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n: any) => (
            <div
              key={n.id}
              onClick={() => !n.read && markRead.mutate(n.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
                n.read ? "bg-white border-gray-100 opacity-70" : "bg-blue-50 border-blue-100 hover:bg-blue-100"
              }`}
            >
              <span className="text-2xl shrink-0">{TYPE_ICONS[n.type] ?? "📌"}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${n.read ? "text-gray-600" : "text-gray-900"}`}>{n.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
