"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Video,
  GraduationCap,
  Plus,
  X,
  Check,
  Search,
  ExternalLink,
} from "lucide-react";
import type React from "react";

type Content = {
  id: string;
  title: string;
  content_type: "article" | "video" | "course" | null;
  category: string | null;
  duration_mins: number | null;
  url: string | null;
  practitioner_id: string;
};

type Assignment = {
  id: string;
  content_id: string;
  patient_id: string;
  assigned_at: string;
  completed_at: string | null;
  progress: number;
  content_title?: string;
  patient_name?: string;
};

type Patient = { id: string; name: string };

type Tab = "library" | "assigned" | "create";

const TYPE_ICON: Record<string, React.ReactNode> = {
  article: <BookOpen size={16} />,
  video: <Video size={16} />,
  course: <GraduationCap size={16} />,
};

const TYPE_COLOR: Record<string, string> = {
  article: "bg-nesema-sage/10 text-nesema-sage",
  video: "bg-amber-100 text-amber-700",
  course: "bg-purple-100 text-purple-700",
};

const TYPE_BORDER: Record<string, string> = {
  article: "border-nesema-sage/30",
  video: "border-amber-200",
  course: "border-purple-200",
};

export default function EducationPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("library");
  const [content, setContent] = useState<Content[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pracId, setPracId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Assign modal
  const [assignModal, setAssignModal] = useState<Content | null>(null);
  const [assignPatientId, setAssignPatientId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    title: "",
    content_type: "article" as "article" | "video" | "course",
    category: "",
    duration_mins: "",
    url: "",
  });
  const [creating, setCreating] = useState(false);
  const [createDone, setCreateDone] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/sign-in"); return; }

      const { data: prac } = (await supabase
        .from("practitioners")
        .select("id")
        .eq("profile_id", user.id)
        .single()) as { data: { id: string } | null; error: unknown };
      if (!prac) { router.push("/onboarding/practitioner"); return; }
      setPracId(prac.id);

      // Load content
      const { data: rawContent } = (await supabase
        .from("education_content")
        .select("id, title, content_type, category, duration_mins, url, practitioner_id")
        .order("created_at", { ascending: false })) as {
        data: Content[] | null;
        error: unknown;
      };
      setContent(rawContent ?? []);

      // Load assignments
      const { data: rawAssign } = (await supabase
        .from("education_assignments")
        .select("id, content_id, patient_id, assigned_at, completed_at, progress")
        .eq("practitioner_id", prac.id)
        .order("assigned_at", { ascending: false })) as {
        data: Assignment[] | null;
        error: unknown;
      };

      const assigns = rawAssign ?? [];

      // Resolve content titles
      const contentIds = Array.from(new Set(assigns.map((a) => a.content_id)));
      const contentMap: Record<string, string> = {};
      if (contentIds.length > 0) {
        const { data: ct } = (await supabase
          .from("education_content")
          .select("id, title")
          .in("id", contentIds)) as {
          data: { id: string; title: string }[] | null;
          error: unknown;
        };
        for (const c of ct ?? []) contentMap[c.id] = c.title;
      }

      // Resolve patient names for assignments
      const patientIds = Array.from(new Set(assigns.map((a) => a.patient_id)));
      const patientNameMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        const { data: pts } = (await supabase
          .from("patients")
          .select("id, profile_id")
          .in("id", patientIds)) as {
          data: { id: string; profile_id: string }[] | null;
          error: unknown;
        };
        const profileIds = (pts ?? []).map((p) => p.profile_id);
        if (profileIds.length > 0) {
          const { data: profs } = (await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", profileIds)) as {
            data: { id: string; first_name: string | null; last_name: string | null }[] | null;
            error: unknown;
          };
          const pm: Record<string, string> = {};
          for (const pr of profs ?? []) {
            pm[pr.id] = [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
          }
          for (const pt of pts ?? []) {
            patientNameMap[pt.id] = pm[pt.profile_id] ?? "Patient";
          }
        }
      }

      setAssignments(
        assigns.map((a) => ({
          ...a,
          content_title: contentMap[a.content_id] ?? "Content",
          patient_name: patientNameMap[a.patient_id] ?? "Patient",
        }))
      );

      // Load patients for assign modal
      const { data: myPts } = (await supabase
        .from("patients")
        .select("id, profile_id")
        .eq("practitioner_id", prac.id)) as {
        data: { id: string; profile_id: string }[] | null;
        error: unknown;
      };
      const myProfIds = (myPts ?? []).map((p) => p.profile_id);
      if (myProfIds.length > 0) {
        const { data: myProfs } = (await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", myProfIds)) as {
          data: { id: string; first_name: string | null; last_name: string | null }[] | null;
          error: unknown;
        };
        const mpMap: Record<string, string> = {};
        for (const pr of myProfs ?? []) {
          mpMap[pr.id] = [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
        }
        setPatients((myPts ?? []).map((p) => ({ id: p.id, name: mpMap[p.profile_id] ?? "Patient" })));
      }

      setLoading(false);
    }
    load();
  }, []);

  const filteredContent = useMemo(() => {
    const q = search.toLowerCase();
    return content.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.category?.toLowerCase().includes(q) ?? false)
    );
  }, [content, search]);

  async function assignContent() {
    if (!assignModal || !assignPatientId || !pracId) return;
    setAssigning(true);
    const { data: newAssign } = (await supabase
      .from("education_assignments")
      .insert({
        content_id: assignModal.id,
        patient_id: assignPatientId,
        practitioner_id: pracId,
        progress: 0,
      })
      .select("id, content_id, patient_id, assigned_at, completed_at, progress")
      .single()) as { data: Assignment | null; error: unknown };

    if (newAssign) {
      const patient = patients.find((p) => p.id === assignPatientId);
      setAssignments((prev) => [
        {
          ...newAssign,
          content_title: assignModal.title,
          patient_name: patient?.name ?? "Patient",
        },
        ...prev,
      ]);
      setAssignSuccess(`Assigned to ${patient?.name ?? "patient"}`);
      setTimeout(() => setAssignSuccess(null), 3000);
    }
    setAssigning(false);
    setAssignModal(null);
    setAssignPatientId("");
  }

  async function createContent() {
    if (!createForm.title || !pracId) return;
    setCreating(true);
    const { data: newContent } = (await supabase
      .from("education_content")
      .insert({
        title: createForm.title,
        content_type: createForm.content_type,
        category: createForm.category || null,
        duration_mins: createForm.duration_mins ? Number(createForm.duration_mins) : null,
        url: createForm.url || null,
        practitioner_id: pracId,
      })
      .select("id, title, content_type, category, duration_mins, url, practitioner_id")
      .single()) as { data: Content | null; error: unknown };

    if (newContent) {
      setContent((prev) => [newContent, ...prev]);
      setCreateDone(true);
      setCreateForm({ title: "", content_type: "article", category: "", duration_mins: "", url: "" });
      setTimeout(() => { setCreateDone(false); setTab("library"); }, 1500);
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-nesema-sage/30 border-t-nesema-sage rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-nesema-t1">Education Hub</h1>
        <button
          onClick={() => setTab("create")}
          className="flex items-center gap-1.5 bg-nesema-bark text-white text-sm px-4 py-1.5 rounded-xl"
        >
          <Plus size={16} /> Add content
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-nesema-sage/10 rounded-xl w-fit">
        {(["library", "assigned", "create"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white text-nesema-bark shadow-sm"
                : "text-nesema-t3 hover:text-nesema-t2"
            }`}
          >
            {t === "library" ? "Library" : t === "assigned" ? "Assigned" : "Create"}
          </button>
        ))}
      </div>

      {/* Success toast */}
      {assignSuccess && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-xl text-sm">
          <Check size={16} /> {assignSuccess}
        </div>
      )}

      {/* Library tab */}
      {tab === "library" && (
        <div>
          <div className="relative mb-5">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nesema-t3" />
            <input
              type="text"
              placeholder="Search content…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-nesema-bdr rounded-xl text-sm text-nesema-t1 focus:outline-none focus:border-nesema-sage"
            />
          </div>

          {filteredContent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
              <BookOpen className="mx-auto mb-3 text-nesema-sage/50" size={36} />
              <p className="text-nesema-t1 font-medium mb-1">No content found</p>
              <p className="text-nesema-t3 text-sm">
                {search ? "Try a different search" : "Create your first piece of content"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContent.map((c) => (
                <ContentCard
                  key={c.id}
                  content={c}
                  onAssign={() => { setAssignModal(c); setAssignPatientId(""); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assigned tab */}
      {tab === "assigned" && (
        <div>
          {assignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
              <GraduationCap className="mx-auto mb-3 text-nesema-sage/50" size={36} />
              <p className="text-nesema-t1 font-medium mb-1">No assignments yet</p>
              <p className="text-nesema-t3 text-sm">Assign content from the Library tab.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-nesema-sage/20 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-nesema-sage/10">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-wide">Content</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-wide">Patient</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-wide hidden md:table-cell">Assigned</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-wide">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, i) => (
                    <tr key={a.id} className={i > 0 ? "border-t border-nesema-sage/10" : ""}>
                      <td className="px-4 py-3 text-nesema-t1 font-medium">{a.content_title}</td>
                      <td className="px-4 py-3 text-nesema-t2">{a.patient_name}</td>
                      <td className="px-4 py-3 text-nesema-t3 hidden md:table-cell">
                        {new Date(a.assigned_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        {a.completed_at ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                            <Check size={12} /> Complete
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-nesema-sage rounded-full" style={{ width: `${a.progress}%` }} />
                            </div>
                            <span className="text-xs text-nesema-t3">{a.progress}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create tab */}
      {tab === "create" && (
        <div className="max-w-lg">
          {createDone ? (
            <div className="rounded-2xl bg-green-50 border border-green-200 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Check className="text-green-600" size={24} />
              </div>
              <p className="font-medium text-green-800">Content created!</p>
              <p className="text-sm text-green-600 mt-1">Redirecting to library…</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6 space-y-4">
              <h2 className="font-medium text-nesema-t1">New content</h2>

              <div>
                <label className="block text-xs font-medium text-nesema-t2 mb-1">Title *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Understanding the Gut Microbiome"
                  className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 focus:outline-none focus:border-nesema-sage"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-nesema-t2 mb-1">Type</label>
                <div className="flex gap-2">
                  {(["article", "video", "course"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCreateForm((f) => ({ ...f, content_type: t }))}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium border capitalize transition-colors flex items-center justify-center gap-1 ${
                        createForm.content_type === t
                          ? "bg-nesema-bark text-white border-nesema-bark"
                          : "border-nesema-bdr text-nesema-t2"
                      }`}
                    >
                      {TYPE_ICON[t]} {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-nesema-t2 mb-1">Category</label>
                  <input
                    type="text"
                    value={createForm.category}
                    onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Nutrition"
                    className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 focus:outline-none focus:border-nesema-sage"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nesema-t2 mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    value={createForm.duration_mins}
                    onChange={(e) => setCreateForm((f) => ({ ...f, duration_mins: e.target.value }))}
                    placeholder="e.g. 10"
                    min="1"
                    className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 focus:outline-none focus:border-nesema-sage"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-nesema-t2 mb-1">URL</label>
                <input
                  type="url"
                  value={createForm.url}
                  onChange={(e) => setCreateForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 focus:outline-none focus:border-nesema-sage"
                />
              </div>

              <button
                onClick={createContent}
                disabled={creating || !createForm.title}
                className="w-full bg-nesema-bark text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {creating ? "Saving…" : "Create content"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-medium text-nesema-t1">Assign to patient</h2>
                <p className="text-sm text-nesema-t3 mt-0.5">{assignModal.title}</p>
              </div>
              <button onClick={() => setAssignModal(null)} className="text-nesema-t3 hover:text-nesema-t1">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-nesema-t2 mb-1">Patient</label>
              <select
                value={assignPatientId}
                onChange={(e) => setAssignPatientId(e.target.value)}
                className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 bg-white focus:outline-none focus:border-nesema-sage"
              >
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 border border-nesema-bdr text-nesema-t2 py-2 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={assignContent}
                disabled={assigning || !assignPatientId}
                className="flex-1 bg-nesema-bark text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {assigning ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContentCard({
  content,
  onAssign,
}: {
  content: Content;
  onAssign: () => void;
}) {
  const type = content.content_type ?? "article";
  return (
    <div className={`rounded-2xl bg-white border p-4 flex flex-col gap-3 ${TYPE_BORDER[type] ?? "border-nesema-sage/20"}`}>
      <div className="flex items-start gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLOR[type] ?? "bg-nesema-sage/10 text-nesema-sage"}`}>
          {TYPE_ICON[type] ?? <BookOpen size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-nesema-t1 leading-snug">{content.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-nesema-t3 flex-wrap">
            {content.category && <span>{content.category}</span>}
            {content.duration_mins && <span>{content.duration_mins} min</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onAssign}
          className="flex-1 text-xs text-nesema-bark border border-nesema-sage/30 py-1.5 rounded-lg hover:bg-nesema-sage/5 transition-colors"
        >
          Assign
        </button>
        {content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center border border-nesema-bdr rounded-lg text-nesema-t3 hover:text-nesema-t1 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
