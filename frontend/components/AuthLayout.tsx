"use client";

import Image from "next/image";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actionText?: string;
  actionLink?: string;
  imageText?: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
  actionText,
  actionLink,
  imageText,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f7f7f8] via-white to-[#f2f2f4] px-6">
      {/* OUTER SHELL */}
      <div className="relative w-full max-w-5xl rounded-3xl bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* LEFT — FORM */}
        <div className="relative z-10 px-10 py-14 flex flex-col justify-center">
          <div className="mb-10">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-sm text-gray-500 max-w-sm">
                {subtitle}
              </p>
            )}
          </div>

          {children}

          {actionText && (
            <p className="mt-10 text-sm text-gray-600 text-center">
              {actionText}{" "}
              <a
                href={actionLink}
                className="font-medium text-gray-900 hover:underline underline-offset-4"
              >
                Log in
              </a>
            </p>
          )}
        </div>

        {/* RIGHT — VISUAL */}
        <div className="relative hidden md:flex items-center justify-center">
          {/* Background image */}
          <Image
            src="/textures/auth-bg.jpg"
            alt="SigmaMail background"
            fill
            className="object-cover"
            priority
          />

          {/* Overlay layers */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/40 to-black/10" />
          <div className="absolute inset-0 backdrop-blur-[2px]" />

          {/* Content */}
          <div className="relative z-10 px-12 py-14 text-white max-w-md">
            <div className="mb-6">
              <span className="inline-block text-xs tracking-wide uppercase text-white/70">
                SigmaMail
              </span>
            </div>

            <h2 className="text-3xl font-semibold leading-tight">
              {imageText ||
                "A calmer, smarter inbox — built for people who live in email."}
            </h2>

            <p className="mt-5 text-sm text-white/80 leading-relaxed">
              Unified Gmail accounts, decision-first views, real-time updates,
              and zero inbox noise — engineered for focus, not distraction.
            </p>

            {/* Decorative divider */}
            <div className="mt-10 h-px w-20 bg-white/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
