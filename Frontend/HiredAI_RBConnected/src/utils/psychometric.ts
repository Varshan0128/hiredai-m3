export type PsychometricModule = "resume_builder" | "job_discovery";

export const PSYCHOMETRIC_STORAGE_KEYS = {
  resumeCompleted: "psychometric_resume_completed",
  jobCompleted: "psychometric_job_completed",
  resumeAnswers: "psychometric_resume_answers",
  jobAnswers: "psychometric_job_answers",
  profile: "psychometric_profile",
} as const;

export function getCompletionKey(module: PsychometricModule) {
  return module === "resume_builder"
    ? PSYCHOMETRIC_STORAGE_KEYS.resumeCompleted
    : PSYCHOMETRIC_STORAGE_KEYS.jobCompleted;
}

export function getAnswersKey(module: PsychometricModule) {
  return module === "resume_builder"
    ? PSYCHOMETRIC_STORAGE_KEYS.resumeAnswers
    : PSYCHOMETRIC_STORAGE_KEYS.jobAnswers;
}

export function getPsychometricRoute(module: PsychometricModule) {
  return module === "resume_builder"
    ? "/psychometric/resume"
    : "/psychometric/job";
}

export function getFeatureRoute(module: PsychometricModule) {
  return module === "resume_builder" ? "/jobrole" : "/upload-resume";
}

export function isPsychometricComplete(module: PsychometricModule) {
  return localStorage.getItem(getCompletionKey(module)) === "true";
}

export function getModuleForPage(page: string): PsychometricModule | null {
  if (
    page === "resume-builder" ||
    page === "jobrole" ||
    page === "upload-resume"
  ) {
    return "resume_builder";
  }

  if (page === "job-discovery" || page === "jobs") {
    return "job_discovery";
  }

  return null;
}
