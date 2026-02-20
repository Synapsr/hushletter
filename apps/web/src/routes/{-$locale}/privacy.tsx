import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$locale}/privacy")({
  component: PrivacyPolicyPage,
});

const LAST_UPDATED = "February 20, 2026";

function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="space-y-8 text-sm leading-7 text-slate-700 md:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Overview</h2>
            <p>
              Hushletter helps you organize and read newsletters. This policy
              explains what information we collect, how we use it, and the
              choices you have.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Information We Collect
            </h2>
            <p>We may collect:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Account information, such as your email address and profile
                name.
              </li>
              <li>
                Newsletter content and metadata that you import, forward, or
                upload to Hushletter.
              </li>
              <li>
                Gmail data you explicitly authorize through Google OAuth with
                read-only scope for newsletter import.
              </li>
              <li>
                Usage and technical data, such as logs, diagnostics, and basic
                device/browser details.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              How We Use Information
            </h2>
            <p>We use information to:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Provide, secure, and maintain the service.</li>
              <li>Import, organize, and display your newsletters.</li>
              <li>Offer product features, including search and summaries.</li>
              <li>Process billing and respond to support requests.</li>
              <li>Detect abuse, fraud, and technical issues.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Google User Data And Gmail Access
            </h2>
            <p>
              If you connect Gmail, Hushletter requests read-only Gmail access
              to scan and import newsletters. We do not use this access to send
              email or modify your mailbox.
            </p>
            <p>
              Hushletter&apos;s use and transfer of information received from
              Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Sharing And Processors
            </h2>
            <p>
              We do not sell personal data. We may share information only with
              trusted service providers that help us operate Hushletter (for
              example infrastructure, authentication, payments, and email
              delivery), and only as needed to provide the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Data Retention And Deletion
            </h2>
            <p>
              We keep data as long as needed to provide the service or comply
              with legal obligations. You can disconnect Gmail at any time and
              request account deletion by contacting us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Security</h2>
            <p>
              We use reasonable technical and organizational safeguards to
              protect data. No method of storage or transmission is completely
              secure, so we cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Changes To This Policy
            </h2>
            <p>
              We may update this policy from time to time. We will post updates
              on this page and revise the last updated date.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
            <p>
              For privacy questions or requests, contact{" "}
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
