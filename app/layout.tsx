import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Budgetly - Modern Personal Finance & Budget Tracker",
  description: "Budgetly adalah aplikasi pengatur keuangan pribadi yang modern, aman, dan mudah digunakan. Kelola anggaran, pantau pengeluaran, dan tingkatkan kesehatan finansialmu.",
  keywords: ["budgeting", "keuangan pribadi", "pengatur keuangan", "catat keuangan", "budgetly", "money tracker"],
  authors: [{ name: "Budgetly Team" }],
  openGraph: {
    title: "Budgetly - Kelola Keuanganmu dengan Cerdas",
    description: "Pantau pengeluaran dan tabunganmu secara real-time dengan Budgetly. Aplikasi budget tracker modern untuk kebutuhan sehari-hari.",
    url: "https://budgetly-app.vercel.app", // User will replace with actual domain if different
    siteName: "Budgetly",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 600,
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Budgetly - Modern Finance Tracker",
    description: "Catat keuanganmu dengan aman dan mudah bersama Budgetly.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  verification: {
    google: "we9mD5OQZFEOt9ESLYdSrtXXh9LF-PkrZi23rlnJRx0",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${outfit.className} bg-gray-50 text-gray-900 antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
