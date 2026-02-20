/**
 * Go High Level (GHL) API client.
 * All functions are server-side only — never import this in client components.
 * Every call is logged to ghl_sync_log. Errors never throw — they return null gracefully.
 */

import { createClient } from "@supabase/supabase-js";

const GHL_BASE = "https://services.leadconnectorhq.com";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GHLContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  tags?: string[];
  customFields?: { key: string; field_value: string }[];
  locationId: string;
}

export interface GHLContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  tags?: string[];
}

export interface GHLOpportunityInput {
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  status: "open" | "won" | "lost" | "abandoned";
  monetaryValue?: number;
  assignedTo?: string;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  status: string;
  monetaryValue?: number;
}

export interface GHLPipelineStage {
  id: string;
  name: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function ghlHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY ?? ""}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

async function writeLog(entry: {
  userId?: string | null;
  eventType: string;
  ghlContactId?: string | null;
  payload?: unknown;
  response?: unknown;
  success: boolean;
  error?: string | null;
}): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = serviceDb() as any;
    await db.from("ghl_sync_log").insert({
      user_id: entry.userId ?? null,
      event_type: entry.eventType,
      ghl_contact_id: entry.ghlContactId ?? null,
      payload: entry.payload ?? null,
      response: entry.response ?? null,
      success: entry.success,
      error: entry.error ?? null,
    });
  } catch {
    // log failures must never surface
  }
}

async function ghlFetch(
  path: string,
  options: RequestInit,
  userId: string | null | undefined,
  eventType: string
): Promise<{ data: unknown; ok: boolean }> {
  if (!process.env.GHL_API_KEY) {
    await writeLog({ userId, eventType, success: false, error: "GHL_API_KEY not set" });
    return { data: null, ok: false };
  }

  const url = `${GHL_BASE}${path}`;
  let bodyPayload: unknown = undefined;
  try {
    if (options.body && typeof options.body === "string") {
      bodyPayload = JSON.parse(options.body);
    }
  } catch {
    bodyPayload = options.body;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...ghlHeaders(), ...(options.headers as Record<string, string> | undefined) },
    });

    let responseData: unknown = null;
    try {
      responseData = await res.json();
    } catch {
      responseData = null;
    }

    await writeLog({
      userId,
      eventType,
      payload: bodyPayload,
      response: responseData,
      success: res.ok,
      error: res.ok ? null : `HTTP ${res.status}`,
    });

    return { data: responseData, ok: res.ok };
  } catch (err) {
    const msg = (err as Error).message;
    await writeLog({ userId, eventType, payload: bodyPayload, success: false, error: msg });
    return { data: null, ok: false };
  }
}

// ── Contact management ─────────────────────────────────────────────────────────

export async function createContact(
  data: GHLContactInput,
  userId?: string | null
): Promise<GHLContact | null> {
  const { data: res, ok } = await ghlFetch(
    "/contacts/",
    { method: "POST", body: JSON.stringify(data) },
    userId,
    "create_contact"
  );
  if (!ok || !res) return null;
  return (res as { contact?: GHLContact }).contact ?? null;
}

export async function updateContact(
  contactId: string,
  data: Partial<GHLContactInput>,
  userId?: string | null
): Promise<GHLContact | null> {
  const { data: res, ok } = await ghlFetch(
    `/contacts/${contactId}`,
    { method: "PUT", body: JSON.stringify(data) },
    userId,
    "update_contact"
  );
  if (!ok || !res) return null;
  return (res as { contact?: GHLContact }).contact ?? null;
}

export async function getContactByEmail(
  email: string,
  userId?: string | null
): Promise<GHLContact | null> {
  const locationId = process.env.GHL_LOCATION_ID ?? "";
  const { data: res, ok } = await ghlFetch(
    `/contacts/?email=${encodeURIComponent(email)}&locationId=${encodeURIComponent(locationId)}`,
    { method: "GET" },
    userId,
    "get_contact_by_email"
  );
  if (!ok || !res) return null;
  const list = (res as { contacts?: GHLContact[] }).contacts ?? [];
  return list[0] ?? null;
}

