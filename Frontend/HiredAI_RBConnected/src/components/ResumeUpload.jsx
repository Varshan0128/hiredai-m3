import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageBackButton from "./PageBackButton";
import { processJobs } from "../utils/autoApply";

const acceptedExtensions = [".pdf", ".doc", ".docx"];
const PYTHON_BASE_URL = (
  import.meta.env.VITE_PYTHON_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");
function isSupportedFile(file) {
  const lowerName = file.name.toLowerCase();
  return acceptedExtensions.some((extension) => lowerName.endsWith(extension));
}

export default function ResumeUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [autoApplyStatus, setAutoApplyStatus] = useState("");

  const handleUpload = async (file) => {
    if (!file) return;

    if (!isSupportedFile(file)) {
      setError("Please upload a PDF, DOC, or DOCX file.");
      return;
    }

    try {
      setIsUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      const res1 = await fetch(`${PYTHON_BASE_URL}/jobs-from-resume`, {
        method: "POST",
        body: formData,
      });

      if (!res1.ok) {
        const err = await res1.text();
        throw new Error("JOBS ERROR: " + err);
      }

      const data1 = await res1.json();
      const jobs = data1?.jobs || [];
      console.log("JOBS:", jobs);

      localStorage.removeItem("jobData");
      localStorage.setItem("jobData", JSON.stringify(jobs));
      localStorage.setItem("resumeAnalysis", JSON.stringify(data1));
      localStorage.setItem("resumeUploaded", "true");

      try {
        setAutoApplyStatus("Analyzing jobs...");
        localStorage.setItem("autoApplyStatus", "Analyzing jobs...");
        processJobs(jobs);
        setAutoApplyStatus("Auto Apply Ready");
        localStorage.setItem("autoApplyStatus", "Auto Apply Ready");
      } catch (processingError) {
        console.error("AUTO APPLY PROCESSING ERROR:", processingError);
        setAutoApplyStatus("Auto Apply Failed");
        localStorage.setItem("autoApplyStatus", "Auto Apply Failed");
      }

      console.log("Stored Data:", localStorage.getItem("jobData"));
      console.log("➡️ Upload complete → going to processing");
      navigate("/resume-processing");
      return;
    } catch (err) {
      console.error("ERROR:", err);
      setError("Unable to process the resume right now.");
      setIsUploading(false);
      setAutoApplyStatus("Auto Apply Failed");
      localStorage.setItem("autoApplyStatus", "Auto Apply Failed");
    }
  };

  const handleFileChange = async (file) => {
    await handleUpload(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed left-4 top-4 z-50">
        <PageBackButton fallbackTo="/dashboard" label="Dashboard" variant="floating" />
      </div>

      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-[24px] border-2 border-neutral-800 bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
          <div className="text-center mb-8">
            <h1 className="font-['Poppins:Bold',sans-serif] text-3xl text-neutral-800">
              Upload Your Resume
            </h1>
            <p className="mt-2 font-['Poppins:Regular',sans-serif] text-neutral-600">
              Get AI-powered job matches
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Upload a Resume
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files?.[0])}
            />
          </div>

          {error ? (
            <p className="mt-4 text-center font-['Poppins:Regular',sans-serif] text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
