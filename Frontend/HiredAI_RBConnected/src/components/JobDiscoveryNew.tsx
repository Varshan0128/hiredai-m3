import { motion } from 'motion/react';
import {
  Search,
  Filter,
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  Bookmark,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';
import PageBackButton from './PageBackButton';

import { Page } from "../App";

interface JobDiscoveryNewProps {
  onNavigate: (page: Page) => void;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  link?: string;
  type: 'Remote' | 'Hybrid' | 'On-site';
  salary: string;
  experience: string;
  posted: string;
  description: string;
  requirements: string[];
  saved: boolean;
}

interface StoredJobData {
  role?: string;
  skills?: string[];
  jobs?: unknown[];
}

function inferJobType(job: Record<string, unknown>): Job['type'] {
  const source = `${job.type ?? job.job_type ?? job.workplace ?? job.work_mode ?? job['Employment Type'] ?? ""}`.toLowerCase();
  if (source.includes('hybrid')) return 'Hybrid';
  if (source.includes('on-site') || source.includes('onsite') || source.includes('office')) return 'On-site';
  return 'Remote';
}

function normalizeJob(job: unknown, index: number): Job | null {
  if (!job || typeof job !== 'object') return null;

  const record = job as Record<string, unknown>;
  const title = String(record.title ?? record.job_title ?? record.role ?? record['Job Title'] ?? '').trim();
  const company = String(record.company ?? record.company_name ?? record.employer ?? record['Query'] ?? record['Category'] ?? 'Unknown Company').trim();

  if (!title) return null;

  const location = String(record.location ?? record.job_location ?? record.city ?? record['Category'] ?? 'Location not specified').trim();
  const salary = String(record.salary ?? record.salary_range ?? record.compensation ?? 'Not specified').trim();
  const experience = String(record.experience ?? record.experience_level ?? record.seniority ?? record['Experience'] ?? record['Experience Level'] ?? 'Not specified').trim();
  const posted = String(record.posted ?? record.posted_at ?? record.date_posted ?? 'Recently').trim();
  const description = String(record.description ?? record.summary ?? record.job_description ?? record['Description'] ?? 'No description available.').trim();
  const requirements = Array.isArray(record.requirements)
    ? record.requirements.map((value) => String(value).trim()).filter(Boolean)
    : Array.isArray(record.skills)
      ? record.skills.map((value) => String(value).trim()).filter(Boolean)
      : `${record['IT Skills'] ?? ''},${record['Soft Skills'] ?? ''}`
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

  return {
    id: String(record.id ?? record.job_id ?? record.link ?? record.url ?? record['ID'] ?? `${title}-${index}`),
    title,
    company,
    location,
    link: String(record.link ?? record.url ?? "").trim() || undefined,
    type: inferJobType(record),
    salary,
    experience,
    posted,
    description,
    requirements,
    saved: false,
  };
}

function readStoredJobData(): StoredJobData | unknown[] | null {
  try {
    const raw = localStorage.getItem('jobData');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredJobData | unknown[];
    return parsed;
  } catch {
    return null;
  }
}

export default function JobDiscoveryNew({ onNavigate }: JobDiscoveryNewProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [hasJobData, setHasJobData] = useState(false);
  
  // Filter states
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState<string[]>([]);
  const [salaryRange, setSalaryRange] = useState([0, 200]);

  useEffect(() => {
    console.log("➡️ Jobs page loaded");
    const storedData = readStoredJobData();
    console.log('Stored Data:', localStorage.getItem('jobData'));
    const rawJobs = Array.isArray(storedData)
      ? storedData
      : Array.isArray(storedData?.jobs)
        ? storedData.jobs
        : [];
    const storedJobs = Array.isArray(rawJobs)
      ? rawJobs.map(normalizeJob).filter((job): job is Job => job !== null)
      : [];

    setJobs(storedJobs);
    setHasJobData(storedJobs.length > 0);
  }, []);

  const handleSaveJob = (jobId: string) => {
    setJobs(
      jobs.map((job) =>
        job.id === jobId ? { ...job, saved: !job.saved } : job
      )
    );
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      toast.success(job.saved ? 'Job removed from saved list' : 'Job saved successfully!');
    }
  };

  const handleApply = (job: Job) => {
    if (job.link) {
      window.open(job.link, '_blank', 'noopener,noreferrer');
      toast.success(`Application opened for ${job.title}!`, {
        description: 'Good luck with your application!',
      });
      return;
    }

    toast.error('Application link is not available for this job.');
  };

  const filteredJobs = useMemo(() => (
    jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(job.type);
      return matchesSearch && matchesType;
    })
  ), [jobs, searchQuery, selectedTypes]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b-2 border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative py-4 lg:py-5">
            {/* Back Button */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2">
              <PageBackButton fallbackTo="/dashboard" label="Dashboard" />
            </div>

            {/* Title */}
            <div className="flex flex-col items-center justify-center text-center mt-4 mb-6">
              <h1 className="text-2xl font-semibold text-neutral-800">
                Job Discovery
              </h1>
            </div>

            {/* Saved Count */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Bookmark size={20} className="text-purple-600" />
              <span className="font-['Poppins:Bold',sans-serif] text-neutral-800">
                {jobs.filter((j) => j.saved).length}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-36 lg:pt-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Search & Filters Bar */}
          <div className="mb-6 space-y-4">
            <div className="flex gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search jobs by title or company..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-neutral-300 rounded-lg font-['Poppins:Regular',sans-serif] focus:border-neutral-800 focus:outline-none transition-colors"
                />
              </div>

              {/* Filter Button - Mobile */}
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <motion.button
                    className="lg:hidden flex items-center gap-2 px-4 py-3 bg-neutral-800 text-white rounded-lg font-['Poppins:Medium',sans-serif]"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Filter size={20} />
                    Filters
                  </motion.button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <SheetTitle className="font-['Poppins:Bold',sans-serif]">
                      Filters
                    </SheetTitle>
                  </SheetHeader>
                  <FilterPanel
                    selectedTypes={selectedTypes}
                    setSelectedTypes={setSelectedTypes}
                    selectedExperience={selectedExperience}
                    setSelectedExperience={setSelectedExperience}
                    salaryRange={salaryRange}
                    setSalaryRange={setSalaryRange}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Filters Panel - Desktop */}
            <aside className="hidden lg:block w-80 shrink-0">
              <div className="sticky top-24 p-6 bg-white border-2 border-neutral-800 rounded-2xl">
                <h3 className="font-['Poppins:Bold',sans-serif] text-lg text-neutral-800 mb-6">
                  Filters
                </h3>
                <FilterPanel
                  selectedTypes={selectedTypes}
                  setSelectedTypes={setSelectedTypes}
                  selectedExperience={selectedExperience}
                  setSelectedExperience={setSelectedExperience}
                  salaryRange={salaryRange}
                  setSalaryRange={setSalaryRange}
                />
              </div>
            </aside>

            {/* Job List */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="font-['Poppins:Medium',sans-serif] text-neutral-600">
                  {filteredJobs.length} jobs found
                </p>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="p-12 bg-white border-2 border-neutral-300 border-dashed rounded-2xl text-center">
                  <p className="font-['Poppins:Medium',sans-serif] text-neutral-600">
                    {hasJobData
                      ? 'No jobs found based on your resume'
                      : 'Upload a resume to see AI-powered job matches.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredJobs.map((job, index) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      index={index}
                      onSave={() => handleSaveJob(job.id)}
                      onClick={() => setSelectedJob(job)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Job Detail Modal */}
      <Dialog open={selectedJob !== null} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="font-['Poppins:Bold',sans-serif] text-2xl">
                  {selectedJob.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Company Info */}
                <div>
                  <h3 className="font-['Poppins:Bold',sans-serif] text-lg text-neutral-800 mb-2">
                    {selectedJob.company}
                  </h3>
                  <div className="flex flex-wrap gap-3 text-sm text-neutral-600">
                    <span className="flex items-center gap-1">
                      <MapPin size={16} />
                      {selectedJob.location}
                    </span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-['Poppins:Medium',sans-serif]">
                      {selectedJob.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={16} />
                      {selectedJob.salary}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase size={16} />
                      {selectedJob.experience}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-['Poppins:Bold',sans-serif] text-neutral-800 mb-2">
                    Description
                  </h4>
                  <p className="font-['Poppins:Regular',sans-serif] text-neutral-700">
                    {selectedJob.description}
                  </p>
                </div>

                {/* Requirements */}
                <div>
                  <h4 className="font-['Poppins:Bold',sans-serif] text-neutral-800 mb-3">
                    Requirements
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.requirements.map((req) => (
                      <span
                        key={req}
                        className="px-3 py-1 bg-gray-100 text-neutral-800 rounded-full font-['Poppins:Medium',sans-serif] text-sm"
                      >
                        {req}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <motion.button
                    onClick={() => handleSaveJob(selectedJob.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg border-2 font-['Poppins:Medium',sans-serif] ${
                      selectedJob.saved
                        ? 'bg-purple-50 border-purple-400 text-purple-700'
                        : 'bg-white border-neutral-800 text-neutral-800'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Bookmark
                      size={20}
                      className={selectedJob.saved ? 'fill-purple-600' : ''}
                    />
                    {selectedJob.saved ? 'Saved' : 'Save Job'}
                  </motion.button>
                  <motion.button
                    onClick={() => handleApply(selectedJob)}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-['Poppins:Bold',sans-serif]"
                    whileHover={{ scale: 1.02, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Apply Now
                    <ExternalLink size={18} />
                  </motion.button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Job Card Component
function JobCard({
  job,
  index,
  onSave,
  onClick,
}: {
  job: Job;
  index: number;
  onSave: () => void;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="p-6 bg-white border-2 border-neutral-300 rounded-xl hover:border-neutral-800 hover:shadow-lg cursor-pointer transition-all"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Content */}
        <div className="flex-1">
          <h3 className="font-['Poppins:Bold',sans-serif] text-lg text-neutral-800 mb-2">
            {job.title}
          </h3>
          <p className="font-['Poppins:Medium',sans-serif] text-neutral-600 mb-3">
            {job.company}
          </p>

          {/* Job Details */}
          <div className="flex flex-wrap gap-3 text-sm text-neutral-600 mb-3">
            <span className="flex items-center gap-1">
              <MapPin size={14} />
              {job.location}
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-['Poppins:Medium',sans-serif]">
              {job.type}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign size={14} />
              {job.salary}
            </span>
          </div>

          <p className="text-xs text-neutral-500 flex items-center gap-1">
            <Clock size={12} />
            Posted {job.posted}
          </p>
        </div>

        {/* Save Button */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className={`p-3 rounded-lg border-2 transition-colors ${
            job.saved
              ? 'bg-purple-50 border-purple-400'
              : 'bg-white border-neutral-300 hover:border-neutral-800'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Bookmark
            size={20}
            className={job.saved ? 'text-purple-600 fill-purple-600' : 'text-neutral-600'}
          />
        </motion.button>
      </div>
    </motion.div>
  );
}

// Filter Panel Component
function FilterPanel({
  selectedTypes,
  setSelectedTypes,
  selectedExperience,
  setSelectedExperience,
  salaryRange,
  setSalaryRange,
}: any) {
  const jobTypes = ['Remote', 'Hybrid', 'On-site'];
  const experienceLevels = ['Entry Level', 'Mid Level', 'Senior', 'Lead'];

  const toggleType = (type: string) => {
    setSelectedTypes((prev: string[]) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleExperience = (level: string) => {
    setSelectedExperience((prev: string[]) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  return (
    <div className="space-y-6">
      {/* Job Type */}
      <div>
        <h4 className="font-['Poppins:Bold',sans-serif] text-sm text-neutral-800 mb-3">
          Job Type
        </h4>
        <div className="space-y-2">
          {jobTypes.map((type) => (
            <label
              key={type}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <Checkbox
                checked={selectedTypes.includes(type)}
                onCheckedChange={() => toggleType(type)}
              />
              <span className="font-['Poppins:Regular',sans-serif] text-sm text-neutral-700 group-hover:text-neutral-900">
                {type}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Experience Level */}
      <div>
        <h4 className="font-['Poppins:Bold',sans-serif] text-sm text-neutral-800 mb-3">
          Experience Level
        </h4>
        <div className="space-y-2">
          {experienceLevels.map((level) => (
            <label
              key={level}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <Checkbox
                checked={selectedExperience.includes(level)}
                onCheckedChange={() => toggleExperience(level)}
              />
              <span className="font-['Poppins:Regular',sans-serif] text-sm text-neutral-700 group-hover:text-neutral-900">
                {level}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Salary Range */}
      <div>
        <h4 className="font-['Poppins:Bold',sans-serif] text-sm text-neutral-800 mb-3">
          Salary Range ($ thousands)
        </h4>
        <div className="space-y-3">
          <Slider
            value={salaryRange}
            onValueChange={setSalaryRange}
            min={0}
            max={200}
            step={10}
            className="w-full"
          />
          <div className="flex items-center justify-between text-sm text-neutral-600 font-['Poppins:Medium',sans-serif]">
            <span>${salaryRange[0]}k</span>
            <span>${salaryRange[1]}k</span>
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      <motion.button
        onClick={() => {
          setSelectedTypes([]);
          setSelectedExperience([]);
          setSalaryRange([0, 200]);
        }}
        className="w-full px-4 py-2 bg-gray-100 text-neutral-800 rounded-lg font-['Poppins:Medium',sans-serif] hover:bg-gray-200"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Clear All Filters
      </motion.button>
    </div>
  );
}
