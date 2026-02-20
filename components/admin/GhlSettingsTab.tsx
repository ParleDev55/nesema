"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, RefreshCcw, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SyncLogRow {
  id: string;
  event_type: string;
  ghl_contact_id: string | null;
  success: boolean;
  error: string | null;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

// ── Connection status card ─────────────────────────────────────────────────────

function ConnectionCard({
  apiKeySet,
  locationIdSet,
}: {
  apiKeySet: boolean;
  locationIdSet: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function testConnection() {
    setStatus("testing");
    setErrMsg(null);
    try {
      const res = await fetch("/api/admin/ghl/test", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
      } else {
        setStatus("error");
        setErrMsg(data.error ?? "Connection failed");
      }
    } catch (e) {
      setStatus("error");
      setErrMsg((e as Error).message);
    }
  }

  const envOk = apiKeySet && locationIdSet;

  return (
    <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
      <h3 className="font-medium text-nesema-t1 mb-3">Connection status</h3>
      <div className="flex items-center gap-3 mb-4">
        {status === "ok" ? (
          <>
            <CheckCircle2 size={18} className="text-green-500" />
            <span className="text-sm font-medium text-green-700">Connected</span>
          </>
        ) : status === "error" ? (
          <>
            <XCircle size={18} className="text-red-500" />
            <span className="text-sm font-medium text-red-700">Not connected — {errMsg}</span>
          </>
        ) : envOk ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="text-sm text-nesema-t2">Credentials set — click Test to verify</span>
          </>
        ) : (
          <>
            <XCircle size={18} className="text-nesema-t3" />
            <span className="text-sm text-nesema-t3">Not configured</span>
          </>
        )}
      </div>

      {!envOk && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4 text-xs text-amber-800 space-y-1">
          {!apiKeySet && <p>⚠ <code>GHL_API_KEY</code> is not set in environment variables.</p>}
          {!locationIdSet && <p>⚠ <code>GHL_LOCATION_ID</code> is not set in environment variables.</p>}
          <p className="mt-1">See SETUP_GUIDE.md → GHL Integration for setup instructions.</p>
        </div>
      )}

      <button
        onClick={testConnection}
        disabled={status === "testing"}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-nesema-sage text-white hover:bg-nesema-sage-l transition-colors disabled:opacity-50"
      >
        {status === "testing" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RefreshCcw size={14} />
        )}
        Test connection
      </button>
    </div>
  );
}

// ── Pipeline config ────────────────────────────────────────────────────────────

