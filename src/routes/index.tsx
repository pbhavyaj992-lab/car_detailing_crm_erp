import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { TrustBar } from "@/components/marketing/trust-bar";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { WorkflowShowcase } from "@/components/marketing/workflow-showcase";
import { Capabilities } from "@/components/marketing/capabilities";
import { ContactSection } from "@/components/marketing/contact";
import { SecondaryFeatures } from "@/components/marketing/secondary-features";
import { AnalyticsProof } from "@/components/marketing/analytics-proof";
import { FinalCta } from "@/components/marketing/final-cta";
import { MarketingFooter } from "@/components/marketing/footer";

const SITE_URL = "https://getishan.in";
const OG_IMAGE = `${SITE_URL}/branding/logo-full.png`;
const PAGE_TITLE = "Ishan — Car Detailing CRM & Shop Management Software";
const PAGE_DESC =
  "Ishan (getishan.in) is a car detailing CRM for detailing, PPF and ceramic coating shops: manage leads, customers, vehicles, quotes, jobs, invoices, payments, staff and analytics in one place.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESC },
      {
        name: "keywords",
        content:
          "getishan, ishan, ishan crm, car detailing crm, car crm, detailing shop software, PPF studio software, ceramic coating business software, auto detailing management software",
      },
      { name: "author", content: "Ishan" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:site_name", content: "Ishan" },
      { property: "og:locale", content: "en_IN" },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESC },
      { property: "og:url", content: SITE_URL },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: "Ishan car detailing CRM dashboard" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify([
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Ishan — Car Detailing CRM",
            alternateName: ["Ishan", "GetIshan"],
            applicationCategory: "BusinessApplication",
            applicationSubCategory: "CRM",
            operatingSystem: "Web",
            url: SITE_URL,
            image: OG_IMAGE,
            description: PAGE_DESC,
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Ishan",
            url: SITE_URL,
            logo: `${SITE_URL}/branding/logo.png`,
            contactPoint: [
              {
                "@type": "ContactPoint",
                telephone: "+91-95864-61871",
                contactType: "sales",
                areaServed: "IN",
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Ishan",
            url: SITE_URL,
          },
        ]),
      },
    ],
  }),

  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      <MarketingNav />
      <main>
        <Hero />
        <TrustBar />
        <ProblemSolution />
        <Capabilities />
        <WorkflowShowcase />
        <SecondaryFeatures />
        <AnalyticsProof />
        <FinalCta />
        <ContactSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
