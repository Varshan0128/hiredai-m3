export type PsychometricModule = "resume_builder" | "job_discovery";

export interface PsychometricOption {
  id?: string;
  key?: string;
  value?: string;
  label?: string;
  text?: string;
  trait?: string;
  impact?: Record<string, number>;
  traits?: Record<string, number>;
  score?: Record<string, number>;
}

export interface PsychometricQuestion {
  id?: string | number;
  question_id?: string | number;
  module: PsychometricModule;
  question?: string;
  text?: string;
  prompt?: string;
  options?: PsychometricOption[] | Record<string, PsychometricOption>;
  choices?: PsychometricOption[];
}

export interface PsychometricAnswer {
  questionId: string;
  module: PsychometricModule;
  question: string;
  selectedOption: string;
  optionLabel: string;
  trait: string;
  impact: Record<string, number>;
}

const PSYCHOMETRIC_QUESTION_SOURCE = "/psychometric_questions.json";

export const PSYCHOMETRIC_STORAGE_KEYS = {
  resumeCompleted: "psychometric_resume_completed",
  jobCompleted: "psychometric_job_completed",
  resumeAnswers: "psychometric_resume_answers",
  jobAnswers: "psychometric_job_answers",
  profile: "psychometric_profile",
} as const;

export async function loadPsychometricQuestions(): Promise<PsychometricQuestion[]> {
  try {
    const response = await fetch(PSYCHOMETRIC_QUESTION_SOURCE, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const parsed = (await response.json()) as unknown;
    console.log("Loaded JSON:", parsed);
    return Array.isArray(parsed) ? (parsed as PsychometricQuestion[]) : [];
  } catch {
    return [];
  }
}

export function getQuestionsByModule(
  questions: PsychometricQuestion[],
  module: PsychometricModule,
) {
  return questions.filter(
    (question) =>
      question.module?.trim().toLowerCase() === module?.trim().toLowerCase(),
  );
}

export function shuffleArray<T>(array: T[]) {
  const shuffled = [...array];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

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

export function getQuestionText(question: PsychometricQuestion) {
  return question.question ?? question.text ?? question.prompt ?? "";
}

export function getQuestionOptions(question: PsychometricQuestion) {
  if (Array.isArray(question.options)) {
    return question.options;
  }

  if (question.options && typeof question.options === "object") {
    return Object.entries(question.options).map(([key, option]) => ({
      key,
      ...option,
    }));
  }

  return Array.isArray(question.choices) ? question.choices : [];
}

export function getOptionValue(option: PsychometricOption, index: number) {
  return option.value ?? option.key ?? option.id ?? String.fromCharCode(65 + index);
}

export function getOptionLabel(option: PsychometricOption, index: number) {
  return option.label ?? option.text ?? option.value ?? option.key ?? `Option ${index + 1}`;
}

export function getOptionImpact(option: PsychometricOption) {
  return option.impact ?? option.traits ?? option.score ?? {};
}

function mapSectorToTrait(sector: string) {
  const normalizedSector = sector.trim().toLowerCase();

  if (normalizedSector === "creative") {
    return "creative";
  }

  if (normalizedSector === "tech") {
    return "analytical";
  }

  if (normalizedSector === "business") {
    return "management";
  }

  if (normalizedSector === "core") {
    return "execution";
  }

  return "execution";
}

export function normalizeTraitName(trait: string) {
  const normalizedTrait = trait.trim().toLowerCase();

  if (normalizedTrait === "leadership" || normalizedTrait === "structured") {
    return "management";
  }

  if (
    normalizedTrait === "creative" ||
    normalizedTrait === "analytical" ||
    normalizedTrait === "execution" ||
    normalizedTrait === "management"
  ) {
    return normalizedTrait;
  }

  return normalizedTrait;
}

export function getOptionTrait(option: PsychometricOption) {
  if (option.trait) {
    return normalizeTraitName(option.trait);
  }

  const impact = getOptionImpact(option);
  const entries = Object.entries(impact);

  if (entries.length === 0) {
    return "execution";
  }

  const sectorEntry = entries.find(
    ([key, value]) => key === "Sector" && typeof value === "string",
  );

  if (sectorEntry) {
    return mapSectorToTrait(String(sectorEntry[1]));
  }

  const numericEntries = entries.filter(([, value]) => typeof value === "number");

  if (numericEntries.length === 0) {
    return "execution";
  }

  const [topTrait] = numericEntries.sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  return normalizeTraitName(topTrait);
}

export function computePsychometricProfile(answers: PsychometricAnswer[]) {
  return answers.reduce<Record<string, number>>((profile, answer) => {
    Object.entries(answer.impact).forEach(([trait, value]) => {
      profile[trait] = (profile[trait] ?? 0) + value;
    });

    return profile;
  }, {});
}

export function readStoredAnswers(module: PsychometricModule) {
  try {
    const raw = localStorage.getItem(getAnswersKey(module));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PsychometricAnswer[]) : [];
  } catch {
    return [];
  }
}

export function persistPsychometricCompletion(
  module: PsychometricModule,
  answers: PsychometricAnswer[],
) {
  localStorage.setItem(getCompletionKey(module), "true");
  localStorage.setItem(getAnswersKey(module), JSON.stringify(answers));

  const allAnswers =
    module === "resume_builder"
      ? [...answers, ...readStoredAnswers("job_discovery")]
      : [...readStoredAnswers("resume_builder"), ...answers];

  localStorage.setItem(
    PSYCHOMETRIC_STORAGE_KEYS.profile,
    JSON.stringify(computePsychometricProfile(allAnswers)),
  );
}
