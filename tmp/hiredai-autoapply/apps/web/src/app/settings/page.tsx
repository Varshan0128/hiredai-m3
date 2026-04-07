"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

const schema = z.object({
  enabled: z.boolean(),
  fullyAutomatic: z.boolean(),
  targetRoles: z.string().min(1, "Enter at least one role"),
  preferredLocations: z.string(),
  minSalary: z.coerce.number().min(0).optional().or(z.literal("")),
  maxSalary: z.coerce.number().min(0).optional().or(z.literal("")),
  workModes: z.array(z.string()),
  companyTypes: z.array(z.string()),
  experienceLevels: z.array(z.string()),
  maxApplicationsPerDay: z.coerce.number().min(1).max(100),
  maxApplicationsPerWeek: z.coerce.number().min(1).max(500),
  minimumMatchScore: z.coerce.number().min(0).max(100),
  timezone: z.string(),
});

type FormValues = z.infer<typeof schema>;

const WORK_MODES = ["remote", "hybrid", "onsite"];
const COMPANY_TYPES = ["startup", "product_based", "mnc", "service_based"];
const EXP_LEVELS = ["entry", "junior", "mid", "senior", "lead", "executive"];

function ToggleGroup({ options, value, onChange, label }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; label: string;
}) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors font-medium ${
              value.includes(opt)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
            }`}>
            {opt.replace("_", " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: pref, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: () => api.get("/api/v1/auto-apply/preferences").then((r) => r.data),
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enabled: false, fullyAutomatic: false,
      targetRoles: "", preferredLocations: "",
      minSalary: "", maxSalary: "",
      workModes: [], companyTypes: [], experienceLevels: [],
      maxApplicationsPerDay: 10, maxApplicationsPerWeek: 40,
      minimumMatchScore: 70, timezone: "UTC",
    },
  });

  useEffect(() => {
    if (pref) {
      reset({
        enabled: pref.enabled ?? false,
        fullyAutomatic: pref.fullyAutomatic ?? false,
        targetRoles: (pref.targetRoles ?? []).join(", "),
        preferredLocations: (pref.preferredLocations ?? []).join(", "),
        minSalary: pref.minSalary ?? "",
        maxSalary: pref.maxSalary ?? "",
        workModes: pref.workModes ?? [],
        companyTypes: pref.companyTypes ?? [],
        experienceLevels: pref.experienceLevels ?? [],
        maxApplicationsPerDay: pref.maxApplicationsPerDay ?? 10,
        maxApplicationsPerWeek: pref.maxApplicationsPerWeek ?? 40,
        minimumMatchScore: pref.minimumMatchScore ?? 70,
        timezone: pref.timezone ?? "UTC",
      });
    }
  }, [pref, reset]);

  const save = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        enabled: data.enabled,
        fullyAutomatic: data.fullyAutomatic,
        targetRoles: data.targetRoles.split(",").map((s) => s.trim()).filter(Boolean),
        preferredLocations: data.preferredLocations.split(",").map((s) => s.trim()).filter(Boolean),
        minSalary: data.minSalary ? Number(data.minSalary) : undefined,
        maxSalary: data.maxSalary ? Number(data.maxSalary) : undefined,
        workModes: data.workModes,
        companyTypes: data.companyTypes,
        experienceLevels: data.experienceLevels,
        maxApplicationsPerDay: Number(data.maxApplicationsPerDay),
        maxApplicationsPerWeek: Number(data.maxApplicationsPerWeek),
        minimumMatchScore: Number(data.minimumMatchScore),
        timezone: data.timezone,
      };
      return api.put("/api/v1/auto-apply/preferences", payload).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success("Preferences saved");
      qc.invalidateQueries({ queryKey: ["preferences"] });
    },
    onError: () => toast.error("Failed to save preferences"),
  });

  const enabled = watch("enabled");
  const fullyAutomatic = watch("fullyAutomatic");
  const workModes = watch("workModes");
  const companyTypes = watch("companyTypes");
  const experienceLevels = watch("experienceLevels");
  const minScore = watch("minimumMatchScore");

  if (isLoading) return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Auto Apply Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configure how HiredAI discovers and applies to jobs for you</p>
      </div>

      <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-6">

        {/* Master toggle */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Auto Apply Engine</h2>
              <p className="text-sm text-gray-500 mt-0.5">Enable automatic job discovery and application</p>
            </div>
            <button type="button" onClick={() => setValue("enabled", !enabled, { shouldDirty: true })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-green-500" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {enabled && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Fully Automatic Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">Apply without asking for review on high-confidence matches</p>
              </div>
              <button type="button" onClick={() => setValue("fullyAutomatic", !fullyAutomatic, { shouldDirty: true })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fullyAutomatic ? "bg-blue-500" : "bg-gray-300"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${fullyAutomatic ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          )}
        </div>

        {/* Target roles */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Job Targeting</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Roles <span className="text-red-500">*</span></label>
            <input {...register("targetRoles")} placeholder="Frontend Developer, React Engineer, Full Stack Developer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Comma-separated list of job titles</p>
            {errors.targetRoles && <p className="text-xs text-red-500 mt-1">{errors.targetRoles.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred Locations</label>
            <input {...register("preferredLocations")} placeholder="Remote, London, New York, Berlin"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Comma-separated. Use "Remote" for remote-first</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">Job Filters</h2>

          <ToggleGroup label="Work Modes" options={WORK_MODES} value={workModes}
            onChange={(v) => setValue("workModes", v, { shouldDirty: true })} />
          <ToggleGroup label="Company Types" options={COMPANY_TYPES} value={companyTypes}
            onChange={(v) => setValue("companyTypes", v, { shouldDirty: true })} />
          <ToggleGroup label="Experience Levels" options={EXP_LEVELS} value={experienceLevels}
            onChange={(v) => setValue("experienceLevels", v, { shouldDirty: true })} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Salary</label>
              <input {...register("minSalary")} type="number" placeholder="60000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Salary</label>
              <input {...register("maxSalary")} type="number" placeholder="140000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        </div>

        {/* Limits & thresholds */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">Rate Limits & Thresholds</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Minimum Match Score: <span className="text-blue-600 font-bold">{minScore}%</span>
            </label>
            <input {...register("minimumMatchScore")} type="range" min={0} max={100} step={5}
              className="w-full accent-blue-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0% (any match)</span><span>100% (perfect only)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Per Day</label>
              <input {...register("maxApplicationsPerDay")} type="number" min={1} max={100}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Per Week</label>
              <input {...register("maxApplicationsPerWeek")} type="number" min={1} max={500}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
            <input {...register("timezone")} placeholder="UTC"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => reset()}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Reset changes
          </button>
          <button type="submit" disabled={save.isPending || !isDirty}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {save.isPending ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}
