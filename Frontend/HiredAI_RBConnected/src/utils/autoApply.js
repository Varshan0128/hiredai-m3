export const processJobs = async (jobs) => {
  const normalizedJobs = Array.isArray(jobs) ? jobs : [];

  console.log("Processing jobs for auto-apply...");

  for (const job of normalizedJobs) {
    const title = String(job?.title ?? job?.job_title ?? job?.role ?? "").trim();

    console.log("Applying to:", title || "Untitled job");

    // Example integration hook:
    // filter relevant jobs
    // prepare apply payload

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};
