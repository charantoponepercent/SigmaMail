import "./globals.css";

export const metadata = {
  title: "SigmaMail",
  description: "Multi-account Gmail + Outlook aggregator with AI insights",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
