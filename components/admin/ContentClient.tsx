"use client";

import { useState } from "react";
import { Trash2, ExternalLink } from "lucide-react";

interface EducationRow {
  id: string;
  practitioner_id: string;
  title: string;
  content_type: "article" | "video" | "course" | null;
  category: string | null;
  duration_mins: number | null;
  url: string | null;
  created_at: string;
  practitioners: {
    id: string;
    practice_name: string | null;
    profiles: { first_name: string | null; last_name: string | null } | null;
  } | null;
}

interface DocumentRow {
  id: string;
  patient_id: string | null;
  practitioner_id: string | null;
  uploaded_by: string | null;
  document_type: "lab_result" | "intake_form" | "consent" | "report" | "other" | null;
  title: string;
  storage_path: string;
  is_lab_result: boolean;
  requires_pin: boolean;
  created_at: string;
}

type ContentTab = "education" | "documents";

const TYPE_COLORS: Record<string, string> = {
  article: "bg-blue-100 text-blue-700",
  video: "bg-purple-100 text-purple-700",
  course: "bg-amber-100 text-amber-700",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  lab_result: "bg-red-100 text-red-700",
  intake_form: "bg-blue-100 text-blue-700",
  consent: "bg-green-100 text-green-700",
  report: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-600",
};

export function ContentClient({
  education,
  documents,
}: {
  education: EducationRow[];
  documents: DocumentRow[];
}) {
  const [tab, setTab] = useState<ContentTab>("education");
  const [eduRows, setEduRows] = useState(education);
  const [docRows, setDocRows] = useState(documents);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function getPracName(row: EducationRow) {
    const profile = Array.isArray(row.practitioners?.profiles)
      ? row.practitioners?.profiles[0]
      : row.practitioners?.profiles;
    return (
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      row.practitioners?.practice_name ||
      "—"
    );
  }

  async function deleteContent(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/content/${id}/delete`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to delete");
      setEduRows((prev) => prev.filter((r) => r.id !== id));
      showToast("Content deleted.");
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function deleteDocument(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}/delete`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to delete");
      setDocRows((prev) => prev.filter((r) => r.id !== id));
      showToast("Document deleted.");
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function viewDocument(id: string) {
    try {
      const res = await fetch(`/api/admin/documents/${id}/signed-url`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to get URL");
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      showToast((e as Error).message);
    }
  }

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

      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Content</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-nesema-bg rounded-2xl p-1 border border-nesema-bdr w-fit">
        {[
          { id: "education" as ContentTab, label: "Education", count: eduRows.length },
          { id: "documents" as ContentTab, label: "Documents", count: docRows.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              tab === t.id ? "text-white shadow-sm" : "text-nesema-t3 hover:text-nesema-t2"
            }`}
            style={tab === t.id ? { backgroundColor: "#C27D30" } : {}}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  tab === t.id ? "bg-white/30" : "bg-nesema-bdr"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Education content */}
      {tab === "education" && (
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr overflow-hidden">
          {eduRows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-nesema-t3 text-sm">No education content yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-nesema-bdr">
                <tr>
                  {["Title", "Practitioner", "Type", "Category", "Duration", "Added", ""].map((h) => (
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
                {eduRows.map((row) => (
                  <tr key={row.id} className="hover:bg-nesema-bg/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-nesema-t1">{row.title}</div>
                      {row.url && (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-nesema-sage flex items-center gap-0.5 hover:underline"
                        >
                          View <ExternalLink size={10} />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-nesema-t2">{getPracName(row)}</td>
                    <td className="px-4 py-3">
                      {row.content_type && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            TYPE_COLORS[row.content_type] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {row.content_type}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-nesema-t3 text-xs">{row.category ?? "—"}</td>
                    <td className="px-4 py-3 text-nesema-t3 text-xs">
                      {row.duration_mins ? `${row.duration_mins}m` : "—"}
                    </td>
                    <td className="px-4 py-3 text-nesema-t3 text-xs">
                      {new Date(row.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteContent(row.id)}
                        disabled={loading === row.id}
                        className="text-red-400 hover:text-red-600 disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr overflow-hidden">
          {docRows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-nesema-t3 text-sm">No documents yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-nesema-bdr">
                <tr>
                  {["Title", "Type", "Lab result", "Uploaded", ""].map((h) => (
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
                {docRows.map((doc) => (
                  <tr key={doc.id} className="hover:bg-nesema-bg/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-nesema-t1">{doc.title}</td>
                    <td className="px-4 py-3">
                      {doc.document_type && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            DOC_TYPE_COLORS[doc.document_type] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {doc.document_type.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-nesema-t3">
                      {doc.is_lab_result ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-nesema-t3 text-xs">
                      {new Date(doc.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewDocument(doc.id)}
                          className="text-nesema-sage hover:text-nesema-sage-l"
                          title="View"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          disabled={loading === doc.id}
                          className="text-red-400 hover:text-red-600 disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
