# Psychometric Test Documentation

This document describes the psychometric assessment system implemented in this project as it exists in code today.

It is based on the live implementation in:

- `Frontend/HiredAI_RBConnected/src/utils/psychometricEngine.ts`
- `Frontend/HiredAI_RBConnected/src/utils/psychometric.ts`
- `Frontend/HiredAI_RBConnected/src/components/PsychometricFlow.tsx`
- `Frontend/HiredAI_RBConnected/src/App.tsx`
- `Frontend/HiredAI_RBConnected/src/components/ResumeProcessing.tsx`

## 1. Purpose

The psychometric test is used as a mandatory front-door profiling step before users enter two major product flows:

- `resume_builder`
- `job_discovery`

The assessment is not a backend-scored test. It is a frontend-local decision engine that:

- asks up to 15 multiple-choice questions,
- adapts later questions based on earlier answers,
- scores hidden traits,
- matches the user to archetypes,
- stores results in `localStorage`,
- unlocks downstream product routes based on completion.

## 2. High-Level Architecture

The implementation is split into three main layers.

### 2.1 Routing and access control

File:

- `Frontend/HiredAI_RBConnected/src/App.tsx`

Responsibilities:

- defines psychometric routes:
  - `/psychometric/resume`
  - `/psychometric/job`
- prevents users from entering protected flows before completing the required assessment,
- redirects users into the appropriate psychometric route when needed.

Key behavior:

- `resume_builder` psychometric completion is required before:
  - `/jobrole/*`
  - `/resume-builder/*`
- `job_discovery` psychometric completion is required before:
  - `/upload-resume`
  - `/resume-processing`
  - `/jobs`
- `/jobs` additionally requires `resumeAnalysis` in `localStorage`.

### 2.2 Psychometric UI flow

File:

- `Frontend/HiredAI_RBConnected/src/components/PsychometricFlow.tsx`

Responsibilities:

- initializes the engine,
- renders one question at a time,
- allows only 4 displayed answer options per question,
- supports back navigation by rebuilding state from answer history,
- stops when the engine says to stop or when 15 questions are answered,
- persists completion and result data,
- shows the final summary screen.

### 2.3 Scoring engine

File:

- `Frontend/HiredAI_RBConnected/src/utils/psychometricEngine.ts`

Responsibilities:

- owns all live question definitions,
- maintains trait state,
- applies weighted scoring,
- detects contradictions,
- chooses adaptive next questions,
- computes normalized trait scores,
- scores archetypes,
- derives final result and confidence.

## 3. Modules

The system contains two independent psychometric modules.

## 3.1 `resume_builder`

Internal module key:

- `resume_builder`

Purpose:

- profiles the user for resume-builder role direction and sector fit.

Trait set:

- `tech` -> technical
- `anl` -> analytical
- `cre` -> creative
- `lead` -> leadership
- `comm` -> communication
- `risk` -> risk-taking

Question bank:

- 5 fixed questions
- 17 adaptive questions
- engine module max: 18
- UI hard cap: 15

Primary archetypes in the engine:

- `swe` -> Software / Backend Engineer
- `data` -> Data Scientist / ML Engineer
- `pm` -> Product Manager
- `design` -> UX Designer / Product Designer
- `mgmt` -> Operations / Strategy Manager
- `fin` -> Financial / Investment Analyst
- `consult` -> Strategy Consultant
- `startup` -> Co-founder / Growth Lead
- `core` -> Design / Systems Engineer
- `mktg` -> Growth / Performance Marketer
- `hr` -> HR Business Partner / L&D Lead

Output style:

- industry headline,
- primary role,
- alternative role,
- top traits,
- confidence score.

## 3.2 `job_discovery`

Internal module key:

- `job_discovery`

Purpose:

- profiles the user for work-style fit and job discovery recommendations.

Trait set:

- `ldr` -> leadership
- `cre` -> creative
- `risk` -> risk-taking
- `dec` -> decision-making
- `soc` -> social
- `flex` -> adaptability

