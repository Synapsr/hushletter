import { Link, createFileRoute } from "@tanstack/react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"

export const Route = createFileRoute("/")({
  component: LandingPage,
})

function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          Newsletter Manager
        </div>
        <nav className="flex gap-4">
          <Link to="/">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link to="/">
            <Button>Get Started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 max-w-4xl mx-auto leading-tight">
          Your Newsletters, Organized and Accessible
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
          One dedicated email address. All your newsletters in one clean
          interface.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/">
            <Button size="lg" className="text-lg px-8 py-6">
              Get Started
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline" size="lg" className="text-lg px-8 py-6">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          Everything you need to manage your newsletters
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <FeatureCard
            icon="📧"
            title="Dedicated Email"
            description="Get a unique email address just for your newsletters. No more cluttered inbox."
          />
          <FeatureCard
            icon="⚡"
            title="Real-time Delivery"
            description="Newsletters arrive instantly and are automatically organized by sender."
          />
          <FeatureCard
            icon="🤖"
            title="AI Summaries"
            description="Get quick AI-generated summaries of your newsletters when you're short on time."
          />
          <FeatureCard
            icon="🗂️"
            title="Community Catalog"
            description="Discover and access newsletters from our community's shared collection."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-3xl mx-auto bg-gray-900 dark:bg-gray-800 text-white">
          <CardContent className="p-12 text-center">
            <h3 className="text-3xl font-bold mb-4">
              Ready to take control of your newsletters?
            </h3>
            <p className="text-gray-300 mb-8">
              Join thousands of readers who have simplified their newsletter
              experience.
            </p>
            <Link to="/">
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-6"
              >
                Start for Free
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} Newsletter Manager. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-900 dark:hover:text-white">
              Privacy
            </a>
            <a href="#" className="hover:text-gray-900 dark:hover:text-white">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">{description}</p>
      </CardContent>
    </Card>
  )
}
