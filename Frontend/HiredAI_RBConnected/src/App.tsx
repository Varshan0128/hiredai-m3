import { motion } from "motion/react";
import svgPaths from "./imports/svg-9y28g0x8it";
import imgImage3 from "figma:asset/3b46c74508bb1126c1fce42aad9b1ac457abfb67.png";
import imgScreenshot20221208At739 from "figma:asset/8ec9b849fa5dc073bb1e2f71472829be40df09cd.png";
import imgScreenshot20221208At740 from "figma:asset/46c46ec047a9193f42de1af0a69bab60f47b1a7e.png";
import imgScreenshot20221208At742 from "figma:asset/ae647588c05e5ee23168bf9ee9df946bee2b71d9.png";
import imgImg20251107Wa0001Png from "figma:asset/7fa86d10fe7a100691ba4868621b02ba4faa4ef4.png";
import imgImage11 from "figma:asset/a2b703d040bce791f675dd7cf6885d1036fd2231.png";
import imgImage16 from "figma:asset/bfe47dbcf76bf0f8f9a9c89a602b19a8377e934a.png";
import imgImage13 from "figma:asset/ff481aec25cbcbc343f678835274251cf1ee61e3.png";
import imgImage12 from "figma:asset/74fdb8e6d8e3ae9ce9275167f87a0e76b123410a.png";
import imgImage17 from "figma:asset/b11efd7ca7fd477a27f50cd23595b58d46569a32.png";
import imgImage19 from "figma:asset/856140275db9caf7503f19c7bd56c6dcbd234be3.png";
import imgImage15 from "figma:asset/9e4c9c71df24135cc9a1913a0a704372dbf6510f.png";
import imgImage14 from "figma:asset/5027334901ff10dbe245131ace98997a6e75ff70.png";
import imgImage18 from "figma:asset/824a519fbb36e79fc76bb0720c136704d19d3157.png";
import imgImage20 from "figma:asset/687ffefdae64b24f6cba5ff8038cd899fe3aaa85.png";
import imgImage22 from "figma:asset/ff079a30a3fb9f9e7116747f45b055da957767e5.png";
import imgImage21 from "figma:asset/156167b22f1edaa82fa5d3d9b68b6c0c7b09ae8b.png";
import imgImage24 from "figma:asset/c529100d210b1482a7a4ebb4b77d7f53928df70b.png";
import imgImage23 from "figma:asset/0ff0b3a98e0d021aa8ba7e5bc21bcd7a82257d18.png";
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import SignInPage from "./components/SignInPage";
import LogInPage from "./components/LogInPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import VerifyOtpPage from "./components/VerifyOtpPage";
import ResumeBuilder1 from "./components/ResumeBuilder1";
import ResumeBuilder2 from "./components/ResumeBuilder2";
import ResumeBuilder3 from "./components/ResumeBuilder3";
import DashboardNew from "./components/DashboardNew";
import TemplateSelectionNew from "./components/TemplateSelectionNew";
import ResumeEditor from "./components/ResumeEditor";
import ResumeResults from "./components/ResumeResults";
import JobDiscoveryNew from "./components/JobDiscoveryNew";
import ResumeUpload from "./components/ResumeUpload";
import ResumeProcessing from "./components/ResumeProcessing";
import PsychometricFlow from "./components/PsychometricFlow";
import { Toaster } from "sonner";
import SettingsMain from "./components/SettingsMain";
import ResumeBuilderApp from "./resume-builder/ResumeBuilderApp";
import OAuthSuccess from "./components/OAuthSuccess";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import {
  type PsychometricModule,
  getPsychometricRoute,
  isPsychometricComplete,
} from "./utils/psychometric";

export type Page = string;
const EXPLORE_SCROLL_NAV_EVENT = "hired-ai:explore-scroll-nav";

if (import.meta.env.DEV) {
  const forceReset = false;

  if (forceReset) {
    localStorage.removeItem("psychometric_job_completed");
    localStorage.removeItem("psychometric_resume_completed");
  }
}

function RouteScrollManager() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function PsychometricFeatureRoute({
  module,
  element,
}: {
  module: PsychometricModule;
  element: JSX.Element;
}) {
  if (!isPsychometricComplete(module)) {
    return <Navigate to={getPsychometricRoute(module)} replace />;
  }

  return element;
}