Question bank:

- 5 fixed questions
- 15 adaptive questions
- engine module max: 16
- UI hard cap: 15

Primary archetypes in the engine:

- `mgmt` -> Management Type / Strategic Operator
- `creative` -> Creative Type / Original Thinker
- `analytical` -> Analytical Type / Strategic Advisor
- `technical` -> Technical Type / Deep Specialist
- `entrepreneur` -> Entrepreneurial Type / Risk-Driven Builder
- `support` -> Support & Operations Type / Collaborative Enabler
- `connector` -> Connector Type / Relationship Architect

Output style:

- type headline,
- subtype description,
- top three suggested jobs,
- top traits,
- confidence score.

## 4. Route Gating and User Journey

The psychometric flow is not optional in normal use.

### 4.1 Resume builder path

User journey:

1. user clicks resume-builder related entrypoint,
2. app redirects to `/psychometric/resume`,
3. user completes assessment,
4. app stores completion and profile,
5. user is redirected to `/jobrole` or `/resume-builder`.

### 4.2 Job discovery path

User journey:

1. user clicks job-discovery related entrypoint,
2. app redirects to `/psychometric/job`,
3. user completes assessment,
4. app stores completion and profile,
5. user can access `/upload-resume`,
6. after resume upload creates `resumeAnalysis`, user can access `/jobs`.

## 5. Question Delivery Model

Questions are delivered in two phases.

### 5.1 Fixed questions

The engine starts with fixed questions in sequence.

Purpose:

- establish broad signal across the module's main trait dimensions,
- create enough initial information for adaptive targeting,
- avoid cold-start randomness.

### 5.2 Adaptive questions

After fixed questions are exhausted, the engine selects from the adaptive pool using a priority order.

Priority order used by `nextQuestion()`:

1. reprobe a recently conflicted trait,
2. if two archetypes are close, ask a question targeting the traits that best separate them,
3. otherwise target the trait with the lowest confidence,
4. otherwise fall back to the first remaining unused adaptive question.

This means the questionnaire is not a simple linear form after the fixed stage.

## 6. Trait State Model

Each trait is initialized with a neutral starting state:

- `score = 50`
- `conf = 0`
- `dirs = []`
- `total = 0`
- `positive = 0`
- `negative = 0`
- `contradictions = 0`

Meaning of each field:

- `score`: live trait score in the range `0..100`
- `conf`: confidence for that trait, normalized to `0..1`
- `dirs`: history of answer direction signs for that trait
- `total`: cumulative weighted directional total
- `positive`: accumulated positive contribution magnitude
- `negative`: accumulated negative contribution magnitude
- `contradictions`: count of directional reversals for that trait

## 7. Answer Scoring Logic

Each answer option contains weighted trait effects, for example:

- positive weight increases a trait,
- negative weight decreases a trait,
- multiple traits can be affected by one answer.

The engine only applies weights with absolute value `>= 6`. Tiny effects are ignored.

### 7.1 Early bonus

For the first two answered questions, `earlyBonus()` returns `0.9`.

Effect:

- early answers are slightly damped rather than over-amplified.

From question 3 onward, the multiplier returns to `1`.

### 7.2 Position weight

Each answer receives:

- `positionWeight = 1 + questionIndex / totalQuestions`

Effect:

- later answers carry slightly more weight than earlier ones.

### 7.3 Trait damping by confidence

For each affected trait, the score update uses:

- `damping = 1 - traitState.conf * 0.45`

Effect:

- once the engine becomes more confident about a trait, later updates move it less aggressively.

### 7.4 Final trait score update

For each weighted trait:

- `adjusted = delta * bonus * positionWeight`
- `score = clamp(score + adjusted * damping, 0, 100)`

The engine also updates:

- direction history,
- positive/negative accumulation,
- confidence,
- contradiction counts.

## 8. Contradiction Detection

