import type { PsychometricModule } from "./psychometric";

type TraitScores = Record<string, number>;

export interface EngineOption {
  t: string;
  w: TraitScores;
}

export interface EngineQuestion {
  id: string;
  type: string;
  text: string;
  opts: EngineOption[];
  targets?: string[];
}

interface ResumeArchetype {
  id: string;
  industry: string;
  role: string;
  alt: string;
  sig: TraitScores;
}

interface JobArchetype {
  id: string;
  type: string;
  sub: string;
  envs: string[];
  jobs: string[];
  sig: TraitScores;
}

type EngineArchetype = ResumeArchetype | JobArchetype;

interface EngineModuleDefinition<TArch extends EngineArchetype> {
  id: number;
  traits: string[];
  maxQ: number;
  fixed: EngineQuestion[];
  adaptive: EngineQuestion[];
  archetypes: TArch[];
}

type AnyModuleDefinition = EngineModuleDefinition<EngineArchetype>;

interface TraitState {
  score: number;
  conf: number;
  dirs: number[];
  total: number;
  positive: number;
  negative: number;
  contradictions: number;
}

interface EngineState {
  moduleKey: PsychometricModule;
  mod: AnyModuleDefinition;
  tr: Record<string, TraitState>;
  asked: Set<string>;
  qIdx: number;
  answered: number;
  pHist: string[];
  conflictPenalty: number;
  recentConflictTraits: Set<string>;
}

interface DebugAnswerRun {
  timestamp: string;
  module: PsychometricModule;
  questionId: string;
  optionIndex: number;
  answerText: string;
  answered: number;
  normalizedScores: Record<string, number>;
  rawScores: Record<string, number>;
}

interface DebugResultRun {
  timestamp: string;
  module: PsychometricModule;
  answered: number;
  confidence: number;
  bestId: string | null;
  topTraits: string[];
  traitScores: Record<string, number>;
}

export interface RankedArchetype<TArch extends EngineArchetype = EngineArchetype> {
  arch: TArch;
  score: number;
}

export interface PsychometricEngineResult {
  module: PsychometricModule;
  answered: number;
  confidence: number;
  best: EngineArchetype | null;
  second: EngineArchetype | null;
  topTraits: string[];
  traitScores: Record<string, number>;
  contradictionScore: number;
  isHybrid: boolean;
  explanation: string;
  archetypeScores: RankedArchetype[];
}

const MAX_QUESTIONS = 15;
const DEBUG_STORAGE_KEY = "psychometric_debug_runs";
const DAMPENING_POWER = 0.6;
const DIVERSITY_BOOST_FACTOR = 0.04;
const REBALANCE_THRESHOLD = 55;
const REBALANCE_REDUCTION = 0.06;
const MIN_TRAIT_FLOOR = 5;

const MODULE_TRAIT_LABELS: Record<PsychometricModule, Record<string, string>> = {
  resume_builder: {
    tech: "technical",
    anl: "analytical",
    cre: "creative",
    lead: "leadership",
    comm: "communication",
    risk: "risk-taking",
  },
  job_discovery: {
    ldr: "leadership",
    cre: "creative",
    risk: "risk-taking",
    dec: "decision-making",
    soc: "social",
    flex: "adaptability",
  },
};

const RESUME_TRAIT_ROLE_MAP: Record<string, Omit<ResumeArchetype, "id" | "sig">> = {
  "analytical+technical": {
    industry: "Software, Data & Intelligent Systems",
    role: "Backend / Data Engineer",
    alt: "ML Platform Engineer",
  },
  "analytical+creative": {
    industry: "Product Strategy & Experience Design",
    role: "Product Strategist",
    alt: "UX Research / Product Design Lead",
  },
  "analytical+leadership": {
    industry: "Strategy, Consulting & Operations",
    role: "Strategy Consultant",
    alt: "Business Operations Manager",
  },
  "communication+creative": {
    industry: "Marketing, Brand & Storytelling",
    role: "Brand Strategist",
    alt: "Content / Growth Lead",
  },
  "communication+leadership": {
    industry: "Consulting, People & Client Leadership",
    role: "Program / Client Success Lead",
    alt: "Operations / People Manager",
  },
  "creative+risk-taking": {
    industry: "Startups, Growth & Venture Building",
    role: "Growth Product Builder",
    alt: "Founder Associate / Venture Operator",
  },
};

const JOB_TRAIT_ROLE_MAP: Record<string, Omit<JobArchetype, "id" | "sig" | "envs">> = {
  "creative+risk-taking": {
    type: "Venture Creator",
    sub: "Original builder who thrives in uncertain environments",
    jobs: ["Founder", "Growth Lead", "Innovation Strategist"],
  },
  "decision-making+leadership": {
    type: "Executive Operator",
    sub: "Decisive leader who translates ambiguity into action",
    jobs: ["Operations Manager", "Chief of Staff", "Program Director"],
  },
  "adaptability+social": {
    type: "Relationship Navigator",
    sub: "Flexible connector who succeeds across changing teams and contexts",
    jobs: ["Partnerships Lead", "Customer Success Manager", "Community Manager"],
  },
  "creative+leadership": {
    type: "Vision-Led Builder",
    sub: "Leads through ideas, direction, and original thinking",
    jobs: ["Creative Lead", "Product Lead", "Innovation Manager"],
  },
  "leadership+social": {
    type: "People Catalyst",
    sub: "Brings people together and moves groups toward outcomes",
    jobs: ["Team Lead", "People Operations Lead", "Client Partner"],
  },
  "adaptability+decision-making": {
    type: "Strategic Generalist",
    sub: "Handles shifting conditions while making strong calls under pressure",
    jobs: ["Strategy Associate", "General Manager", "Program Manager"],
  },
};

const JOB_TRAIT_CATEGORY_MAP: Record<string, string> = {
  ldr: "Execution",
  risk: "Execution",
  dec: "Analytical",
  flex: "Structured",
  cre: "Creative",
  soc: "Social",
};

const JOB_DISCOVERY_COMBINATION_MAP: Record<
  string,
  Omit<JobArchetype, "id" | "sig" | "envs">
> = {
  "Analytical-Structured": {
    type: "Technical Specialist",
    sub: "Analytical and structured profile that thrives in systems, rigor, and operational clarity",
    jobs: ["Technical Analyst", "Systems Specialist", "Process Engineer"],
  },
  "Structured-Analytical": {
    type: "Technical Specialist",
    sub: "Analytical and structured profile that thrives in systems, rigor, and operational clarity",
    jobs: ["Technical Analyst", "Systems Specialist", "Process Engineer"],
  },
  "Analytical-Creative": {
    type: "Product Innovator",
    sub: "Combines structured thinking with originality to shape products and new ideas",
    jobs: ["Product Strategist", "Innovation Analyst", "Product Manager"],
  },
  "Creative-Analytical": {
    type: "Product Innovator",
    sub: "Combines structured thinking with originality to shape products and new ideas",
    jobs: ["Product Strategist", "Innovation Analyst", "Product Manager"],
  },
  "Creative-Structured": {
    type: "UX Strategist",
    sub: "Creative problem-solver who still prefers frameworks, process, and experience design logic",
    jobs: ["UX Strategist", "Service Designer", "Experience Research Lead"],
  },
  "Structured-Creative": {
    type: "UX Strategist",
    sub: "Creative problem-solver who still prefers frameworks, process, and experience design logic",
    jobs: ["UX Strategist", "Service Designer", "Experience Research Lead"],
  },
  "Execution-Structured": {
    type: "Operations Leader",
    sub: "Execution-oriented operator who brings consistency, delivery, and team coordination",
    jobs: ["Operations Manager", "Program Lead", "Delivery Manager"],
  },
  "Structured-Execution": {
    type: "Operations Leader",
    sub: "Execution-oriented operator who brings consistency, delivery, and team coordination",
    jobs: ["Operations Manager", "Program Lead", "Delivery Manager"],
  },
  "Execution-Analytical": {
    type: "Business Analyst",
    sub: "Action-minded thinker who translates analysis into practical business decisions",
    jobs: ["Business Analyst", "Strategy Associate", "Operations Analyst"],
  },
  "Analytical-Execution": {
    type: "Business Analyst",
    sub: "Action-minded thinker who translates analysis into practical business decisions",
    jobs: ["Business Analyst", "Strategy Associate", "Operations Analyst"],
  },
  "Creative-Execution": {
    type: "Startup Builder",
    sub: "Creative doer who likes turning ambiguous ideas into fast-moving opportunities",
    jobs: ["Startup Operator", "Venture Builder", "Growth Product Lead"],
  },
  "Execution-Creative": {
    type: "Startup Builder",
    sub: "Creative doer who likes turning ambiguous ideas into fast-moving opportunities",
    jobs: ["Startup Operator", "Venture Builder", "Growth Product Lead"],
  },
};

const JOB_DISCOVERY_SINGLE_TRAIT_MAP: Record<string, Omit<JobArchetype, "id" | "sig" | "envs">> = {
  Analytical: {
    type: "Technical Specialist",
    sub: "Analytical profile that prefers logic, rigor, and problem decomposition",
    jobs: ["Technical Analyst", "Research Associate", "Systems Specialist"],
  },
  Creative: {
    type: "Creative Thinker",
    sub: "Idea-led profile that thrives on originality, reframing, and concept generation",
    jobs: ["Creative Strategist", "Content Lead", "Innovation Associate"],
  },
  Structured: {
    type: "Process Manager",
    sub: "Organized profile that prefers clarity, consistency, and reliable execution systems",
    jobs: ["Process Manager", "Program Coordinator", "Operations Planner"],
  },
  Execution: {
    type: "Operations Specialist",
    sub: "Action-oriented profile that likes momentum, delivery, and moving work forward quickly",
    jobs: ["Operations Specialist", "Delivery Associate", "Program Executor"],
  },
};

