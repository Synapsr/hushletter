import type React from "react";
import { EnvelopeIcon } from "./envelope-icon";
import { LandingButton } from "./landing-button";
import { m } from "@/paraglide/messages.js";

const floatingEnvelopes: Array<{
  className: string;
  style: React.CSSProperties;
}> = [
  {
    className: "absolute w-8 h-8 text-gray-900 opacity-10 animate-float-1",
    style: { top: "10%", left: "5%", "--rotate": "-15deg", "--duration": "6s" } as React.CSSProperties,
  },
  {
    className: "absolute w-12 h-12 text-gray-900 opacity-8 animate-float-2",
    style: { top: "20%", right: "8%", "--rotate": "20deg", "--duration": "7s" } as React.CSSProperties,
  },
  {
    className: "absolute w-6 h-6 text-gray-900 opacity-12 animate-float-3",
    style: { top: "60%", left: "10%", "--rotate": "10deg", "--duration": "8s" } as React.CSSProperties,
  },
  {
    className: "absolute w-10 h-10 text-gray-900 opacity-10 animate-float-1",
    style: { top: "70%", right: "15%", "--rotate": "-10deg", "--duration": "9s" } as React.CSSProperties,
  },
  {
    className: "absolute w-7 h-7 text-gray-900 opacity-15 animate-float-2",
    style: { top: "40%", right: "3%", "--rotate": "15deg", "--duration": "6.5s" } as React.CSSProperties,
  },
  {
    className: "absolute w-9 h-9 text-gray-900 opacity-8 animate-float-3",
    style: { bottom: "15%", left: "8%", "--rotate": "-20deg", "--duration": "7.5s" } as React.CSSProperties,
  },
];

const mockEmails = [
  { color: "bg-violet-400", sender: "Stratechery", subject: "The AI Value Chain", time: "2m", bold: true },
  { color: "bg-blue-400", sender: "Dense Discovery", subject: "Issue #287: Design Systems", time: "1h", bold: true },
  { color: "bg-emerald-400", sender: "The Hustle", subject: "Why startups are moving...", time: "3h", bold: false },
  { color: "bg-amber-400", sender: "Morning Brew", subject: "Markets are shifting fast", time: "5h", bold: false },
  { color: "bg-rose-400", sender: "Lenny's Newsletter", subject: "How to build products...", time: "1d", bold: false },
];

const mockFolders = [
  { color: "bg-violet-400", name: "Stratechery", count: "3" },
  { color: "bg-blue-400", name: "Dense Discovery", count: "5" },
  { color: "bg-emerald-400", name: "The Hustle", count: "8" },
  { color: "bg-amber-400", name: "Morning Brew", count: "4" },
  { color: "bg-rose-400", name: "Lenny's", count: "4" },
];

export function LandingHero() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {floatingEnvelopes.map((envelope, i) => (
        <EnvelopeIcon key={i} className={envelope.className} style={envelope.style} />
      ))}

      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 animate-bounce-subtle">
              <span className="text-sm">📬 {m.landing_heroBadge()}</span>
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] text-gray-900">
              {m.landing_heroTitle()}
              <span className="wavy-underline">{m.landing_heroTitleHighlight()}</span>
              {m.landing_heroTitleEnd()}
            </h1>

            <p className="font-body text-lg text-gray-500 max-w-xl">
              {m.landing_heroSubtitle()}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <LandingButton render={<a href="#start" />} className="group">
                {m.landing_heroCtaPrimary()}
                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </LandingButton>
              <LandingButton variant="secondary" render={<a href="#demo" />}>
                {m.landing_heroCtaSecondary()}
              </LandingButton>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span> {m.landing_heroCheckFree()}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span> {m.landing_heroCheckNoSpam()}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span> {m.landing_heroCheckSetup()}
              </span>
            </div>
          </div>

          {/* Right side - Inbox Mockup */}
          <div className="relative">
            <div className="max-w-md ml-auto bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
              <div className="h-12 bg-gray-50 border-b border-gray-100 flex items-center justify-between px-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-sm font-medium text-gray-700">{m.landing_mockupInbox()}</span>
                <div className="w-12" />
              </div>

              <div className="flex">
                {/* Folder sidebar */}
                <div className="w-36 bg-gray-50/80 border-r border-gray-100 p-3 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 px-2">
                    {m.landing_mockupFolders()}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-gray-900" />
                      <span className="text-xs font-medium text-gray-900">{m.landing_mockupAll()}</span>
                      <span className="ml-auto text-[10px] text-gray-400">24</span>
                    </div>
                    {mockFolders.map((folder) => (
                      <div
                        key={folder.name}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/50 rounded-lg transition-colors"
                      >
                        <div className={`w-2 h-2 rounded-full ${folder.color}`} />
                        <span className="text-xs text-gray-600">{folder.name}</span>
                        <span className="ml-auto text-[10px] text-gray-400">{folder.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email list */}
                <div className="flex-1 divide-y divide-gray-100">
                  {mockEmails.map((email, i) => (
                    <div
                      key={email.sender}
                      className="p-3 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-in-right"
                      style={{ animationDelay: `${0.1 * (i + 1)}s`, opacity: 0 }}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full ${email.color} mt-1.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span
                              className={`text-xs truncate ${email.bold ? "font-semibold text-gray-900" : "text-gray-500"}`}
                            >
                              {email.sender}
                            </span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{email.time}</span>
                          </div>
                          <p className={`text-xs truncate ${email.bold ? "text-gray-600" : "text-gray-500"}`}>
                            {email.subject}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
