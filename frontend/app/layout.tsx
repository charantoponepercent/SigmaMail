import "./globals.css";

function extractGoogleVerificationToken(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return undefined;

  if (!raw.includes("<meta")) {
    return raw;
  }

  const contentMatch = raw.match(/content\s*=\s*["']([^"']+)["']/i);
  if (contentMatch?.[1]) {
    return contentMatch[1].trim();
  }

  return undefined;
}

export const metadata = {
  title: "SigmaMail",
  description: "Multi-account Gmail + Outlook aggregator with AI insights",
  verification: {
    google: extractGoogleVerificationToken(
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
