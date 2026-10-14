import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autonomous Satellite Constellation Mission Control (MAS + 6-DOF MPC)",
  description: "Autonomous Satellite Constellation Coordination using Multi-Agent Systems, GAT+LSTM+RF AI, and 6-DOF Model Predictive Control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-space-950 text-slate-200 antialiased selection:bg-cyan-500/30 selection:text-cyan-200" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