export async function addContactTag(
  contactId: string,
  tags: string[],
  userId?: string | null
): Promise<void> {
  await ghlFetch(
    `/contacts/${contactId}/tags`,
    { method: "POST", body: JSON.stringify({ tags }) },
    userId,
    "add_tag"
  );
}

export async function removeContactTag(
  contactId: string,
  tags: string[],
  userId?: string | null
): Promise<void> {
  await ghlFetch(
    `/contacts/${contactId}/tags`,
    { method: "DELETE", body: JSON.stringify({ tags }) },
    userId,
    "remove_tag"
  );
}

// ── Pipeline / opportunity management ─────────────────────────────────────────

export async function createOpportunity(
  data: GHLOpportunityInput,
  userId?: string | null
): Promise<GHLOpportunity | null> {
  const { data: res, ok } = await ghlFetch(
    "/opportunities/",
    { method: "POST", body: JSON.stringify(data) },
    userId,
    "create_opportunity"
  );
  if (!ok || !res) return null;
  return (res as { opportunity?: GHLOpportunity }).opportunity ?? null;
}

export async function updateOpportunity(
  opportunityId: string,
  data: Partial<GHLOpportunityInput>,
  userId?: string | null
): Promise<GHLOpportunity | null> {
  const { data: res, ok } = await ghlFetch(
    `/opportunities/${opportunityId}`,
    { method: "PUT", body: JSON.stringify(data) },
    userId,
    "update_opportunity"
  );
  if (!ok || !res) return null;
  return (res as { opportunity?: GHLOpportunity }).opportunity ?? null;
}

export async function moveOpportunityStage(
  opportunityId: string,
  stageId: string,
  userId?: string | null
): Promise<void> {
  await ghlFetch(
    `/opportunities/${opportunityId}`,
    { method: "PUT", body: JSON.stringify({ pipelineStageId: stageId }) },
    userId,
    "move_opportunity_stage"
  );
}

export async function getPipelineStages(
  pipelineId: string,
  userId?: string | null
): Promise<GHLPipelineStage[]> {
  const locationId = process.env.GHL_LOCATION_ID ?? "";
  const { data: res, ok } = await ghlFetch(
    `/opportunities/pipelines/${pipelineId}?locationId=${encodeURIComponent(locationId)}`,
    { method: "GET" },
    userId,
    "get_pipeline_stages"
  );
  if (!ok || !res) return [];
  const pipeline = res as { stages?: GHLPipelineStage[] };
  return pipeline.stages ?? [];
}

// ── Notes ──────────────────────────────────────────────────────────────────────

export async function addNote(
  contactId: string,
  body: string,
  userId?: string | null
): Promise<void> {
  await ghlFetch(
    `/contacts/${contactId}/notes`,
    { method: "POST", body: JSON.stringify({ body }) },
    userId,
    "add_note"
  );
}

// ── SMS ────────────────────────────────────────────────────────────────────────

export async function sendSMS(
  contactId: string,
  message: string,
  userId?: string | null
): Promise<void> {
  await ghlFetch(
    "/conversations/messages",
    { method: "POST", body: JSON.stringify({ type: "SMS", contactId, message }) },
    userId,
    "send_sms"
  );
}

// ── Workflows ──────────────────────────────────────────────────────────────────

export async function triggerWorkflow(
  contactId: string,
  workflowId: string,
  userId?: string | null
): Promise<void> {
  await ghlFetch(
    `/contacts/${contactId}/workflow/${workflowId}`,
    { method: "POST", body: JSON.stringify({}) },
    userId,
    "trigger_workflow"
  );
}

// ── Test connection ────────────────────────────────────────────────────────────

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
    return { ok: false, error: "GHL_API_KEY or GHL_LOCATION_ID not set" };
  }
  const locationId = process.env.GHL_LOCATION_ID;
  try {
    const res = await fetch(
      `${GHL_BASE}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=1`,
      { headers: ghlHeaders() }
    );
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
