import { createFileRoute } from "@tanstack/react-router";
import { LandingStyles } from "@/components/landing/landing-styles";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingSocialProof } from "@/components/landing/landing-social-proof";
import { LandingStats } from "@/components/landing/landing-stats";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export const Route = createFileRoute("/{-$locale}/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <LandingStyles />
      <div className="min-h-screen bg-sheer font-body">
        <LandingHeader />
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingSocialProof />
        <LandingStats />
        <LandingPricing />
        <LandingCta />
        <LandingFooter />
      </div>
    </>
  );
}
