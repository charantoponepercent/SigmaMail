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
  title: "SigmaMail Privacy Policy",
  description: "Privacy policy for SigmaMail.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className={`${bodyFont.className} min-h-screen bg-[#f4f6fb] px-6 py-14 text-slate-900`}>
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_14px_36px_rgba(15,23,42,0.08)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SigmaMail</p>
        <h1 className={`${displayFont.className} mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl`}>
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500">Effective date: February 10, 2026</p>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>What SigmaMail does</h2>
          <p>
            SigmaMail connects to your Gmail account using Google OAuth and helps you organize inbox
            data into actionable categories such as reply-needed, deadlines, and follow-ups.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Data we process</h2>
          <p>
            SigmaMail processes email metadata and message content required to provide inbox categorization,
            thread summaries, and search. OAuth tokens are used only to access connected mailbox data.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>How we use data</h2>
          <p>
            Data is used to provide core product functionality: syncing email, classification, retrieval,
            and user-requested analytics. SigmaMail does not sell personal email data.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Data sharing</h2>
          <p>
            SigmaMail may use infrastructure subprocessors (for hosting, database, queueing, and storage)
            strictly to operate the service. Data is not shared for advertising purposes.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Security and retention</h2>
          <p>
            SigmaMail uses industry-standard transport security and access controls. Data retention depends
            on account usage and operational requirements. You can request account disconnection and removal.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-slate-700">
          <h2 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>Contact</h2>
          <p>
            For privacy questions, contact the SigmaMail team using the developer contact email configured
            in Google Cloud OAuth consent settings.
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