const M1: EngineModuleDefinition<ResumeArchetype> = {
  "id": 1,
  "traits": [
    "tech",
    "anl",
    "cre",
    "lead",
    "comm",
    "risk"
  ],
  "maxQ": 18,
  "fixed": [
    {
      "id": "r_f1",
      "type": "S",
      "text": "Your team's product is silently failing for 8% of users — no one has complained yet. No one is assigned to investigate. You notice.",
      "opts": [
        {
          "t": "I dig in personally — I want to understand the failure mode before bringing it to anyone.",
          "w": {
            "tech": 22,
            "anl": 10,
            "lead": -6
          }
        },
        {
          "t": "I map out who is best placed to own this and route it to them with a clear brief.",
          "w": {
            "lead": 20,
            "comm": 10,
            "anl": 6
          }
        },
        {
          "t": "I see this as a signal of a deeper systemic issue and push to surface it in the next planning cycle.",
          "w": {
            "anl": 20,
            "lead": 8,
            "risk": -6
          }
        },
        {
          "t": "I find the fastest way to patch the user experience first, then figure out the root cause.",
          "w": {
            "risk": 18,
            "cre": 10,
            "tech": 6
          }
        }
      ]
    },
    {
      "id": "r_f2",
      "type": "I",
      "text": "Imagine you have 6 months of paid time, no deliverables, and access to any resource you want. What do you actually spend it onINR ",
      "opts": [
        {
          "t": "Building something technical I have never had the time to properly learn or attempt.",
          "w": {
            "tech": 22,
            "risk": 10,
            "cre": 6
          }
        },
        {
          "t": "Doing deep research on a domain question that genuinely bothers me — turning uncertainty into a clear answer.",
          "w": {
            "anl": 24,
            "tech": 6
          }
        },
        {
          "t": "Creating something that expresses a perspective — a body of writing, design, or a project with a distinct voice.",
          "w": {
            "cre": 24,
            "comm": 10
          }
        },
        {
          "t": "Travelling into environments that challenge my assumptions — different industries, cultures, and systems.",
          "w": {
            "risk": 18,
            "lead": 8,
            "comm": 10
          }
        }
      ]
    },
    {
      "id": "r_f3",
      "type": "B",
      "text": "Think of the last time a project you cared about went off the rails. What did you actually do — not what you should have doneINR ",
      "opts": [
        {
          "t": "I stayed late and fixed the technical parts myself rather than delegating risk to someone else.",
          "w": {
            "tech": 20,
            "risk": 8,
            "lead": -8
          }
        },
        {
          "t": "I rebuilt the plan from scratch — identified what was still salvageable and what needed to go.",
          "w": {
            "anl": 22,
            "lead": 10
          }
        },
        {
          "t": "I reframed the outcome: found a way to make the \"failed\" project useful or interesting anyway.",
          "w": {
            "cre": 20,
            "risk": 12
          }
        },
        {
          "t": "I called the stakeholders before they found out and managed the narrative carefully.",
          "w": {
            "comm": 22,
            "lead": 12,
            "risk": 6
          }
        }
      ]
    },
    {
      "id": "r_f4",
      "type": "P",
      "text": "You are offered two roles. Neither is perfect. You have 24 hours to decide.",
      "opts": [
        {
          "t": "Role A: Technically complex, mostly solo, world-class team, slower promotion track.",
          "w": {
            "tech": 20,
            "anl": 10,
            "lead": -10,
            "risk": -8
          }
        },
        {
          "t": "Role B: High visibility, requires leading people you did not hire, politically complex company.",
          "w": {
            "lead": 20,
            "comm": 12,
            "risk": 10
          }
        },
        {
          "t": "Role C: Early-stage, unclear scope, massive upside if it works, high chance it does not.",
          "w": {
            "risk": 24,
            "cre": 10,
            "anl": 6
          }
        },
        {
          "t": "Role D: Well-defined, respected domain expert track, slower growth, deep specialisation.",
          "w": {
            "anl": 20,
            "tech": 10,
            "risk": -14
          }
        }
      ]
    },
    {
      "id": "r_f5",
      "type": "S",
      "text": "You are in a meeting where a decision is about to be made that you believe is wrong. The leader outranks you significantly.",
      "opts": [
        {
          "t": "I raise the issue clearly, with the data that supports my concern, regardless of the room.",
          "w": {
            "comm": 18,
            "anl": 12,
            "risk": 10
          }
        },
        {
          "t": "I pull the key person aside before the meeting ends and make my case privately.",
          "w": {
            "comm": 20,
            "lead": 10
          }
        },
        {
          "t": "I let it go — execution matters more than being right, and I will adapt when it fails.",
          "w": {
            "risk": -10,
            "lead": 8,
            "cre": 6
          }
        },
        {
          "t": "I ask one well-chosen question that forces the group to reconsider without me taking a position.",
          "w": {
            "cre": 18,
            "comm": 14,
            "anl": 8
          }
        }
      ]
    }
  ],
  "adaptive": [
    {
      "id": "r_a1",
      "targets": [
        "tech",
        "anl"
      ],
      "type": "S",
      "text": "A system you are responsible for is behaving unpredictably. You have two hours before it affects users. What happens inside your headINR ",
      "opts": [
        {
          "t": "I go into a focused, almost meditative state — I narrow to the failure point and work outward from there.",
          "w": {
            "tech": 24,
            "anl": 8
          }
        },
        {
          "t": "I structure the problem: what changed, what is correlated, what can I eliminate.",
          "w": {
            "anl": 24,
            "tech": 8
          }
        },
        {
          "t": "I immediately think about who else knows this system and pull them in.",
          "w": {
            "lead": 14,
            "comm": 12,
            "tech": 6
          }
        },
        {
          "t": "I focus on impact containment first — what is the minimum action to protect users right now.",
          "w": {
            "risk": 16,
            "lead": 10,
            "anl": 6
          }
        }
      ]
    },
    {
      "id": "r_a2",
      "targets": [
        "cre",
        "anl"
      ],
      "type": "I",
      "text": "You are given ₹2 crore and told to launch something in 90 days. No constraints on what it is. What is your first instinctINR ",
      "opts": [
        {
          "t": "Find the most underserved, specific problem — model the economics before writing a word of copy.",
          "w": {
            "anl": 22,
            "tech": 8,
            "risk": 6
          }
        },
        {
          "t": "Find the idea that feels surprising and inevitable at the same time — then figure out the business.",
          "w": {
            "cre": 24,
            "risk": 14
          }
        },
        {
          "t": "Assemble a small, sharp team first — the idea is secondary to having the right people.",
          "w": {
            "lead": 22,
            "comm": 10
          }
        },
        {
          "t": "Find one distribution channel I can own completely and build backwards from that.",
          "w": {
            "anl": 16,
            "risk": 10,
            "cre": 8
          }
        }
      ]
    },
    {
      "id": "r_a3",
      "targets": [
        "lead",
        "comm"
      ],
      "type": "B",
      "text": "Recall a moment where someone around you was clearly struggling but had not asked for help. What did you doINR ",
      "opts": [
        {
          "t": "I stepped in without being asked — I read the situation and made a direct offer.",
          "w": {
            "lead": 22,
            "comm": 12
          }
        },
        {
          "t": "I waited until they asked — intervening without being asked feels presumptuous to me.",
          "w": {
            "anl": 12,
            "risk": -8,
            "lead": -10
          }
        },
        {
          "t": "I changed the structure of the work so their problem became less visible and easier.",
          "w": {
            "cre": 16,
            "lead": 10,
            "tech": 8
          }
        },
        {
          "t": "I created an opportunity for them to ask — made it easier for them to reach out.",
          "w": {
            "comm": 20,
            "lead": 10
          }
        }
      ]
    },
    {
      "id": "r_a4",
      "targets": [
        "risk",
        "anl"
      ],
      "type": "P",
      "text": "Your current trajectory is stable and respected. Someone credible offers you a path that is harder, riskier, and more interesting. You:",
      "opts": [
        {
          "t": "Take it immediately — the stable path was never interesting enough to stay on.",
          "w": {
            "risk": 26,
            "cre": 8
          }
        },
        {
          "t": "Request 30 days to analyse both paths properly before responding.",
          "w": {
            "anl": 22,
            "risk": -6
          }
        },
        {
          "t": "Negotiate — I want the interesting path but I am not willing to burn what I built.",
          "w": {
            "comm": 14,
            "anl": 10,
            "risk": 8
          }
        },
        {
          "t": "Stay. I know what I am good at, and changing direction has hidden costs people underestimate.",
          "w": {
            "risk": -20,
            "anl": 10
          }
        }
      ]
    },
    {
      "id": "r_a5",
      "targets": [
        "comm",
        "lead"
      ],
      "type": "S",
      "text": "You just finished the most technically complex thing you have ever built. Your CEO asks you to present it to the board in 20 minutes.",
      "opts": [
        {
          "t": "I find the one analogy that makes it click for non-technical people and build the whole 20 minutes around it.",
          "w": {
            "comm": 22,
            "cre": 12
          }
        },
        {
          "t": "I lead with the business outcome — what changed, what it enables, what it costs. The tech is the appendix.",
          "w": {
            "lead": 20,
            "comm": 12
          }
        },
        {
          "t": "I am honest: I would rather have more time, but I will deliver what I can clearly.",
          "w": {
            "comm": 14,
            "risk": -6,
            "anl": 8
          }
        },
        {
          "t": "I ask someone from the business side to co-present the impact while I handle technical questions.",
          "w": {
            "lead": 16,
            "comm": 14,
            "cre": 6
          }
        }
      ]
    },
    {
      "id": "r_a6",
      "targets": [
        "cre",
        "anl"
      ],
      "type": "B",
      "text": "Think of a problem you solved in a way that surprised even you. What actually happenedINR ",
      "opts": [
        {
          "t": "I found a lateral connection nobody had noticed — borrowed an idea from an unrelated domain entirely.",
          "w": {
            "cre": 24,
            "anl": 8,
            "risk": 8
          }
        },
        {
          "t": "I broke the problem into its smallest components until the answer was obvious.",
          "w": {
            "anl": 24,
            "tech": 8
          }
        },
        {
          "t": "I talked to the people closest to the problem and the answer was already there.",
          "w": {
            "comm": 20,
            "lead": 8
          }
        },
        {
          "t": "I ran a small experiment to test my hunch before spending more time on it.",
          "w": {
            "anl": 16,
            "risk": 10,
            "tech": 8
          }
        }
      ]
    },
    {
      "id": "r_a7",
      "targets": [
        "lead",
        "risk"
      ],
      "type": "I",
      "text": "Imagine your career 10 years from now. Which version of success would make you feel most proud — honestlyINR ",
      "opts": [
        {
          "t": "I have built and led something meaningful — people I developed are now doing significant things.",
          "w": {
            "lead": 24,
            "comm": 8
          }
        },
        {
          "t": "I am the best practitioner in my domain — the person serious organisations call for the hardest problems.",
          "w": {
            "tech": 18,
            "anl": 14,
            "risk": -6
          }
        },
        {
          "t": "I have founded or co-founded something — it exists because of decisions I was willing to make.",
          "w": {
            "risk": 24,
            "lead": 12,
            "cre": 8
          }
        },
        {
          "t": "I have shaped a field or category — my thinking influenced how others approach a class of problems.",
          "w": {
            "anl": 18,
            "cre": 14,
            "comm": 10
          }
        }
      ]
    },
    {
      "id": "r_a8",
      "targets": [
        "tech",
        "cre"
      ],
      "type": "P",
      "text": "You have one afternoon to invest in yourself. No obligations. Which of these feels most like the right use of itINR ",
      "opts": [
        {
          "t": "Going deep on a technical concept I have been shallow on — reading the spec, not the summary.",
          "w": {
            "tech": 24,
            "anl": 8
          }
        },
        {
          "t": "Working on something creative with no defined outcome — just making something.",
          "w": {
            "cre": 24,
            "risk": 8
          }
        },
        {
          "t": "Having a long, unstructured conversation with someone who thinks very differently from me.",
          "w": {
            "comm": 18,
            "cre": 8,
            "risk": 6
          }
        },
        {
          "t": "Running the numbers on something I have been wondering about — turning a hunch into a view.",
          "w": {
            "anl": 22,
            "tech": 6
          }
        }
      ]
    },
    {
      "id": "r_a9",
      "targets": [
        "risk",
        "lead"
      ],
      "type": "S",
      "text": "Your company is acquired. The acquirer offers to retain you at the same salary with a safer, narrower role. Alternatively you get a 6-month severance and your own time.",
      "opts": [
        {
          "t": "I take the severance. I have been waiting for a forcing function to try something on my own.",
          "w": {
            "risk": 26,
            "cre": 10
          }
        },
        {
          "t": "I negotiate: stay 12 months, use it to understand the new organisation, then decide.",
          "w": {
            "anl": 18,
            "comm": 12,
            "lead": 8
          }
        },
        {
          "t": "I stay. The stability gives me the runway to do quality work without financial pressure.",
          "w": {
            "risk": -18,
            "anl": 10
          }
        },
        {
          "t": "I stay only if I can carve out a scope that is genuinely new — I will not do the same job under a different logo.",
          "w": {
            "lead": 20,
            "risk": 10
          }
        }
      ]
    },
    {
      "id": "r_a10",
      "targets": [
        "anl",
        "cre"
      ],
      "type": "B",
      "text": "You had a strong conviction about something that turned out to be wrong. Looking back, what was the patternINR ",
      "opts": [
        {
          "t": "I had the right framework but the wrong data — I trusted old information.",
          "w": {
            "anl": 20,
            "tech": 8
          }
        },
        {
          "t": "I fell in love with my own idea too early and stopped looking for evidence against it.",
          "w": {
            "cre": 14,
            "risk": 12,
            "anl": -8
          }
        },
        {
          "t": "I trusted a person's judgment over the evidence because I respected them.",
          "w": {
            "comm": 14,
            "lead": 8,
            "anl": -6
          }
        },
        {
          "t": "I was not wrong — I was early. The outcome was poor, not the thinking.",
          "w": {
            "risk": 14,
            "cre": 12,
            "anl": 8
          }
        }
      ]
    },
    {
      "id": "r_a11",
      "targets": [
        "comm",
        "lead"
      ],
      "type": "S",
      "text": "Two people on your team are in direct conflict over a strategic direction. Both are talented. Both are partially right.",
      "opts": [
        {
          "t": "I make the call myself. Both arguments are good; at some point someone has to decide.",
          "w": {
            "lead": 24,
            "risk": 10
          }
        },
        {
          "t": "I get them in a room and facilitate — the answer usually emerges when the right people are in conversation.",
          "w": {
            "comm": 22,
            "lead": 10
          }
        },
        {
          "t": "I run a time-boxed experiment that lets the data choose rather than the opinion.",
          "w": {
            "anl": 20,
            "tech": 8,
            "lead": 6
          }
        },
        {
          "t": "I reframe the question — conflict usually means the problem is not yet properly defined.",
          "w": {
            "cre": 18,
            "anl": 10,
            "comm": 8
          }
        }
      ]
    },
    {
      "id": "r_a12",
      "targets": [
        "risk",
        "cre"
      ],
      "type": "I",
      "text": "Imagine you discover an unseized opportunity in a sector no one in your peer group is talking about. You are 80% convinced it is real. What do you doINR ",
      "opts": [
        {
          "t": "I test it quietly with a small investment of time and money before telling anyone.",
          "w": {
            "risk": 18,
            "anl": 12,
            "tech": 6
          }
        },
        {
          "t": "I tell a few trusted people and pressure-test the thesis before committing anything.",
          "w": {
            "anl": 16,
            "comm": 12,
            "risk": 6
          }
        },
        {
          "t": "I write up the idea completely — getting it on paper forces clarity faster than talking about it.",
          "w": {
            "anl": 18,
            "cre": 12
          }
        },
        {
          "t": "I move fast. If it is real, waiting means someone else gets there first.",
          "w": {
            "risk": 24,
            "cre": 8
          }
        }
      ]
    },
    {
      "id": "r_a13",
      "targets": [
        "tech",
        "lead"
      ],
      "type": "P",
      "text": "Which of these trade-offs feels most personally costly to youINR ",
      "opts": [
        {
          "t": "Being technically excellent but without the authority to implement what you believe is right.",
          "w": {
            "tech": 20,
            "lead": 10,
            "risk": 8
          }
        },
        {
          "t": "Having the authority to shape direction but being dependent on others' technical judgment.",
          "w": {
            "lead": 18,
            "tech": -10,
            "risk": 6
          }
        },
        {
          "t": "Having deep expertise but no platform to communicate it to the people who need it.",
          "w": {
            "comm": 18,
            "anl": 10,
            "tech": 6
          }
        },
        {
          "t": "Being highly capable but in a domain that is stable and not growing.",
          "w": {
            "risk": 16,
            "cre": 10
          }
        }
      ]
    },
    {
      "id": "r_a14",
      "targets": [
        "comm",
        "anl"
      ],
      "type": "B",
      "text": "Think of the last time your view genuinely changed because of a conversation. What happenedINR ",
      "opts": [
        {
          "t": "Someone shared evidence I had not seen — I updated my position based on the data.",
          "w": {
            "anl": 22,
            "comm": 8
          }
        },
        {
          "t": "Someone reframed the problem in a way I had not considered — the question itself was wrong.",
          "w": {
            "cre": 18,
            "comm": 12,
            "anl": 8
          }
        },
        {
          "t": "Someone challenged me respectfully and directly — the friction forced me to examine my assumptions.",
          "w": {
            "comm": 18,
            "lead": 10,
            "risk": 8
          }
        },
        {
          "t": "Honestly, my view rarely changes from a single conversation — I need time to sit with it.",
          "w": {
            "anl": 14,
            "risk": -6,
            "comm": -8
          }
        }
      ]
    },
    {
      "id": "r_a15",
      "targets": [
        "risk",
        "tech"
      ],
      "type": "S",
      "text": "You are the most experienced person in a room making a decision that is outside your technical domain. The team is stuck.",
      "opts": [
        {
          "t": "I admit openly that I am not the expert here and ask the questions a non-expert would ask.",
          "w": {
            "comm": 18,
            "lead": 10,
            "risk": 6
          }
        },
        {
          "t": "I quickly learn what I need to — I go find the right sources and bring myself up to speed.",
          "w": {
            "tech": 16,
            "anl": 14,
            "risk": 8
          }
        },
        {
          "t": "I focus on the process: how should this decision be made, regardless of the technical content?",
          "w": {
            "lead": 20,
            "anl": 12
          }
        },
        {
          "t": "I make a provisional call and explicitly flag that it should be revisited once better expertise is available.",
          "w": {
            "lead": 18,
            "risk": 12,
            "comm": 8
          }
        }
      ]
    },
    {
      "id": "r_a16",
      "targets": [
        "cre",
        "risk"
      ],
      "type": "I",
      "text": "If you could spend a year embedded in any environment — not for career reasons, just for what it would do to how you think — where would you goINR ",
      "opts": [
        {
          "t": "A cutting-edge research lab — I want to be around people solving problems that do not have names yet.",
          "w": {
            "tech": 18,
            "anl": 14,
            "cre": 8
          }
        },
        {
          "t": "A high-growth startup at the zero-to-one stage — I want to see how things are built from nothing.",
          "w": {
            "risk": 22,
            "lead": 10,
            "cre": 8
          }
        },
        {
          "t": "An organisation solving a large-scale human problem — education, healthcare, infrastructure.",
          "w": {
            "comm": 18,
            "lead": 10,
            "cre": 8
          }
        },
        {
          "t": "A creative studio or design-led company — I want to see how constraint produces originality.",
          "w": {
            "cre": 24,
            "comm": 8
          }
        }
      ]
    },
    {
      "id": "r_a17",
      "targets": [
        "lead",
        "anl"
      ],
      "type": "P",
      "text": "You can only optimise one thing about how you work. Which matters most to you, honestlyINR ",
      "opts": [
        {
          "t": "The depth and quality of my own thinking — I want to be harder to fool and faster to understand.",
          "w": {
            "anl": 24,
            "tech": 8
          }
        },
        {
          "t": "My ability to influence and align people around what I believe is right.",
          "w": {
            "lead": 22,
            "comm": 10
          }
        },
        {
          "t": "My capacity to generate original ideas and see what others miss.",
          "w": {
            "cre": 24,
            "risk": 8
          }
        },
        {
          "t": "My tolerance for uncertainty — I want to be more comfortable moving before I am ready.",
          "w": {
            "risk": 22,
            "lead": 8
          }
        }
      ]
    }
  ],
  "archetypes": [
    {
      "id": "swe",
      "industry": "Software & Product Engineering",
      "role": "Software / Backend Engineer",
      "alt": "Platform / DevOps Engineer",
      "sig": {
        "tech": 86,
        "anl": 66,
        "cre": 38,
        "lead": 30,
        "comm": 36,
        "risk": 46
      }
    },
    {
      "id": "data",
      "industry": "Data & AI / Analytics",
      "role": "Data Scientist / ML Engineer",
      "alt": "Business Intelligence Analyst",
      "sig": {
        "tech": 64,
        "anl": 88,
        "cre": 40,
        "lead": 36,
        "comm": 48,
        "risk": 42
      }
    },
    {
      "id": "pm",
      "industry": "Product Management",
      "role": "Product Manager",
      "alt": "Associate Product Manager",
      "sig": {
        "tech": 42,
        "anl": 66,
        "cre": 68,
        "lead": 62,
        "comm": 74,
        "risk": 52
      }
    },
    {
      "id": "design",
      "industry": "Design & Creative Strategy",
      "role": "UX Designer / Product Designer",
      "alt": "Brand / Creative Strategist",
      "sig": {
        "tech": 26,
        "anl": 40,
        "cre": 90,
        "lead": 44,
        "comm": 76,
        "risk": 58
      }
    },
    {
      "id": "mgmt",
      "industry": "Business Management & Operations",
      "role": "Operations / Strategy Manager",
      "alt": "Business Analyst",
      "sig": {
        "tech": 36,
        "anl": 68,
        "cre": 44,
        "lead": 86,
        "comm": 78,
        "risk": 48
      }
    },
    {
      "id": "fin",
      "industry": "Finance & Investment Banking",
      "role": "Financial / Investment Analyst",
      "alt": "Risk & Compliance Analyst",
      "sig": {
        "tech": 50,
        "anl": 88,
        "cre": 28,
        "lead": 44,
        "comm": 56,
        "risk": 20
      }
    },
    {
      "id": "consult",
      "industry": "Management Consulting",
      "role": "Strategy Consultant",
      "alt": "Business Analyst / Project Manager",
      "sig": {
        "tech": 34,
        "anl": 76,
        "cre": 54,
        "lead": 68,
        "comm": 82,
        "risk": 42
      }
    },
    {
      "id": "startup",
      "industry": "Startups & Entrepreneurship",
      "role": "Co-founder / Growth Lead",
      "alt": "Early-stage Product Builder",
      "sig": {
        "tech": 52,
        "anl": 54,
        "cre": 70,
        "lead": 72,
        "comm": 64,
        "risk": 92
      }
    },
    {
      "id": "core",
      "industry": "Core Engineering (Mech/Civil/Elec)",
      "role": "Design / Systems Engineer",
      "alt": "R&D / Estimation Engineer",
      "sig": {
        "tech": 84,
        "anl": 76,
        "cre": 34,
        "lead": 34,
        "comm": 34,
        "risk": 24
      }
    },
    {
      "id": "mktg",
      "industry": "Marketing, Brand & Growth",
      "role": "Growth / Performance Marketer",
      "alt": "Content Strategist / Brand Manager",
      "sig": {
        "tech": 32,
        "anl": 50,
        "cre": 78,
        "lead": 48,
        "comm": 84,
        "risk": 62
      }
    },
    {
      "id": "hr",
      "industry": "HR & People Operations",
      "role": "HR Business Partner / L&D Lead",
      "alt": "Talent Acquisition Specialist",
      "sig": {
        "tech": 22,
        "anl": 44,
        "cre": 46,
        "lead": 56,
        "comm": 88,
        "risk": 28
      }
    }
  ]
};

