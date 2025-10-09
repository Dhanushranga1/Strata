import Hero from "./(marketing)/components/Hero";
import ValueProps from "./(marketing)/components/ValueProps";
import HowItWorks from "./(marketing)/components/HowItWorks";
import SocialProof from "./(marketing)/components/SocialProof";
import CTA from "./(marketing)/components/CTA";
import Footer from "./(marketing)/components/Footer";

interface PageProps {
  searchParams: Promise<{ ab?: string; wordmark?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  // A/B testing - default to variant "a", switch to "b" if ?ab=b
  const params = await searchParams;
  const variant = params.ab === "b" ? "b" : "a";
  
  // Wordmark variant - aurora, neon, or mono
  const wordmarkVariant = (params.wordmark === "aurora" || params.wordmark === "neon") 
    ? params.wordmark 
    : "mono";

  return (
    <main className="min-h-screen">
      <Hero variant={variant} wordmarkVariant={wordmarkVariant} />
      <ValueProps />
      <HowItWorks />
      <SocialProof />
      <CTA />
      <Footer />
    </main>
  );
}
