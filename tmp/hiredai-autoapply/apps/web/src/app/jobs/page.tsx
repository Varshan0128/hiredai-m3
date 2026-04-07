"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

const TABS = [
  { key: "auto_apply", label: "Auto Apply" },
  { key: "needs_review", label: "Needs Review" },
  { key: "skip", label: "Skipped" },
] as const;

const SOURCE_COLORS: Record<string, string> = {
  adzuna: "bg-blue-100 text-blue-700",
  jooble: "bg-purple-100 text-purple-700",
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "text-green-600 bg-green-50" : s >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${SCORE_COLOR(score)}`}>{score}</span>
    </div>
  );
}

function JobCard({ match, onApprove, onReject }: { match: any; onApprove?: () => void; onReject?: () => void }) {
  const job = match.job ?? match;
  const isReview = match.decision === "needs_review";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
          <p className="text-sm text-gray-500">{job.companyName}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[job.sourceProvider] ?? "bg-gray-100 text-gray-600"}`}>
            {job.sourceProvider}
          </span>
          {job.workMode && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{job.workMode}</span>
          )}
        </div>
      </div>

      <div className="mb-3">
        <ScoreBar score={match.matchScore ?? 0} />
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {(job.skills ?? []).slice(0, 5).map((s: string) => (
          <span key={s} className="text-xs px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-600">{s}</span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
        <span>{job.location ?? "Location not specified"}</span>
        <span>{job.salaryMin ? `$${(job.salaryMin / 1000).toFixed(0)}k${job.salaryMax ? `–$${(job.salaryMax / 1000).toFixed(0)}k` : "+"}` : "Salary not listed"}</span>
      </div>

      {match.explanation?.decisionReason && (
        <p className="text-xs text-gray-400 italic mb-3 line-clamp-1">{match.explanation.decisionReason}</p>
      )}

      <div className="flex items-center gap-2">
        {job.applyUrl && (
          <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline">View job →</a>
        )}
        {isReview && onApprove && (
          <>
            <button onClick={onApprove}
              className="ml-auto text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Approve
            </button>
            <button onClick={onReject}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [tab, setTab] = useState<typeof TABS[number]["key"]>("auto_apply");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["jobs-matched", tab],
    queryFn: () => api.get(`/api/v1/jobs?decision=${tab}&limit=50`).then((r) => r.data),
  });

  const ingest = useMutation({
    mutationFn: () => api.post("/api/v1/jobs/ingest/run"),
    onSuccess: () => { toast.success("Ingestion started — jobs will appear shortly"); qc.invalidateQueries({ queryKey: ["jobs-matched"] }); },
    onError: () => toast.error("Failed to start ingestion"),
  });

  const approve = useMutation({
    mutationFn: (appId: string) => api.post(`/api/v1/applications/${appId}/approve`),
    onSuccess: () => { toast.success("Application approved and scheduled"); qc.invalidateQueries({ queryKey: ["jobs-matched"] }); },
    onError: () => toast.error("Approval failed"),
  });

  const reject = useMutation({
    mutationFn: (appId: string) => api.post(`/api/v1/applications/${appId}/reject`),
    onSuccess: () => { toast.success("Application rejected"); qc.invalidateQueries({ queryKey: ["jobs-matched"] }); },
    onError: () => toast.error("Rejection failed"),
  });

  const matches: any[] = data?.data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-500 text-sm mt-0.5">Jobs discovered from Adzuna and Jooble</p>
        </div>
        <button
          onClick={() => ingest.mutate()}
          disabled={ingest.isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {ingest.isPending ? "Fetching..." : "Fetch New Jobs"}
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-medium">No jobs in this category</p>
          <p className="text-sm mt-1">Click "Fetch New Jobs" to start ingestion</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((m: any) => (
            <JobCard
              key={m.id}
              match={m}
              onApprove={m.applications?.[0]?.id ? () => approve.mutate(m.applications[0].id) : undefined}
              onReject={m.applications?.[0]?.id ? () => reject.mutate(m.applications[0].id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
