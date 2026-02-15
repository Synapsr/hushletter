import { m } from "@/paraglide/messages.js";

export function LandingHowItWorks() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="font-display text-3xl font-bold text-center text-gray-900 mb-12">
          {m.landing_stepsTitle()}
        </h2>

        <div className="">
          {/* Step 1 */}
          <div className="flex items-stretch gap-6">
            <div className="flex flex-col items-center shrink-0">
              <div className="size-10 shrink-0 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div className="w-0.5 flex-1 border-l-2 border-dashed mt-2" />
            </div>
            <div className="pt-2 pb-6">
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                {m.landing_step1Title()}
              </h3>
              <p className="text-gray-500 mb-3">{m.landing_step1Desc()}</p>
              <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg text-sm font-mono text-gray-900">
                you@hushletter.com
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-stretch gap-6">
            <div className="flex flex-col items-center shrink-0">
              <div className="size-10 shrink-0 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div className="w-0.5 flex-1 border-l-2 border-dashed" />
            </div>
            <div className="pt-2 pb-6">
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                {m.landing_step2Title()}
              </h3>
              <p className="text-gray-500 mb-3">{m.landing_step2Desc()}</p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm text-gray-700">
                  Substack
                </span>
                <span className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm text-gray-700">
                  Mailchimp
                </span>
                <span className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm text-gray-700">
                  Beehiiv
                </span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
            </div>
            <div className="pt-2">
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                {m.landing_step3Title()}
              </h3>
              <p className="text-gray-500 mb-3">{m.landing_step3Desc()}</p>
              <div className="space-y-2">
                <div className="h-2 bg-gray-100 rounded w-full" />
                <div className="h-2 bg-gray-100 rounded w-5/6" />
                <div className="h-2 bg-gray-100 rounded w-4/6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
