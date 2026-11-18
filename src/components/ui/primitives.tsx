"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="font-sans text-[11px] font-semibold uppercase tracking-wider text-outline">
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-error">{error}</p> : null}
    </div>
  );
}

const inputClass =
  "w-full h-9 px-3 bg-surface-container-low rounded text-on-surface font-sans text-[13px] focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary transition-all disabled:opacity-60";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 bg-surface-container-low rounded text-on-surface font-sans text-[13px] focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputClass} appearance-none cursor-pointer ${props.className ?? ""}`}
    />
  );
}

export function Button({
  variant = "primary",
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-primary text-on-primary hover:bg-primary-container shadow-sm font-semibold",
    secondary:
      "bg-surface-container text-on-surface hover:bg-surface-container-high font-medium",
    ghost: "text-outline hover:text-on-surface hover:bg-surface-container",
    danger: "text-outline hover:text-error hover:bg-error-container/20",
  };
  return (
    <button
      {...props}
      className={`px-3 py-2 rounded font-sans text-[12px] transition-colors disabled:opacity-50 ${variants[variant]} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface-container-lowest rounded shadow-sm ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "warn" | "success";
}) {
  const tones = {
    neutral: "bg-surface-container text-on-surface-variant",
    primary: "bg-surface-container text-primary",
    warn: "bg-error-container text-error",
    success: "bg-surface-container-high text-secondary",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
