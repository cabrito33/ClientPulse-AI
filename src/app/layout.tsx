import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://clientpulse.example";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ClientPulse AI — Relatórios semanais em minutos, não em horas",
    template: "%s · ClientPulse AI",
  },
  description:
    "O ClientPulse AI liga-se ao GitHub Projects, escreve o relatório semanal em linguagem de negócio e entrega-o ao cliente por e-mail e num portal sem login. Revisto por ti antes de sair.",
  keywords: [
    "relatórios semanais",
    "agências digitais",
    "freelancers",
    "GitHub Projects",
    "portal do cliente",
    "ClientPulse",
  ],
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: "/",
    siteName: "ClientPulse AI",
    title: "ClientPulse AI — Relatórios semanais em minutos, não em horas",
    description:
      "Liga o GitHub Projects, revê o rascunho escrito por IA e entrega um relatório claro ao cliente. Portal sem login incluído.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClientPulse AI — Relatórios semanais em minutos, não em horas",
    description:
      "Relatórios de progresso semanais gerados a partir do GitHub Projects e entregues num portal sem login.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
