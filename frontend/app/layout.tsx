import "./globals.css";

export const metadata = {
  title: "SigmaMail",
  description: "Multi-account Gmail + Outlook aggregator with AI insights",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
