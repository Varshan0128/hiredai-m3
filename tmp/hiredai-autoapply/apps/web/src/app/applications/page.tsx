"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  discovered:  "bg-gray-100 text-gray-600",
  matched:     "bg-blue-100 text-blue-700",
  skipped:     "bg-gray-100 text-gray-400",
  needs_review:"bg-yellow-100 text-yellow-700",
  approved:    "bg-blue-100 text-blue-700",
  rejected:    "bg-red-100 text-red-600",
  scheduled:   "bg-indigo-100 text-indigo-700",
  submitting:  "bg-orange-100 text-orange-700",
  submitted:   "bg-green-100 text-green-700",
  failed:      "bg-red-100 text-red-700",
  retrying:    "bg-orange-100 text-orange-600",
  cancelled:   "bg-gray-100 text-gray-500",
};

const ALL_STATUSES = ["needs_review", "approved", "scheduled", "submitted", "failed", "skipped", "cancelled"];

function EventTimeline({ events }: { events: any[] }) {
  if (!events?.length) return null;
  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Timeline</p>
      <div className="space-y-2">
        {events.map((e: any, i: number) => (
          <div key={e.id ?? i} className="flex gap-3 text-xs">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-0.5 shrink-0" />
              {i < events.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
            </div>
            <div className="pb-2">
              <span className="text-gray-700 font-medium">{e.message}</span>
              <span className="text-gray-400 ml-2">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppRow({ app, onCancel }: { app: any; onCancel: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const job = app.job;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">{job?.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[app.status] ?? "bg-gray-100 text-gray-600"}`}>
                {app.status.replace("_", " ")}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${app.sourceProvider === "adzuna" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                {app.sourceProvider}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{job?.companyName} · {job?.location ?? "—"}</p>
          </div>
          <div className="text-right shrink-0 text-xs text-gray-400 space-y-0.5">
            {app.scheduledAt && <p>Scheduled {new Date(app.scheduledAt).toLocaleDateString()}</p>}
            {app.appliedAt && <p className="text-green-600">Applied {new Date(app.appliedAt).toLocaleDateString()}</p>}
            {!app.scheduledAt && !app.appliedAt && <p>{new Date(app.createdAt).toLocaleDateString()}</p>}
          </div>
          <span className="text-gray-400 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          {app.failureReason && (
            <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs text-red-600"><span className="font-semibold">Failure reason:</span> {app.failureReason}</p>
            </div>
          )}
          {app.resume && (
            <p className="text-xs text-gray-500 mb-2">Resume: <span className="font-medium">{app.resume.title}</span></p>
          )}
          {app.submissionMode && (
            <p className="text-xs text-gray-500 mb-2">Mode: <span className="font-medium">{app.submissionMode.replace("_", " ")}</span></p>
          )}
          {app.retryCount > 0 && (
            <p className="text-xs text-orange-600 mb-2">Retry attempts: {app.retryCount}</p>
          )}
          <EventTimeline events={app.events} />
          {!["submitted", "cancelled", "rejected", "skipped"].includes(app.status) && (
            <button
              onClick={(ev) => { ev.stopPropagation(); onCancel(); }}
              className="mt-3 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel application
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  const [status, setStatus] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["applications", status],
    queryFn: () => api.get(`/api/v1/applications?limit=50${status ? `&status=${status}` : ""}`).then((r) => r.data),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/applications/${id}/cancel`),
    onSuccess: () => { toast.success("Application cancelled"); qc.invalidateQueries({ queryKey: ["applications"] }); },
    onError: () => toast.error("Cancel failed"),
  });

  const apps: any[] = data?.data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data?.total ?? 0} total applications</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-semibold">No applications found</p>
          <p className="text-sm mt-1">Run ingestion from the Jobs page to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app: any) => (
            <AppRow key={app.id} app={app} onCancel={() => cancel.mutate(app.id)} />
          ))}
        </div>
      )}

      {data?.hasMore && (
        <p className="text-center text-sm text-gray-400 mt-6">Showing first 50 — use filters to narrow results</p>
      )}
    </div>
  );
}
