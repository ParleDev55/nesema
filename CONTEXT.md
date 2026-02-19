# Nesema — Claude Code Project Briefing

> Read this file at the start of every Claude Code session before writing any code.

---

## What is Nesema?

Nesema is a holistic health platform connecting patients with specialist practitioners across disciplines including functional nutrition, physiotherapy, sleep coaching, osteopathy, acupuncture, psychotherapy, and personal training.

The name comes from the Hebrew **Neshama (נְשָׁמָה)** — meaning soul, breath, and divine spark.
**Tagline: "Health, felt whole."**

The platform has two sides:
- **Practitioners** manage their practice: patients, appointments, clinical tools, payments, and analytics
- **Patients** manage their health journey: care plans, daily check-ins, progress, education, and results

---

## Design System

All UI must match these values exactly. Never use arbitrary colours or fonts.

### Colours
```css
--bark:    #2E2620   /* dark primary, headings, dark buttons */
--sage:    #4E7A5F   /* primary green, CTAs, active states */
--sage-l:  #6B9E7A   /* sage hover state */
--sage-p:  #EBF2EE   /* sage pale background tint */
--sage-m:  #C3D9CB   /* sage mid */
--clay:    #B5704A   /* warm accent */
--clay-p:  #F5EDE8
--sky:     #4A7FA0   /* blue accent */
--sky-p:   #E8F2F8
--amber:   #C27D30   /* amber accent */
--amb-p:   #F9F1E6
--lav:     #7B6FA8   /* lavender accent */
--lav-p:   #EEECf6
--bg:      #F6F3EE   /* warm off-white page background */
--surf:    #FDFCFA   /* card/surface white */
--sb-bg:   #2A2118   /* sidebar — warm dark espresso */
--bdr:     #E6E0D8   /* border */
--t1:      #1E1A16   /* primary text */
--t2:      #5C5248   /* secondary text */
--t3:      #9C9087   /* muted text */
--t4:      #BFB8B0   /* placeholder/disabled */
```

In Tailwind, define these as custom colours in `tailwind.config.ts` under `theme.extend.colors.nesema`.

### Typography
- **Display / headings:** Cormorant Garamond (serif) — loaded from Google Fonts
- **Body / UI:** Instrument Sans (sans-serif) — loaded from Google Fonts

### Key component rules
- Buttons: pill-shaped (`rounded-full`), sage green for primary CTAs
- Cards: `rounded-xl` or `rounded-2xl`, subtle shadow, `bg-[#FDFCFA]`
- Sidebar: `bg-[#2A2118]`, white text at 55% opacity, sage highlight for active items
- Stat cards: icon block → uppercase label → large serif number → trend delta
- All borders use `#E6E0D8`

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Database + Auth | Supabase |
| File storage | Supabase Storage |
| Video | Daily.co |
| Payments | Stripe |
| Email | Resend |
| Deployment | Vercel |
| Version control | GitHub |

---

## Folder Structure

```
nesema/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   ├── (practitioner)/
│   │   ├── layout.tsx               ← practitioner shell + sidebar
│   │   ├── dashboard/page.tsx
│   │   ├── patients/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── toolkit/
│   │   │   ├── page.tsx
│   │   │   └── meal-builder/page.tsx
│   │   ├── documents/page.tsx
│   │   ├── education/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── messages/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── notifications/page.tsx
│   │   └── settings/page.tsx
│   ├── (patient)/
│   │   ├── layout.tsx               ← patient shell + sidebar
│   │   ├── dashboard/page.tsx
│   │   ├── plan/page.tsx
│   │   ├── check-in/page.tsx
│   │   ├── progress/page.tsx
│   │   ├── appointments/page.tsx
│   │   ├── vault/page.tsx
│   │   ├── learn/page.tsx
│   │   ├── team/page.tsx
│   │   ├── messages/page.tsx
│   │   └── settings/page.tsx
│   ├── onboarding/
│   │   ├── practitioner/page.tsx
│   │   └── patient/page.tsx
│   └── book/
│       └── [slug]/page.tsx          ← public booking page, no auth required
├── components/
│   ├── ui/                          ← shadcn primitives
│   ├── layout/
│   │   ├── PractitionerSidebar.tsx
│   │   ├── PatientSidebar.tsx
│   │   └── AppShell.tsx
│   ├── practitioner/
│   ├── patient/
│   └── shared/
├── lib/
│   ├── supabase/
│   │   ├── client.ts                ← browser client
│   │   ├── server.ts                ← server client (cookies)
│   │   └── middleware.ts            ← session refresh + route protection
│   ├── stripe.ts
│   ├── daily.ts
│   └── utils.ts
├── types/
│   └── database.ts                  ← generated from Supabase schema
├── middleware.ts                     ← Next.js middleware (auth guards)
├── CONTEXT.md                       ← this file
└── SCHEMA.md                        ← full database schema reference
```

