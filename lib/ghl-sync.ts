/**
 * GHL Sync Service — higher-level sync functions that combine GHL API calls with Supabase updates.
 * Import this in API routes and server actions. Never call lib/ghl.ts directly from pages.
 * All functions are fire-and-forget safe: they never throw.
 */

import { createClient } from "@supabase/supabase-js";
import {
  createContact,
  updateContact,
  getContactByEmail,
  addContactTag,
  removeContactTag,
  createOpportunity,
  updateOpportunity,
  moveOpportunityStage,
  getPipelineStages,
  addNote,
  sendSMS,
  triggerWorkflow,
} from "@/lib/ghl";

// ── Supabase service-role client ───────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Stage ID lookup (by name) ──────────────────────────────────────────────────

async function getStageId(
  pipelineId: string,
  stageName: string,
  userId?: string | null
): Promise<string | null> {
  const stages = await getPipelineStages(pipelineId, userId);
  const match = stages.find(
    (s) => s.name.toLowerCase() === stageName.toLowerCase()
  );
  return match?.id ?? null;
}

// ── Shared: ensure GHL contact exists, return contactId ───────────────────────

async function ensureContact(
  profileId: string,
  firstName: string,
  lastName: string,
  email: string,
  phone?: string | null,
  extraTags?: string[]
): Promise<string | null> {
  const supabase = db();
  const locationId = process.env.GHL_LOCATION_ID ?? "";

  // Check if we already have a GHL contact ID stored
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("ghl_contact_id")
    .eq("id", profileId)
    .single();

  if (profile?.ghl_contact_id) {
    // Update existing contact
    await updateContact(
      profile.ghl_contact_id,
      { firstName, lastName, email, phone: phone ?? undefined, locationId },
      profileId
    );
    return profile.ghl_contact_id;
  }

  // Try to find by email first
  let contact = await getContactByEmail(email, profileId);
  if (!contact) {
    contact = await createContact(
      {
        firstName,
        lastName,
        email,
        phone: phone ?? undefined,
        tags: extraTags,
        locationId,
      },
      profileId
    );
  }
  if (!contact) return null;

  // Persist ghl_contact_id to profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("profiles")
    .update({ ghl_contact_id: contact.id })
    .eq("id", profileId);

  return contact.id;
}

// ── Practitioner: signup (onboarding complete) ─────────────────────────────────

export async function syncPractitionerSignup(
  practitionerId: string
): Promise<void> {
  try {
    const supabase = db();

    const { data: prac } = await supabase
      .from("practitioners")
      .select(
        "id, profile_id, discipline, registration_body, registration_number, practice_name"
      )
      .eq("id", practitionerId)
      .single();
    if (!prac) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", prac.profile_id)
      .single();
    if (!profile?.email) return;

    const firstName = profile.first_name ?? "";
    const lastName = profile.last_name ?? "";

    const contactId = await ensureContact(
      prac.profile_id,
      firstName,
      lastName,
      profile.email,
      null,
      ["practitioner", "onboarding-complete"]
    );
    if (!contactId) return;

    // Add discipline tag
    const disciplineTag = prac.discipline
      ? `discipline-${prac.discipline.toLowerCase().replace(/\s+/g, "-")}`
      : null;
    const tags = ["practitioner", "onboarding-complete"];
    if (disciplineTag) tags.push(disciplineTag);
    await addContactTag(contactId, tags, prac.profile_id);

    // Create opportunity
    const pipelineId = process.env.GHL_PRACTITIONER_PIPELINE_ID ?? "";
    const stageId = await getStageId(pipelineId, "Pending Verification", prac.profile_id);
    if (pipelineId && stageId) {
      const opp = await createOpportunity(
        {
          name: `${firstName} ${lastName} — Practitioner`,
          pipelineId,
          pipelineStageId: stageId,
          contactId,
          status: "open",
        },
        prac.profile_id
      );
      if (opp) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("practitioners")
          .update({ ghl_opportunity_id: opp.id })
          .eq("id", practitionerId);
      }
    }

    // Add note
    await addNote(
      contactId,
      `Practitioner signed up via Nesema. Discipline: ${prac.discipline ?? "Not specified"}. Registration: ${prac.registration_body ?? ""} ${prac.registration_number ?? ""}.`,
      prac.profile_id
    );
  } catch {
    // never throw
  }
}