const M2: EngineModuleDefinition<JobArchetype> = {
  "id": 2,
  "traits": [
    "ldr",
    "cre",
    "risk",
    "dec",
    "soc",
    "flex"
  ],
  "maxQ": 16,
  "fixed": [
    {
      "id": "j_f1",
      "type": "S",
      "text": "Your company is failing publicly. The founder is present. No one wants to speak first in the all-hands. Five seconds of silence.",
      "opts": [
        {
          "t": "I speak — not because I have the answer but because someone has to break the silence.",
          "w": {
            "ldr": 22,
            "risk": 12,
            "soc": 8
          }
        },
        {
          "t": "I read the room carefully — who is most shaken, what does the founder need from this meeting?",
          "w": {
            "soc": 22,
            "dec": 10
          }
        },
        {
          "t": "I think about what the company needs to hear versus what it wants to hear — and how to frame that.",
          "w": {
            "dec": 18,
            "cre": 12,
            "ldr": 8
          }
        },
        {
          "t": "I feel the discomfort but wait — speaking without something useful to say makes it worse.",
          "w": {
            "dec": 16,
            "risk": -8,
            "flex": 6
          }
        }
      ]
    },
    {
      "id": "j_f2",
      "type": "I",
      "text": "Imagine a work week with no meetings, no deliverables, and no one watching. What do you actually spend it onINR ",
      "opts": [
        {
          "t": "Building something — a project, a prototype, an idea that has been waiting for time.",
          "w": {
            "cre": 22,
            "risk": 10,
            "ldr": 6
          }
        },
        {
          "t": "Learning deeply — going into a subject I only know the surface of.",
          "w": {
            "dec": 20,
            "flex": 8
          }
        },
        {
          "t": "Connecting with people outside my usual orbit — conversations that expand how I see things.",
          "w": {
            "soc": 22,
            "flex": 10
          }
        },
        {
          "t": "Thinking — writing, reflecting, making sense of patterns I have been noticing.",
          "w": {
            "dec": 18,
            "cre": 12
          }
        }
      ]
    },
    {
      "id": "j_f3",
      "type": "B",
      "text": "Think of the last time you changed an environment rather than adapting to it. What did you doINR ",
      "opts": [
        {
          "t": "I identified what was broken and proposed a structural change — then pushed until it happened.",
          "w": {
            "ldr": 24,
            "risk": 12
          }
        },
        {
          "t": "I found an unconventional approach to the same problem that made the old environment irrelevant.",
          "w": {
            "cre": 22,
            "risk": 10
          }
        },
        {
          "t": "I built a coalition of people who felt the same way — change happened because of collective pressure.",
          "w": {
            "soc": 20,
            "ldr": 10,
            "dec": 6
          }
        },
        {
          "t": "I optimised within the environment rather than changing it — making constraints work for me.",
          "w": {
            "dec": 18,
            "flex": 10
          }
        }
      ]
    },
    {
      "id": "j_f4",
      "type": "P",
      "text": "You are designing your own role from scratch. The only constraint is that it has to be one of these.",
      "opts": [
        {
          "t": "I lead a team with full accountability for outcomes — I live and die by the results.",
          "w": {
            "ldr": 24,
            "risk": 12,
            "dec": 8
          }
        },
        {
          "t": "I create — my output is original work that others build from or respond to.",
          "w": {
            "cre": 26,
            "risk": 10
          }
        },
        {
          "t": "I connect — I am the person who makes relationships, deals, and collaborations happen.",
          "w": {
            "soc": 24,
            "flex": 10
          }
        },
        {
          "t": "I decide — I am the person who makes the calls that others implement.",
          "w": {
            "dec": 24,
            "ldr": 12
          }
        }
      ]
    },
    {
      "id": "j_f5",
      "type": "S",
      "text": "You are offered a significant opportunity that requires relocating to a city where you know no one, in a domain you have never worked in.",
      "opts": [
        {
          "t": "I am energised. New city, new domain — that is exactly the kind of forcing function I respond to.",
          "w": {
            "flex": 24,
            "risk": 18
          }
        },
        {
          "t": "I am interested but cautious — I would need to understand the role deeply before committing.",
          "w": {
            "dec": 20,
            "risk": 4,
            "flex": 6
          }
        },
        {
          "t": "The city concerns me more than the domain — my relationships are my infrastructure.",
          "w": {
            "soc": 18,
            "risk": -8,
            "flex": -6
          }
        },
        {
          "t": "I would take it if I had clarity on what success looked like within 12 months.",
          "w": {
            "dec": 18,
            "risk": 6,
            "ldr": 8
          }
        }
      ]
    }
  ],
  "adaptive": [
    {
      "id": "j_a1",
      "targets": [
        "ldr",
        "dec"
      ],
      "type": "S",
      "text": "Your team has reached a decision that you believe is correct. Half the room disagrees. The meeting is ending.",
      "opts": [
        {
          "t": "I call the decision and take responsibility for it. We can revisit if new evidence emerges.",
          "w": {
            "ldr": 24,
            "risk": 10,
            "dec": 10
          }
        },
        {
          "t": "I request more time — a rushed decision in a split room is worse than a delayed one.",
          "w": {
            "dec": 20,
            "risk": -6
          }
        },
        {
          "t": "I find the strongest argument on the other side and address it directly before closing.",
          "w": {
            "dec": 18,
            "ldr": 10,
            "cre": 6
          }
        },
        {
          "t": "I frame a trial period — commit to the decision for 30 days, then evaluate with shared criteria.",
          "w": {
            "dec": 16,
            "ldr": 12,
            "flex": 8
          }
        }
      ]
    },
    {
      "id": "j_a2",
      "targets": [
        "cre",
        "risk"
      ],
      "type": "I",
      "text": "Imagine you had to build your personal brand from zero — no past work, no network, no credentials. What is your moveINR ",
      "opts": [
        {
          "t": "I do something remarkable in public — something that speaks for itself and cannot be ignored.",
          "w": {
            "cre": 24,
            "risk": 16
          }
        },
        {
          "t": "I find the most credible person in the space I want to enter and make myself useful to them.",
          "w": {
            "soc": 20,
            "dec": 12,
            "ldr": 8
          }
        },
        {
          "t": "I publish a specific, original point of view consistently until people seek it out.",
          "w": {
            "cre": 18,
            "dec": 12,
            "risk": 8
          }
        },
        {
          "t": "I identify the gap no one is filling and become the person who fills it.",
          "w": {
            "dec": 20,
            "cre": 10,
            "risk": 8
          }
        }
      ]
    },
    {
      "id": "j_a3",
      "targets": [
        "soc",
        "flex"
      ],
      "type": "B",
      "text": "You joined a team with an established culture you were not sure you agreed with. What did you doINR ",
      "opts": [
        {
          "t": "I adapted — I focused on learning the culture before trying to change anything.",
          "w": {
            "flex": 22,
            "soc": 10
          }
        },
        {
          "t": "I stayed true to how I work and let the quality of results speak.",
          "w": {
            "risk": 12,
            "ldr": 10,
            "flex": -6
          }
        },
        {
          "t": "I was transparent about my perspective while being respectful of theirs.",
          "w": {
            "soc": 14,
            "ldr": 10,
            "cre": 8
          }
        },
        {
          "t": "I found the subculture within the culture — people who operated the way I do.",
          "w": {
            "soc": 18,
            "flex": 10,
            "cre": 6
          }
        }
      ]
    },
    {
      "id": "j_a4",
      "targets": [
        "risk",
        "flex"
      ],
      "type": "P",
      "text": "Which kind of professional risk is most like the one you are most willing to takeINR ",
      "opts": [
        {
          "t": "Leaving a stable situation before the next one is confirmed.",
          "w": {
            "risk": 26,
            "flex": 14
          }
        },
        {
          "t": "Publicly advocating for a position that your field's consensus opposes.",
          "w": {
            "risk": 20,
            "ldr": 10,
            "cre": 8
          }
        },
        {
          "t": "Taking a role that requires capabilities you have not yet fully developed.",
          "w": {
            "risk": 16,
            "flex": 12,
            "ldr": 8
          }
        },
        {
          "t": "Turning down a well-paid, respected opportunity because it does not align with your direction.",
          "w": {
            "risk": 18,
            "dec": 14
          }
        }
      ]
    },
    {
      "id": "j_a5",
      "targets": [
        "soc",
        "ldr"
      ],
      "type": "S",
      "text": "A new person joins your organisation who is clearly talented but struggling socially. They are not asking for help.",
      "opts": [
        {
          "t": "I create an opportunity for connection — I invite them to something low-stakes.",
          "w": {
            "soc": 22,
            "ldr": 8,
            "flex": 6
          }
        },
        {
          "t": "I give them time — struggling socially at first is normal and over-intervention can be patronising.",
          "w": {
            "dec": 14,
            "flex": 12
          }
        },
        {
          "t": "I mention it to their manager — this seems like something that should be addressed structurally.",
          "w": {
            "ldr": 16,
            "dec": 10
          }
        },
        {
          "t": "I observe whether it is affecting their work before deciding whether to act.",
          "w": {
            "dec": 18,
            "soc": 6
          }
        }
      ]
    },
    {
      "id": "j_a6",
      "targets": [
        "cre",
        "dec"
      ],
      "type": "I",
      "text": "Imagine the most intellectually alive you have ever felt at work. What was happeningINR ",
      "opts": [
        {
          "t": "I was solving a problem nobody had a clean answer to — and the solution came from an unexpected place.",
          "w": {
            "cre": 22,
            "dec": 10,
            "risk": 8
          }
        },
        {
          "t": "I was making a high-stakes decision with incomplete information and it worked.",
          "w": {
            "dec": 22,
            "ldr": 12,
            "risk": 10
          }
        },
        {
          "t": "I was in a conversation where every person in the room was challenging my thinking.",
          "w": {
            "soc": 18,
            "dec": 12,
            "cre": 8
          }
        },
        {
          "t": "I was building something and I could feel it starting to work.",
          "w": {
            "cre": 18,
            "risk": 10,
            "flex": 8
          }
        }
      ]
    },
    {
      "id": "j_a7",
      "targets": [
        "dec",
        "flex"
      ],
      "type": "B",
      "text": "Think of a moment where you changed direction on something you had already committed to. What made you do itINR ",
      "opts": [
        {
          "t": "New evidence made the original direction clearly wrong — I pivoted as soon as I saw it.",
          "w": {
            "dec": 22,
            "flex": 12
          }
        },
        {
          "t": "I realised I had been optimising for the wrong thing — the goal shifted, not just the path.",
          "w": {
            "dec": 18,
            "cre": 10,
            "flex": 10
          }
        },
        {
          "t": "Someone I trusted made a compelling case — I am not so attached to my own views that I ignore good arguments.",
          "w": {
            "soc": 16,
            "flex": 14
          }
        },
        {
          "t": "Honestly, I rarely change direction mid-commitment. I am more likely to see it through and debrief.",
          "w": {
            "dec": 16,
            "risk": -8,
            "flex": -10
          }
        }
      ]
    },
    {
      "id": "j_a8",
      "targets": [
        "ldr",
        "soc"
      ],
      "type": "P",
      "text": "You can only do one of these well. Which do you chooseINR ",
      "opts": [
        {
          "t": "Leading — setting the direction and being accountable for outcomes.",
          "w": {
            "ldr": 26,
            "dec": 10
          }
        },
        {
          "t": "Connecting — building the relationships and trust that make everything else possible.",
          "w": {
            "soc": 26,
            "ldr": 6
          }
        },
        {
          "t": "Creating — producing original work that others could not have produced.",
          "w": {
            "cre": 26,
            "risk": 8
          }
        },
        {
          "t": "Deciding — making the hard calls with clarity, speed, and accountability.",
          "w": {
            "dec": 26,
            "ldr": 8
          }
        }
      ]
    },
    {
      "id": "j_a9",
      "targets": [
        "risk",
        "ldr"
      ],
      "type": "S",
      "text": "Your organisation is about to make a strategic move that you think is wrong. You have one opportunity to speak.",
      "opts": [
        {
          "t": "I make the strongest possible case with the evidence I have — the outcome is theirs but the argument is mine.",
          "w": {
            "ldr": 22,
            "risk": 14,
            "dec": 8
          }
        },
        {
          "t": "I ask the one question that forces them to articulate an assumption they have not examined.",
          "w": {
            "cre": 18,
            "dec": 14,
            "ldr": 8
          }
        },
        {
          "t": "I make my view known clearly and then commit fully to executing whatever they decide.",
          "w": {
            "ldr": 16,
            "dec": 14,
            "risk": 6
          }
        },
        {
          "t": "I wait — sometimes the right thing is to be on record having disagreed, not to fight a losing battle.",
          "w": {
            "dec": 18,
            "risk": -8,
            "flex": 8
          }
        }
      ]
    },
    {
      "id": "j_a10",
      "targets": [
        "flex",
        "cre"
      ],
      "type": "B",
      "text": "Tell me about a time you surprised yourself with how you handled something. What did that revealINR ",
      "opts": [
        {
          "t": "I was more resilient than I expected — I held together under pressure I thought would break me.",
          "w": {
            "risk": 16,
            "flex": 14,
            "ldr": 8
          }
        },
        {
          "t": "I found a creative solution I did not know I had — it came from constraint not comfort.",
          "w": {
            "cre": 22,
            "flex": 12
          }
        },
        {
          "t": "I managed people much better than I predicted — something clicked about how to bring people with me.",
          "w": {
            "ldr": 18,
            "soc": 14
          }
        },
        {
          "t": "I was more decisive than usual — the clarity came from having no good options, only less bad ones.",
          "w": {
            "dec": 20,
            "risk": 10
          }
        }
      ]
    },
    {
      "id": "j_a11",
      "targets": [
        "soc",
        "flex"
      ],
      "type": "I",
      "text": "Imagine the best professional version of yourself. What is the most important thing that version does differentlyINR ",
      "opts": [
        {
          "t": "She or he moves more decisively with less certainty — acts before feeling fully ready.",
          "w": {
            "risk": 20,
            "ldr": 10,
            "flex": 10
          }
        },
        {
          "t": "She or he spends more time in deep conversation with people who are very different from them.",
          "w": {
            "soc": 22,
            "flex": 10
          }
        },
        {
          "t": "She or he produces more original work instead of responding to others' agendas.",
          "w": {
            "cre": 22,
            "risk": 8
          }
        },
        {
          "t": "She or he leads from the front more — takes ownership rather than contributing from the side.",
          "w": {
            "ldr": 22,
            "risk": 10
          }
        }
      ]
    },
    {
      "id": "j_a12",
      "targets": [
        "risk",
        "flex"
      ],
      "type": "P",
      "text": "Two paths: one you are almost certain to do well on; one you might fail at but would learn more from. You choose:",
      "opts": [
        {
          "t": "The uncertain one, without hesitation. I optimise for learning, not for looking good.",
          "w": {
            "risk": 24,
            "flex": 16,
            "cre": 6
          }
        },
        {
          "t": "The certain one — I need a foundation of wins before I can afford to take real risks.",
          "w": {
            "risk": -18,
            "dec": 12
          }
        },
        {
          "t": "The uncertain one, but only after I have understood the specific failure modes.",
          "w": {
            "dec": 18,
            "risk": 12
          }
        },
        {
          "t": "It depends on what is at stake — for me right now this is not a principled answer.",
          "w": {
            "dec": 16,
            "flex": 10
          }
        }
      ]
    },
    {
      "id": "j_a13",
      "targets": [
        "ldr",
        "cre"
      ],
      "type": "S",
      "text": "A junior person on your team produces work that is creative but not what was asked for. Deadline was yesterday.",
      "opts": [
        {
          "t": "I use what they have and ship it — done is better than perfect, and creativity deserves respect.",
          "w": {
            "flex": 18,
            "risk": 12,
            "cre": 8
          }
        },
        {
          "t": "I ask them to redo the specific element that missed the brief — I hold the standard.",
          "w": {
            "ldr": 22,
            "dec": 12
          }
        },
        {
          "t": "I spend an hour with them to understand what they were trying to do — then we solve it together.",
          "w": {
            "soc": 18,
            "ldr": 12,
            "cre": 8
          }
        },
        {
          "t": "I take it back myself — fastest path to done is usually to do it.",
          "w": {
            "ldr": 14,
            "risk": 10,
            "dec": 8
          }
        }
      ]
    },
    {
      "id": "j_a14",
      "targets": [
        "dec",
        "soc"
      ],
      "type": "B",
      "text": "Think of a relationship at work that required genuine effort to build. What did you doINR ",
      "opts": [
        {
          "t": "I found what they cared about and made it easy to work around that — met them where they were.",
          "w": {
            "soc": 22,
            "flex": 10
          }
        },
        {
          "t": "I was direct about what I needed from them and asked what they needed from me.",
          "w": {
            "ldr": 18,
            "dec": 12,
            "soc": 6
          }
        },
        {
          "t": "I was patient — I showed up consistently even when the relationship was not yet producing anything.",
          "w": {
            "soc": 20,
            "flex": 12
          }
        },
        {
          "t": "I looked for the specific moment to do something useful for them, without being asked.",
          "w": {
            "soc": 18,
            "cre": 10,
            "flex": 8
          }
        }
      ]
    },
    {
      "id": "j_a15",
      "targets": [
        "cre",
        "risk"
      ],
      "type": "I",
      "text": "If you had to bet your career on one thing — not the safe thing, the true thing — what would it beINR ",
      "opts": [
        {
          "t": "That original thinking at the right moment is worth more than any amount of execution.",
          "w": {
            "cre": 24,
            "risk": 12
          }
        },
        {
          "t": "That relationships are the only durable advantage in any field.",
          "w": {
            "soc": 22,
            "ldr": 8,
            "dec": 6
          }
        },
        {
          "t": "That the people willing to make decisions in the dark are the ones who matter most.",
          "w": {
            "ldr": 20,
            "risk": 18,
            "dec": 8
          }
        },
        {
          "t": "That knowing yourself deeply enough to play to your actual strengths beats any strategy.",
          "w": {
            "dec": 20,
            "flex": 12
          }
        }
      ]
    }
  ],
  "archetypes": [
    {
      "id": "mgmt",
      "type": "Management Type",
      "sub": "Strategic Operator",
      "envs": [
        "Growing teams",
        "P&L ownership",
        "Cross-functional orgs"
      ],
      "jobs": [
        "Team Lead",
        "Operations Manager",
        "Director / VP",
        "Chief of Staff"
      ],
      "sig": {
        "ldr": 88,
        "cre": 46,
        "risk": 52,
        "dec": 64,
        "soc": 70,
        "flex": 52
      }
    },
    {
      "id": "creative",
      "type": "Creative Type",
      "sub": "Original Thinker",
      "envs": [
        "Agencies & studios",
        "Early-stage startups",
        "Design-led orgs"
      ],
      "jobs": [
        "Creative Director",
        "UX Lead",
        "Brand Strategist",
        "Content Lead"
      ],
      "sig": {
        "ldr": 40,
        "cre": 90,
        "risk": 64,
        "dec": 44,
        "soc": 58,
        "flex": 72
      }
    },
    {
      "id": "analytical",
      "type": "Analytical Type",
      "sub": "Strategic Advisor",
      "envs": [
        "Research orgs",
        "Consulting firms",
        "Data-first companies"
      ],
      "jobs": [
        "Data Scientist",
        "Strategy Consultant",
        "Research Lead",
        "Finance Analyst"
      ],
      "sig": {
        "ldr": 42,
        "cre": 34,
        "risk": 28,
        "dec": 90,
        "soc": 40,
        "flex": 34
      }
    },
    {
      "id": "technical",
      "type": "Technical Type",
      "sub": "Deep Specialist",
      "envs": [
        "Engineering orgs",
        "R&D labs",
        "Deep-tech companies"
      ],
      "jobs": [
        "Software Engineer",
        "ML Engineer",
        "Systems Architect",
        "DevOps Lead"
      ],
      "sig": {
        "ldr": 34,
        "cre": 42,
        "risk": 40,
        "dec": 70,
        "soc": 30,
        "flex": 44
      }
    },
    {
      "id": "entrepreneur",
      "type": "Entrepreneurial Type",
      "sub": "Risk-Driven Builder",
      "envs": [
        "Startups",
        "Venture-backed orgs",
        "Self-directed ventures"
      ],
      "jobs": [
        "Founder",
        "Early Startup Lead",
        "Venture Investor",
        "Growth Lead"
      ],
      "sig": {
        "ldr": 72,
        "cre": 68,
        "risk": 92,
        "dec": 54,
        "soc": 58,
        "flex": 82
      }
    },
    {
      "id": "support",
      "type": "Support & Operations Type",
      "sub": "Collaborative Enabler",
      "envs": [
        "Large orgs",
        "Service industries",
        "Mission-driven companies"
      ],
      "jobs": [
        "HR Business Partner",
        "Customer Success Lead",
        "Ops Coordinator",
        "Account Manager"
      ],
      "sig": {
        "ldr": 44,
        "cre": 36,
        "risk": 20,
        "dec": 68,
        "soc": 84,
        "flex": 40
      }
    },
    {
      "id": "connector",
      "type": "Connector Type",
      "sub": "Relationship Architect",
      "envs": [
        "BD-heavy orgs",
        "Consulting",
        "Community-led companies"
      ],
      "jobs": [
        "Business Development",
        "Partnerships Lead",
        "Community Manager",
        "Client Partner"
      ],
      "sig": {
        "ldr": 58,
        "cre": 48,
        "risk": 44,
        "dec": 52,
        "soc": 90,
        "flex": 64
      }
    }
  ]
};

