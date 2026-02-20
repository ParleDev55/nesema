# Nesema — Setup Guide

How to go from zero to a live, deployed app without touching a terminal.
Every step is done in a browser tab.

---

## What you'll create accounts for

All are free to start. You only pay when you're ready to launch.

| Service | What it does | URL |
|---|---|---|
| GitHub | Stores your code | github.com |
| Supabase | Your database and user login system | supabase.com |
| Vercel | Makes your app live on the internet | vercel.com |
| Claude (Pro) | Your AI developer | claude.ai |
| Stripe | Takes payments | stripe.com |
| Daily.co | Powers video sessions | daily.co |
| Resend | Sends emails | resend.com |

---

## Phase 1 — Create your accounts (Day 1, ~1 hour)

### 1. GitHub
1. Go to **github.com** and click **Sign up**
2. Create a free account
3. Once signed in, click the **+** icon top right → **New repository**
4. Name it `nesema`
5. Set it to **Private**
6. Tick **Add a README file**
7. Click **Create repository**

Your code now has a home. Keep this tab open.

---

### 2. Supabase
1. Go to **supabase.com** and click **Start your project**
2. Sign up with your GitHub account (easiest)
3. Click **New project**
4. Name it `nesema`
5. Choose a strong database password — save it somewhere safe
6. Choose **Europe (London)** as your region
7. Click **Create new project** — takes about 2 minutes to set up

Once ready:
- Click **Project Settings** (gear icon, left sidebar)
- Click **API**
- You'll see **Project URL** and **anon public** key — copy both and save them. You'll need these later.
- Also copy the **service_role** key (keep this one secret — never share it publicly)

---

### 3. Set up the database

Still in Supabase:
1. Click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `SCHEMA.md` from this project
4. Copy everything inside the first code block (Step 1 — Enable extensions)
5. Paste it into the SQL editor and click **Run**
6. Repeat for Steps 2, 3, 4 (each SQL block)
7. For Step 5 (Storage), go to **Storage** in the left sidebar and create the three buckets manually

---

### 4. Vercel
1. Go to **vercel.com** and click **Sign up**
2. Sign up with your GitHub account
3. Don't create a project yet — you'll do this after Claude Code creates the codebase

---

### 5. Claude Pro
1. Go to **claude.ai** and upgrade to **Pro** (£17/month)
2. Once subscribed, go to **claude.com/code**
3. Connect your GitHub account when prompted
4. Select your `nesema` repository

This is where you'll be building the app.

---

## Phase 2 — Build the app with Claude Code (Weeks 1–6)

Open **claude.com/code** with your `nesema` repository connected.

### How to start every session

Begin each Claude Code session with this message:

> "Please read CONTEXT.md and SCHEMA.md before we start. Today I want to build [describe the feature]."

Claude will read the briefing files, understand the full project context, and write code that matches the design system.

---

### Session 1 — Project scaffold

Send this message to Claude Code:

> "Please set up the Nesema project from scratch. Use Next.js 14 with the App Router and TypeScript. Configure Tailwind CSS with our design tokens from CONTEXT.md. Install and configure shadcn/ui. Set up the Supabase client using @supabase/ssr. Create the folder structure from CONTEXT.md. Add Google Fonts for Cormorant Garamond and Instrument Sans."

Claude will create all the files and open a pull request. Review it on GitHub, then merge it.

---

### Session 2 — Connect Vercel to GitHub

After Session 1's pull request is merged:

1. Go to **vercel.com**
2. Click **Add New → Project**
3. Import your `nesema` GitHub repository
4. Add environment variables (click **Environment Variables** during setup):

```
NEXT_PUBLIC_SUPABASE_URL          = [your Supabase project URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY     = [your Supabase anon key]
SUPABASE_SERVICE_ROLE_KEY         = [your Supabase service role key]
```

5. Click **Deploy**

Your app is now live at a `vercel.app` URL. Every time Claude Code merges a pull request, Vercel auto-deploys within 30 seconds.

---

### Session 3 — Authentication

Send to Claude Code:

