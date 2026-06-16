import type { ReactNode } from "react";
import type { FeedbackCell } from "@/src/core/types";
import { feedbackToPip } from "@/src/core/feedback";

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative border border-[var(--hairline)] bg-black/55 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.85)] backdrop-blur-sm">
      <Corners />
      <div className="flex flex-col gap-1 border-b border-[var(--hairline)] px-4 pb-2 pt-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="text-sm uppercase tracking-[0.22em] text-[var(--ember-bright)]">{title}</span>
        {subtitle ? (
          <span className="font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)] sm:shrink-0">{subtitle}</span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  );
}

export function Corners() {
  return (
    <>
      <span className="absolute left-0 top-0 h-2 w-2 border-l border-t border-[var(--ember)]/70" />
      <span className="absolute right-0 top-0 h-2 w-2 border-r border-t border-[var(--ember)]/70" />
      <span className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-[var(--ember)]/70" />
      <span className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-[var(--ember)]/70" />
    </>
  );
}

export function ParchmentPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative p-4 shadow-2xl sm:p-6 lg:p-8 2xl:p-10"
      style={{
        background:
          "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.18), transparent 34%), linear-gradient(180deg, oklch(0.88 0.052 78) 0%, oklch(0.78 0.065 70) 100%)",
        boxShadow: "0 36px 90px -24px rgba(0,0,0,0.88), inset 0 0 70px rgba(80,40,10,0.25)",
      }}
    >
      <Corners />
      {children}
    </div>
  );
}

export function Stat({ label, value, bar }: { label: string; value: string; bar: number }) {
  return (
    <div className="pt-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 font-mono text-xs uppercase tracking-[0.14em]">
        <span className="text-base text-[var(--bone-dim)]">{label}</span>
        <span className="shrink-0 text-sm text-[var(--bone)]">{value}</span>
      </div>
      <div className="relative h-px bg-[var(--hairline)]">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--ember)]"
          style={{ width: `${bar * 100}%`, boxShadow: "0 0 8px rgba(255,140,60,0.7)" }}
        />
      </div>
    </div>
  );
}

export function Line({ who, text }: { who: string; text: string }) {
  return (
    <p className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <span className="w-auto shrink-0 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--rust)] sm:w-16 sm:pt-2">
        {who}
      </span>
      <span className="text-base italic leading-snug text-[var(--panel-ink)] sm:text-lg md:text-xl">{text}</span>
    </p>
  );
}

export function Pip({ cell, debugTitle }: { cell: FeedbackCell; debugTitle?: string }) {
  const kind = feedbackToPip(cell);
  const className =
    kind === "hit" ? "bg-[var(--moss)]" : kind === "near" ? "bg-[var(--ember)]" : "bg-[var(--panel-ink)]/25";

  return (
    <span
      className={`mx-auto block size-5 sm:size-6 ${debugTitle ? "cursor-help" : ""} ${className}`}
      title={debugTitle}
    />
  );
}