// ── Practitioner: verified ─────────────────────────────────────────────────────

export async function syncPractitionerVerified(
  practitionerId: string
): Promise<void> {
  try {
    const supabase = db();

    const { data: prac } = await supabase
      .from("practitioners")
      .select("id, profile_id, ghl_opportunity_id")
      .eq("id", practitionerId)
      .single();
    if (!prac) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("ghl_contact_id")
      .eq("id", prac.profile_id)
      .single();

    const contactId: string | null = profile?.ghl_contact_id ?? null;
    if (!contactId) return;

    await addContactTag(contactId, ["verified"], prac.profile_id);

    if (prac.ghl_opportunity_id) {
      const pipelineId = process.env.GHL_PRACTITIONER_PIPELINE_ID ?? "";
      const stageId = await getStageId(pipelineId, "Verified & Live", prac.profile_id);
      if (stageId) {
        await moveOpportunityStage(prac.ghl_opportunity_id, stageId, prac.profile_id);
      }
    }

    const dateStr = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    await addNote(contactId, `Practitioner verified by admin on ${dateStr}.`, prac.profile_id);
  } catch {
    // never throw
  }
}

// ── Practitioner: rejected ─────────────────────────────────────────────────────

export async function syncPractitionerRejected(
  practitionerId: string,
  reason: string
): Promise<void> {
  try {
    const supabase = db();

    const { data: prac } = await supabase
      .from("practitioners")
      .select("id, profile_id, ghl_opportunity_id")
      .eq("id", practitionerId)
      .single();
    if (!prac) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("ghl_contact_id")
      .eq("id", prac.profile_id)
      .single();

    const contactId: string | null = profile?.ghl_contact_id ?? null;
    if (!contactId) return;

    await addContactTag(contactId, ["rejected"], prac.profile_id);

    if (prac.ghl_opportunity_id) {
      const pipelineId = process.env.GHL_PRACTITIONER_PIPELINE_ID ?? "";
      const stageId = await getStageId(pipelineId, "Rejected", prac.profile_id);
      if (stageId) {
        await moveOpportunityStage(prac.ghl_opportunity_id, stageId, prac.profile_id);
      }
      await updateOpportunity(prac.ghl_opportunity_id, { status: "lost" }, prac.profile_id);
    }

    await addNote(contactId, `Rejected. Reason: ${reason}`, prac.profile_id);
  } catch {
    // never throw
  }
}

// ── Patient: signup (onboarding complete) ─────────────────────────────────────

export async function syncPatientSignup(patientId: string): Promise<void> {
  try {
    const supabase = db();

    const { data: patient } = await supabase
      .from("patients")
      .select(
        "id, profile_id, goals, motivation_level, diet_type, programme_weeks"
      )
      .eq("id", patientId)
      .single();
    if (!patient) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", patient.profile_id)
      .single();
    if (!profile?.email) return;

    const firstName = profile.first_name ?? "";
    const lastName = profile.last_name ?? "";
    const goals: string[] = patient.goals ?? [];

    const goalTags = goals.map(
      (g) => `goal-${g.toLowerCase().replace(/\s+/g, "-")}`
    );
    const tags = ["patient", "in-queue", ...goalTags];

    const contactId = await ensureContact(
      patient.profile_id,
      firstName,
      lastName,
      profile.email,
      null,
      tags
    );
    if (!contactId) return;

    await addContactTag(contactId, tags, patient.profile_id);

    // Custom fields
    const customFields: { key: string; field_value: string }[] = [
      { key: "motivation_level", field_value: patient.motivation_level ?? "" },
      { key: "diet_type", field_value: patient.diet_type ?? "" },
      { key: "programme_week", field_value: "1" },
    ];

    await updateContact(
      contactId,
      {
        firstName,
        lastName,
        email: profile.email,
        locationId: process.env.GHL_LOCATION_ID ?? "",
        customFields,
      },
      patient.profile_id
    );

    // Create opportunity
    const pipelineId = process.env.GHL_PIPELINE_ID ?? "";
    const stageId = await getStageId(pipelineId, "In Queue", patient.profile_id);
    if (pipelineId && stageId) {
      const opp = await createOpportunity(
        {
          name: `${firstName} ${lastName} — Patient`,
          pipelineId,
          pipelineStageId: stageId,
          contactId,
          status: "open",
        },
        patient.profile_id
      );
      if (opp) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("patients")
          .update({ ghl_opportunity_id: opp.id })
          .eq("id", patientId);
      }
    }

    const goalsStr = goals.length ? goals.join(", ") : "None specified";
    await addNote(
      contactId,
      `Patient signed up via Nesema. Health goals: ${goalsStr}. Motivation level: ${patient.motivation_level ?? "not specified"}.`,
      patient.profile_id
    );
  } catch {
    // never throw
  }
}

