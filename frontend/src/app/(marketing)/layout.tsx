import { Geist, Inter } from "next/font/google";
import { HeroUIProvider } from "@heroui/react";
import "../globals.css";

const geist = Geist({ 
  subsets: ["latin"], 
  variable: "--font-geist",
  display: "swap"
});

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  display: "swap"
});

export const metadata = {
  title: "TicketPilot — AI Customer Support that Cites Your Docs",
  description: "Resolve tickets 2× faster with Gemini-powered answers, RAG citations, and a rep console built for scale.",
  openGraph: { 
    title: "TicketPilot — AI Customer Support that Cites Your Docs", 
    description: "Resolve tickets 2× faster with Gemini-powered answers, RAG citations, and a rep console built for scale.", 
    url: "https://ticketpilot.app", 
    type: "website" 
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${inter.variable}`}>
      <body className="font-inter bg-[rgb(var(--bg))] text-[rgb(var(--text))] antialiased">
        <HeroUIProvider>
          {children}
        </HeroUIProvider>
      </body>
    </html>
  );
}