A contradiction is recorded when a new answer pushes a trait in the opposite direction from the trait's existing directional trend.

What happens when that occurs:

- `traitState.contradictions += 1`
- that trait is added to `recentConflictTraits`
- `conflictPenalty += 2`

Why this matters:

- the engine may choose a follow-up adaptive question specifically for that conflicted trait,
- contradiction count affects normalized scores,
- contradiction count affects hybrid detection,
- contradiction count affects final confidence.

## 9. Trait Confidence Calculation

Trait confidence is calculated from:

- consistency of direction,
- number of observations for that trait.

Formula used after each affected answer:

- `ratio = abs(positiveDirections / totalDirections - 0.5) * 2`
- `conf = min(1, ratio + totalDirections * 0.055)`

Interpretation:

- repeated consistent directional answers increase confidence,
- inconsistent directional answers lower confidence,
- more observations gradually increase confidence.

## 10. When the Test Stops

The engine can stop before 15 questions, but the UI still enforces a hard maximum of 15.

Stopping rules from `shouldStop()`:

1. stop if answered questions reached `min(module.maxQ, 15)`
2. stop early if:
   - answered >= 8
   - average trait confidence > 0.75
   - even trait representation >= 0.8
3. after at least 9 answers, stop if:
   - last 3 predicted archetypes are identical
   - archetype separation > 0.22
4. otherwise, stop if every trait confidence >= 0.68

Practical result:

- most runs finish between 8 and 15 questions,
- the displayed progress always says `Question X of 15`,
- the engine is adaptive and may not need all 15 questions.

## 11. Archetype Scoring

Archetypes are scored by comparing the user's live trait scores against each archetype's ideal trait signature.

Per trait:

- `diff = 100 - abs(userTraitScore - idealTraitScore)`
- trait weight = `traitConfidence + 0.1`

Archetype similarity:

- weighted similarity is accumulated across all signature traits,
- final archetype score is converted to a `0..100` percentage.

Ranking:

- higher score wins,
- ties are broken by lexicographic archetype id.

## 12. Top Trait Selection

Top traits are not chosen from raw trait scores alone.

The engine ranks traits using:

- normalized trait score,
- directional total magnitude,
- trait confidence,
- distance from neutral score `50`.

Important restriction:

- before 4 answered questions, the engine returns no top traits.

## 13. Normalized Trait Score Calculation

The public-facing `traitScores` shown in the result are normalized percentages, not raw trait-state scores.

The process is:

1. compute a weighted value per trait from:
   - trait score above 50,
   - absolute directional total,
   - trait confidence,
   - positive/negative polarity boost,
   - contradiction penalty
2. apply a diversity boost to below-average traits
3. normalize values to percentages
4. apply dampening power `0.6`
5. renormalize
6. if one trait exceeds `55`, reduce it by `6%` and redistribute to the others
7. add a small answer-driven nudge based on directional total
8. floor every trait at `5`
9. renormalize and round

Constants used:

- `DAMPENING_POWER = 0.6`
- `DIVERSITY_BOOST_FACTOR = 0.04`
- `REBALANCE_THRESHOLD = 55`
- `REBALANCE_REDUCTION = 0.06`
- `MIN_TRAIT_FLOOR = 5`

Implication:

- result percentages are intentionally smoothed,
- the engine avoids over-dominant single-trait profiles,
- every trait keeps at least minimal representation.

## 14. Hybrid Profile Detection

The engine marks a profile as hybrid when either of the following is true:

- top two normalized traits are within 5 points of each other
- contradiction score is at least 2

Hybrid handling is important because the engine can override normal archetype ranking with derived hybrid role mappings.

## 15. Resume Builder Hybrid Mapping

If the resume-builder result qualifies as hybrid, the engine checks the top-trait pair against these mappings:

