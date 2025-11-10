"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <div className="flex flex-col space-y-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        {...props}
        className={`border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 text-sm ${
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-gray-200 focus:ring-blue-200"
        }`}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
