import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$locale}/terms")({
  component: TermsOfServicePage,
});

const LAST_UPDATED = "February 21, 2026";

function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <div className="mb-8">
          <Link
            to="/"
            className="text-sm text-slate-500 transition-colors hover:text-slate-900"
          >
            Back to Hushletter
          </Link>
        </div>

        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="space-y-8 text-sm leading-7 text-slate-700 md:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Acceptance Of Terms
            </h2>
            <p>
              By accessing or using Hushletter, you agree to these Terms of
              Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Your Account
            </h2>
            <p>
              You are responsible for your account credentials and activities
              under your account. You must provide accurate information and keep
              it up to date.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Permitted Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Use Hushletter for unlawful, abusive, or fraudulent activity.</li>
              <li>Interfere with the service, systems, or security.</li>
              <li>
                Attempt to reverse engineer, scrape, or misuse private data
                from the service.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Gmail Connection
            </h2>
            <p>
              If you connect Gmail, you grant Hushletter read-only access to
              your Gmail account for newsletter import features. Hushletter
              does not send, delete, or modify your emails, labels, or mailbox
              settings.
            </p>
            <p>
              You can disconnect Gmail at any time from Hushletter settings or
              by revoking access in your Google account permissions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Paid Plans And Billing
            </h2>
            <p>
              Some features may require a paid subscription. Billing is handled
              by third-party payment providers. Prices, plan limits, and
              features may change over time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Intellectual Property
            </h2>
            <p>
              Hushletter and its software, branding, and original content are
              protected by applicable intellectual property laws. These Terms do
              not transfer ownership rights to you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Termination</h2>
            <p>
              We may suspend or terminate access if these Terms are violated or
              if required for security, legal, or operational reasons.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Disclaimer And Limitation Of Liability
            </h2>
            <p>
              Hushletter is provided on an as-is and as-available basis, to the
              maximum extent permitted by law. To the maximum extent permitted
              by law, we are not liable for indirect, incidental, special, or
              consequential damages arising from use of the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Privacy
            </h2>
            <p>
              Your use of the service is also subject to our{" "}
              <Link
                to="/{-$locale}/privacy"
                className="underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Changes To These Terms
            </h2>
            <p>
              We may update these Terms from time to time. Continued use after
              changes means you accept the updated Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
            <p>
              For legal questions, contact{" "}
              <a
                href="mailto:teo.goulois.dev@gmail.com"
                className="underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900"
              >
                teo.goulois.dev@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
