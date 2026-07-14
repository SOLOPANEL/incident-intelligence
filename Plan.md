# AI Incident Intelligence Platform — Solo Builder Master Plan

ok, lets resume, i did the docker starting process:
need to run this everytime whenever i restart the device: Order to run things in from now on (every session):

1. `docker compose up -d` — start Redis + Postgres
2. `docker ps` — confirm both show "Up"
3. Terminal 1: `python redis_to_postgres_consumer.py`
4. Terminal 2: `python fake_log_generator.py`
5. Termional 3: `python log_analyzer.py`
6. Terminal 4: `python dashboard_api.py`
   6.5 python -m uvicorn api:app --reload --port 8000
7. Termional 5: `npm run dev` in the dashboard folder

Keep this file open/pinned. Everything you need to not get lost lives here.

---

## 0. YOUR STARTING POINT (read this first, every time you open this file)

**Today's job — do only this, nothing else:**

1. Install Git, VS Code, Python 3.11+, Docker Desktop (Section 2).
2. Install **one** AI coding tool as your daily driver — recommendation: **Cursor** (simplest to start with) or **Google Antigravity** (if you want agent-driven task delegation from day one). Don't install both yet.
3. Create a new folder + Git repo for the project. Nothing else goes in it yet.
4. Open this file inside that repo (save it as `PLAN.md`) so it travels with the project.
5. Write the fake-log-generator script (Week 1 goal, Section 4) — this is genuinely step one of the actual build. Everything downstream depends on having fake data to test against.

**Do not** set up Redis, Postgres, the dashboard, or any AI/LLM tooling yet — that's Week 2+. Starting point is: repo exists, tools installed, one working script that prints fake logs.

---

## 1. PINNED ARCHITECTURE (the whole system in one glance)

```
[Log/metric sources]
        |
        v
[Ingestion queue: Redis Streams]
        |
        v
[Parsing & templating: Drain3]
        |
        v
[ML anomaly detector: scikit-learn]
        |
        v
   -----------------------------------
   |  Vector DB (pgvector)            |
   |  stores past incidents + fixes   |
   -----------------------------------
        |
        v
[RAG + LLM explainer]  <-- retrieves similar past incidents, explains + suggests fix
        |
        v
[Triage & routing]  <-- severity scoring, sends alert
        |
        v
[Dashboard]  <-- human sees it, resolves it, marks AI right/wrong
        |
        v
(feedback loops back into Vector DB, system gets smarter)
```

**One-line description of each piece:**
| Layer | Job | Tech |
|---|---|---|
| Sources | Generate/emit logs | Your app or a demo app |
| Ingestion | Don't lose data under load | Redis Streams |
| Parsing | Turn messy text into structured templates | Drain3 |
| ML detector | Flag "this looks abnormal" | scikit-learn (Isolation Forest) |
| Vector DB | Remember past incidents | PostgreSQL + pgvector |
| RAG + LLM | Explain + suggest a fix using memory | Ollama (local) or free-tier API |
| Triage | Decide urgency, route to the right channel | Simple rules or LLM scoring |
| Dashboard | Human sees, acts, gives feedback | React |

---

## 2. FULL TOOL LIST — what to install, and why

### Core (install first, in this order)

| Tool                    | What it's for                                       | Free? | Install                 |
| ----------------------- | --------------------------------------------------- | ----- | ----------------------- |
| **Git**                 | Version control                                     | Free  | `git-scm.com`           |
| **VS Code**             | Code editor                                         | Free  | `code.visualstudio.com` |
| **Python 3.11+**        | Backend, ML, parsing                                | Free  | `python.org`            |
| **Node.js LTS**         | Frontend tooling                                    | Free  | `nodejs.org`            |
| **Docker Desktop**      | Run Postgres/Redis without installing them natively | Free  | `docker.com`            |
| **Postman or Insomnia** | Test your APIs without writing test code            | Free  | either website          |
| **DBeaver**             | See inside your database visually                   | Free  | `dbeaver.io`            |

### AI coding assistants — pick ONE primary, use the rest situationally

