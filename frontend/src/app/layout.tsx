import "./globals.css";
import { Geist, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import MotionProvider from '@/ui/motion/MotionProvider';

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = { title: "TicketPilot", description: "Customer support with AI" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="v2-dark">
      <body className={`${geist.variable} ${inter.variable} antialiased bg-[color:var(--bg)] text-[rgb(var(--text))] font-inter`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MotionProvider>
            {children}
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
