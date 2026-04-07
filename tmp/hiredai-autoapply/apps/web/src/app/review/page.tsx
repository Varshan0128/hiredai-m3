"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

const SOURCE_BADGE: Record<string, string> = {
  adzuna: "bg-blue-100 text-blue-700",
  jooble: "bg-purple-100 text-purple-700",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-400" : "bg-red-400";
  const text = score >= 80 ? "text-green-700" : score >= 60 ? "text-yellow-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${text}`}>{score}%</span>
    </div>
  );
}

function ScoreBreakdown({ explanation }: { explanation: any }) {
  if (!explanation) return null;
  const items = [
    { label: "Role Fit", score: explanation.roleFitScore },
    { label: "Skill Fit", score: explanation.skillFitScore },
    { label: "Location", score: explanation.locationFitScore },
    { label: "Salary", score: explanation.salaryFitScore },
    { label: "Work Mode", score: explanation.workModeFitScore },
    { label: "Experience", score: explanation.experienceFitScore },
    { label: "Company", score: explanation.companyTypeFitScore },
  ];
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Score Breakdown</p>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 text-gray-500 shrink-0">{it.label}</span>
          <ScoreBar score={Math.round(it.score)} />
        </div>
      ))}
      {explanation.matchedSkills?.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-gray-400 mb-1">Matched skills</p>
          <div className="flex flex-wrap gap-1">
            {explanation.matchedSkills.map((s: string) => (
              <span key={s} className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">{s}</span>
            ))}
          </div>
        </div>
      )}
      {explanation.missingSkills?.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-gray-400 mb-1">Missing skills</p>
          <div className="flex flex-wrap gap-1">
            {explanation.missingSkills.slice(0, 5).map((s: string) => (
              <span key={s} className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const qc = useQueryClient();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => api.get("/api/v1/applications/review").then((r) => r.data),
  });

  const { data: matchResults } = useQuery({
    queryKey: ["match-results-review"],
    queryFn: () => api.get("/api/v1/jobs?decision=needs_review&limit=100").then((r) => r.data),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/applications/${id}/approve`),
    onSuccess: () => { toast.success("Approved — application scheduled"); qc.invalidateQueries({ queryKey: ["review-queue"] }); },
    onError: () => toast.error("Approval failed"),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/applications/${id}/reject`),
    onSuccess: () => { toast.success("Application rejected"); qc.invalidateQueries({ queryKey: ["review-queue"] }); },
    onError: () => toast.error("Rejection failed"),
  });

  const items: any[] = applications ?? [];
  const matchMap: Record<string, any> = {};
  (matchResults?.data ?? []).forEach((m: any) => { if (m.jobId) matchMap[m.jobId] = m; });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {items.length} application{items.length !== 1 ? "s" : ""} waiting for your decision
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-semibold text-lg">All clear!</p>
          <p className="text-sm mt-1">No applications waiting for review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((app: any) => {
            const job = app.job;
            const match = matchMap[app.jobId];
            return (
              <div key={app.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE[job?.sourceProvider] ?? "bg-gray-100 text-gray-600"}`}>
                          {job?.sourceProvider}
                        </span>
                        {job?.workMode && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{job.workMode}</span>
                        )}
                        {job?.companyType && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{job.companyType.replace("_", " ")}</span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{job?.title}</h3>
                      <p className="text-gray-500 text-sm">{job?.companyName} · {job?.location ?? "Location not specified"}</p>
                    </div>

                    <div className="text-right shrink-0">
                      {match && (
                        <div className="mb-1">
                          <span className={`text-2xl font-bold ${match.matchScore >= 80 ? "text-green-600" : match.matchScore >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                            {Math.round(match.matchScore)}
                          </span>
                          <span className="text-gray-400 text-sm">/100</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400">
                        {job?.salaryMin ? `$${(job.salaryMin / 1000).toFixed(0)}k${job.salaryMax ? `–$${(job.salaryMax / 1000).toFixed(0)}k` : "+"}` : "Salary not listed"}
                      </p>
                    </div>
                  </div>

                  {match?.explanation && <ScoreBreakdown explanation={match.explanation} />}

                  {match?.explanation?.decisionReason && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <p className="text-xs text-amber-700"><span className="font-semibold">Why review?</span> {match.explanation.decisionReason}</p>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {job?.applyUrl && (
                      <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline">View listing →</a>
                    )}
                    {app.resume && (
                      <span className="text-xs text-gray-400">Resume: {app.resume.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => reject.mutate(app.id)}
                      disabled={reject.isPending}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approve.mutate(app.id)}
                      disabled={approve.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Approve & Schedule
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