// ── Patient: matched to practitioner ──────────────────────────────────────────

export async function syncPatientMatched(
  patientId: string,
  practitionerId: string
): Promise<void> {
  try {
    const supabase = db();

    const { data: patient } = await supabase
      .from("patients")
      .select("id, profile_id, ghl_opportunity_id")
      .eq("id", patientId)
      .single();
    if (!patient) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("ghl_contact_id")
      .eq("id", patient.profile_id)
      .single();
    const contactId: string | null = profile?.ghl_contact_id ?? null;
    if (!contactId) return;

    // Fetch practitioner name
    const { data: prac } = await supabase
      .from("practitioners")
      .select("profile_id, practice_name")
      .eq("id", practitionerId)
      .single();
    const { data: pracProfile } = prac
      ? await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", prac.profile_id)
          .single()
      : { data: null };
    const pracName =
      prac?.practice_name ??
      [pracProfile?.first_name, pracProfile?.last_name].filter(Boolean).join(" ") ??
      "your practitioner";

    await removeContactTag(contactId, ["in-queue"], patient.profile_id);
    await addContactTag(contactId, ["matched", "active"], patient.profile_id);

    if (patient.ghl_opportunity_id) {
      const pipelineId = process.env.GHL_PIPELINE_ID ?? "";
      const stageId = await getStageId(pipelineId, "Matched", patient.profile_id);
      if (stageId) {
        await moveOpportunityStage(patient.ghl_opportunity_id, stageId, patient.profile_id);
      }
      await updateOpportunity(
        patient.ghl_opportunity_id,
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        patient.profile_id
      );
    }

    const dateStr = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    await addNote(
      contactId,
      `Matched to ${pracName} on ${dateStr}.`,
      patient.profile_id
    );
  } catch {
    // never throw
  }
}

// ── Patient: first booking ─────────────────────────────────────────────────────

export async function syncPatientFirstBooking(patientId: string): Promise<void> {
  try {
    const supabase = db();

    const { data: patient } = await supabase
      .from("patients")
      .select("id, profile_id, ghl_opportunity_id")
      .eq("id", patientId)
      .single();
    if (!patient) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("ghl_contact_id")
      .eq("id", patient.profile_id)
      .single();
    const contactId: string | null = profile?.ghl_contact_id ?? null;
    if (contactId) {
      await addContactTag(contactId, ["first-booking"], patient.profile_id);
    }

    if (patient.ghl_opportunity_id) {
      const pipelineId = process.env.GHL_PIPELINE_ID ?? "";
      const stageId = await getStageId(pipelineId, "First Session Booked", patient.profile_id);
      if (stageId) {
        await moveOpportunityStage(patient.ghl_opportunity_id, stageId, patient.profile_id);
      }
    }
  } catch {
    // never throw
  }
}

// ── Appointment: completed ─────────────────────────────────────────────────────