- `analytical+technical` -> Software, Data & Intelligent Systems / Backend / Data Engineer / ML Platform Engineer
- `analytical+creative` -> Product Strategy & Experience Design / Product Strategist / UX Research / Product Design Lead
- `analytical+leadership` -> Strategy, Consulting & Operations / Strategy Consultant / Business Operations Manager
- `communication+creative` -> Marketing, Brand & Storytelling / Brand Strategist / Content / Growth Lead
- `communication+leadership` -> Consulting, People & Client Leadership / Program / Client Success Lead / Operations / People Manager
- `creative+risk-taking` -> Startups, Growth & Venture Building / Growth Product Builder / Founder Associate / Venture Operator

If a mapping exists and hybrid rules are satisfied, the hybrid archetype can replace the default highest-ranked archetype.

## 16. Job Discovery Derived Mapping

Job discovery uses more aggressive derived mapping than resume builder.

It can choose:

- a derived combination archetype,
- a derived single-trait archetype,
- the built-in `entrepreneur` archetype,
- a generic hybrid fallback,
- or the normal highest-ranked archetype.

### 16.1 Trait category remapping

Job-discovery top traits are remapped into higher-level categories:

- `ldr` -> Execution
- `risk` -> Execution
- `dec` -> Analytical
- `flex` -> Structured
- `cre` -> Creative
- `soc` -> Social

### 16.2 Combination-derived archetypes

Examples:

- `Analytical-Structured` -> Technical Specialist
- `Analytical-Creative` -> Product Innovator
- `Creative-Structured` -> UX Strategist
- `Execution-Structured` -> Operations Leader
- `Execution-Analytical` -> Business Analyst
- `Creative-Execution` -> Startup Builder

### 16.3 Single-trait fallbacks

Examples:

- `Analytical` -> Technical Specialist
- `Creative` -> Creative Thinker
- `Structured` -> Process Manager
- `Execution` -> Operations Specialist

### 16.4 Special-case entrepreneur promotion

If execution is extremely dominant:

- execution score > 65
- every non-execution score < 20

the engine prefers the built-in `entrepreneur` archetype.

## 17. Explanation Generation

The result explanation is generated dynamically from:

- top trait names,
- their normalized percentages,
- whether the profile is hybrid,
- the selected archetype.

The explanation text explicitly states:

- which traits emerged strongest,
- which archetype they aligned with,
- whether the profile looks focused or hybrid.

## 18. Confidence Score Calculation

The result confidence is an aggregate score in the range `50..97`.

Formula inputs:

- average trait confidence,
- separation between top two archetypes,
- spread between top two traits,
- even representation across traits,
- conflict penalty,
- contradiction penalty.

Confidence formula:

- base starts at `56`
- `+ averageConfidence * 22`
- `+ separation * 18`
- `+ min(8, topTraitSpread)`
- `+ evenRepresentationBonus`
- `- evenRepresentationBonus / 2`
- `+ state.conflictPenalty`
- `- contradictionPenalty`

Final clamp:

- minimum `50`
- maximum `97`
- rounded to integer

Important note:

- `conflictPenalty` increases confidence,
- `contradictionPenalty` decreases confidence.

That combination means the engine rewards additional probing activity while still penalizing unresolved contradiction counts.

## 19. Result Object Shape

`getResult()` returns:

- `module`
- `answered`
- `confidence`
- `best`
- `second`
- `topTraits`
- `traitScores`
- `contradictionScore`
- `isHybrid`
- `explanation`
- `archetypeScores`

Meaning:

- `best`: chosen final archetype after module-specific overrides
- `second`: runner-up archetype
- `topTraits`: friendly labels like `analytical`, `creative`, `adaptability`
- `traitScores`: normalized percentages by trait label key
- `archetypeScores`: ranked raw engine scores for all built-in archetypes

## 20. UI Behavior

The UI is implemented in `PsychometricFlow.tsx`.

Behavior details:

- only the first 4 options of a question are rendered,
- the progress display always shows `Question X of 15`,
- there is a `Previous` button,
- going back rebuilds engine state by replaying all earlier answers,
- the result screen shows:
  - headline
  - descriptive paragraph
  - confidence score
  - top traits
  - top roles when available

