import Link from "next/link";
import { Manrope, Space_Grotesk } from "next/font/google";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "SigmaMail Terms of Service",
  description: "Terms of service for SigmaMail.",
};

export default function TermsPage() {
  return (
    <main className={`${bodyFont.className} min-h-screen bg-[#f4f6fb] px-6 py-14 text-slate-900`}>
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_14px_36px_rgba(15,23,42,0.08)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SigmaMail</p>
        <h1 className={`${displayFont.className} mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl`}>
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-slate-500">Effective date: February 10, 2026</p>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Service description</h2>
          <p>
            SigmaMail provides inbox workflow tools for connected Gmail accounts, including synchronization,
            categorization, search, and action insights.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Acceptable use</h2>
          <p>
            You agree to use SigmaMail in compliance with applicable laws and platform rules. You must not
            misuse the service, attempt unauthorized access, or disrupt system operations.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Account responsibility</h2>
          <p>
            You are responsible for your account credentials and connected mailbox permissions. You may
            disconnect integrations at any time through application settings.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Availability and changes</h2>
          <p>
            SigmaMail may update, improve, or modify features over time. Service availability may vary based
            on third-party platform dependencies and maintenance windows.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Limitation of liability</h2>
          <p>
            SigmaMail is provided on an as-available basis. To the maximum extent permitted by law, SigmaMail
            is not liable for indirect, incidental, or consequential damages arising from service use.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Contact</h2>
          <p>
            For legal or terms questions, contact the SigmaMail team using the developer contact email listed
            in your Google OAuth consent configuration.
          </p>
        </section>

        <div className="mt-10 border-t border-slate-200 pt-6 text-sm">
          <Link href="/" className="underline underline-offset-4 text-slate-700 hover:text-slate-900">
            Back to SigmaMail home
          </Link>
        </div>
      </div>
    </main>
  );
}
