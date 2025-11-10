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
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-4xl p-10 bg-white shadow-xl rounded-4xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* LEFT: Form Section */}
        <div className="p-10 flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{title}</h1>
            {subtitle && (
              <p className="text-gray-500 text-sm">{subtitle}</p>
            )}
          </div>
          {children}
          {actionText && (
            <p className="mt-6 text-sm text-gray-600 text-center">
              {actionText}{" "}
              <a
                href={actionLink}
                className="text-blue-600 font-semibold hover:underline"
              >
                Log in
              </a>
            </p>
          )}
        </div>

        {/* RIGHT: Visual Section */}
        <div className="relative border-2 border-slate-200 p-5 hidden md:flex items-center justify-center bg-gray-100">
          <Image
            src="/textures/auth-bg.jpg"
            alt="Background texture"
            fill
            className="object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-black/40" />
          <div className="relative z-10 p-10 text-white text-center max-w-md">
            <h2 className="text-2xl font-semibold mb-4 leading-tight drop-shadow">
              Join SigmaMail and stay ahead with smart inbox management.
            </h2>
            <p className="text-sm text-gray-200">
              Simplify, organize, and supercharge your email productivity today.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
