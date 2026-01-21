"use client";

import { ReactNode } from "react";
import Link from "next/link";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actionText?: string;
  actionLink?: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
  actionText,
  actionLink,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#fafafa] text-[#111] flex items-center justify-center px-6">
      {/* FRAME */}
      <div className="relative w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 border border-black/10">
        
        {/* LEFT — EDITORIAL INTRO */}
        <div className="relative hidden md:flex flex-col justify-between p-16 border-r border-black/10">
          {/* Top label */}
          <span className="text-3xl uppercase tracking-[0.2em] text-black/40">
            SigmaMail
          </span>

          {/* Center statement */}
          <div>
            <h2 className="text-3xl font-medium leading-tight max-w-sm">
              Email, reduced to its
              <br />
              <span className="italic">essential form.</span>
            </h2>

            <p className="mt-6 text-sm text-black/60 max-w-xs leading-relaxed">
              Designed for people who treat attention as a finite resource.
              Less noise. Fewer decisions. Clear intent.
            </p>
          </div>

          {/* Bottom divider */}
          <div className="flex items-center gap-4 text-xs text-black/40">
            <span className="h-px w-12 bg-black/20" />
            <span>Since 2025</span>
          </div>
        </div>

        {/* RIGHT — FORM */}
        <div className="relative p-10 sm:p-16 flex flex-col justify-center bg-white">
          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-0">
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-sm">
            <h1 className="text-4xl font-medium tracking-tight">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-4 text-sm text-black/60 leading-relaxed">
                {subtitle}
              </p>
            )}

            <div className="mt-10">
              {children}
            </div>

            {actionText && actionLink && (
              <p className="mt-10 text-xs text-black/50">
                {actionText}{" "}
                <Link
                  href={actionLink}
                  className="text-black underline underline-offset-4 hover:opacity-70 transition"
                >
                  Continue
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
