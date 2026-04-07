import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const PROCESSING_STEPS = [
  "Uploading resume...",
  "Extracting skills...",
  "Analyzing job role...",
  "Calculating demand...",
  "Matching similar jobs...",
  "Finalizing insights...",
];

const TOTAL_DURATION_MS = 6000;
const STEP_DURATION_MS = 1000;

export default function ResumeProcessing() {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const completedSteps = useMemo(
    () => PROCESSING_STEPS.map((_, index) => index < currentStep),
    [currentStep],
  );

  useEffect(() => {
    console.log("🔥 PROCESSING PAGE MOUNTED");

    if (hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    console.log("➡️ Processing screen loaded");

    const stepInterval = window.setInterval(() => {
      setCurrentStep((value) =>
        value < PROCESSING_STEPS.length - 1 ? value + 1 : value,
      );
    }, STEP_DURATION_MS);

    const progressInterval = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          return 100;
        }

        return Math.min(value + 100 / (TOTAL_DURATION_MS / 100), 100);
      });
    }, 100);

    const timeout = window.setTimeout(() => {
      console.log("Processing done → going to jobs");
      navigate("/jobs");
    }, TOTAL_DURATION_MS);

    return () => {
      window.clearInterval(stepInterval);
      window.clearInterval(progressInterval);
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-full max-w-2xl">
          <div className="text-center">
            <h1 className="font-['Poppins:Bold',sans-serif] text-3xl text-neutral-800">
              Analyzing your resume...
            </h1>
            <p className="mt-2 font-['Poppins:Regular',sans-serif] text-neutral-600">
              Our AI is preparing your insights
            </p>
          </div>

          <div className="mt-10 flex justify-center">
            <motion.div
              className="h-14 w-14 rounded-full border-4 border-neutral-200 border-t-black"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-sm font-['Poppins:Medium',sans-serif] text-neutral-700">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="h-full bg-black"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-neutral-200 p-5">
            <AnimatePresence mode="wait">
              <motion.p
                key={PROCESSING_STEPS[currentStep]}
                className="text-center font-['Poppins:Medium',sans-serif] text-neutral-800"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {PROCESSING_STEPS[currentStep]}
              </motion.p>
            </AnimatePresence>

            <div className="mt-6 space-y-3">
              {PROCESSING_STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isComplete = completedSteps[index];

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-3 text-sm transition-colors ${
                      isActive
                        ? "text-black"
                        : isComplete
                          ? "text-neutral-700"
                          : "text-neutral-400"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                        isComplete || isActive
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 bg-white text-neutral-400"
                      }`}
                    >
                      {isComplete ? "✓" : index + 1}
                    </div>
                    <span
                      className={`font-['Poppins:Regular',sans-serif] ${
                        isActive ? "font-semibold" : ""
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
