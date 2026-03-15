import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ModalProvider } from "@/components/providers/ModalProvider";
import AuthProvider from "@/components/providers/AuthProvider";
import GlobalModalRenderer from "@/components/common/GlobalModalRenderer";

import { DM_Sans, DM_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Aexon",
  description: "All in one Agency Solution",
};

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const fontMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: "400",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "relative min-h-screen font-sans antialiased",
          fontSans.variable,
          fontMono.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ModalProvider>
              {children}
              <GlobalModalRenderer />
            </ModalProvider>
          </AuthProvider>
        </ThemeProvider>

        <Toaster richColors />
      </body>
    </html>
  );
}