const MODULES: Record<PsychometricModule, AnyModuleDefinition> = {
  resume_builder: M1,
  job_discovery: M2,
};

let state: EngineState | null = null;

function isBrowserEnvironment() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function appendDebugRun(entry: DebugAnswerRun | DebugResultRun) {
  if (!isBrowserEnvironment()) {
    return;
  }

  try {
    const existing = window.localStorage.getItem(DEBUG_STORAGE_KEY);
    const parsed = existing ? (JSON.parse(existing) as Array<DebugAnswerRun | DebugResultRun>) : [];
    const next = [...parsed, entry].slice(-50);
    window.localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.debug("[psychometric] unable to persist debug run", error);
  }
}

function getRawTraitSnapshot() {
  if (!state) {
    return {} as Record<string, number>;
  }

  return Object.fromEntries(
    Object.entries(state.tr).map(([trait, traitState]) => [trait, Math.round(traitState.score * 100) / 100]),
  );
}

function scoreArchetypes() {
  if (!state) {
    return [] as RankedArchetype[];
  }

  return state.mod.archetypes
    .map((arch) => {
      let similarity = 0;
      let weightTotal = 0;

      Object.entries(arch.sig).forEach(([trait, ideal]) => {
        const traitState = state?.tr[trait];
        if (!traitState) {
          return;
        }

        const diff = 100 - Math.abs(traitState.score - ideal);
        const weight = traitState.conf + 0.1;
        similarity += diff * weight;
        weightTotal += 100 * weight;
      });

      return {
        arch,
        score: weightTotal > 0 ? (similarity / weightTotal) * 100 : 0,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.arch.id.localeCompare(right.arch.id);
    });
}

function getDiffTraits(archetypes: EngineArchetype[]) {
  if (archetypes.length < 2) {
    return [] as string[];
  }

  const [first, second] = archetypes;
  return Object.keys(first.sig)
    .map((trait) => ({
      trait,
      diff: Math.abs((first.sig[trait] ?? 50) - (second.sig[trait] ?? 50)),
    }))
    .sort((left, right) => right.diff - left.diff)
    .slice(0, 2)
    .map(({ trait }) => trait);
}

function separation() {
  const ranked = scoreArchetypes();
  if (ranked.length < 2) {
    return 1;
  }

  return Math.min(1, (ranked[0].score - ranked[1].score) / 18);
}

function getTopTraitKeys(limit = 2) {
  if (!state) {
    return [] as string[];
  }

  if (state.answered < 4) {
    return [] as string[];
  }

  const normalized = getNormalizedTraitScores();
  return Object.entries(state.tr)
    .sort((left, right) => {
      const rightWeight =
        (normalized[right[0]] ?? 0) * 1.2 + Math.abs(right[1].total) * (1 + right[1].conf * 0.25);
      const leftWeight =
        (normalized[left[0]] ?? 0) * 1.2 + Math.abs(left[1].total) * (1 + left[1].conf * 0.25);
      if (rightWeight !== leftWeight) {
        return rightWeight - leftWeight;
      }

      const scoreGap = Math.abs(right[1].score - 50) - Math.abs(left[1].score - 50);
      if (scoreGap !== 0) {
        return scoreGap;
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([trait]) => trait);
}

function getTraitKeyPair() {
  const topKeys = getTopTraitKeys(2);
  return [...topKeys]
    .map((trait) => MODULE_TRAIT_LABELS[state?.moduleKey ?? "resume_builder"][trait] ?? trait)
    .sort()
    .join("+");
}

function getContradictionScore() {
  if (!state) {
    return 0;
  }

  return Object.values(state.tr).reduce((sum, traitState) => sum + traitState.contradictions, 0);
}

function getNormalizedTraitScores() {
  if (!state) {
    return {} as Record<string, number>;
  }

  const weightedTotals = Object.entries(state.tr).map(([trait, traitState]) => {
    const polarityBoost =
      traitState.total >= 0 ? traitState.positive * 0.25 : traitState.negative * 0.25;
    const contradictionPenalty = traitState.contradictions * 4;
    const weighted =
      Math.max(0, traitState.score - 50) +
      Math.abs(traitState.total) * 0.65 +
      traitState.conf * 18 +
      polarityBoost -
      contradictionPenalty;

    return [trait, Math.max(0, weighted)] as const;
  });

  const weightedAverage =
    weightedTotals.reduce((sum, [, value]) => sum + value, 0) / Math.max(1, weightedTotals.length);

  const diversifiedTotals = weightedTotals.map(([trait, value]) => {
    const diversified = value < weightedAverage ? value + weightedAverage * DIVERSITY_BOOST_FACTOR : value;
    return [trait, diversified] as const;
  });

  const absTotal = diversifiedTotals.reduce((sum, [, value]) => sum + Math.abs(value), 0);
  if (absTotal <= 0) {
    return Object.fromEntries(diversifiedTotals.map(([trait]) => [trait, 0]));
  }

  const normalizedEntries = diversifiedTotals.map(([trait, value]) => [
    trait,
    (Math.abs(value) / absTotal) * 100,
  ]) as [string, number][];

  const dampenedEntries = normalizedEntries.map(([trait, value]) => [
    trait,
    Math.pow(value, DAMPENING_POWER),
  ]) as [string, number][];

  const dampenedTotal = dampenedEntries.reduce((sum, [, value]) => sum + Math.abs(value), 0);
  if (dampenedTotal <= 0) {
    return Object.fromEntries(dampenedEntries.map(([trait]) => [trait, 0]));
  }

  const renormalizedEntries = dampenedEntries.map(([trait, value]) => [
    trait,
    (Math.abs(value) / dampenedTotal) * 100,
  ]) as [string, number][];

  const dominant = renormalizedEntries.find(([, value]) => value > REBALANCE_THRESHOLD);
  if (dominant && renormalizedEntries.length > 1) {
    const reduction = dominant[1] * REBALANCE_REDUCTION;
    const redistribution = reduction / (renormalizedEntries.length - 1);
    dominant[1] -= reduction;

    renormalizedEntries.forEach((entry) => {
      if (entry[0] !== dominant[0]) {
        entry[1] += redistribution;
      }
    });
  }

  const separatedEntries = renormalizedEntries.map(([trait, value]) => {
    const traitState = state?.tr[trait];
    const answerDrivenNudge = Math.min(0.5, Math.abs(traitState?.total ?? 0) * 0.005);
    return [trait, value + answerDrivenNudge] as [string, number];
  });

  const flooredEntries = separatedEntries.map(([trait, value]) => [trait, Math.max(MIN_TRAIT_FLOOR, value)] as [string, number]);
  const renormalizedTotal = flooredEntries.reduce((sum, [, value]) => sum + Math.abs(value), 0);
  if (renormalizedTotal <= 0) {
    return Object.fromEntries(flooredEntries.map(([trait]) => [trait, 0]));
  }

  return Object.fromEntries(
    flooredEntries.map(([trait, value]) => [trait, Math.round((Math.abs(value) / renormalizedTotal) * 100)]),
  );
}

function getTopTraitSpread() {
  const topKeys = getTopTraitKeys(2);
  const normalized = getNormalizedTraitScores();

  if (topKeys.length < 2) {
    return 100;
  }

  return Math.abs((normalized[topKeys[0]] ?? 0) - (normalized[topKeys[1]] ?? 0));
}

function isHybridProfile() {
  if (!state) {
    return false;
  }

  return getTopTraitSpread() < 5 || getContradictionScore() >= 2;
}

function getEvenRepresentationScore() {
  if (!state) {
    return 0;
  }

  const coverage = Object.values(state.tr).filter((traitState) => traitState.dirs.length > 0).length;
  return coverage / state.mod.traits.length;
}

function getTraitLabel(trait: string) {
  if (!state) {
    return trait;
  }

  return MODULE_TRAIT_LABELS[state.moduleKey][trait] ?? trait;
}

function getJobCategoryLabel(trait: string) {
  return JOB_TRAIT_CATEGORY_MAP[trait] ?? getTraitLabel(trait);
}

function createDerivedJobArchetype(
  id: string,
  mapped: Omit<JobArchetype, "id" | "sig" | "envs">,
  envs: string[] = ["Cross-functional teams", "Adaptive environments", "Role-flexible orgs"],
) {
  return {
    id,
    type: mapped.type,
    sub: mapped.sub,
    jobs: mapped.jobs,
    envs,
    sig: {},
  } satisfies JobArchetype;
}

function getSingleTraitJobArchetype(topTrait: string, topScore: number) {
  const mapped = JOB_DISCOVERY_SINGLE_TRAIT_MAP[topTrait];
  if (!mapped) {
    return null;
  }

  return {
    arch: createDerivedJobArchetype(
      `job-single-${topTrait.toLowerCase()}`,
      mapped,
      ["Focused contributor roles", "Team-based execution", "Clarity-driven environments"],
    ),
    score: Math.min(96, 72 + topScore / 4),
  } satisfies RankedArchetype;
}

function generateExplanation(best: EngineArchetype | null) {
  if (!state) {
    return "";
  }

  const topKeys = getTopTraitKeys(2);
  const normalized = getNormalizedTraitScores();
  const pair = topKeys.map(getTraitLabel).join(" and ");
  const pairScores = topKeys.map((trait) => `${getTraitLabel(trait)} ${normalized[trait] ?? 0}%`).join(", ");
  const hybridText = isHybridProfile()
    ? "Your profile is balanced enough to read as a hybrid rather than a single-lane fit."
    : "Your top traits separate cleanly enough to suggest a focused direction.";

  if (!best) {
    return `${pair} emerged as your strongest pattern. ${hybridText}`;
  }

  if ("industry" in best) {
    return `${pair} emerged as your strongest pattern (${pairScores}), which aligned best with ${best.industry}. ${hybridText}`;
  }

  return `${pair} emerged as your strongest pattern (${pairScores}), which aligned best with the ${best.type} profile. ${hybridText}`;
}

function getJobDiscoveryBest(ranked: RankedArchetype[]) {
  if (!state || state.moduleKey !== "job_discovery") {
    return null;
  }

  const topKeys = getTopTraitKeys(2);
  const normalized = getNormalizedTraitScores();
  const confidence = getConfidence() / 100;
  const executionScore = Math.max(normalized.ldr ?? 0, normalized.risk ?? 0);
  const otherScores = Object.entries(normalized)
    .filter(([trait]) => trait !== "ldr" && trait !== "risk")
    .map(([, value]) => value);
  const [topTraitKey] = topKeys;
  const topTrait = topTraitKey ? getJobCategoryLabel(topTraitKey) : "";
  const topTraitScore = topTraitKey ? normalized[topTraitKey] ?? 0 : 0;
  const topTwoScores = topKeys.map((trait) => normalized[trait] ?? 0);
  const topSpread =
    topTwoScores.length >= 2 ? Math.abs((topTwoScores[0] ?? 0) - (topTwoScores[1] ?? 0)) : 100;
  const hybridAllowed = topSpread < 2 && confidence < 0.4;

  if (topKeys.length < 2) {
    return (
      (topTraitScore > 40 && topTrait ? getSingleTraitJobArchetype(topTrait, topTraitScore) : null) ??
      getSingleTraitJobArchetype(topTrait || "Analytical", Math.max(35, topTraitScore))
    );
  }

  if (executionScore > 65 && otherScores.every((value) => value < 20)) {
    const entrepreneur = state.mod.archetypes.find((arch) => arch.id === "entrepreneur");
    if (entrepreneur) {
      return {
        arch: entrepreneur,
        score: ranked.find((entry) => entry.arch.id === "entrepreneur")?.score ?? 92,
      } satisfies RankedArchetype;
    }
  }

  const [t1, t2] = topKeys.map(getJobCategoryLabel);
  const key1 = `${t1}-${t2}`;
  const key2 = `${t2}-${t1}`;
  const mapped = JOB_DISCOVERY_COMBINATION_MAP[key1] ?? JOB_DISCOVERY_COMBINATION_MAP[key2];

  if (mapped && topTraitScore > 35) {
    return {
      arch: createDerivedJobArchetype(
        `job-combo-${key1.toLowerCase().replace(/[^a-z]+/g, "-")}`,
        mapped,
      ),
      score: Math.min(97, (ranked[0]?.score ?? 74) + 2),
    } satisfies RankedArchetype;
  }

  if (hybridAllowed) {
    return (
      (topTraitScore > 40 && topTrait ? getSingleTraitJobArchetype(topTrait, topTraitScore) : null) ??
      ({
        arch: createDerivedJobArchetype("hybrid-professional", {
          type: "Hybrid Professional",
          sub: "Balanced profile with overlapping strengths across multiple work styles",
          jobs: ["Program Generalist", "Strategy Coordinator", "Cross-Functional Associate"],
        }),
        score: Math.min(95, ranked[0]?.score ?? 72),
      } satisfies RankedArchetype)
    );
  }

  if (mapped) {
    return {
      arch: createDerivedJobArchetype(
        `job-combo-${key1.toLowerCase().replace(/[^a-z]+/g, "-")}`,
        mapped,
      ),
      score: Math.min(97, (ranked[0]?.score ?? 74) + 2),
    } satisfies RankedArchetype;
  }

  return (
    getSingleTraitJobArchetype(topTrait, Math.max(35, topTraitScore)) ??
    {
      arch: createDerivedJobArchetype("job-single-analytical", JOB_DISCOVERY_SINGLE_TRAIT_MAP.Analytical),
      score: Math.min(95, ranked[0]?.score ?? 72),
    } satisfies RankedArchetype
  );
}

function getHybridBest(ranked: RankedArchetype[]) {
  if (!state || ranked.length === 0) {
    return null;
  }

  const pairKey = getTraitKeyPair();
  const contradictionScore = getContradictionScore();
  const topSpread = getTopTraitSpread();

  if ((contradictionScore < 2 && topSpread >= 5) || topSpread > 12 || getTopTraitKeys(2).length < 2) {
    return null;
  }

  if (state.moduleKey === "resume_builder") {
    const mapped = RESUME_TRAIT_ROLE_MAP[pairKey];
    if (!mapped) {
      return null;
    }

    return {
      arch: {
        id: `hybrid-${pairKey}`,
        industry: mapped.industry,
        role: mapped.role,
        alt: mapped.alt,
        sig: {},
      } satisfies ResumeArchetype,
      score: Math.min(97, (ranked[0]?.score ?? 70) + 2),
    } satisfies RankedArchetype;
  }

  const mapped = JOB_TRAIT_ROLE_MAP[pairKey];
  if (!mapped) {
    return null;
  }

  return {
    arch: {
      id: `hybrid-${pairKey}`,
      type: mapped.type,
      sub: mapped.sub,
      jobs: mapped.jobs,
      envs: ["Adaptive environments", "Cross-functional teams", "Hybrid-fit roles"],
      sig: {},
    } satisfies JobArchetype,
    score: Math.min(97, (ranked[0]?.score ?? 70) + 2),
  } satisfies RankedArchetype;
}

function earlyBonus() {
  return state && state.answered < 3 ? 0.9 : 1;
}

function getAverageTraitConfidence() {
  if (!state) {
    return 0;
  }

  return (
    Object.values(state.tr).reduce((sum, traitState) => sum + traitState.conf, 0) /
    state.mod.traits.length
  );
}

function applyWeights(weights: TraitScores) {
  if (!state) {
    return;
  }

  const currentState = state;
  let conflicts = 0;
  const bonus = earlyBonus();
  const questionIndex = currentState.answered;
  const totalQuestions = Math.min(currentState.mod.maxQ, MAX_QUESTIONS);
  const positionWeight = 1 + questionIndex / Math.max(1, totalQuestions);

  Object.entries(weights).forEach(([trait, delta]) => {
    if (Math.abs(delta) < 6) {
      return;
    }

    const traitState = currentState.tr[trait];
    if (!traitState) {
      return;
    }

    const adjusted = delta * bonus * positionWeight;
    const prevDirection = traitState.dirs.length
      ? Math.sign(traitState.dirs.reduce((sum, value) => sum + value, 0))
      : 0;
    const newDirection = Math.sign(delta);

    if (prevDirection !== 0 && newDirection !== 0 && prevDirection !== newDirection) {
      conflicts += 1;
      currentState.recentConflictTraits.add(trait);
      traitState.contradictions += 1;
    }

    const damping = 1 - traitState.conf * 0.45;
    traitState.score = Math.max(0, Math.min(100, traitState.score + adjusted * damping));
    traitState.dirs.push(newDirection);
    traitState.total += adjusted;
    if (adjusted >= 0) {
      traitState.positive += adjusted;
    } else {
      traitState.negative += Math.abs(adjusted);
    }

    const totalDirections = traitState.dirs.length;
    const positiveDirections = traitState.dirs.filter((value) => value > 0).length;
    const ratio = Math.abs(positiveDirections / totalDirections - 0.5) * 2;
    traitState.conf = Math.min(1, ratio + totalDirections * 0.055);
  });

  currentState.conflictPenalty += conflicts * 2;
}

function shouldStop() {
  if (!state) {
    return true;
  }

  const MIN_Q = 9;
  const CONF_T = 0.68;
  const STAB = 3;
  const EARLY_STOP_Q = 8;

  if (state.answered >= Math.min(state.mod.maxQ, MAX_QUESTIONS)) {
    return true;
  }

  if (
    state.answered >= EARLY_STOP_Q &&
    getAverageTraitConfidence() > 0.75 &&
    getEvenRepresentationScore() >= 0.8
  ) {
    return true;
  }

  if (state.answered < MIN_Q) {
    return false;
  }

  if (state.pHist.length >= STAB) {
    const tail = state.pHist.slice(-STAB);
    if (tail.every((value) => value === tail[0]) && separation() > 0.22) {
      return true;
    }
  }

  return Object.values(state.tr).every((traitState) => traitState.conf >= CONF_T);
}

function getFriendlyTopTraits() {
  if (!state) {
    return [] as string[];
  }

  const labels = MODULE_TRAIT_LABELS[state.moduleKey];
  return getTopTraitKeys(2).map((trait) => labels[trait] ?? trait);
}

export function init(module: PsychometricModule) {
  const mod = MODULES[module];
  const tr = mod.traits.reduce<Record<string, TraitState>>((acc, trait) => {
    acc[trait] = {
      score: 50,
      conf: 0,
      dirs: [],
      total: 0,
      positive: 0,
      negative: 0,
      contradictions: 0,
    };
    return acc;
  }, {});

  state = {
    moduleKey: module,
    mod,
    tr,
    asked: new Set<string>(),
    qIdx: 0,
    answered: 0,
    pHist: [],
    conflictPenalty: 0,
    recentConflictTraits: new Set<string>(),
  };
}

export function nextQuestion() {
  if (!state) {
    return null;
  }

  const { mod, qIdx, asked, recentConflictTraits } = state;
  if (qIdx < mod.fixed.length) {
    return mod.fixed[qIdx];
  }

  const ranked = scoreArchetypes();
  const topTwo = [ranked[0]?.arch, ranked[1]?.arch].filter(Boolean) as EngineArchetype[];

  if (recentConflictTraits.size > 0) {
    const conflictTrait = [...recentConflictTraits][0];
    const reprobe = mod.adaptive.find(
      (question) => !asked.has(question.id) && question.targets?.includes(conflictTrait),
    );
    if (reprobe) {
      recentConflictTraits.delete(conflictTrait);
      return reprobe;
    }
  }

  if (topTwo.length === 2) {
    const diffTraits = getDiffTraits(topTwo);
    const byDiff = mod.adaptive.find(
      (question) =>
        !asked.has(question.id) &&
        question.targets?.some((trait) => diffTraits.includes(trait)),
    );
    if (byDiff) {
      return byDiff;
    }
  }

  const weakestTrait = Object.entries(state.tr).sort((left, right) => left[1].conf - right[1].conf)[0]?.[0];
  if (weakestTrait) {
    const byWeakness = mod.adaptive.find(
      (question) => !asked.has(question.id) && question.targets?.includes(weakestTrait),
    );
    if (byWeakness) {
      return byWeakness;
    }
  }

  return mod.adaptive.find((question) => !asked.has(question.id)) ?? null;
}

export function recordAnswer(question: EngineQuestion, optionIndex: number) {
  if (!state) {
    throw new Error("Psychometric engine has not been initialized.");
  }

  const option = question.opts[optionIndex];
  if (!option) {
    throw new Error("Invalid option index for psychometric question.");
  }

  state.asked.add(question.id);
  applyWeights(option.w);
  state.answered += 1;
  state.qIdx += 1;

  const best = scoreArchetypes()[0];
  if (best && state.answered >= 4) {
    state.pHist.push(best.arch.id);
  }

  const normalizedScores = getNormalizedTraitScores();
  const rawScores = getRawTraitSnapshot();
  console.debug("[psychometric] answer", {
    module: state.moduleKey,
    questionId: question.id,
    optionIndex,
    answerText: option.t,
    answered: state.answered,
    normalizedScores,
    rawScores,
  });
  appendDebugRun({
    timestamp: new Date().toISOString(),
    module: state.moduleKey,
    questionId: question.id,
    optionIndex,
    answerText: option.t,
    answered: state.answered,
    normalizedScores,
    rawScores,
  });

  return {
    stop: shouldStop(),
    answered: state.answered,
  };
}

export function getBest() {
  const ranked = scoreArchetypes();
  const moduleBest =
    state?.moduleKey === "job_discovery" ? getJobDiscoveryBest(ranked) : getHybridBest(ranked);
  return (moduleBest ?? ranked[0])?.arch ?? null;
}

export function getResult(): PsychometricEngineResult | null {
  if (!state) {
    return null;
  }

  const ranked = scoreArchetypes();
  const moduleBest =
    state.moduleKey === "job_discovery" ? getJobDiscoveryBest(ranked) : getHybridBest(ranked);
  const bestRanked = moduleBest ?? ranked[0] ?? null;
  const secondRanked =
    moduleBest && ranked[0] && ranked[0].arch.id !== moduleBest.arch.id ? ranked[0] : ranked[1] ?? null;

  const result = {
    module: state.moduleKey,
    answered: state.answered,
    confidence: getConfidence(),
    best: bestRanked?.arch ?? null,
    second: secondRanked?.arch ?? null,
    topTraits: getFriendlyTopTraits(),
    traitScores: getNormalizedTraitScores(),
    contradictionScore: getContradictionScore(),
    isHybrid: isHybridProfile(),
    explanation: generateExplanation(bestRanked?.arch ?? null),
    archetypeScores: ranked,
  };

  console.debug("[psychometric] result", {
    module: result.module,
    answered: result.answered,
    confidence: result.confidence,
    bestId: result.best?.id ?? null,
    topTraits: result.topTraits,
    traitScores: result.traitScores,
  });
  appendDebugRun({
    timestamp: new Date().toISOString(),
    module: result.module,
    answered: result.answered,
    confidence: result.confidence,
    bestId: result.best?.id ?? null,
    topTraits: result.topTraits,
    traitScores: result.traitScores,
  });

  return result;
}

export function getConfidence() {
  if (!state) {
    return 0;
  }

  const averageConfidence = getAverageTraitConfidence();
  const topSpread = getTopTraitSpread();
  const contradictionPenalty = Math.min(10, getContradictionScore() * 2);
  const evenRepresentationBonus = getEvenRepresentationScore() * 6;
  const base =
    56 +
    averageConfidence * 22 +
    separation() * 18 +
    Math.min(8, topSpread) -
    evenRepresentationBonus / 2 +
    evenRepresentationBonus +
    state.conflictPenalty -
    contradictionPenalty;
  return Math.round(Math.min(97, Math.max(50, base)));
}
