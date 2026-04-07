import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageBackButton from "./PageBackButton";
import {
  type PsychometricAnswer,
  type PsychometricModule,
  type PsychometricOption,
  computePsychometricProfile,
  getFeatureRoute,
  getOptionImpact,
  getOptionLabel,
  getOptionTrait,
  getOptionValue,
  getQuestionOptions,
  getQuestionText,
  getQuestionsByModule,
  loadPsychometricQuestions,
  normalizeTraitName,
  persistPsychometricCompletion,
  shuffleArray,
} from "../utils/psychometric";

interface PsychometricFlowProps {
  module: PsychometricModule;
}

interface PsychometricResultSummary {
  headline: string;
  description: string;
  roles?: string[];
}

function getTopTraitWithFallback(answers: PsychometricAnswer[]) {
  const scores = answers.reduce<Record<string, number>>((acc, answer) => {
    const trait = normalizeTraitName(answer.trait || "execution");
    acc[trait] = (acc[trait] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Trait Scores:", scores);

  const topTrait = Object.keys(scores).reduce(
    (best, current) =>
      (scores[current] ?? 0) > (scores[best] ?? 0) ? current : best,
    Object.keys(scores)[0] ?? "execution",
  );

  return topTrait || "execution";
}

function formatTraitLabel(trait: string) {
  return trait.charAt(0).toUpperCase() + trait.slice(1);
}

function getSectorFromTrait(trait: string) {
  const traitToSector: Record<string, string> = {
    creative: "Creative",
    analytical: "Tech",
    execution: "Core",
    management: "Business",
  };

  return traitToSector[trait] ?? "Core";
}

function getRolesFromTrait(trait: string) {
  const traitToRoles: Record<string, string[]> = {
    creative: ["UI/UX Designer", "Content Creator", "Product Designer"],
    analytical: ["Data Analyst", "Backend Developer", "ML Engineer"],
    execution: ["Operations Executive", "Field Engineer", "Production Manager"],
    management: ["Product Manager", "Business Analyst", "Consultant"],
  };

  return traitToRoles[trait] ?? traitToRoles.execution;
}

function getResultSummary(
  module: PsychometricModule,
  answers: PsychometricAnswer[],
): PsychometricResultSummary {
  if (module === "resume_builder") {
    const trait = getTopTraitWithFallback(answers);
    const sector = getSectorFromTrait(trait);
    const roles = getRolesFromTrait(trait);
    return {
      headline: `You are best suited for ${sector}`,
      description: `Based on your ${formatTraitLabel(trait)} thinking, your answers point toward the kind of work, responsibilities, and problem-solving patterns where you are most likely to thrive.`,
      roles,
    };
  }

  const trait = getTopTraitWithFallback(answers);
  return {
    headline: `Your personality type is ${formatTraitLabel(trait)}`,
    description:
      `Based on your ${formatTraitLabel(trait)} thinking, your responses reveal the work style you naturally lean toward. We'll use this profile to shape the next job-discovery step around how you think and operate best.`,
  };
}

export default function PsychometricFlow({ module }: PsychometricFlowProps) {
  const navigate = useNavigate();
  const featureRoute = getFeatureRoute(module);
  const forceShow = import.meta.env.DEV; // DEV ONLY
  const [questions, setQuestions] = useState(
    () => [] as Awaited<ReturnType<typeof loadPsychometricQuestions>>,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<PsychometricAnswer[]>([]);
  const [selectedValue, setSelectedValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [resultSummary, setResultSummary] = useState<PsychometricResultSummary | null>(null);
  const filteredQuestions = useMemo(
    () => shuffleArray(getQuestionsByModule(questions, module)).slice(0, 15),
    [module, questions],
  );

  useEffect(() => {
    let isActive = true;

    void (async () => {
      const allQuestions = await loadPsychometricQuestions();
      if (!isActive) {
        return;
      }

      setQuestions(allQuestions);
      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    console.log("Module:", module);
    console.log("All Questions:", questions);
    console.log("Filtered Questions:", filteredQuestions);

    if (isLoading || filteredQuestions.length === 0 || resultSummary) {
      return;
    }

    const completed =
      module === "resume_builder"
        ? localStorage.getItem("psychometric_resume_completed")
        : localStorage.getItem("psychometric_job_completed");

    if (completed && !forceShow && filteredQuestions.length > 0) {
      console.log("Already completed -> redirecting");
      navigate(featureRoute, { replace: true });
    }
  }, [
    featureRoute,
    filteredQuestions,
    forceShow,
    isLoading,
    module,
    navigate,
    questions,
    resultSummary,
  ]);

  useEffect(() => {
    const currentAnswer = answers[currentIndex];
    setSelectedValue(currentAnswer?.selectedOption ?? "");
  }, [answers, currentIndex]);

  const currentQuestion = filteredQuestions?.[currentIndex];
  const options = useMemo(
    () => (currentQuestion ? getQuestionOptions(currentQuestion).slice(0, 4) : []),
    [currentQuestion],
  );
  const totalQuestions = filteredQuestions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  if (!questions || !Array.isArray(questions)) {
    console.error("Questions data invalid");
    return null;
  }

  if (!filteredQuestions.length) {
    return null;
  }

  console.log("Current Index:", currentIndex);
  console.log("Current Question:", currentQuestion);

  const handleResultContinue = () => {
    console.log("Navigating to:", featureRoute);
    navigate(featureRoute, { replace: true });
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const saveAnswer = () => {
    if (!currentQuestion || !selectedValue) {
      return;
    }

    const selectedOption = options.find(
      (option, index) => getOptionValue(option, index) === selectedValue,
    );

    if (!selectedOption) {
      return;
    }

    const nextAnswer: PsychometricAnswer = {
      questionId: String(
        currentQuestion.question_id ?? currentQuestion.id ?? `${module}-${currentIndex}`,
      ),
      module,
      question: getQuestionText(currentQuestion),
      selectedOption: selectedValue,
      optionLabel: getOptionLabel(selectedOption, options.indexOf(selectedOption)),
      trait: getOptionTrait(selectedOption),
      impact: getOptionImpact(selectedOption),
    };

    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = nextAnswer;
    setAnswers(nextAnswers);

    if (isLastQuestion) {
      persistPsychometricCompletion(module, nextAnswers);
      setResultSummary(getResultSummary(module, nextAnswers));
      return;
    }

    setCurrentIndex((index) => index + 1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="fixed left-4 top-4 z-50">
          <PageBackButton fallbackTo="/dashboard" label="Dashboard" variant="floating" />
        </div>
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl rounded-[24px] border-2 border-neutral-800 bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] text-center">
            <p className="font-['Poppins:Medium',sans-serif] text-neutral-700">
              Loading questions...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (totalQuestions === 0) {
    console.error("No questions available");
    return (
      <div className="min-h-screen bg-white">
        <div className="fixed left-4 top-4 z-50">
          <PageBackButton fallbackTo="/dashboard" label="Dashboard" variant="floating" />
        </div>
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl rounded-[24px] border-2 border-neutral-800 bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] text-center">
            <h1 className="font-['Poppins:Bold',sans-serif] text-3xl text-neutral-800">
              Psychometric Questions
            </h1>
            <p className="mt-3 font-['Poppins:Regular',sans-serif] text-neutral-600">
              Questions not loaded
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (resultSummary) {
    return (
      <div className="min-h-screen bg-white">
        <div className="fixed left-4 top-4 z-50">
          <PageBackButton fallbackTo="/dashboard" label="Dashboard" variant="floating" />
        </div>

        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl rounded-[24px] border-2 border-neutral-800 bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
            <div className="mb-8 text-center">
              <h1 className="font-['Poppins:Bold',sans-serif] text-3xl text-neutral-800">
                Psychometric Result
              </h1>
            </div>

            <div className="text-center">
              <h2 className="font-['Poppins:Medium',sans-serif] text-xl text-neutral-800 leading-8">
                {resultSummary.headline}
              </h2>
              <p className="mt-4 font-['Poppins:Regular',sans-serif] text-neutral-600 leading-7">
                {resultSummary.description}
              </p>
              {resultSummary.roles?.length ? (
                <div className="mt-6 text-left">
                  <p className="font-['Poppins:Medium',sans-serif] text-neutral-800">
                    Top roles for you:
                  </p>
                  <div className="mt-3 space-y-2 font-['Poppins:Regular',sans-serif] text-neutral-600">
                    {resultSummary.roles.map((role, index) => (
                      <p key={role}>
                        {index + 1}. {role}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleResultContinue}
                className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    console.error("No question available at index:", currentIndex);
    return (
      <div className="min-h-screen bg-white">
        <div className="fixed left-4 top-4 z-50">
          <PageBackButton fallbackTo="/dashboard" label="Dashboard" variant="floating" />
        </div>
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl rounded-[24px] border-2 border-neutral-800 bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] text-center">
            <h1 className="font-['Poppins:Bold',sans-serif] text-3xl text-neutral-800">
              Psychometric Questions
            </h1>
            <p className="mt-3 font-['Poppins:Regular',sans-serif] text-neutral-600">
              Questions not loaded
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion.options) {
    console.error("Invalid question structure:", currentQuestion);
    return <div>Questions not loaded</div>;
  }

  console.log("Options:", currentQuestion.options);

  const optionEntries = Object.entries(currentQuestion.options).slice(0, 4) as [
    string,
    PsychometricOption,
  ][];

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed left-4 top-4 z-50">
        <PageBackButton fallbackTo="/dashboard" label="Dashboard" variant="floating" />
      </div>

      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-[24px] border-2 border-neutral-800 bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
          <div className="mb-8 text-center">
            <h1 className="font-['Poppins:Bold',sans-serif] text-3xl text-neutral-800">
              Psychometric Questions
            </h1>
            <p className="mt-2 font-['Poppins:Regular',sans-serif] text-neutral-600">
              Question {currentIndex + 1} of {totalQuestions}
            </p>
          </div>

          <motion.div
            key={`${module}-${currentIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="font-['Poppins:Medium',sans-serif] text-xl text-neutral-800 leading-8">
              {getQuestionText(currentQuestion)}
            </h2>

            <div className="mt-8 px-2">
              <div className="space-y-3">
                {optionEntries.map(([key, option], index) => {
                  const normalizedOption = { key, ...option };
                  const optionValue = getOptionValue(normalizedOption, index);
                  const optionLabel = option.text ?? getOptionLabel(normalizedOption, index);
                  const isSelected = selectedValue === optionValue;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedValue(optionValue)}
                      className={`mx-2 flex w-full items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition ${
                        isSelected
                          ? "border-neutral-800 bg-neutral-100"
                          : "border-neutral-300 bg-white hover:border-neutral-800"
                      }`}
                    >
                      <span className="min-w-[28px] text-center font-['Poppins:Medium',sans-serif] font-semibold text-neutral-800">
                        {key}.
                      </span>
                      <span className="flex-1 font-['Poppins:Medium',sans-serif] leading-relaxed text-neutral-800">
                        {optionLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex justify-between pt-4">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="rounded-lg border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-800 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={saveAnswer}
                disabled={!selectedValue}
                className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLastQuestion ? "Finish" : "Next"}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
