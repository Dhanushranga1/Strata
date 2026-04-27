import Hero from "./(marketing)/components/Hero";
import StatsBar from "./(marketing)/components/StatsBar";
import TargetAudience from "./(marketing)/components/TargetAudience";
import ValueProps from "./(marketing)/components/ValueProps";
import HowItWorks from "./(marketing)/components/HowItWorks";
import CASPERSpotlight from "./(marketing)/components/CASPERSpotlight";
import CapabilitiesDemo from "./(marketing)/components/CapabilitiesDemo";
import SocialProof from "./(marketing)/components/SocialProof";
import CTA from "./(marketing)/components/CTA";
import Footer from "./(marketing)/components/Footer";

interface PageProps {
  searchParams: Promise<{ ab?: string; wordmark?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const variant = params.ab === "b" ? "b" : "a";
  const wordmarkVariant = (params.wordmark === "aurora" || params.wordmark === "neon")
    ? params.wordmark
    : "mono";

  return (
    <main className="min-h-screen bg-zinc-950">
      <Hero variant={variant} wordmarkVariant={wordmarkVariant} />
      <StatsBar />
      <TargetAudience />
      <ValueProps />
      <HowItWorks />
      <CASPERSpotlight />
      <CapabilitiesDemo />
      <SocialProof />
      <CTA />
      <Footer />
    </main>
  );
}