export async function syncAppointmentCompleted(
  appointmentId: string
): Promise<void> {
  try {
    const supabase = db();

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_type, scheduled_at, amount_pence")
      .eq("id", appointmentId)
      .single();
    if (!appt) return;

    const { data: patient } = await supabase
      .from("patients")
      .select("id, profile_id, ghl_opportunity_id")
      .eq("id", appt.patient_id)
      .single();
    if (!patient) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("ghl_contact_id")
      .eq("id", patient.profile_id)
      .single();
    const contactId: string | null = profile?.ghl_contact_id ?? null;

    if (patient.ghl_opportunity_id) {
      const pipelineId = process.env.GHL_PIPELINE_ID ?? "";
      const stageId = await getStageId(pipelineId, "Active Patient", patient.profile_id);
      if (stageId) {
        await moveOpportunityStage(patient.ghl_opportunity_id, stageId, patient.profile_id);
      }

      // Calculate total revenue from this patient
      const { data: completedAppts } = await supabase
        .from("appointments")
        .select("amount_pence")
        .eq("patient_id", appt.patient_id)
        .eq("status", "completed");

      const totalPence = (completedAppts ?? []).reduce(
        (sum, a) => sum + (a.amount_pence ?? 0),
        appt.amount_pence ?? 0
      );

      await updateOpportunity(
        patient.ghl_opportunity_id,
        { monetaryValue: Math.round(totalPence / 100) },
        patient.profile_id
      );
    }

    if (contactId) {
      const dateStr = new Date(appt.scheduled_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      await addNote(
        contactId,
        `Session completed on ${dateStr}. Type: ${appt.appointment_type}.`,
        patient.profile_id
      );
    }
  } catch {
    // never throw
  }
}

// ── Patient: at risk ───────────────────────────────────────────────────────────

export async function syncPatientAtRisk(patientId: string): Promise<void> {
  try {
    const supabase = db();

    const { data: patient } = await supabase
      .from("patients")
      .select("id, profile_id, ghl_opportunity_id")
      .eq("id", patientId)
      .single();
    if (!patient) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("ghl_contact_id")
      .eq("id", patient.profile_id)
      .single();
    const contactId: string | null = profile?.ghl_contact_id ?? null;

    if (contactId) {
      await addContactTag(contactId, ["at-risk"], patient.profile_id);

      const workflowId = process.env.GHL_REENGAGEMENT_WORKFLOW_ID;
      if (workflowId) {
        await triggerWorkflow(contactId, workflowId, patient.profile_id);
      }
    }

    if (patient.ghl_opportunity_id) {
      const pipelineId = process.env.GHL_PIPELINE_ID ?? "";
      const stageId = await getStageId(pipelineId, "At Risk", patient.profile_id);
      if (stageId) {
        await moveOpportunityStage(patient.ghl_opportunity_id, stageId, patient.profile_id);
      }
    }
  } catch {
    // never throw
  }
}

// ── Patient: churned ──────────────────────────────────────────────────────────

export async function syncPatientChurned(patientId: string): Promise<void> {
  try {
    const supabase = db();

    const { data: patient } = await supabase
      .from("patients")
      .select("id, profile_id, ghl_opportunity_id")
      .eq("id", patientId)
      .single();
    if (!patient) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("ghl_contact_id")
      .eq("id", patient.profile_id)
      .single();
    const contactId: string | null = profile?.ghl_contact_id ?? null;

    if (contactId) {
      await removeContactTag(contactId, ["active"], patient.profile_id);
      await addContactTag(contactId, ["churned"], patient.profile_id);
    }

    if (patient.ghl_opportunity_id) {
      const pipelineId = process.env.GHL_PIPELINE_ID ?? "";
      const stageId = await getStageId(pipelineId, "Churned", patient.profile_id);
      if (stageId) {
        await moveOpportunityStage(patient.ghl_opportunity_id, stageId, patient.profile_id);
      }
      await updateOpportunity(
        patient.ghl_opportunity_id,
        { status: "lost" },
        patient.profile_id
      );
    }
  } catch {
    // never throw
  }
}

// ── SMS: appointment reminder ──────────────────────────────────────────────────

export async function sendAppointmentSMSReminder(
  appointmentId: string
): Promise<void> {
  try {
    const supabase = db();

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, scheduled_at, daily_room_url, patient_id, practitioner_id")
      .eq("id", appointmentId)
      .single();
    if (!appt) return;

    const { data: patient } = await supabase
      .from("patients")
      .select("id, profile_id")
      .eq("id", appt.patient_id)
      .single();
    const { data: prac } = await supabase
      .from("practitioners")
      .select("id, profile_id, practice_name")
      .eq("id", appt.practitioner_id)
      .single();

    const { data: patProfile } = patient
      ? await supabase
          .from("profiles")
          .select("first_name, ghl_contact_id")
          .eq("id", patient.profile_id)
          .single()
      : { data: null };

    const { data: pracProfile } = prac
      ? await supabase
          .from("profiles")
          .select("first_name, last_name, ghl_contact_id")
          .eq("id", prac.profile_id)
          .single()
      : { data: null };

    const timeStr = new Date(appt.scheduled_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/London",
    });

    const patName = patProfile?.first_name ?? "there";
    const pracName =
      prac?.practice_name ??
      [pracProfile?.first_name, pracProfile?.last_name].filter(Boolean).join(" ") ??
      "your practitioner";
    const joinUrl = appt.daily_room_url ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://nesema.com";

    // SMS to patient
    const patContactId: string | null = (patProfile as { ghl_contact_id?: string | null } | null)?.ghl_contact_id ?? null;
    if (patContactId) {
      await sendSMS(
        patContactId,
        `Hi ${patName}, reminder: your session with ${pracName} is tomorrow at ${timeStr}. Join here: ${joinUrl}`,
        patient?.profile_id
      );
    }

    // SMS to practitioner
    const pracContactId: string | null = (pracProfile as { ghl_contact_id?: string | null } | null)?.ghl_contact_id ?? null;
    if (pracContactId) {
      await sendSMS(
        pracContactId,
        `Reminder: session with ${patName} tomorrow at ${timeStr}.`,
        prac?.profile_id
      );
    }
  } catch {
    // never throw
  }
}

