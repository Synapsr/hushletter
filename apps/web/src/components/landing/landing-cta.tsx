import { EnvelopeIcon } from "./envelope-icon";
import { LandingButton } from "./landing-button";
import { m } from "@/paraglide/messages.js";

export function LandingCta() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative bg-gray-900 rounded-3xl p-10 md:p-14 text-white overflow-hidden">
          <EnvelopeIcon
            className="absolute w-16 h-16 text-white opacity-5"
            style={{ top: "10%", left: "5%" }}
          />
          <EnvelopeIcon
            className="absolute w-12 h-12 text-white opacity-5"
            style={{ top: "60%", right: "8%" }}
          />
          <EnvelopeIcon
            className="absolute w-20 h-20 text-white opacity-5"
            style={{ bottom: "10%", right: "15%" }}
          />

          <div className="relative z-10 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              {m.landing_ctaTitle()}
            </h2>
            <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
              {m.landing_ctaSubtitle()}
            </p>
            <LandingButton variant="inverted" size="lg" render={<a href="#start" />} className="group">
              {m.landing_ctaButton()}
              <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </LandingButton>
            <p className="text-sm text-gray-400 mt-4">
              {m.landing_ctaNote()}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
