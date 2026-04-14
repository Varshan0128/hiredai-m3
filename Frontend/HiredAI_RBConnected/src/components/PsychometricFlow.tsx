import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageBackButton from "./PageBackButton";
import {
  getAnswersKey,
  getCompletionKey,
  getFeatureRoute,
  PSYCHOMETRIC_STORAGE_KEYS,
  type PsychometricModule,
} from "../utils/psychometric";
import * as engine from "../utils/psychometricEngine";
import type {
  EngineQuestion,
  PsychometricEngineResult,
} from "../utils/psychometricEngine";

interface PsychometricFlowProps {
  module: PsychometricModule;
}

interface ResultSummary {
  headline: string;
  description: string;
  roles: string[];
  confidence: number;
  topTraits: string[];
  showTopTraits: boolean;
}

interface AnswerHistoryItem {
  question: EngineQuestion;
  optionIndex: number;
  optionValue: string;
}

function formatTraitLabel(trait: string) {
  return trait
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTraitPair(topTraits: string[]) {
  return topTraits.map(formatTraitLabel).join(" + ");
}

function isResumeBuilderBest(
  best: PsychometricEngineResult["best"],
): best is Extract<NonNullable<PsychometricEngineResult["best"]>, { industry: string }> {
  return Boolean(best && "industry" in best && "role" in best && "alt" in best);
}

function isJobDiscoveryBest(
  best: PsychometricEngineResult["best"],
): best is Extract<NonNullable<PsychometricEngineResult["best"]>, { type: string; sub: string }> {
  return Boolean(best && "type" in best && "sub" in best);
}

function buildResultSummary(
  module: PsychometricModule,
  result: PsychometricEngineResult,
): ResultSummary {
  const topTraits = result.topTraits.length ? result.topTraits : ["adaptability"];
  const traitPair = formatTraitPair(topTraits);
  const best = result.best;
  const explanation = result.explanation ? ` ${result.explanation}` : "";
  const hybridNote =
    result.contradictionScore >= 2
      ? " Your answers show a hybrid pattern, so this result balances more than one strong work style."
      : "";

  if (module === "resume_builder" && isResumeBuilderBest(best)) {
    return {
      headline: best.industry,
      description: `Primary role: ${best.role}. Alternative path: ${best.alt}. Your strongest patterns point toward ${traitPair}.${hybridNote}${explanation}`,
      roles: [best.role, best.alt],
      confidence: result.confidence,
      topTraits,
      showTopTraits: true,
    };
  }

  if (module === "job_discovery" && isJobDiscoveryBest(best)) {
    return {
      headline: best.type,
      description: best.sub,
      roles: [],
      confidence: result.confidence,
      topTraits,
      showTopTraits: false,
    };
  }

  return {
    headline: "Psychometric Result",
    description: `Your strongest patterns point toward ${traitPair}.${hybridNote}${explanation}`,
    roles: [],
    confidence: result.confidence,
    topTraits,
    showTopTraits: true,
  };
}

function readStoredProfile() {
  try {
    const raw = localStorage.getItem(PSYCHOMETRIC_STORAGE_KEYS.profile);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistEngineState(
  module: PsychometricModule,
  result: PsychometricEngineResult,
  history: AnswerHistoryItem[],
) {
  localStorage.setItem(getCompletionKey(module), "true");
  localStorage.setItem(
    getAnswersKey(module),
    JSON.stringify(
      history.map((entry) => ({
        questionId: entry.question.id,
        answerIndex: entry.optionIndex,
        answer: entry.optionValue,
      })),
    ),
  );

  const currentProfile = readStoredProfile() as Record<string, unknown>;
  const mergedProfile = {
    ...currentProfile,
    module,
    topTraits: result.topTraits,
    confidence: result.confidence,
    best: result.best,
    second: result.second,
    traitScores: result.traitScores,
    [module]: result,
  };

  localStorage.setItem("psychometric_profile", JSON.stringify(mergedProfile));
}

export default function PsychometricFlow({ module }: PsychometricFlowProps) {
  const navigate = useNavigate();
  const featureRoute = getFeatureRoute(module);
  const forceShow = import.meta.env.DEV;
  const [isReady, setIsReady] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<EngineQuestion | null>(null);
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryItem[]>([]);
  const [selectedValue, setSelectedValue] = useState("");
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem(getCompletionKey(module));
    if (completed && !forceShow) {
      navigate(featureRoute, { replace: true });
      return;
    }

    engine.init(module);
    setAnswerHistory([]);
    setResultSummary(null);
    setSelectedValue("");
    setCurrentQuestion(engine.nextQuestion());
    setIsReady(true);
  }, [featureRoute, forceShow, module, navigate]);

  const totalQuestions = useMemo(() => 15, []);

  const optionEntries = useMemo(() => {
    if (!currentQuestion) {
      return [] as Array<{ key: string; label: string; index: number }>;
    }

    return currentQuestion.opts.slice(0, 4).map((option, index) => ({
      key: String.fromCharCode(65 + index),
      label: option.t,
      index,
    }));
  }, [currentQuestion]);

  const handleResultContinue = () => {
    navigate(featureRoute, { replace: true });
  };

  const handlePrevious = () => {
    if (answerHistory.length === 0) {
      return;
    }

    const trimmedHistory = answerHistory.slice(0, -1);
    const previous = answerHistory[answerHistory.length - 1];

    engine.init(module);
    trimmedHistory.forEach((entry) => {
      engine.recordAnswer(entry.question, entry.optionIndex);
    });

    setAnswerHistory(trimmedHistory);
    setCurrentQuestion(previous.question);
    setSelectedValue(previous.optionValue);
    setResultSummary(null);
  };

  const saveAnswer = () => {
    if (!currentQuestion || !selectedValue) {
      return;
    }

    const selectedIndex = optionEntries.find((entry) => entry.key === selectedValue)?.index;
    if (selectedIndex === undefined) {
      return;
    }

    const nextHistory = [
      ...answerHistory,
      {
        question: currentQuestion,
        optionIndex: selectedIndex,
        optionValue: selectedValue,
      },
    ];

    const record = engine.recordAnswer(currentQuestion, selectedIndex);
    setAnswerHistory(nextHistory);

    if (record.stop || nextHistory.length >= totalQuestions) {
      const result = engine.getResult();
      if (!result) {
        return;
      }

      persistEngineState(module, result, nextHistory);
      setResultSummary(buildResultSummary(module, result));
      setCurrentQuestion(null);
      return;
    }

    setCurrentQuestion(engine.nextQuestion());
    setSelectedValue("");
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-white">
        <div className="fixed left-4 top-4 z-50">
          <PageBackButton fallbackTo="/dashboard" label="Dashboard" variant="floating" />
        </div>
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl rounded-[24px] border-2 border-neutral-800 bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] text-center">
            <p className="font-['Poppins:Medium',sans-serif] text-neutral-700">
              Preparing assessment...
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
              <div className="mt-5 rounded-lg border border-neutral-300 p-4 text-left">
                <p className="font-['Poppins:Medium',sans-serif] text-neutral-800">
                  Confidence score: {resultSummary.confidence}%
                </p>
                {resultSummary.showTopTraits ? (
                  <p className="mt-2 font-['Poppins:Regular',sans-serif] text-neutral-600">
                    Top traits: {formatTraitPair(resultSummary.topTraits)}
                  </p>
                ) : null}
              </div>
              {resultSummary.roles.length ? (
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
              Question {answerHistory.length + 1} of {totalQuestions}
            </p>
          </div>

          <motion.div
            key={`${module}-${currentQuestion.id}-${answerHistory.length}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="font-['Poppins:Medium',sans-serif] text-xl text-neutral-800 leading-8">
              {currentQuestion.text}
            </h2>

            <div className="mt-8 px-2">
              <div className="space-y-3">
                {optionEntries.map(({ key, label }) => {
                  const isSelected = selectedValue === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedValue(key)}
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
                        {label}
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
                disabled={answerHistory.length === 0}
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
                Next
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
