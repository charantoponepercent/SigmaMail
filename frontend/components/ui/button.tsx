"use client";

import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ variant = "primary", ...props }: ButtonProps) {
  const base =
    "w-full py-2 rounded-lg font-medium text-sm transition-colors duration-200";
  const variants = {
    primary: "bg-blue-500 text-white cursor-pointer hover:bg-blue-600",
    secondary: "bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200",
    danger: "bg-red-500 text-white cursor-pointer hover:bg-red-600",
  };
  return <button {...props} className={`${base} ${variants[variant]}`} />;
}