function PipelineConfig({
  pipelineId,
  pracPipelineId,
}: {
  pipelineId: string;
  pracPipelineId: string;
}) {
  const patientStages = [
    "In Queue",
    "Matched",
    "First Session Booked",
    "Active Patient",
    "At Risk",
    "Churned",
  ];
  const pracStages = ["Pending Verification", "Verified & Live", "Rejected", "Suspended"];

  return (
    <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-5">
      <h3 className="font-medium text-nesema-t1">Pipeline configuration</h3>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Patient pipeline */}
        <div>
          <p className="text-xs font-semibold text-nesema-t3 uppercase tracking-wider mb-2">
            Patient pipeline
          </p>
          <p className="text-[11px] text-nesema-t4 font-mono mb-2">
            {pipelineId || "GHL_PIPELINE_ID not set"}
          </p>
          <ul className="space-y-1">
            {patientStages.map((s, i) => (
              <li key={s} className="text-xs text-nesema-t2 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-nesema-sage/10 flex items-center justify-center text-[9px] font-bold text-nesema-sage shrink-0">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Practitioner pipeline */}
        <div>
          <p className="text-xs font-semibold text-nesema-t3 uppercase tracking-wider mb-2">
            Practitioner pipeline
          </p>
          <p className="text-[11px] text-nesema-t4 font-mono mb-2">
            {pracPipelineId || "GHL_PRACTITIONER_PIPELINE_ID not set"}
          </p>
          <ul className="space-y-1">
            {pracStages.map((s, i) => (
              <li key={s} className="text-xs text-nesema-t2 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#7B6FA822] flex items-center justify-center text-[9px] font-bold text-[#7B6FA8] shrink-0">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Manual sync ────────────────────────────────────────────────────────────────

function SyncButton({
  label,
  endpoint,
  onDone,
}: {
  label: string;
  endpoint: string;
  onDone: () => void;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState("");

  async function run() {
    setState("running");
    setProgress("Starting…");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.body) { setState("error"); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value).split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line) as {
              total?: number;
              done?: number;
              synced?: number;
              complete?: boolean;
            };
            if (obj.complete) {
              setProgress(`Done — synced ${obj.synced ?? 0}`);
              setState("done");
            } else if (obj.done !== undefined && obj.total !== undefined) {
              setProgress(`Syncing ${obj.done} of ${obj.total}…`);
            } else if (obj.total !== undefined) {
              setProgress(`Found ${obj.total} to sync…`);
            }
          } catch {}
        }
      }
      if (state !== "done") setState("done");
      onDone();
    } catch (e) {
      setProgress((e as Error).message);
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={state === "running"}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-nesema-bdr text-nesema-t1 hover:border-nesema-sage hover:text-nesema-sage transition-colors disabled:opacity-50"
      >
        {state === "running" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
        {label}
      </button>
      {progress && (
        <span className={`text-xs ${state === "error" ? "text-red-600" : "text-nesema-t3"}`}>
          {progress}
        </span>
      )}
    </div>
  );
}

// ── Sync log table ─────────────────────────────────────────────────────────────

function SyncLog() {
  const [rows, setRows] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ghl/log");
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  async function retry(logId: string) {
    setRetrying(logId);
    try {
      await fetch("/api/admin/ghl/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      await fetchLog();
    } catch {}
    setRetrying(null);
  }

  return (
    <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-nesema-t1">Sync log</h3>
        <button
          onClick={fetchLog}
          className="p-1.5 rounded-lg hover:bg-nesema-bg transition-colors text-nesema-t3"
          title="Refresh"
        >
          <RefreshCcw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-nesema-t4" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-nesema-t3 py-4 text-center">No sync events yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-nesema-bdr text-nesema-t3 text-left">
                <th className="pb-2 font-semibold uppercase tracking-wider pr-3">Event</th>
                <th className="pb-2 font-semibold uppercase tracking-wider pr-3">User</th>
                <th className="pb-2 font-semibold uppercase tracking-wider pr-3">GHL Contact</th>
                <th className="pb-2 font-semibold uppercase tracking-wider pr-3">Status</th>
                <th className="pb-2 font-semibold uppercase tracking-wider pr-3">Error</th>
                <th className="pb-2 font-semibold uppercase tracking-wider pr-3">Time</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                const userName = prof
                  ? [prof.first_name, prof.last_name].filter(Boolean).join(" ") || prof.email || "—"
                  : "—";
                const isFailed = !row.success;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-nesema-bdr/50 ${
                      isFailed ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="py-2 pr-3 font-mono text-[11px] text-nesema-t2">
                      {row.event_type}
                    </td>
                    <td className="py-2 pr-3 text-nesema-t2 max-w-[120px] truncate">
                      {userName}
                    </td>
                    <td className="py-2 pr-3 font-mono text-nesema-t4 text-[11px]">
                      {row.ghl_contact_id ? row.ghl_contact_id.slice(0, 12) + "…" : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {row.success ? (
                        <CheckCircle2 size={13} className="text-green-500" />
                      ) : (
                        <XCircle size={13} className="text-red-500" />
                      )}
                    </td>
                    <td className="py-2 pr-3 text-red-600 max-w-[120px] truncate">
                      {row.error ?? ""}
                    </td>
                    <td className="py-2 pr-3 text-nesema-t4 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2">
                      {isFailed && (
                        <button
                          onClick={() => retry(row.id)}
                          disabled={retrying === row.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[#B5704A] hover:bg-[#F5EDE8] transition-colors disabled:opacity-50"
                        >
                          {retrying === row.id ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <RefreshCcw size={10} />
                          )}
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main GhlSettingsTab ────────────────────────────────────────────────────────

export function GhlSettingsTab({
  apiKeySet,
  locationIdSet,
  pipelineId,
  pracPipelineId,
}: {
  apiKeySet: boolean;
  locationIdSet: boolean;
  pipelineId: string;
  pracPipelineId: string;
}) {
  const [logKey, setLogKey] = useState(0);

  return (
    <div className="space-y-6">
      <ConnectionCard apiKeySet={apiKeySet} locationIdSet={locationIdSet} />
      <PipelineConfig pipelineId={pipelineId} pracPipelineId={pracPipelineId} />

      {/* Manual sync tools */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
        <h3 className="font-medium text-nesema-t1 mb-1">Manual sync</h3>
        <p className="text-xs text-nesema-t3 mb-4">
          Sync records that are missing a GHL contact ID. Existing contacts will be updated, not duplicated.
        </p>
        <div className="space-y-3">
          <SyncButton
            label="Sync all practitioners"
            endpoint="/api/admin/ghl/sync-practitioners"
            onDone={() => setLogKey((k) => k + 1)}
          />
          <SyncButton
            label="Sync all patients"
            endpoint="/api/admin/ghl/sync-patients"
            onDone={() => setLogKey((k) => k + 1)}
          />
        </div>
      </div>

      {/* Sync log */}
      <div key={logKey}>
        <SyncLog />
      </div>
    </div>
  );
}
