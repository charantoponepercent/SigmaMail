"use client";

import AuthLayout from "@/components/AuthLayout";
import RegisterForm from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Unify all your emails and manage smarter with SigmaMail."
      actionText="Already have an account?"
      actionLink="/login"
    >
      <RegisterForm />
    </AuthLayout>
  );
}
