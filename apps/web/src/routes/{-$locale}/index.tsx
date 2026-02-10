import { Link, createFileRoute } from "@tanstack/react-router";
import { Button, Card, CardContent } from "@hushletter/ui";
import { m } from "@/paraglide/messages.js";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/{-$locale}/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{m.common_brandName()}</div>
        <nav className="flex gap-4 items-center">
          <LanguageSwitcher />
          <Link to="/{-$locale}/login">
            <Button variant="ghost">{m.landing_signIn()}</Button>
          </Link>
          <Link to="/{-$locale}/signup">
            <Button>{m.landing_getStarted()}</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 max-w-4xl mx-auto leading-tight">
          {m.landing_title()}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
          {m.landing_subtitle()}
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/{-$locale}/signup">
            <Button size="lg" className="text-lg px-8 py-6">
              {m.landing_getStarted()}
            </Button>
          </Link>
          <Link to="/{-$locale}/login">
            <Button variant="outline" size="lg" className="text-lg px-8 py-6">
              {m.landing_signIn()}
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {m.landing_featuresTitle()}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <FeatureCard
            icon="📧"
            title={m.landing_featureEmailTitle()}
            description={m.landing_featureEmailDesc()}
          />
          <FeatureCard
            icon="⚡"
            title={m.landing_featureRealtimeTitle()}
            description={m.landing_featureRealtimeDesc()}
          />
          <FeatureCard
            icon="🤖"
            title={m.landing_featureAiTitle()}
            description={m.landing_featureAiDesc()}
          />
          <FeatureCard
            icon="🗂️"
            title={m.landing_featureCommunityTitle()}
            description={m.landing_featureCommunityDesc()}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-3xl mx-auto bg-gray-900 dark:bg-gray-800 text-white">
          <CardContent className="p-12 text-center">
            <h3 className="text-3xl font-bold mb-4">{m.landing_ctaTitle()}</h3>
            <p className="text-gray-300 mb-8">
              {m.landing_ctaSubtitle()}
            </p>
            <Link to="/{-$locale}/signup">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                {m.landing_ctaButton()}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
          <p>{m.landing_footerCopyright({ year: new Date().getFullYear().toString() })}</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-900 dark:hover:text-white">
              {m.landing_footerPrivacy()}
            </a>
            <a href="#" className="hover:text-gray-900 dark:hover:text-white">
              {m.landing_footerTerms()}
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-300">{description}</p>
      </CardContent>
    </Card>
  );
}