---

## Build Order

Work through this sequence. Each step builds on the last.

1. **Scaffold** — Next.js, Tailwind config with design tokens, shadcn/ui, Supabase client
2. **Auth** — sign-up, sign-in, sign-out, middleware for role-based routing
3. **Practitioner onboarding** — 5 steps: account → credentials → practice setup → availability → go live
4. **Patient onboarding** — 4 steps: account → health background → goals → lifestyle → welcome screen
5. **Practitioner dashboard** — today's sessions, patient alerts, mini calendar, revenue stat
6. **Patient dashboard** — today's plan, check-in prompt, streak, next session
7. **Patient list + profile** — searchable list, profile with tabs (overview, plan, notes, labs)
8. **Daily check-in** — mood, energy, sleep, digestion, symptoms, supplements, notes
9. **Public booking page** — `/book/[slug]`, slot grid, Stripe payment, email confirmation
10. **Meal plan builder** — food library, macro calculator, assign to patient
11. **Payments** — invoices, packages, Stripe Connect for practitioner payouts
12. **Analytics** — revenue chart, adherence rates, outcome trends, capacity
13. **Video sessions** — Daily.co room creation, session notes
14. **Messages** — real-time with Supabase Realtime
15. **Notifications** — real-time feed, mark as read
16. **Results vault** — PIN-protected lab result viewer

---

## Prototype Reference

A fully designed HTML prototype (`nesema-ia-prototype-v2.html`) covers all 30 screens of the application. Always reference it for layout, spacing, components, and copy when building a screen.

Key screen IDs in the prototype:
```
s-dash        → practitioner dashboard
s-pdash       → patient dashboard
s-pcheckin    → daily check-in
s-mealbuilder → meal plan builder
s-analytics   → analytics & insights
s-bkpg        → public booking page
s-obp         → practitioner onboarding (5 steps)
s-obpat       → patient onboarding (4 steps)
s-kit         → toolkit
s-pts         → patient list
s-pprof       → patient profile
s-vault       → results vault
s-sess        → video session
s-cal         → calendar
s-msg         → messages
s-notif       → notifications
s-pay         → payments
```

---

## Compliance (UK)

- UK GDPR and the Data Protection Act 2018 govern all health data
- Practitioners must verify registration with their professional body (BANT, HCPC, NTC, etc.)
- Explicit, recorded patient consent is required before any data sharing between practitioners
- Lab results require patient consent to share with another practitioner
- Video must be GDPR-compliant — Daily.co qualifies out of the box
- Stripe handles PCI compliance for all payments

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Daily.co
DAILY_API_KEY=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://nesema.com
```

Set all of these in Vercel's project settings under Environment Variables. Never commit them to GitHub.

---

## Tone & Copy Principles

- Warm, not clinical. Human, not corporate.
- Practitioner-facing: professional but approachable
- Patient-facing: encouraging, calm, supportive
- Use natural language: "Your session with Emma" not "Appointment #2847"
- Empty states should invite action, not just say "No data"
- Error messages should tell the user what to do next, not just what went wrong
