import { EnvelopeIcon } from "./envelope-icon";
import { m } from "@/paraglide/messages.js";

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl font-bold text-gray-900 mb-3">
            {m.landing_featuresTitle()}
          </h2>
          <p className="font-body text-lg text-gray-500">
            {m.landing_featuresSubtitle()}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[200px]">
          {/* Unified Inbox */}
          <div
            className="lg:col-span-2 lg:row-span-2 bg-gray-50 rounded-2xl p-6 flex flex-col animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            <EnvelopeIcon className="w-10 h-10 text-gray-900 mb-4" />
            <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
              {m.landing_featureUnifiedTitle()}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {m.landing_featureUnifiedDesc()}
            </p>
            <div className="mt-auto space-y-3">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="h-2 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-2 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="h-2 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-2 bg-gray-100 rounded w-3/5" />
              </div>
            </div>
          </div>

          {/* Smart Folders */}
          <div
            className="lg:col-span-2 bg-gray-900 text-white rounded-2xl p-6 flex flex-col animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <h3 className="font-display text-xl font-bold mb-2">
              {m.landing_featureSmartFoldersTitle()}
            </h3>
            <p className="text-sm text-gray-300 mb-6">
              {m.landing_featureSmartFoldersDesc()}
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-sm">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                Stratechery
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                Morning Brew
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                Tech Bundle ✦
              </div>
            </div>
          </div>

          {/* AI Summaries */}
          <div
            className="lg:col-span-1 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 flex flex-col animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <h3 className="font-display text-lg font-bold text-gray-900 mb-2">
              {m.landing_featureAiTitle()}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {m.landing_featureAiDesc()}
            </p>
            <div className="mt-auto space-y-2">
              <div className="h-1.5 bg-gray-300 rounded w-full" />
              <div className="h-1.5 bg-gray-300 rounded w-5/6" />
              <div className="h-1.5 bg-gray-300 rounded w-4/6" />
            </div>
          </div>

          {/* Reading Insights - Coming Soon */}
          <div
            className="relative lg:col-span-1 bg-gray-50 rounded-2xl p-6 flex flex-col animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            <span className="absolute top-3 right-3 bg-gray-200 text-gray-600 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md">
              {m.landing_comingSoon()}
            </span>
            <h3 className="font-display text-lg font-bold text-gray-900 mb-2">
              {m.landing_featureInsightsTitle()}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {m.landing_featureInsightsDesc()}
            </p>
            <div className="mt-auto flex items-end gap-1 opacity-40">
              <div className="w-full h-8 bg-gray-300 rounded" />
              <div className="w-full h-12 bg-gray-300 rounded" />
              <div className="w-full h-6 bg-gray-300 rounded" />
              <div className="w-full h-10 bg-gray-300 rounded" />
            </div>
          </div>

          {/* Community - Coming Soon */}
          <div
            className="relative lg:col-span-2 bg-gray-50 rounded-2xl p-6 flex flex-col animate-fade-in-up"
            style={{ animationDelay: "0.5s" }}
          >
            <span className="absolute top-3 right-3 bg-gray-200 text-gray-600 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md">
              {m.landing_comingSoon()}
            </span>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
              {m.landing_featureCommunityTitle()}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {m.landing_featureCommunityDesc()}
            </p>
            <div className="mt-auto flex -space-x-2 opacity-40">
              <div className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white" />
              <div className="w-10 h-10 rounded-full bg-gray-400 border-2 border-white" />
              <div className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white" />
              <div className="w-10 h-10 rounded-full bg-gray-400 border-2 border-white" />
            </div>
          </div>

          {/* Newsletter Discovery - Coming Soon */}
          <div
            className="relative lg:col-span-2 bg-gray-900 text-white rounded-2xl p-6 flex flex-col animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <span className="absolute top-3 right-3 bg-white/15 text-gray-300 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md">
              {m.landing_comingSoon()}
            </span>
            <h3 className="font-display text-xl font-bold mb-2">
              {m.landing_featureDiscoveryTitle()}
            </h3>
            <p className="text-sm text-gray-300 mb-6">
              {m.landing_featureDiscoveryDesc()}
            </p>
            <div className="mt-auto flex flex-wrap gap-3 opacity-40">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">📰</div>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">💼</div>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">🎨</div>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">🚀</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
