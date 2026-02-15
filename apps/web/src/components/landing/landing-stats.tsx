import { useInView, useCounter } from "./use-in-view";
import { m } from "@/paraglide/messages.js";

export function LandingStats() {
  const [ref, isInView] = useInView();
  const readers = useCounter(50, isInView, 2000);
  const newsletters = useCounter(2, isInView, 2000);
  const sources = useCounter(500, isInView, 2000);

  return (
    <section ref={ref} className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              {readers}K+
            </div>
            <div className="text-sm text-gray-500">{m.landing_statsReaders()}</div>
          </div>
          <div>
            <div className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              {newsletters}M+
            </div>
            <div className="text-sm text-gray-500">{m.landing_statsNewsletters()}</div>
          </div>
          <div>
            <div className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              {sources}+
            </div>
            <div className="text-sm text-gray-500">{m.landing_statsSources()}</div>
          </div>
          <div>
            <div className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              4.9★
            </div>
            <div className="text-sm text-gray-500">{m.landing_statsRating()}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
