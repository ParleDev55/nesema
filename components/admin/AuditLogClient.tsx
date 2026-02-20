"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

const ACTION_COLORS: Record<string, string> = {
  verify: "bg-green-100 text-green-700",
  reject: "bg-red-100 text-red-700",
  suspend: "bg-amber-100 text-amber-700",
  reinstate: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  reassign: "bg-purple-100 text-purple-700",
  cancel: "bg-gray-100 text-gray-600",
  settings_update: "bg-blue-100 text-blue-700",
};

function getActionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : "bg-gray-100 text-gray-600";
}

export function AuditLogClient({
  entries,
  page,
  totalPages,
  totalCount,
}: {
  entries: AuditEntry[];
  page: number;
  totalPages: number;
  totalCount: number;
}) {
  const router = useRouter();

  function getAdminName(entry: AuditEntry) {
    const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
    if (!profile) return "Unknown admin";
    return (
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      profile.email ||
      "Unknown admin"
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-nesema-t1">Audit Log</h1>
          <p className="text-sm text-nesema-t3 mt-1">{totalCount} total entries</p>
        </div>
      </div>

      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr overflow-hidden">
        {entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-nesema-t3 text-sm">No audit log entries yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-nesema-bdr">
              <tr>
                {["Time", "Admin", "Action", "Target", "Details"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nesema-bdr">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-nesema-bg/60 transition-colors">
                  <td className="px-4 py-3 text-xs text-nesema-t3 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: "#C27D3022", color: "#C27D30" }}
                      >
                        {getAdminName(entry).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-nesema-t1 text-xs font-medium">
                        {getAdminName(entry)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(
                        entry.action
                      )}`}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-nesema-t3">
                    {entry.target_type && (
                      <span className="capitalize">{entry.target_type}</span>
                    )}
                    {entry.target_id && (
                      <span className="text-nesema-t4 ml-1 font-mono">
                        {entry.target_id.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-nesema-t3 max-w-xs truncate">
                    {entry.metadata
                      ? Object.entries(entry.metadata)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-nesema-t3">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/admin/audit-log?page=${page - 1}`)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-nesema-bdr text-nesema-t2 hover:bg-nesema-bg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => router.push(`/admin/audit-log?page=${page + 1}`)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-nesema-bdr text-nesema-t2 hover:bg-nesema-bg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
