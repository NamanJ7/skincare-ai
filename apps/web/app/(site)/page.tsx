import { Hero } from "@/components/sections/Hero";
import { FeatureCards } from "@/components/sections/FeatureCards";
import { WhyPore } from "@/components/sections/WhyPore";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WaitlistCTA } from "@/components/sections/WaitlistCTA";
import { PricingTiers } from "@/components/sections/PricingTiers";
import { ProductUpdates } from "@/components/sections/ProductUpdates";
import { BlogPreview } from "@/components/sections/BlogPreview";
import { AppDownload } from "@/components/sections/AppDownload";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureCards />
      <WhyPore />
      <HowItWorks />
      <WaitlistCTA />
      <PricingTiers />
      <ProductUpdates />
      <BlogPreview />
      <AppDownload />
    </>
  );
}
