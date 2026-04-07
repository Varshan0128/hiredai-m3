# HiredAI Auto Apply

AI-powered job discovery and auto-application engine using **Adzuna** and **Jooble** APIs.

## Architecture

```
hiredai-autoapply/
├── apps/
│   ├── web/      Next.js 15 frontend
│   ├── api/      NestJS REST API
│   └── worker/   BullMQ background processor
└── packages/
    ├── db/       Prisma schema + seed
    ├── types/    Shared TypeScript types
    └── utils/    Shared helpers
```

## Quick Start

### 1. Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Yarn 1.x

### 2. Clone and install
```bash
git clone <repo>
cd hiredai-autoapply
cp .env.example .env
# Edit .env — add Adzuna and Jooble API keys
yarn install
```

### 3. Start infrastructure
```bash
docker-compose up postgres redis -d
```

### 4. Database setup
```bash
yarn db:generate    # Generate Prisma client
yarn db:migrate     # Run migrations
yarn db:seed        # Seed demo data (demo@hiredai.dev / password123)
```

### 5. Run all services
```bash
# Terminal 1 — API
cd apps/api && yarn dev

# Terminal 2 — Worker
cd apps/worker && yarn dev

# Terminal 3 — Web
cd apps/web && yarn dev
```

Open http://localhost:3000

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | [Get at adzuna.com/api](https://developer.adzuna.com/) |
| `JOOBLE_API_KEY` | [Get at jooble.org/api](https://jooble.org/api/about) |

---

## Full Docker deployment
```bash
cp .env.example .env  # Edit all values
docker-compose up --build
```

---

## API Reference

All endpoints prefixed `/api/v1`. Auth via `Authorization: Bearer <token>`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET  | `/auth/me` | Current user |

### Auto Apply
| Method | Path | Description |
|---|---|---|
| GET | `/auto-apply/preferences` | Get preferences |
| PUT | `/auto-apply/preferences` | Update preferences |

### Jobs
| Method | Path | Description |
|---|---|---|
| GET | `/jobs` | List jobs (filter by `?decision=auto_apply\|needs_review\|skip`) |
| GET | `/jobs/:id` | Job detail |
| POST | `/jobs/ingest/run` | Trigger Adzuna + Jooble ingestion |
| POST | `/jobs/match/run` | Trigger matching for all jobs |

### Applications
| Method | Path | Description |
|---|---|---|
| GET | `/applications` | List applications (filter by `?status=`) |
| GET | `/applications/review` | Pending review queue |
| GET | `/applications/:id` | Application detail + events |
| POST | `/applications/:id/approve` | Approve and schedule |
| POST | `/applications/:id/reject` | Reject |
| POST | `/applications/:id/cancel` | Cancel |

### Resumes
| Method | Path | Description |
|---|---|---|
| POST | `/resumes/upload` | Upload resume (multipart) |
| GET | `/resumes` | List resumes |
| PATCH | `/resumes/:id` | Update (title, roleTag, isDefault) |
| DELETE | `/resumes/:id` | Delete |

### Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | List (latest 50) |
| GET | `/notifications/unread/count` | Unread count |
| POST | `/notifications/:id/read` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |

### Dev (non-production)
| Method | Path | Description |
|---|---|---|
| POST | `/dev/seed` | Seed demo data |
| POST | `/dev/mock-ingest` | Insert mock jobs |
| GET | `/health` | Health check |

---

## Queue Architecture

| Queue | Trigger | Action |
|---|---|---|
| `ingestion` | Manual or scheduled | Fetch jobs from Adzuna + Jooble |
| `normalization` | After ingestion | Post-save enrichment |
| `deduplication` | After normalization | Detect same job across providers |
| `match` | After dedup | Score job against user preferences |
| `scheduling` | After auto_apply decision | Assign submission time slot |
| `submission` | At scheduled time | Submit via `direct_source_apply` or `mocked_structured_submit` |
| `retry` | On failure | Exponential backoff retry |
| `notification` | Various events | Persist in-app notification |

---

## Scoring Engine

7-dimension weighted score (0–100):

| Dimension | Weight |
|---|---|
| Role Fit | 25% |
| Skill Fit | 25% |
| Location Fit | 10% |
| Salary Fit | 10% |
| Work Mode Fit | 10% |
| Experience Fit | 10% |
| Company Type Fit | 10% |

**Decisions:**
- `auto_apply` — score ≥ threshold + fully automatic mode + complete job data
- `needs_review` — score qualifies but data is ambiguous OR semi-automatic mode
- `skip` — score below threshold OR hard filter failed

---

## Submission Modes

| Mode | When | Behaviour |
|---|---|---|
| `direct_source_apply` | Apply URL available | Records URL, timestamps, marks submitted |
| `mocked_structured_submit` | No apply URL | Assembles payload, records internally |

The submission layer is isolated in `apps/worker/src/processors/submission.processor.ts` and can be upgraded to real browser-based submission without touching the rest of the pipeline.

---

## Seed Data

Run `yarn db:seed` to create:
- 1 demo user (`demo@hiredai.dev` / `password123`)
- 3 resumes (frontend, full-stack, backend)
- 8 jobs from Adzuna + Jooble (including 1 duplicate pair)
- Match results with `auto_apply`, `needs_review`, `skip` examples
- Applications in various statuses including `submitted`, `failed`, `needs_review`
- 3 sample notifications

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod |
| Backend | NestJS, TypeScript, Passport JWT, Swagger |
| Database | PostgreSQL 16, Prisma ORM |
| Queue | Redis 7, BullMQ |
| Job Sources | Adzuna API, Jooble API |
| Infrastructure | Docker, Docker Compose |
