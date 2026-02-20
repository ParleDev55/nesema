"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ClipboardList, Leaf, Utensils, Sparkles, X, Send } from "lucide-react";
import type { Json } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────
type CarePlan = {
  id: string;
  week_number: number;
  goals: string[] | null;
  supplements: Json | null;
  notes: string | null;
  updated_at: string;
};

type MealDay = {
  breakfast?: string[];
  lunch?: string[];
  dinner?: string[];
  snacks?: string[];
};

type MealPlan = {
  id: string;
  protocol_name: string | null;
  week_number: number | null;
  notes: string | null;
  days: Json | null;
  assigned_at: string;
};

type PatientInfo = {
  diagnosed_conditions: string | null;
  allergies: string | null;
  goals: string[] | null;
  diet_type: string | null;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

interface Props {
  carePlan: CarePlan | null;
  mealPlan: MealPlan | null;
  patient: PatientInfo;
  systemContext: string;
}

// ── Helper: stream text from an API route ─────────────────────────────────────
async function streamText(
  url: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429 || (err as { code?: string }).code === "RATE_LIMIT") {
      onChunk(
        "You've used a lot of AI features today. Come back tomorrow for fresh insights."
      );
      return;
    }
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

// ── Food alternatives inline popover ──────────────────────────────────────────
function FoodAlternatives({
  foodName,
  protocol,
  goals,
}: {
  foodName: string;
  protocol: string;
  goals: string;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (content) { setOpen(true); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setOpen(true);
    setLoading(true);
    let accumulated = "";
    try {
      await streamText(
        "/api/ai/meal-alternatives",
        {
          userMessage: `Food item: ${foodName}\nDietary protocol: ${protocol}\nGoals: ${goals}`,
          foodName,
        },
        (chunk) => {
          accumulated += chunk;
          setContent(accumulated);
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setContent("Unable to suggest alternatives right now.");
      }
    }
    setLoading(false);
  }, [foodName, protocol, goals, content]);

  if (!open) {
    return (
      <button
        onClick={load}
        className="text-[10px] text-[#7C3AED] hover:underline whitespace-nowrap"
      >
        Alternatives ✦
      </button>
    );
  }

  return (
    <div className="mt-1 rounded-xl bg-[#FAFAFE] border border-[#C4B5FD] p-3 text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[#7C3AED] font-medium">Alternatives for {foodName}</span>
        <button onClick={() => setOpen(false)} className="text-nesema-t3 hover:text-nesema-t1">
          <X size={12} />
        </button>
      </div>
      {loading && !content && (
        <div className="space-y-1">
          <div className="h-2 bg-[#EDE9FE] rounded-full animate-pulse w-4/5" />
          <div className="h-2 bg-[#EDE9FE] rounded-full animate-pulse w-3/5" />
        </div>
      )}
      <p className="text-nesema-t2 whitespace-pre-wrap leading-relaxed">{content}</p>
      <p className="text-[9px] text-nesema-t4 mt-1">Powered by Claude</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PlanPageClient({ carePlan, mealPlan, patient, systemContext }: Props) {
  // Meal explanation slide-over
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [explanationContent, setExplanationContent] = useState("");
  const [explanationLoading, setExplanationLoading] = useState(false);
  const explanationAbortRef = useRef<AbortController | null>(null);

  // Q&A chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Supplements
  type Supp = { name?: string; dose?: string; timing?: string } | string;
  const supplements: Supp[] = Array.isArray(carePlan?.supplements)
    ? (carePlan!.supplements as Supp[])
    : [];

  // Protocol string for alternatives
  const protocol = [
    patient.diet_type ?? "",
    patient.allergies ? `Allergies: ${patient.allergies}` : "",
  ]
    .filter(Boolean)
    .join(", ") || "Standard protocol";

  const goals = (patient.goals ?? []).join(", ") || "General health";

  // Meal plan days
  const days =
    mealPlan?.days && typeof mealPlan.days === "object" && !Array.isArray(mealPlan.days)
      ? (mealPlan.days as Record<string, MealDay>)
      : null;

  const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const MEAL_ORDER: (keyof MealDay)[] = ["breakfast", "lunch", "dinner", "snacks"];
  const DAY_LABEL: Record<string, string> = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday",
    thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
  };

  async function openExplanation() {
    if (explanationAbortRef.current) explanationAbortRef.current.abort();
    const controller = new AbortController();
    explanationAbortRef.current = controller;

    setExplanationOpen(true);
    setExplanationContent("");
    setExplanationLoading(true);

    const mealContext = `
Protocol: ${mealPlan?.protocol_name ?? "Standard"}
Notes: ${mealPlan?.notes ?? "None"}
Dietary restrictions: ${patient.diet_type ?? "None"}, Allergies: ${patient.allergies ?? "None"}
Goals: ${goals}
Days: ${days ? JSON.stringify(days, null, 2) : "Not structured"}
    `.trim();

    let accumulated = "";
    try {
      await streamText(
        "/api/ai/meal-explanation",
        { userMessage: mealContext },
        (chunk) => {
          accumulated += chunk;
          setExplanationContent(accumulated);
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setExplanationContent("Unable to explain meal plan right now. Please try again.");
      }
    }
    setExplanationLoading(false);
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    if (chatAbortRef.current) chatAbortRef.current.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;

    // Add placeholder assistant message
    const assistantIndex = newMessages.length;
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let accumulated = "";
    try {
      await streamText(
        "/api/ai/plan-qa",
        { systemContext, messages: newMessages.slice(-10) },
        (chunk) => {
          accumulated += chunk;
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[assistantIndex] = { role: "assistant", content: accumulated };
            return updated;
          });
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[assistantIndex] = {
            role: "assistant",
            content: "I'm unable to answer right now. Please try again.",
          };
          return updated;
        });
      }
    }
    setChatLoading(false);
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Meal Explanation Slide-over */}
      {explanationOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setExplanationOpen(false); explanationAbortRef.current?.abort(); }}
          />
          <div className="relative w-full max-w-lg bg-white h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nesema-bdr">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#7C3AED]" />
                <h2 className="font-semibold text-nesema-t1">Meal Plan Explained</h2>
              </div>
              <button
                onClick={() => { setExplanationOpen(false); explanationAbortRef.current?.abort(); }}
                className="p-1.5 rounded-full hover:bg-nesema-bg text-nesema-t3 hover:text-nesema-t1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {explanationLoading && !explanationContent && (
                <div className="space-y-3">
                  <p className="text-xs text-[#7C3AED] font-medium animate-pulse">Analysing…</p>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-3 bg-[#EDE9FE] rounded-full animate-pulse" style={{ width: `${90 - i * 8}%` }} />
                  ))}
                </div>
              )}
              {explanationContent && (
                <p className="text-sm text-nesema-t2 leading-relaxed whitespace-pre-wrap">
                  {explanationContent}
                </p>
              )}
            </div>
            <p className="text-center text-[10px] text-nesema-t4 pb-4">Powered by Claude</p>
          </div>
        </div>
      )}

      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">My Plan</h1>

      {!carePlan && !mealPlan ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <ClipboardList className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">No plan yet</p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto">
            Your practitioner will create a personalised care plan for you
            after your initial consultation.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Care plan card */}
          {carePlan && (
            <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6">
              <div className="flex items-center gap-2 mb-5">
                <ClipboardList className="text-nesema-sage" size={20} />
                <h2 className="font-semibold text-nesema-t1">
                  Care Plan · Week {carePlan.week_number}
                </h2>
              </div>

              {carePlan.goals && carePlan.goals.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                    Goals
                  </p>
                  <ul className="space-y-2">
                    {carePlan.goals.map((g, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-nesema-t2">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-nesema-sage/15 flex items-center justify-center shrink-0 text-[10px] text-nesema-bark font-bold">
                          {i + 1}
                        </span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {supplements.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                    Supplements
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {supplements.map((s, i) => {
                      const name = typeof s === "string" ? s : (s?.name ?? "");
                      const dose = typeof s === "object" && s?.dose ? s.dose : null;
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 text-xs bg-nesema-sage/10 text-nesema-bark px-3 py-1.5 rounded-full"
                        >
                          <Leaf size={11} />
                          {name}
                          {dose ? ` · ${dose}` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {carePlan.notes && (
                <div>
                  <p className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                    Practitioner Notes
                  </p>
                  <p className="text-sm text-nesema-t2 whitespace-pre-wrap leading-relaxed">
                    {carePlan.notes}
                  </p>
                </div>
              )}

              <p className="mt-5 text-[11px] text-nesema-t3">
                Last updated{" "}
                {new Date(carePlan.updated_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          )}

          {/* Meal plan card */}
          {mealPlan && (
            <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Utensils className="text-nesema-sage" size={20} />
                  <h2 className="font-semibold text-nesema-t1">
                    Meal Plan
                    {mealPlan.protocol_name ? ` · ${mealPlan.protocol_name}` : ""}
                  </h2>
                </div>
                {(mealPlan.notes || days) && (
                  <button
                    onClick={openExplanation}
                    className="flex items-center gap-1.5 text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium"
                  >
                    <Sparkles size={13} />
                    Explain this plan ✦
                  </button>
                )}
              </div>

              {mealPlan.notes && (
                <p className="text-sm text-nesema-t2 whitespace-pre-wrap leading-relaxed mb-4">
                  {mealPlan.notes}
                </p>
              )}

              {/* Days breakdown */}
              {days && (
                <div className="space-y-4">
                  {DAY_ORDER.filter((d) => days[d]).map((dayKey) => {
                    const dayData = days[dayKey] as MealDay;
                    return (
                      <div key={dayKey}>
                        <p className="text-xs font-semibold text-nesema-t3 uppercase tracking-wide mb-2">
                          {DAY_LABEL[dayKey]}
                        </p>
                        <div className="space-y-2 pl-2">
                          {MEAL_ORDER.filter((m) => dayData[m]?.length).map((mealType) => (
                            <div key={mealType}>
                              <p className="text-[11px] text-nesema-t4 capitalize mb-1">{mealType}</p>
                              <div className="space-y-1">
                                {(dayData[mealType] ?? []).map((food, fi) => (
                                  <div key={fi} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-nesema-t2">{food}</span>
                                      <FoodAlternatives
                                        foodName={food}
                                        protocol={protocol}
                                        goals={goals}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!mealPlan.notes && !days && (
                <p className="text-sm text-nesema-t3">No notes from your practitioner yet.</p>
              )}

              <p className="mt-5 text-[11px] text-nesema-t3">
                Assigned{" "}
                {new Date(mealPlan.assigned_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Q&A Chat ─────────────────────────────────────────────────────────── */}
      <div className="mt-8 rounded-2xl bg-white border border-nesema-sage/20 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-[#7C3AED]" />
          <h2 className="font-semibold text-nesema-t1 text-sm">
            Questions about your plan?
          </h2>
        </div>
        <p className="text-xs text-nesema-t3 mb-4">
          Ask anything about your care plan, supplements, or meal plan.
        </p>

        {/* Message history */}
        {chatMessages.length > 0 && (
          <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <span className="text-[#7C3AED] mr-1.5 mt-0.5 shrink-0 text-sm">✦</span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-nesema-bark text-white rounded-br-sm"
                      : "bg-[#F5F3FF] text-nesema-t1 rounded-bl-sm"
                  }`}
                >
                  {msg.content || (
                    <span className="text-xs opacity-60 animate-pulse">Thinking…</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input */}
        <form onSubmit={sendChatMessage} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask about your supplements, goals, or meal plan…"
            disabled={chatLoading}
            className="flex-1 rounded-xl border border-nesema-bdr px-3 py-2 text-sm text-nesema-t1 placeholder:text-nesema-t3 focus:outline-none focus:border-nesema-sage disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            className="p-2.5 rounded-xl bg-nesema-bark text-white hover:bg-nesema-bark/90 transition-colors disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>

        <p className="text-[11px] text-nesema-t3 mt-3 leading-snug">
          This assistant can only answer questions about your current plan. For medical advice,
          contact your practitioner.
        </p>
        <p className="text-[10px] text-nesema-t4 mt-1">Powered by Claude</p>
      </div>
    </div>
  );
}
