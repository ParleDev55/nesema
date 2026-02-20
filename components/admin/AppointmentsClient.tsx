"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface AppointmentRow {
  id: string;
  practitioner_id: string | null;
  patient_id: string | null;
  status: string | null;
  appointment_type: string | null;
  scheduled_at: string;
  amount_pence: number | null;
  created_at: string;
  practitioners: {
    id: string;
    practice_name: string | null;
    profiles: { first_name: string | null; last_name: string | null } | null;
  } | null;
  patients: {
    id: string;
    profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  } | null;
}

type StatusFilter = "all" | "scheduled" | "completed" | "cancelled";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-gray-100 text-gray-600",
};

export function AppointmentsClient({ appointments }: { appointments: AppointmentRow[] }) {
  const [tab, setTab] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rows, setRows] = useState(appointments);
  const [search, setSearch] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function getPracName(a: AppointmentRow) {
    const profile = Array.isArray(a.practitioners?.profiles)
      ? a.practitioners?.profiles[0]
      : a.practitioners?.profiles;
    return (
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      a.practitioners?.practice_name ||
      "—"
    );
  }

  function getPatientName(a: AppointmentRow) {
    const profile = Array.isArray(a.patients?.profiles)
      ? a.patients?.profiles[0]
      : a.patients?.profiles;
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "—";
  }

  function getPatientEmail(a: AppointmentRow) {
    const profile = Array.isArray(a.patients?.profiles)
      ? a.patients?.profiles[0]
      : a.patients?.profiles;
    return profile?.email ?? "—";
  }

  const filtered = rows.filter((a) => {
    if (tab !== "all" && a.status !== tab) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      getPracName(a).toLowerCase().includes(q) ||
      getPatientName(a).toLowerCase().includes(q) ||
      getPatientEmail(a).toLowerCase().includes(q)
    );
  });

  async function cancelAppointment(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/appointments/${id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to cancel");
      }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
      showToast("Appointment cancelled.");
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  function exportCSV() {
    const headers = ["ID", "Date", "Patient", "Email", "Practitioner", "Type", "Status", "Amount (£)"];
    const csvRows = [
      headers.join(","),
      ...filtered.map((a) =>
        [
          a.id,
          new Date(a.scheduled_at).toLocaleDateString("en-GB"),
          `"${getPatientName(a)}"`,
          `"${getPatientEmail(a)}"`,
          `"${getPracName(a)}"`,
          a.appointment_type ?? "",
          a.status ?? "",
          a.amount_pence ? (a.amount_pence / 100).toFixed(2) : "0.00",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "scheduled", label: "Scheduled" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="p-6 md:p-8">
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg"
          style={{ backgroundColor: "#C27D30" }}
        >
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-nesema-t1">Appointments</h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-nesema-bdr text-nesema-t2 hover:bg-nesema-bg"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search patient or practitioner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-nesema-bdr rounded-xl px-3 py-2 text-sm bg-nesema-bg text-nesema-t1 placeholder:text-nesema-t4 focus:outline-none focus:ring-2 w-full sm:w-64"
        />
        <div className="flex gap-1 bg-nesema-bg rounded-2xl p-1 border border-nesema-bdr w-fit">
          {tabs.map((t) => {
            const count =
              t.id === "all" ? rows.length : rows.filter((r) => r.status === t.id).length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  tab === t.id ? "text-white shadow-sm" : "text-nesema-t3 hover:text-nesema-t2"
                }`}
                style={tab === t.id ? { backgroundColor: "#C27D30" } : {}}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                      tab === t.id ? "bg-white/30" : "bg-nesema-bdr"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-nesema-t3 text-sm">No appointments match this filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-nesema-bdr">
              <tr>
                {["Date & Time", "Patient", "Practitioner", "Type", "Amount", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-nesema-bdr">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-nesema-bg/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-nesema-t1">
                      {new Date(a.scheduled_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-xs text-nesema-t3">
                      {new Date(a.scheduled_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-nesema-t1">{getPatientName(a)}</div>
                    <div className="text-xs text-nesema-t3">{getPatientEmail(a)}</div>
                  </td>
                  <td className="px-4 py-3 text-nesema-t2">{getPracName(a)}</td>
                  <td className="px-4 py-3 text-nesema-t2 capitalize">
                    {a.appointment_type ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-nesema-t2">
                    {a.amount_pence ? `£${(a.amount_pence / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_COLORS[a.status ?? ""] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {a.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status === "scheduled" && (
                      <button
                        onClick={() => cancelAppointment(a.id)}
                        disabled={loading === a.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        {loading === a.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
