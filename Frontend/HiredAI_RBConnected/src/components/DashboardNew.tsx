import { motion, AnimatePresence } from 'motion/react';
import { FileText, Briefcase, MessageSquare, ChevronRight, Download, Plus, Bookmark, MapPin, DollarSign, Clock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import imgImage3 from "figma:asset/3b46c74508bb1126c1fce42aad9b1ac457abfb67.png";
import PageBackButton from './PageBackButton';
import { useAuth } from '../auth/AuthContext';

import { Page } from "../App";


interface DashboardNewProps {
  onNavigate: (page: Page) => void;
}

// Mock data
const recentResumes = [
  { id: '1', name: 'Software Engineer Resume', template: 'Modern Professional', lastEdited: '2 hours ago', atsScore: 92 },
  { id: '2', name: 'Product Manager CV', template: 'Clean Minimal', lastEdited: '1 day ago', atsScore: 88 },
  { id: '3', name: 'Marketing Resume', template: 'Creative Bold', lastEdited: '3 days ago', atsScore: 85 },
];

const recommendedJobs = [
  { id: '1', title: 'Senior Frontend Developer', company: 'TechCorp Inc.', location: 'San Francisco, CA', type: 'Remote', salary: '$120k - $180k', posted: '2 days ago', saved: false },
  { id: '2', title: 'Product Designer', company: 'Design Studio', location: 'New York, NY', type: 'Hybrid', salary: '$100k - $140k', posted: '1 week ago', saved: false },
  { id: '3', title: 'Full Stack Engineer', company: 'StartupXYZ', location: 'Austin, TX', type: 'On-site', salary: '$110k - $150k', posted: '3 days ago', saved: true },
];

export default function DashboardNew({ onNavigate }: DashboardNewProps) {
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set(['3']));
  const { user } = useAuth();
  const navigate = useNavigate();
  const userInitial = (user?.firstName?.[0] || user?.userName?.[0] || user?.email?.[0] || "U").toUpperCase();

  const handleSaveJob = (jobId: string) => {
    setSavedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
        toast.success('Job removed from saved list');
      } else {
        newSet.add(jobId);
        toast.success('Job saved successfully!');
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b-2 border-neutral-800 shadow-sm">
        <div className="max-w-[1728px] mx-auto px-8 sm:px-6 lg:px-90">
          <div className="flex items-center justify-between h-16 lg:h-20">

            <div className="flex items-center gap-3">
              <PageBackButton
                label="Home"
                onClick={() => navigate("/")}
              />
              <motion.button
                onClick={() => onNavigate('home')}
                className="flex items-center gap-0"
                whileHover={{ opacity: 0.8 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-12 h-12 lg:w-56 lg:h-16 rounded-full overflow-hidden flex items-center justify-center">
                  <img src={imgImage3} alt="Hired AI Logo" className="w-full h-full object-cover" />
                </div>
                <span className="font-['Poppins:Bold',sans-serif] text-xl lg:text-3xl text-neutral-800">Hired AI</span>
              </motion.button>
            </div>

            {/* Right Section (UPDATED) */}
            <div className="relative">
              <motion.button
                type="button"
                onClick={() => onNavigate('settings')}
                title={user?.email || "Profile"}
                className="w-10 h-10 rounded-full bg-neutral-200 text-neutral-900 font-['Poppins:Bold',sans-serif] text-sm border border-neutral-400 cursor-pointer"
                whileHover={{ backgroundColor: "rgba(229, 229, 229, 1)" }}
                whileTap={{ scale: 0.96 }}
              >
                {userInitial}
              </motion.button>

               
            </div>

          </div>
        </div>
      </header>

      {/* EVERYTHING BELOW IS 100% UNCHANGED */}
      {/* ... rest of your file stays exactly same ... */}



      {/* Main Content */}
      <div className="pt-16 lg:pt-20">
        <div className="max-w-[1728px] mx-auto">
          <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)]">
            {/* Left Navigation - Desktop */}
            <aside className="hidden lg:block w-80 border-r-2 border-neutral-800 bg-white">
              <nav className="sticky top-20 p-6 space-y-2">
                <NavItem icon={<FileText size={20} />} label="Resume Builder" active onClick={() => onNavigate('resume-builder')} />
                <NavItem icon={<Briefcase size={20} />} label="Job Discovery" onClick={() => onNavigate('jobs')} />
              </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
              {/* Welcome Section */}
              <div>
                <h1 className="font-['Poppins:Bold',sans-serif] text-3xl lg:text-4xl text-neutral-800 mb-2">
                  Welcome back!
                </h1>
                <p className="font-['Poppins:Regular',sans-serif] text-neutral-600">
                  Continue building your career with AI-powered tools
                </p>
              </div>

              {/* Quick Actions - Responsive Grid */}
              <section>
                <h2 className="font-['Poppins:Bold',sans-serif] text-xl lg:text-2xl text-neutral-800 mb-4">
                  Quick Actions
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <QuickActionCard
                    icon={<FileText size={32} />}
                    title="Resume Builder"
                    description="Create ATS-optimized resumes with AI"
                    accentColor="#C8A2FF"
                    onClick={() => onNavigate('jobrole')}
                  />
                  <QuickActionCard
                    icon={<Briefcase size={32} />}
                    title="Job Discovery"
                    description="Find your next opportunity"
                    accentColor="#FF7F7F"
                    onClick={() => onNavigate('jobs')}
                  />
                </div>
              </section>

              {/* Recent Resumes */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-['Poppins:Bold',sans-serif] text-xl lg:text-2xl text-neutral-800">
                    Recent Resumes
                  </h2>
                  <motion.button
                    onClick={() => onNavigate('jobrole')}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg font-['Poppins:Medium',sans-serif]"
                    whileHover={{ scale: 1.03, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Plus size={18} />
                    <span className="hidden sm:inline">New Resume</span>
                  </motion.button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentResumes.map((resume) => (
                    <ResumeCard key={resume.id} resume={resume} />
                  ))}
                </div>
              </section>

              {/* Recommended Jobs */}
              
            </main>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-neutral-800 z-40">
        <div className="grid grid-cols-2 gap-1 p-2">
          <MobileNavItem icon={<FileText size={20} />} label="Resume" onClick={() => onNavigate('jobrole')} />
          <MobileNavItem icon={<Briefcase size={20} />} label="Jobs" onClick={() => onNavigate('jobs')} />
        </div>
      </div>
    </div>
  );
}

// Quick Action Card Component
function QuickActionCard({
  icon,
  title,
  description,
  accentColor,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="relative p-6 bg-white border-2 border-neutral-800 rounded-2xl text-left overflow-hidden group"
      whileHover={{
        scale: 1.03,
        boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      {/* Accent Bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ backgroundColor: accentColor }}
      />

      {/* Icon */}
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: accentColor + '20' }}
      >
        <div style={{ color: accentColor }}>{icon}</div>
      </div>

      {/* Content */}
      <h3 className="font-['Poppins:Bold',sans-serif] text-lg text-neutral-800 mb-2">
        {title}
      </h3>
      <p className="font-['Poppins:Regular',sans-serif] text-sm text-neutral-600">
        {description}
      </p>

      {/* Arrow */}
      <motion.div
        className="absolute bottom-6 right-6"
        initial={{ x: 0 }}
        whileHover={{ x: 4 }}
      >
        <ChevronRight size={24} className="text-neutral-400" />
      </motion.div>
    </motion.button>
  );
}

// Resume Card Component
function ResumeCard({ resume }: { resume: typeof recentResumes[0] }) {
  return (
    <motion.div
      className="p-6 bg-white border-2 border-neutral-800 rounded-xl hover:shadow-lg"
      whileHover={{ scale: 1.02, boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
      transition={{ duration: 0.15 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-['Poppins:Bold',sans-serif] text-base text-neutral-800 mb-1">
            {resume.name}
          </h3>
          <p className="font-['Poppins:Regular',sans-serif] text-sm text-neutral-500">
            {resume.template}
          </p>
        </div>
        <motion.button
          className="p-2 rounded-lg cursor-default"
          whileHover={{ scale: 1 }}
          whileTap={{ scale: 1 }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Download size={18} className="text-neutral-600" />
        </motion.button>
      </div>

      {/* ATS Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-['Poppins:Medium',sans-serif] text-xs text-neutral-600">
            ATS Score
          </span>
          <span className="font-['Poppins:Bold',sans-serif] text-sm text-green-600">
            {resume.atsScore}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${resume.atsScore}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {resume.lastEdited}
        </span>
        <ChevronRight size={16} className="text-neutral-400" />
      </div>
    </motion.div>
  );
}

// Job Card Component
function JobCard({
  job,
  isSaved,
  onSave,
  onNavigate,
}: {
  job: typeof recommendedJobs[0];
  isSaved: boolean;
  onSave: () => void;
  onNavigate: (page: Page) => void;
}) {
  return (
    <motion.div
      className="p-4 sm:p-6 bg-white border-2 border-neutral-800 rounded-xl hover:shadow-lg cursor-pointer"
      whileHover={{ scale: 1.01, boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
      transition={{ duration: 0.15 }}
      onClick={() => onNavigate('jobs')}
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
          <div className="flex flex-wrap gap-3 text-sm text-neutral-600">
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

          <p className="mt-3 text-xs text-neutral-500">Posted {job.posted}</p>
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col gap-2">
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className={`p-2 rounded-lg border-2 ${
              isSaved ? 'bg-purple-50 border-purple-400' : 'bg-white border-neutral-300'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Bookmark
              size={20}
              className={isSaved ? 'text-purple-600 fill-purple-600' : 'text-neutral-600'}
            />
          </motion.button>
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              toast.success('Application opened!');
            }}
            className="px-4 py-2 bg-black text-white rounded-lg font-['Poppins:Medium',sans-serif] text-sm whitespace-nowrap"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            Apply
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// Navigation Item
function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-['Poppins:Medium',sans-serif] text-left transition-colors ${
        active
          ? 'bg-neutral-800 text-white'
          : 'text-neutral-800 hover:bg-gray-100'
      }`}
      whileHover={{ x: active ? 0 : 4 }}
      whileTap={{ scale: 0.98 }}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}

// Mobile Nav Item
function MobileNavItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="flex flex-col items-center justify-center py-2 px-1 rounded-lg hover:bg-gray-100"
      whileTap={{ scale: 0.95 }}
    >
      <div className="text-neutral-800">{icon}</div>
      <span className="text-xs font-['Poppins:Medium',sans-serif] text-neutral-800 mt-1">
        {label}
      </span>
    </motion.button>
  );
}