// ── SMS: patient matched ───────────────────────────────────────────────────────

export async function sendMatchedSMS(patientId: string): Promise<void> {
  try {
    const supabase = db();

    const { data: patient } = await supabase
      .from("patients")
      .select("id, profile_id, practitioner_id")
      .eq("id", patientId)
      .single();
    if (!patient) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, ghl_contact_id")
      .eq("id", patient.profile_id)
      .single();

    const contactId: string | null = (profile as { ghl_contact_id?: string | null } | null)?.ghl_contact_id ?? null;
    if (!contactId) return;

    let pracName = "your new practitioner";
    if (patient.practitioner_id) {
      const { data: prac } = await supabase
        .from("practitioners")
        .select("profile_id, practice_name")
        .eq("id", patient.practitioner_id)
        .single();
      if (prac) {
        const { data: pracProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", prac.profile_id)
          .single();
        pracName =
          prac.practice_name ??
          [pracProfile?.first_name, pracProfile?.last_name].filter(Boolean).join(" ") ??
          pracName;
      }
    }

    const patName = profile?.first_name ?? "there";
    await sendSMS(
      contactId,
      `Hi ${patName}, great news! You've been matched with ${pracName} on Nesema. Check your email to book your first session.`,
      patient.profile_id
    );
  } catch {
    // never throw
  }
}

// ── SMS: low check-in ──────────────────────────────────────────────────────────

export async function sendLowCheckinSMS(patientId: string): Promise<void> {
  try {
    const supabase = db();

    const { data: patient } = await supabase
      .from("patients")
      .select("id, profile_id")
      .eq("id", patientId)
      .single();
    if (!patient) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, ghl_contact_id")
      .eq("id", patient.profile_id)
      .single();

    const contactId: string | null = (profile as { ghl_contact_id?: string | null } | null)?.ghl_contact_id ?? null;
    if (!contactId) return;

    const patName = profile?.first_name ?? "there";
    await sendSMS(
      contactId,
      `Hi ${patName}, we noticed you haven't logged a check-in recently. Your practitioner is here to help — log in to Nesema to stay on track.`,
      patient.profile_id
    );
  } catch {
    // never throw
  }
}