## 21. Persistence Model

The psychometric system stores everything in `localStorage`.

Defined storage keys:

- `psychometric_resume_completed`
- `psychometric_job_completed`
- `psychometric_resume_answers`
- `psychometric_job_answers`
- `psychometric_profile`
- `psychometric_debug_runs`

### 21.1 Completion flags

Used for route gating.

Values:

- string `"true"` when completed

### 21.2 Stored answers

The answer arrays are stored as:

- `questionId`
- `answerIndex`
- `answer`

### 21.3 Stored merged profile

`psychometric_profile` stores a merged object containing:

- `module`
- `topTraits`
- `confidence`
- `best`
- `second`
- `traitScores`
- a nested property for the module result itself:
  - `resume_builder`
  - `job_discovery`

This allows one shared profile object to keep both module outputs.

### 21.4 Debug runs

The engine appends debug snapshots to `psychometric_debug_runs`.

Stored entries include:

- per-answer snapshots
- final-result snapshots

The array is capped at the latest 50 entries.

## 22. Downstream Usage

The psychometric output is consumed beyond the result page.

In `ResumeProcessing.tsx`:

- `psychometric_profile.topTraits` is read,
- those traits are title-cased and mixed into fallback text and signal generation,
- the psychometric profile contributes to resume/job recommendation context.

This means the assessment is not purely cosmetic. It influences downstream recommendation behavior indirectly through stored profile data.

## 23. Legacy or Unused Data File

There is a file:

- `Frontend/HiredAI_RBConnected/public/psychometric_questions.json`

Current code inspection shows:

- no runtime import of this JSON file,
- no fetch from that file in the psychometric flow,
- live scoring and question delivery come from `psychometricEngine.ts`.

Conclusion:

- `psychometric_questions.json` appears to be legacy, reference, or unused data in the current implementation.

## 24. Limitations and Implementation Notes

### 24.1 Frontend-only trust model

Because all logic and persistence are frontend-local:

- users can clear localStorage and reset progress,
- users can tamper with stored values,
- there is no server-side verification of completion or scores.

### 24.2 UI/engine count mismatch

There is a slight conceptual mismatch:

- engine module max values are `18` and `16`,
- UI hard caps all sessions to `15`.

In practice this means:

- not all adaptive questions can ever be asked in one session,
- the UI cap is the real upper bound.

### 24.3 Fixed progress display

The UI always shows `Question X of 15` even though the engine can stop earlier.

### 24.4 Trait naming differences across modules

The two modules use different internal trait keys and different public labels.

This is intentional, but it means consumers of `psychometric_profile` must know which module produced which trait set.

## 25. Developer Summary

If you need the shortest accurate mental model of the implementation, it is this:

- the app has two psychometric modules,
- both are required gates before users reach their next product flow,
- all live questions and scoring rules are hardcoded in `psychometricEngine.ts`,
- the engine starts neutral at 50 for every trait,
- answers move hidden trait scores with weighted adaptive logic,
- contradiction and confidence affect both question selection and final scoring,
- the engine normalizes traits, ranks archetypes, and may override with hybrid or derived mappings,
- the final result is saved in `localStorage` and reused by later UI flows,
- no backend service currently validates or computes psychometric results.

## 26. File Reference Map

- Routing and access control:
  - `Frontend/HiredAI_RBConnected/src/App.tsx`
- Shared psychometric helpers and localStorage keys:
  - `Frontend/HiredAI_RBConnected/src/utils/psychometric.ts`
- Scoring engine, question bank, archetypes, adaptive logic:
  - `Frontend/HiredAI_RBConnected/src/utils/psychometricEngine.ts`
- Assessment UI and persistence:
  - `Frontend/HiredAI_RBConnected/src/components/PsychometricFlow.tsx`
- Downstream use of stored profile:
  - `Frontend/HiredAI_RBConnected/src/components/ResumeProcessing.tsx`