> "Build the sign-up and sign-in pages for Nesema. Use Supabase Auth with email/password. When a user signs up, they should choose whether they're a practitioner or patient — this sets their role in the profiles table. After sign-in, redirect practitioners to /dashboard and patients to /dashboard. Use the design system from CONTEXT.md."

---

### Session 4 — Practitioner onboarding

> "Build the practitioner onboarding flow — 5 steps as described in CONTEXT.md, matching the design of screen `s-obp` in the prototype. Each step should save progress to Supabase so the practitioner can resume if they close the browser. On completion, set `is_live = true` on their practitioners record."

---

### Session 5 — Patient onboarding

> "Build the patient onboarding flow — 4 steps as described in CONTEXT.md, matching screen `s-obpat` in the prototype. Save all health background, goals, and lifestyle data to the patients table in Supabase."

---

### Continue for each feature in the build order from CONTEXT.md

For each screen, reference the prototype screen ID and describe what you want. Claude Code will write the code, create a pull request, and you review and merge it.

---

## Phase 3 — Add integrations (as needed)

### Stripe (payments)
1. Go to **stripe.com** and create an account
2. Get your **Publishable key** and **Secret key** from the Stripe dashboard
3. Add them to Vercel environment variables
4. Tell Claude Code: "Integrate Stripe payments into the booking flow. Use the payment intent API. Practitioners receive payouts via Stripe Connect."

### Daily.co (video sessions)
1. Go to **daily.co** and create a free account
2. Get your **API key** from the dashboard
3. Add it to Vercel environment variables
4. Tell Claude Code: "Integrate Daily.co video rooms into the session screen. Create a room when an appointment is confirmed, store the URL in the appointments table, and show the video interface matching screen `s-sess` in the prototype."

### Resend (emails)
1. Go to **resend.com** and create a free account
2. Get your **API key**
3. Add it to Vercel environment variables
4. Tell Claude Code: "Set up Resend to send a confirmation email when a booking is made, and a reminder 24 hours before each appointment."

---

## GHL Integration — Go High Level CRM

Nesema uses Go High Level (GHL) to handle marketing, nurture sequences, SMS messaging, and pipeline tracking. Resend continues to handle transactional emails. They run alongside each other.

---

### Step 1 — Get your GHL API key

1. Log in to your GHL sub-account at **app.gohighlevel.com**
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**, give it a name like `Nesema`
4. Copy the key — you'll use it as `GHL_API_KEY`

---

### Step 2 — Find your Location ID

1. In GHL, go to **Settings** → **Business Profile**
2. Your **Location ID** is shown near the top of the page (a UUID-style string)
3. Copy it — you'll use it as `GHL_LOCATION_ID`

---

### Step 3 — Create two pipelines

GHL → **CRM** → **Pipelines** → **Add Pipeline**

**Patient pipeline** — name it `Nesema Patients`. Add these stages **in this exact order**:
1. In Queue
2. Matched
3. First Session Booked
4. Active Patient
5. At Risk
6. Churned

**Practitioner pipeline** — name it `Nesema Practitioners`. Add these stages:
1. Pending Verification
2. Verified & Live
3. Rejected
4. Suspended

After saving each pipeline, click into it and look at the URL — it will contain the pipeline ID. Example:
```
https://app.gohighlevel.com/.../pipeline/abc123def456
                                                    ^-- this is your pipeline ID
```
Copy the patient pipeline ID → `GHL_PIPELINE_ID`
Copy the practitioner pipeline ID → `GHL_PRACTITIONER_PIPELINE_ID`

---

### Step 4 — Set up the re-engagement workflow (optional)

1. GHL → **Automation** → **Workflows** → **Create Workflow**
2. Name it `Nesema — Patient Re-engagement`
3. Add a trigger: **Contact Tag Added**, tag = `at-risk`
4. Add steps: SMS / email sequence to bring the patient back
5. Click the workflow and look at the URL for the workflow ID
6. Copy it → `GHL_REENGAGEMENT_WORKFLOW_ID`

If you skip this step, at-risk tagging still works — re-engagement SMS are just not sent.

---

### Step 5 — Add environment variables to Vercel

In Vercel: **project → Settings → Environment Variables**, add:

