"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface AiInsightCardProps {
  title: string;
  systemPrompt: string;
  userMessage: string;
  ctaLabel?: string;
  /** If provided, caches the response in localStorage for the current day */
  cacheKey?: string;
  /** API route to call. Defaults to /api/ai/stream */
  apiRoute?: string;
}

export function AiInsightCard({
  title,
  systemPrompt,
  userMessage,
  cacheKey,
  apiRoute = "/api/ai/stream",
}: AiInsightCardProps) {
  const [content, setContent] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const abortRef = useRef<AbortController | null>(null);

  const todayKey = cacheKey
    ? `ai_${cacheKey}_${new Date().toISOString().slice(0, 10)}`
    : null;

  const run = useCallback(
    async (force = false) => {
      // Check localStorage cache first (unless forcing a refresh)
      if (!force && todayKey) {
        try {
          const cached = localStorage.getItem(todayKey);
          if (cached) {
            setContent(cached);
            setStatus("done");
            return;
          }
        } catch {
          // localStorage unavailable — proceed
        }
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("loading");
      setContent("");

      try {
        const res = await fetch(apiRoute, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ systemPrompt, userMessage }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 429 || err?.code === "RATE_LIMIT") {
            setContent(
              "You've used a lot of AI features today. Come back tomorrow for fresh insights."
            );
            setStatus("done");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setContent(accumulated);
        }

        setStatus("done");

        // Cache in localStorage if cacheKey provided
        if (todayKey && accumulated) {
          try {
            localStorage.setItem(todayKey, accumulated);
          } catch {
            // quota exceeded or unavailable
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStatus("error");
      }
    },
    [apiRoute, systemPrompt, userMessage, todayKey]
  );

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
  }, [run]);

  return (
    <div className="rounded-2xl bg-white border-l-4 border-l-[#C4B5FD] border border-nesema-bdr overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[#7C3AED] text-sm">✦</span>
          <h3 className="font-semibold text-nesema-t1 text-sm">{title}</h3>
        </div>
        <button
          onClick={() => run(true)}
          title="Regenerate"
          className="text-nesema-t3 hover:text-nesema-t1 transition-colors p-1 rounded-full hover:bg-nesema-bg"
        >
          <span className="text-base leading-none">↺</span>
        </button>
      </div>

      {/* Body */}
      <div className="px-5 pb-4">
        {status === "loading" && (
          <div className="space-y-2 py-1">
            <p className="text-xs text-[#7C3AED] font-medium animate-pulse">
              Analysing…
            </p>
            <div className="h-3 bg-[#EDE9FE] rounded-full animate-pulse w-full" />
            <div className="h-3 bg-[#EDE9FE] rounded-full animate-pulse w-5/6" />
            <div className="h-3 bg-[#EDE9FE] rounded-full animate-pulse w-4/6" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-700">
              AI insights unavailable right now
            </p>
          </div>
        )}

        {(status === "done" || (status === "idle" && content)) && (
          <div className="max-h-64 overflow-y-auto">
            <p className="text-sm text-nesema-t2 leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-3 border-t border-nesema-bdr/50 pt-2">
        <p className="text-[10px] text-nesema-t4">Powered by Claude</p>
      </div>
    </div>
  );
}
