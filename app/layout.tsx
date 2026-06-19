import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { JarvisProvider } from "@/context/JarvisContext";

export const metadata: Metadata = {
  title: "Alpha — Study Smarter with AI",
  description:
    "AI-powered study assistant with notes, quizzes, flashcards, and personalized explanations powered by Google Gemini.",
  keywords: ["AI study", "flashcards", "quiz generator", "notes", "Gemini AI"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <JarvisProvider>
              {children}
              <Toaster richColors position="top-right" />
            </JarvisProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