| Tool                                  | What it does for you                                                                                                  | Free tier?                              | Use it for...                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Claude (this chat / Claude Code)**  | Architecture decisions, debugging, writing whole files, explaining errors                                             | Yes, with limits                        | Your default thinking partner — design, debug, explain                                                               |
| **Cursor**                            | AI-native editor, autocomplete that understands your whole repo, inline edits                                         | Yes, free tier                          | Daily line-by-line coding once you're past planning                                                                  |
| **Codex** (OpenAI's coding agent/CLI) | Similar to Cursor — autonomous coding help, CLI-based                                                                 | Yes, free tier limits                   | Alternative to Cursor — pick one, not both                                                                           |
| **Google Antigravity**                | Agent-first IDE — describe a task, agents write code, run it, test it in a real browser, report back with screenshots | Yes, free in public preview             | Delegating whole mechanical tasks (e.g. "build and test the dashboard v1 page") so you can focus on design decisions |
| **GitHub Copilot**                    | Line-by-line autocomplete inside normal VS Code                                                                       | Free for students (GitHub Student Pack) | If you don't want a full editor switch, lightest-touch option                                                        |
| **Warp**                              | AI-powered terminal with command suggestions                                                                          | Yes, free tier                          | Nice-to-have convenience, not essential — skip if it's one more thing to manage                                      |
| **ChatGPT or Perplexity/Gemini**      | Quick second opinion, fast research, fact-checking                                                                    | Free tier                               | Second opinion when you want to sanity-check an approach                                                             |

**Practical tip:** Pick ONE of Cursor / Codex / Antigravity as your primary "hands-on-keyboard" tool. Use Claude (me) throughout for the thinking — architecture, debugging, deciding what to build next. Don't run three agent tools in parallel; that's more overhead than help for a solo builder.

### Tools for specific layers (not general coding assistants)

| Tool                            | What it replaces in your build order                                                             | Worth it?                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **Bolt** (bolt.new)             | Could scaffold Dashboard v1's frontend shell from a prompt                                       | Yes, for that one narrow task — not for backend/ML         |
| **Retool**                      | Could replace hand-coding the dashboard entirely by connecting directly to Postgres              | Yes, genuinely worth trying — could save you weeks 4 and 7 |
| **n8n**                         | Could replace your hand-coded triage/routing/alerting layer (step 11) with visual workflows      | Yes, genuinely worth trying — real time-saver              |
| **Hermes** (Nous Hermes models) | Alternative local LLM for the RAG explainer step, better at structured output than plain Llama   | Optional upgrade, not needed to start                      |
| **OpenAI Agents SDK**           | Framework for multi-step LLM tool-calling, useful once your RAG+LLM step gets more sophisticated | Skip for now — revisit around week 8-9, overkill for MVP   |
| **Notion**                      | Track weekly progress, journal incidents                                                         | Optional — this markdown file already does the job         |

### AI models for your actual RAG/LLM layer

| Option                                  | Cost                           | When to use                                                       |
| --------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| **Ollama + Llama 3.1 8B or Mistral 7B** | Free, runs on your own machine | Default for development/testing — no bills, no rate limits        |
| **Google Gemini free tier**             | Free with rate limits          | When you want better quality than local models for a demo         |
| **Anthropic/OpenAI API**                | Paid (small amounts)           | Only once you have a real pilot user and it's worth a few dollars |

Install Ollama: `ollama.com` → then `ollama pull llama3.1` in your terminal. That's it — free local LLM.

### Data & pipeline libraries (installed via pip, not separate apps)

```bash
pip install fastapi uvicorn scikit-learn drain3 psycopg2-binary redis sentence-transformers pandas
```

- `sentence-transformers` — turns text into embeddings for the vector DB, free, runs locally
- `psycopg2-binary` — lets Python talk to Postgres
- `redis` — Python client for Redis Streams

### Frontend

```bash
npx create-vite@latest dashboard --template react
npm install recharts axios
```

### Hosting (once you're ready to show a real user)

| Option                     | Free tier details                                                              |
| -------------------------- | ------------------------------------------------------------------------------ |
| **Oracle Cloud Free Tier** | Genuinely free forever (not a trial), decent specs, best long-term free option |
| **Railway / Render**       | Free tier, very easy deploy, good for quick demos                              |
| **Fly.io**                 | Small free allowance, good for containerized apps                              |

### Solo organization tools (for tracking yourself, since no team)

| Tool                                                   | Use                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| **Notion (free)** or a plain **GitHub Projects board** | Track your weekly tasks below                              |
| **This markdown file**                                 | Pin it, update it, treat it as your single source of truth |

---

## 3. STEP-BY-STEP BUILD ORDER (do not skip ahead)

**Rule: get an ugly end-to-end version working before making any single piece smart.**

1. Fake log generator (Python script producing realistic + occasionally broken logs)
2. Redis ingestion — logs flow from generator into a stream
3. Postgres storage — consume from Redis, store in a table
4. Drain3 parsing — turn raw text into structured templates
5. Dumb rule-based anomaly detection ("error rate doubled") — get the full pipeline working end to end
6. Swap in real ML (Isolation Forest) once the dumb version works
7. Dashboard v1 — just show flagged anomalies, no AI explanation yet
8. Add pgvector + manually seed 10-15 fake "past incidents"
9. Add RAG: embed the anomaly, retrieve similar past incidents
10. Add LLM explanation step (Ollama first, upgrade later)
11. Add triage/severity scoring + Slack webhook alert
12. Add feedback buttons (thumbs up/down on AI's explanation) writing back into the vector DB

---

## 4. WEEK-BY-WEEK PLAN (solo pace, ~10-12 weeks)

| Week | Goal                                       | Deliverable at end of week                                    |
| ---- | ------------------------------------------ | ------------------------------------------------------------- |
| 1    | Environment setup + fake log generator     | You can run one script and see realistic logs printing        |
| 2    | Redis + Postgres pipeline                  | Logs flow from generator → queue → database, end to end       |
| 3    | Drain3 parsing + dumb rule-based detection | System flags "something's off" using a simple rule            |
| 4    | Dashboard v1                               | You can see flagged events in a browser, not just terminal    |
| 5    | Real ML model (Isolation Forest)           | ML replaces the dumb rule, tested against your fake incidents |
| 6    | pgvector setup + seed past incidents       | 10-15 fake "past incidents" stored and searchable             |
| 7    | RAG retrieval working                      | Given a new anomaly, system pulls the most similar past ones  |
| 8    | LLM explanation layer (Ollama)             | System outputs a written explanation + suggested fix          |
| 9    | Triage + Slack alerts                      | A flagged anomaly pings your own Slack automatically          |
| 10   | Feedback loop + polish                     | Thumbs up/down works, writes back to vector DB                |
| 11   | Deploy to free hosting + real-world test   | System is reachable outside your laptop, running continuously |
| 12   | Find first pilot user, write case study    | One real (even small) external deployment + a results writeup |

_(If solo progress is slower some weeks — normal. Better to stretch this to 14-16 weeks than to skip steps.)_

---

## 5. DAILY RHYTHM (what a working day should look like)

A simple loop to avoid getting stuck or scope-creeping:

1. **5 min** — re-read this file, confirm which week/step you're on
2. **10 min** — write down today's _one_ concrete goal (e.g. "Redis stream receives and stores 100 fake logs") — not "work on ingestion," something checkable
3. **Bulk of the day** — build toward that one goal only
4. **If stuck >30-45 min on one bug** — ask Claude or Cursor to debug with you, don't silently grind
5. **Last 10 min** — write one line in a running "incidents.md" log: what broke today, how you fixed it (this doubles as your first real seed data for the vector DB later — genuinely useful, not just a journaling exercise)

**Guardrail:** if you're not sure whether to add a new feature or fix/finish the current step — always finish the current step first. Half-finished layers are the #1 way solo builds stall.

---

## 6. THINGS TO REMEMBER (the stuff that's easy to forget solo)

- Commit to Git after every small working milestone, not just at the end of the week — solo builders lose work far more often than teams because there's no one else to notice you haven't pushed in 5 days.
- Don't call the LLM on every log line — only on things the ML layer already flagged. This keeps you inside free tiers.
- Keep a `README.md` in your repo from day one that explains how to run the whole thing — future-you in week 8 will not remember week 1's setup steps.
- It's fine, and expected, to fall behind the week-by-week table. The order matters more than the pace.
- When you get your first real pilot user in week 12, that one result is worth more to your resume/interviews than every week before it combined — treat getting there as the actual finish line, not "finishing all the code."
