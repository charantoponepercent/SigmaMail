"use client";

import { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-gray-800">
      <div className="w-full max-w-md border border-gray-100 shadow-lg rounded-2xl p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-blue-600">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
