"use client";

import AuthLayout from "@/components/AuthLayout";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome ✨"
      subtitle="Sign in to access your unified inbox."
      actionText="Don’t have an account?"
      actionLink="/register"
    >
      <LoginForm />
    </AuthLayout>
  );
}
