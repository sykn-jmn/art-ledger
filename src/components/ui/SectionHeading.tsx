"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";

export function SectionHeading({
  children,
  info,
  as: Tag = "h2",
  className = "text-[18px] font-semibold",
}: {
  children: ReactNode;
  info: string;
  as?: ElementType;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Tag className={className}>{children}</Tag>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-outline hover:text-primary hover:bg-surface-container transition-colors"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="About this section"
          title="About this section"
          onClick={() => setOpen((v) => !v)}
        >
          <Info size={14} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {open ? (
        <p
          id={panelId}
          role="note"
          className="text-[12px] leading-relaxed text-on-surface-variant bg-surface-container-low rounded px-3 py-2 max-w-2xl"
        >
          {info}
        </p>
      ) : null}
    </div>
  );
}