function JobsRoute({
  element,
}: {
  element: JSX.Element;
}) {
  const hasJobPsychometric = isPsychometricComplete("job_discovery");
  const hasResumeAnalysis = Boolean(localStorage.getItem("resumeAnalysis"));

  if (!hasJobPsychometric) {
    return <Navigate to="/psychometric/job" replace />;
  }

  if (!hasResumeAnalysis) {
    return <Navigate to="/upload-resume" replace />;
  }

  return element;
}

function JobDiscoveryUploadRoute({
  element,
}: {
  element: JSX.Element;
}) {
  if (!isPsychometricComplete("job_discovery")) {
    return <Navigate to="/psychometric/job" replace />;
  }

  return element;
}

export default function App() {
  const navigate = useNavigate();
  const { isAuthenticated, status } = useAuth();

  const navigateWithLog = (route: string) => {
    console.log("Navigating to:", route);
    navigate(route);
  };

  const handleResumeBuilderClick = () => {
    console.log("Navigating to psychometric first");
    navigateWithLog("/psychometric/resume");
  };

  const handleJobDiscoveryClick = () => {
    console.log("Navigating to psychometric first");
    navigateWithLog("/psychometric/job");
  };

  const handleNavigate = (page: string) => {
    if (page === "home") {
      navigateWithLog("/");
      return;
    }

    if (
      page === "resume-builder" ||
      page === "jobrole" ||
      page === "upload-resume"
    ) {
      handleResumeBuilderClick();
      return;
    }

    if (page === "job-discovery" || page === "jobs") {
      handleJobDiscoveryClick();
      return;
    }

    navigateWithLog(`/${page}`);
  };

  return (
    <div className="w-full h-full bg-white">
        <RouteScrollManager />
        <Routes>
            <Route path="/" element={<HomePage onNavigate={handleNavigate} />} />
            <Route path="/signin" element={<SignInPage onNavigate={handleNavigate} />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage onNavigate={handleNavigate} />} />
            <Route path="/verify-otp" element={<VerifyOtpPage onNavigate={handleNavigate} />} />
            <Route
              path="/login"
              element={
                status === "loading" ? (
                  <div className="min-h-screen grid place-items-center text-neutral-700">Checking authentication...</div>
                ) : isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LogInPage onNavigate={handleNavigate} />
                )
              }
            />
            <Route path="/psychometric/resume" element={<PsychometricFlow module="resume_builder" />} />
            <Route path="/psychometric/job" element={<PsychometricFlow module="job_discovery" />} />
             
            <Route
              path="/jobrole/*"
              element={
                <PsychometricFeatureRoute
                  module="resume_builder"
                  element={<ResumeBuilderApp />}
                />
              }
            />
            <Route
              path="/resume-builder/*"
              element={
                <PsychometricFeatureRoute
                  module="resume_builder"
                  element={<ResumeBuilderApp />}
                />
              }
            />
             
            <Route path="/templates" element={<Navigate to="/resume-builder" replace />} />
            <Route path="/editor" element={<ResumeEditor onNavigate={handleNavigate} />} />
            
            <Route path="/resume1" element={<ResumeBuilder1 onNavigate={handleNavigate} />} />
            <Route path="/resume2" element={<ResumeBuilder2 onNavigate={handleNavigate} />} />
            <Route path="/resume3" element={<ResumeBuilder3 onNavigate={handleNavigate} />} />
            
            <Route path="/results" element={<ResumeResults onNavigate={handleNavigate} />} />
            <Route
              path="/upload-resume"
              element={
                <JobDiscoveryUploadRoute
                  element={<ResumeUpload />}
                />
              }
            />
            <Route
              path="/resume-processing"
              element={
                <JobDiscoveryUploadRoute
                  element={<ResumeProcessing />}
                />
              }
            />
            <Route
              path="/jobs"
              element={
                <JobsRoute
                  element={<JobDiscoveryNew onNavigate={handleNavigate} />}
                />
              }
            />
            <Route path="/settings" element={<SettingsMain onNavigate={handleNavigate} />} />
            <Route path="/oauth-success" element={<OAuthSuccess />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardNew onNavigate={handleNavigate} />} />
            </Route>
        </Routes>
        <Toaster />
    </div>
  );
}
// Home Page Component
function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      {/* Fixed Navigation */}
      <NavBar onNavigate={onNavigate} />

      {/* Hero Section */}
      <section className="relative bg-[#f6f6f4] pt-20 sm:pt-24 lg:pt-32 xl:pt-36 pb-16 sm:pb-20 lg:pb-28 xl:pb-32 px-4 sm:px-6 lg:px-8 min-h-[600px] sm:min-h-[700px] lg:min-h-[800px] xl:min-h-[900px]">
        <div className="max-w-[1728px] mx-auto relative h-full">
          <div className="max-w-xl sm:max-w-2xl lg:max-w-3xl xl:max-w-[900px] relative z-10 pt-8 lg:pt-16 xl:pt-20">
            <motion.h1
              className="font-['Poppins:Bold',sans-serif] text-4xl sm:text-5xl lg:text-6xl xl:text-[72px] leading-[1.15] tracking-[0.01em] text-neutral-800 mb-6 lg:mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Build. Prepare. Get Hired.
            </motion.h1>
            <motion.p
              className="font-['Poppins:Medium',sans-serif] text-lg sm:text-xl xl:text-[22px] leading-[1.65] tracking-[0.01em] text-[#414141] mb-8 lg:mb-10 max-w-[800px]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Your AI-powered career partner — from building resumes to
              mastering interviews and landing real jobs
            </motion.p>

            {/* CTA Button */}
            <div className="flex flex-wrap gap-4">
                <motion.button
                  onClick={() => onNavigate('dashboard')}
                  className="bg-black text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-['Poppins:Bold',sans-serif] text-base sm:text-lg cursor-pointer border border-black"
                  whileHover={{ scale: 1.03, boxShadow: "0 12px 24px rgba(0, 0, 0, 0.3)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  Get Started Free
                </motion.button>

            <motion.button
                  onClick={() => {
                    const section = document.getElementById("explore");
                    section?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-['Poppins:Bold',sans-serif] text-base sm:text-lg text-neutral-800 border-2 border-neutral-800 cursor-pointer"
                  whileHover={{ scale: 1.03, backgroundColor: "rgba(0, 0, 0, 0.05)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  Learn More
                </motion.button>
              </div>
          </div>

          {/* Hero Cards - Tablet and Desktop Only */}
          <HeroCards />
        </div>
      </section>

      {/* Companies Scroll */}
      <CompanyLogosScroll />
      
      
      {/* Explore Section */}
<section
  id="explore"
  className="py-16 sm:py-20 lg:py-24 bg-white scroll-mt-[100px] lg:scroll-mt-[120px]"
>
        <motion.h2
            className="font-['Poppins:Bold',sans-serif] text-4xl sm:text-5xl lg:text-6xl xl:text-[64px] leading-[1.2] tracking-[0.02em] text-neutral-800 mb-8 lg:mb-12 text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Explore Hired AI
          </motion.h2>
          
          <ExploreCards />
        
      </section>

      {/* Tagline Section */}
      <TaglineSection />


      

      <Footer />
    </div>
  );
}
function NavBar({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { status, isAuthenticated, user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const userInitial = (user?.firstName?.[0] || user?.userName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const headerOffset = 100;

  const requestPageScroll = (targetTop: number) => {
    const normalizedTarget = Math.max(targetTop, 0);

    window.dispatchEvent(
      new CustomEvent(EXPLORE_SCROLL_NAV_EVENT, {
        detail: { targetTop: normalizedTarget },
      }),
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: normalizedTarget, behavior: "smooth" });
      });
    });
  };

  const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    const targetTop =
      el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    requestPageScroll(targetTop);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onNavigate("home");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b-2 border-neutral-800">
      <div className="max-w-[1728px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 lg:h-[93px]">
          {/* Logo */}
          <button
            onClick={() => requestPageScroll(0)}
            className="flex items-center gap-0 sm:gap-2 shrink-0"
          >
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 xl:w-[13px] xl:h-[119px]">
              <img
                alt="Hired AI Logo"
                className="w-full h-full object-cover"
                src={imgImage3}
              />
            </div>
            <p className="font-['Poppins:Bold',sans-serif] text-2xl sm:text-3xl lg:text-4xl xl:text-[48px] text-neutral-800 whitespace-nowrap">
              Hired AI
            </p>
          </button>

          {/* Navigation Items - Desktop */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-3">
            <motion.button
              onClick={() => {
                requestPageScroll(0);
              }}
              className="backdrop-blur-[52.5px] backdrop-filter px-4 xl:px-6 py-2 xl:py-3 rounded-lg 
  font-['Poppins:Medium',sans-serif] text-lg xl:text-[20px] text-neutral-800 
  cursor-pointer transition-colors"
              whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
              whileTap={{ scale: 0.95 }}
            >
              Home
            </motion.button>

            <motion.button
  onClick={() => {
    scrollToElement("explore");
  }}
  className="backdrop-blur-[52.5px] backdrop-filter px-4 xl:px-6 py-2 xl:py-3 rounded-lg font-['Poppins:Medium',sans-serif] text-lg xl:text-[20px] text-neutral-800 cursor-pointer transition-colors"
  whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
  whileTap={{ scale: 0.95 }}
>
  Explore
</motion.button>

            

            <motion.button
              onClick={() => {
                scrollToElement("contact");
              }}
              className="backdrop-blur-[52.5px] backdrop-filter px-4 xl:px-6 py-2 xl:py-3 rounded-lg 
  font-['Poppins:Medium',sans-serif] text-lg xl:text-[20px] text-neutral-800 
  cursor-pointer transition-colors"
              whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
              whileTap={{ scale: 0.95 }}
            >
              Contact us
            </motion.button>

            {status !== "loading" &&
              (isAuthenticated ? (
                <>
                  <button
                    key="auth-profile"
                    type="button"
                    onClick={() => onNavigate("settings")}
                    title={user?.email || "Profile"}
                    className="w-10 h-10 rounded-full bg-neutral-200 text-neutral-900 font-['Poppins:Bold',sans-serif] text-sm border border-neutral-400 cursor-pointer"
                  >
                    {userInitial}
                  </button>
                  <motion.button
                    key="auth-logout"
                    onClick={() => void handleLogout()}
                    disabled={isLoggingOut}
                    className="px-4 xl:px-6 py-2 xl:py-3 rounded-lg font-['Poppins:Bold',sans-serif] text-lg xl:text-[18px] cursor-pointer border border-neutral-800 text-neutral-800 disabled:opacity-60"
                    whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    key="guest-signup"
                    onClick={() => onNavigate("signin")}
                    className="px-6 xl:px-8 py-2 xl:py-3 rounded-lg font-['Poppins:Bold',sans-serif] text-lg xl:text-[18px] cursor-pointer border border-neutral-800 text-neutral-800"
                    whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Sign up
                  </motion.button>
                  <motion.button
                    key="guest-login"
                    onClick={() => onNavigate("login")}
                    className="bg-black text-white px-6 xl:px-8 py-2 xl:py-3 rounded-lg font-['Poppins:Bold',sans-serif] text-lg xl:text-[18px] cursor-pointer border border-black"
                    whileHover={{
                      scale: 1.03,
                      boxShadow: "0 12px 24px rgba(0, 0, 0, 0.3)",
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Login
                  </motion.button>
                </>
              ))}
          </div>

          {/* Mobile Menu Button */}
          <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

function HeroCards() {
  const [frontIndex, setFrontIndex] = useState(2);

  // 🔁 Infinite card rotation (ONLY change)
  useEffect(() => {
    const timer = setInterval(() => {
      setFrontIndex((prev) => (prev + 2) % 3); // 2 → 1 → 0 → 2 ...
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // ➜ Correct z-index logic (back → middle → front)
  const getZIndex = (idx) => {
    if (idx === frontIndex) return 2; // front
    if (idx === (frontIndex + 1) % 3) return 0; // middle
    return 1; // back
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 left-[60%] hidden lg:block pointer-events-none">
      {/* Back Card */}
      <motion.div
        className="absolute"
        animate={{ y: [0, -10, 0], zIndex: getZIndex(0) }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          left: "calc(0% + min(122px, 390vw))",
          top: "calc(min(119px, 14vh) - 50px)",
          width: "min(740px, 43vw)",
          height: "min(523px, 30vw)",
        }}
      >
        <div className="w-full h-full rotate-[14.21deg] skew-x-[0.808deg]">
          <div className="w-full h-full relative rounded-[24px] xl:rounded-[38.667px] overflow-hidden border-[3px] xl:border-[5.333px] border-neutral-800 shadow-[-8px_-8px_30px_0px_rgba(0,0,0,0.15)] xl:shadow-[-11.791px_-11.791px_46.667px_0px_rgba(0,0,0,0.15)] bg-white">
            <img
              alt="Resume preview"
              className="absolute h-[188.26%] left-[-1.05%] top-[-35.35%] w-full object-cover"
              src={imgScreenshot20221208At739}
            />
          </div>
        </div>
      </motion.div>

      {/* Middle Card */}
      <motion.div
        className="absolute"
        animate={{ y: [0, -15, 0], zIndex: getZIndex(1) }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
        style={{
          left: "calc(0% + min(98px, 100vw))",
          top: "calc(min(210px, 24vh) - 100px)",
          width: "min(740px, 43vw)",
          height: "min(524px, 30vw)",
        }}
      >
        <div className="w-full h-full rotate-[7.111deg] skew-x-[0.416deg]">
          <div className="w-full h-full relative rounded-[24px] xl:rounded-[38.667px] overflow-hidden border-[3px] xl:border-[5.333px] border-neutral-800 shadow-[-8px_-8px_30px_0px_rgba(0,0,0,0.15)] xl:shadow-[-11.791px_-11.791px_46.667px_0px_rgba(0,0,0,0.15)] bg-white flex items-center justify-center">
            <div className="w-full h-full relative">
              <img
                alt="Resume preview"
                className="w-full h-full object-cover"
                src={imgScreenshot20221208At740}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Front Card */}
      <motion.div
        className="absolute"
        animate={{ y: [0, -8, 0], zIndex: getZIndex(2) }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        style={{
          left: "calc(0% + min(86px, 5vw))",
          top: "calc(min(318px, 37vh) - 150px)",
          width: "min(739px, 43vw)",
          height: "min(523px, 30vw)",
        }}
      >
        <div className="w-full h-full relative rounded-[24px] xl:rounded-[38.667px] overflow-hidden border-[3px] xl:border-[5.333px] border-neutral-800 shadow-[-8px_-8px_30px_0px_rgba(0,0,0,0.15)] xl:shadow-[-11.791px_-11.791px_46.667px_0px_rgba(0,0,0,0.15)] bg-white">
          <img
            alt="Resume preview"
            className="absolute h-[188.26%] left-0 top-[-0.84%] w-full object-cover"
            src={imgScreenshot20221208At739}
          />
          <img
            alt="Resume preview"
            className="absolute h-[188.26%] left-0 top-[-0.67%] w-full object-cover"
            src={imgScreenshot20221208At742}
          />
        </div>
      </motion.div>
    </div>
  );
}

// Company Logos Scrolling Component - Fixed and Responsive
function CompanyLogosScroll() {
  const logos = [
    { img: imgImg20251107Wa0001Png, name: "Infosys" },
    { img: imgImage11, name: "Google" },
    { img: imgImage16, name: "Cognizant" },
    { img: imgImage13, name: "Oracle" },
    { img: imgImage12, name: "Meta" },
    { img: imgImage17, name: "Company" },
    { img: imgImage19, name: "Company" },
    { img: imgImage15, name: "Company" },
    { img: imgImage14, name: "Company" },
    { img: imgImage18, name: "Company" },
    { img: imgImage20, name: "Company" },
    { img: imgImage22, name: "Company" },
    { img: imgImage21, name: "Company" },
    { img: imgImage24, name: "Company" },
    { img: imgImage23, name: "Company" },
  ];

  return (
    <div className="w-full py-8 lg:py-12 bg-white border-t border-b border-gray-200 overflow-hidden">
      <motion.div
        className="flex gap-12 sm:gap-16 lg:gap-20 xl:gap-24 items-center"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          x: {
            duration: 40,
            repeat: Infinity,
            ease: "linear",
          },
        }}
        style={{ width: "max-content" }}
      >
        {/* First set */}
        {logos.map((logo, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 h-12 sm:h-16 lg:h-20 xl:h-24 w-24 sm:w-32 lg:w-40 xl:w-48 flex items-center justify-center"
          >
            <img
              alt={logo.name}
              src={logo.img}
              className="max-h-full max-w-full object-contain opacity-90 transition-all duration-300"
            />
          </div>
        ))}
        {/* Duplicate set for seamless loop */}
        {logos.map((logo, idx) => (
          <div
            key={`dup-${idx}`}
            className="flex-shrink-0 h-12 sm:h-16 lg:h-20 xl:h-24 w-24 sm:w-32 lg:w-40 xl:w-48 flex items-center justify-center"
          >
            <img
              alt={logo.name}
              src={logo.img}
              className="max-h-full max-w-full object-contain opacity-90 transition-all duration-300"
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function ExploreCards() {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [hasTraversedExplore, setHasTraversedExplore] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef(false);
  const lastScrollY = useRef(0);
  const lockedScrollY = useRef(0);
  const direction = useRef<"up" | "down">("down");
  const pendingReleaseDirection = useRef<"up" | "down" | null>(null);
  const pendingNavigationTarget = useRef<number | null>(null);

  const features = [
    {
      icon: (
        <svg className="block w-full h-full" fill="none" viewBox="0 0 86 86">
          <path
            d="M10 10 L76 10 L76 76 L10 76 Z"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      title: "AI-Powered Resume Builder",
      description:
        "Create a professional, ATS-optimized resume that truly represents you. Our adaptive AI refines tone, identifies skill gaps, and mirrors recruiter insights — making every detail matter",
      accent: "#C8A2FF",
    },
    {
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
      title: "Learning Path",
      description:
        "Personalized skill development roadmaps based on your career aspirations. Learn what matters most with curated resources and actionable steps",
      accent: "#A8D5C2",
    },
    {
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
      title: "Job Discovery",
      description:
        "Find opportunities that match your skills and career goals. Our AI analyzes thousands of job postings to surface the perfect roles for you",
      accent: "#FF7F7F",
    },
    {
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      ),
      title: "Interview Preparation",
      description:
        "Practice with AI-powered mock interviews tailored to your industry. Get real-time feedback, improve your responses, and build confidence for the big day",
      accent: "#A8D5C2",
    },
    {
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      title: "Portfolio Builder",
      description:
        "Showcase your best work with a stunning portfolio website. Customizable templates designed to highlight your unique skills and projects",
      accent: "#C8A2FF",
    },
  ];

  /* Lock body scroll */
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    if (scrollLocked) {
      lockedScrollY.current = window.scrollY;
      body.style.position = "fixed";
      body.style.top = `-${lockedScrollY.current}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      html.style.overflow = "hidden";
    } else {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      html.style.overflow = "";

      const navigationTarget = pendingNavigationTarget.current;
      const releaseOffset = Math.max(window.innerHeight * 0.35, 220);
      const releaseDirection = pendingReleaseDirection.current;
      const targetTop =
        navigationTarget !== null
          ? navigationTarget
          : releaseDirection === "down"
          ? lockedScrollY.current + releaseOffset
          : releaseDirection === "up"
            ? Math.max(lockedScrollY.current - releaseOffset, 0)
            : lockedScrollY.current;

      window.scrollTo({ top: targetTop, left: 0, behavior: "auto" });
      pendingReleaseDirection.current = null;
      pendingNavigationTarget.current = null;
    }

    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      html.style.overflow = "";
    };
  }, [scrollLocked]);

  useEffect(() => {
    const onExploreNavRequest = (event: Event) => {
      const { detail } = event as CustomEvent<{ targetTop?: number }>;
      pendingNavigationTarget.current =
        typeof detail?.targetTop === "number" ? Math.max(detail.targetTop, 0) : 0;
      pendingReleaseDirection.current = null;
      isScrolling.current = false;
      setScrollLocked(false);
    };

    window.addEventListener(EXPLORE_SCROLL_NAV_EVENT, onExploreNavRequest);
    return () => {
      window.removeEventListener(EXPLORE_SCROLL_NAV_EVENT, onExploreNavRequest);
    };
  }, []);

  /* Freeze only when cards are visually centered */
  useEffect(() => {
    const onScroll = () => {
      if (!containerRef.current || scrollLocked) return;

      const rect = containerRef.current.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const containerCenter = rect.top + rect.height / 2;

      const delta = Math.abs(containerCenter - viewportCenter);

      const currentY = window.scrollY;
      direction.current = currentY > lastScrollY.current ? "down" : "up";
      lastScrollY.current = currentY;

      if (delta < 25) {
        if (
          direction.current === "down" &&
          activeCardIndex === 0 &&
          !hasTraversedExplore
        ) {
          setScrollLocked(true);
        }
        if (
          direction.current === "up" &&
          activeCardIndex === features.length - 1 &&
          hasTraversedExplore
        ) {
          setScrollLocked(true);
        }
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [activeCardIndex, scrollLocked, features.length, hasTraversedExplore]);

  /* One scroll = one card */
  useEffect(() => {
    const SCROLL_THRESHOLD = 80;
    let scrollSum = 0;

    const onWheel = (e: WheelEvent) => {
      if (!scrollLocked || isScrolling.current) return;

      e.preventDefault();
      scrollSum += e.deltaY;

      if (Math.abs(scrollSum) < SCROLL_THRESHOLD) return;

      isScrolling.current = true;

      if (scrollSum > 0) {
        setActiveCardIndex((prev) => {
          if (prev < features.length - 1) {
            const next = prev + 1;
            if (next === features.length - 1) {
              setHasTraversedExplore(true);
            }
            return next;
          }
          pendingReleaseDirection.current = "down";
          setScrollLocked(false);
          return prev;
        });
      } else {
        setActiveCardIndex((prev) => {
          if (prev > 0) return prev - 1;
          setHasTraversedExplore(false);
          pendingReleaseDirection.current = "up";
          setScrollLocked(false);
          return prev;
        });
      }

      scrollSum = 0;
      setTimeout(() => {
        isScrolling.current = false;
      }, 700);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [scrollLocked, features.length]);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[1428px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 py-2 lg:py-4"
    >
      <div className="relative min-h-[320px] flex items-start justify-center pt-0 lg:pt-0">
        <div className="relative w-full max-w-[900px] h-[500px] sm:h-[550px] md:h-[580px] -mt-12 lg:-mt-20">
          {features.map((feature, index) => {
            const isActive = index === activeCardIndex;
            const isLockedCard =
              feature.title === "Interview Preparation" ||
              feature.title === "Portfolio Builder";

            return (
              <motion.div
                key={index}
                className="absolute inset-0 bg-white rounded-[24px] lg:rounded-[32px] p-8 lg:p-12 border-2 border-neutral-800 shadow-2xl"
                initial={false}
                animate={{
                  opacity: isActive ? 1 : 0,
                  y: isActive ? 0 : 40,
                  scale: isActive ? 1 : 0.96,
                  zIndex: isActive ? 10 : 0,
                }}
                transition={{ duration: 0.4 }}
              >
                {/* COMING SOON BADGE */}
                {feature.title !== "AI-Powered Resume Builder" && (
                  <div className="absolute top-6 right-6 z-20">
                    <span className="bg-black text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-md">
                      Coming Soon!
                    </span>
                  </div>
                )}

                {/* CONTENT WITH BLUR */}
                <div
                  className="flex flex-col items-center justify-center h-full text-center relative"
                  style={
                    {
                      // filter: isLockedCard ? "blur(-5px)" : "none",
                    }
                  }
                >
                  <div
                    className="w-20 h-20 lg:w-24 lg:h-24 mb-6 lg:mb-8 rounded-full p-4 lg:p-5"
                    style={{ backgroundColor: `${feature.accent}40` }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl sm:text-3xl lg:text-[32px] mb-4 font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-base sm:text-lg lg:text-[20px] max-w-[650px]">
                    {feature.description}
                  </p>
                </div>

                {/* LOCK ICON OVER BLUR */}
                {isLockedCard && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                    //  src="/src/assets/lock.jpeg"
                    // alt="Locked"
                    // className="w-16 h-16"
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// Tagline Section with Fade-in - Responsive
function TaglineSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 },
    );

    const element = document.getElementById("tagline-section");
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <motion.section
      id="tagline-section"
      className="w-full py-20 sm:py-24 lg:py-32 xl:py-40 px-4 bg-gradient-to-b from-white via-[#f6f6f4] to-white relative overflow-hidden"
      initial={{ opacity: 0, y: 30 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-6xl mx-auto text-center relative z-10">
        <h2 className="font-['Poppins:SemiBold',sans-serif] text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-[64px] leading-[1.2] text-neutral-800 px-4">
          Built for your future , Not just your resume...
        </h2>
      </div>

      {/* Decorative curve */}
      <div className="absolute inset-x-0 top-0">
        <svg
          className="w-full h-16 sm:h-20 lg:h-24 xl:h-32"
          fill="white"
          preserveAspectRatio="none"
          viewBox="0 0 1728 100"
        >
          <path d="M0,0 Q864,100 1728,0 L1728,100 L0,100 Z" />
        </svg>
      </div>
    </motion.section>
  );
}

// Footer with Black Text Watermark - Exact Figma Design Match
function Footer() {
  return (
    <footer
      id="contact"
      className="bg-black text-white relative overflow-hidden min-h-[541px]"
    >
      <div className="max-w-[1728px] mx-auto px-4 sm:px-8 lg:px-8 py-12 lg:py-16 xl:py-20 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Logo and Description */}
          <div className="space-y-4">
            <div
              className="flex items-center gap-3
            "
            >
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 lg:w-[13px] lg:h-[131px]">
                <img
                  alt="Hired AI Logo"
                  className="w-full h-full object-cover"
                  src={imgImage3}
                />
              </div>
              <p className="font-['Poppins:Bold',sans-serif] text-3xl sm:text-4xl lg:text-[48px]">
                Hired AI
              </p>
            </div>

            <div className="font-['Poppins:Regular',sans-serif] text-sm lg:text-[16px] opacity-50 leading-[1.6]">
              <p>Build. Prepare. Get Hired.</p>
              <p>Hired AI — your AI-powered career partner</p>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-['Ubuntu:Bold',sans-serif] text-base lg:text-[20px] mb-3 lg:mb-4">
              Services
            </h3>
            <div className="font-['Poppins:Regular',sans-serif] text-sm lg:text-[16px] opacity-50 leading-[2.4]">
              <p>Resume Builder</p>
              <p>Learning Path</p>
              <p>Job Discovery</p>
              <p>Interview Prep</p>
              <p>Portfolio Builder</p>
            </div>
          </div>

          {/* Contact Us Column */}
          {/* Contact Us Column */}
          <div>
            <h3 className="font-['Ubuntu:Bold',sans-serif] text-base lg:text-[16px] mb-4 lg:mb-5">
              Contact Us
            </h3>

            <div className="font-['Poppins:Regular',sans-serif] text-sm lg:text-[16px] opacity-50 leading-[2.5] space-y-1">
              <a
                href="https://mail.google.com/mail/?view=cm&fs=1&to=support@hired-ai.in&su=Support%20Request&body=Hello%20Hired%20AI%20Team,%0D%0A%0D%0A"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Support@hired-ai.in
              </a>
            </div>
          </div>

          {/* Social Icons */}
          <div>
            <h3 className="font-['Ubuntu:Bold',sans-serif] text-base lg:text-[16px] mb-4 lg:mb-5">
              Follow Us
            </h3>
            <div className="flex gap-3 lg:gap-4">
              <motion.a
                href="https://www.linkedin.com/company/start-at-root/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 lg:w-[41px] lg:h-[41px] flex items-center justify-center rounded-lg bg-[#4F4F4F] hover:bg-[#6F6F6F] transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg
                  className="w-5 h-5 lg:w-6 lg:h-6"
                  fill="white"
                  viewBox="0 0 41 41"
                >
                  <path d={svgPaths.p3b8e0900} />
                </svg>
              </motion.a>
              <motion.a
                href="https://www.instagram.com/rootai.in?igsh=cXpienFyZmdvYzYy"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 lg:w-[41px] lg:h-[41px] flex items-center justify-center rounded-lg bg-[#4F4F4F] hover:bg-[#6F6F6F] transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg
                  className="w-5 h-5 lg:w-6 lg:h-6"
                  fill="white"
                  viewBox="0 0 41 41"
                >
                  <path d={svgPaths.p3f0b8580} />
                </svg>
              </motion.a>
              <motion.a
                href="https://x.com/ROOT691551"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 lg:w-[41px] lg:h-[41px] flex items-center justify-center rounded-lg bg-[#4F4F4F] hover:bg-[#6F6F6F] transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg
                  className="w-5 h-5 lg:w-6 lg:h-6"
                  fill="white"
                  viewBox="0 0 41 41"
                >
                  <path d={svgPaths.p271ae200} />
                </svg>
              </motion.a>
            </div>
          </div>
        </div>

        {/* Bottom Text */}
        <div className="mt-12 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm lg:text-[16px] text-[#4f4f4f]">
          <p>Produced by Root © 2025</p>

          <a
            href="/Privacy_Policy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white underline"
          >
            Privacy Policy | Terms & Conditions
          </a>
        </div>
      </div>

      {/* 🔥 Watermark (Lower Half Visible, Slightly Above Bottom) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full overflow-hidden pointer-events-none flex justify-center">
        <motion.p
          style={{
            fontSize: "15vw",
            lineHeight: "1",
            transform: "translateY(1%)", // move up to show lower half
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "100% 100%",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
            maskRepeat: "no-repeat",
            maskSize: "100% 100%",
          }}
          className="
            font-['Poppins:Bold',sans-serif]
            text-black
            whitespace-nowrap
            select-none
            [-webkit-text-stroke:4px_#d0d0d0]
          "
          animate={{
            textShadow: [
              "0 0 6px rgba(180,180,180,0.4)",
              "0 0 30px rgba(180,180,180,0.4), 0 0 60px rgba(180,180,180,0.5)",
              "0 0 6px rgba(180,180,180,1)",
            ],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          Hired AI
        </motion.p>
      </div>
    </footer>
  );
}



