import Hero from "./components/Hero";
import ValueProps from "./components/ValueProps";
import HowItWorks from "./components/HowItWorks";
import SocialProof from "./components/SocialProof";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

interface PageProps {
  searchParams: { ab?: string };
}

export default function MarketingPage({ searchParams }: PageProps) {
  // A/B testing - default to variant "a", switch to "b" if ?ab=b
  const variant = searchParams.ab === "b" ? "b" : "a";

  return (
    <main className="min-h-screen">
      <Hero variant={variant} />
      <ValueProps />
      <HowItWorks />
      <SocialProof />
      <CTA />
      <Footer />
    </main>
  );
}