import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";
import { Toaster } from "@/components/ui/sonner";
import UserGradeChecker from "@/components/UserGradeChecker";
import { UserProvider } from "@/contexts/UserContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sulo Training - Hệ Thống Dạy Học",
  description: "Hệ thống quản lý giáo dục từ lớp 1 đến lớp 12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <UserProvider>
          {children}
          <ChatWidget />
          <UserGradeChecker />
          <Toaster position="top-right" richColors />
        </UserProvider>
      </body>
    </html>
  );
}