```
GHL_API_KEY                      = [your GHL private API key]
GHL_LOCATION_ID                  = [your GHL location/sub-account ID]
GHL_PIPELINE_ID                  = [patient pipeline ID]
GHL_PRACTITIONER_PIPELINE_ID     = [practitioner pipeline ID]
GHL_REENGAGEMENT_WORKFLOW_ID     = [workflow ID — optional]
CRON_SECRET                      = [a long random string you invent, e.g. openssl rand -hex 32]
```

Also add `CRON_SECRET` if it's not already set — this protects your cron endpoints.

---

### Step 6 — Run the database migration

In Supabase → **SQL Editor**, run the contents of:
```
supabase/migrations/20240221_ghl_integration.sql
```

This adds `ghl_contact_id` to profiles, `ghl_opportunity_id` to practitioners and patients, and creates the `ghl_sync_log` table.

---

### Step 7 — Test the connection

1. Deploy to Vercel (merge the pull request)
2. Log in as admin at your Nesema URL
3. Go to **Admin → Settings → GHL Integration**
4. Check the "Connection status" card — credentials should show as set
5. Click **Test connection** — should show green "Connected"

If you see an error, double-check your API key and Location ID in Vercel environment variables.

---

### How it works once set up

| App event | What GHL does |
|---|---|
| Practitioner completes onboarding | Contact created, added to Practitioner pipeline at "Pending Verification" |
| Admin verifies practitioner | Contact tagged "verified", moved to "Verified & Live" |
| Admin rejects practitioner | Contact tagged "rejected", opportunity status set to "lost" |
| Patient completes onboarding | Contact created, added to Patient pipeline at "In Queue" |
| Admin matches patient to practitioner | Tagged "matched", moved to "Matched", SMS sent |
| Patient books first appointment | Moved to "First Session Booked" |
| Session completed | Moved to "Active Patient", monetary value updated |
| Patient misses 7 days of check-ins | Tagged "at-risk", moved to "At Risk", re-engagement SMS triggered |
| Patient account deleted | Tagged "churned", opportunity status set to "lost" |
| Appointment 24h away | SMS reminder sent to both patient and practitioner |

All GHL failures are logged in **Admin → Settings → GHL Integration → Sync log**. Failed events can be retried individually.

---

## Phase 4 — Set up your domain

1. Buy your domain (e.g. `nesema.com`) from Namecheap or Google Domains (~£10/year)
2. In Vercel: go to your project → **Settings** → **Domains**
3. Add your domain and follow Vercel's instructions to point your DNS
4. Takes up to 24 hours to go live, usually faster

---

## How to describe features to Claude Code

The clearer you are, the better the code. Use this pattern:

**Template:**
> "Build [screen name]. It should match the design of screen [prototype ID] in the prototype. The data comes from [table name] in Supabase. [Any specific interactions or rules]."

**Example:**
> "Build the patient daily check-in page. It should match screen `s-pcheckin` in the prototype. When submitted, save the data to the `check_ins` table in Supabase linked to the current patient's ID. Show a success confirmation after submitting."

---

## When something looks wrong

Describe what you see versus what you expect:

> "The sidebar background is showing white, but it should be dark espresso (#2A2118) as specified in CONTEXT.md."

> "The booking page isn't showing available slots. The query should be fetching from the `availability` table for this practitioner."

> "The font is showing as the browser default, not Cormorant Garamond. Please check the Google Fonts import."

Claude Code will diagnose and fix it.

---

## Useful things to check in Supabase

- **Table Editor** — see all your data, like a spreadsheet
- **Auth → Users** — see who has signed up
- **Storage** — see uploaded files
- **Logs** — see what's happening in real time if something breaks
- **SQL Editor** — run queries to check or fix data

---

## Quick reference

| Task | Where |
|---|---|
| Build a feature | claude.com/code |
| See your live app | your-project.vercel.app (or your domain) |
| Preview a PR before merging | Click the Vercel preview link in the GitHub pull request |
| See your database | supabase.com → your project → Table Editor |
| See who signed up | supabase.com → Auth → Users |
| Add an environment variable | vercel.com → project → Settings → Environment Variables |
| See deploy logs | vercel.com → project → Deployments |
| Check for errors | vercel.com → project → Deployments → click a deployment → Functions |
