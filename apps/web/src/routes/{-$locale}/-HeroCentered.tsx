import React from "react";

/**
 * Centered hero with 3D perspective app mockup below.
 * Extracted from design /7 — drop this in as a replacement for
 * the default split-layout hero in the landing page.
 *
 * Usage:
 *   import { HeroCentered, heroCenteredStyles } from "./-HeroCentered";
 *   // Add heroCenteredStyles to your <style> block
 *   // Replace the HERO <section> with <HeroCentered />
 */

function EnvelopeIcon({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m2 7 8.97 5.7a1.94 1.94 0 0 0 2.06 0L22 7" />
    </svg>
  );
}

/** Extra CSS keyframes needed by this hero (merge into your <style> block) */
export const heroCenteredStyles = `
  @keyframes float-slow {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }

  @keyframes float-medium {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-15px); }
  }

  @keyframes float-fast {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes float-envelope-hero {
    0%, 100% {
      transform: translateY(0px) rotate(var(--rotate, 0deg));
    }
    50% {
      transform: translateY(-30px) rotate(var(--rotate, 0deg));
    }
  }

  .animate-float-slow {
    animation: float-slow 6s ease-in-out infinite;
  }

  .animate-float-medium {
    animation: float-medium 4s ease-in-out infinite;
  }

  .animate-float-fast {
    animation: float-fast 3s ease-in-out infinite;
  }

  .animate-float-envelope-hero-1 {
    animation: float-envelope-hero var(--duration, 8s) ease-in-out infinite;
  }

  .animate-float-envelope-hero-2 {
    animation: float-envelope-hero var(--duration, 10s) ease-in-out infinite;
    animation-delay: -2s;
  }

  .animate-float-envelope-hero-3 {
    animation: float-envelope-hero var(--duration, 12s) ease-in-out infinite;
    animation-delay: -4s;
  }
`;

export function HeroCentered() {
  return (
    <section className="pt-24 pb-16 relative overflow-hidden">
      {/* Floating envelope background */}
      <div className="absolute inset-0 pointer-events-none">
        <EnvelopeIcon
          className="absolute top-20 left-10 w-16 h-16 text-gray-900 opacity-[0.08] animate-float-envelope-hero-1"
          style={
            { "--rotate": "15deg", "--duration": "8s" } as React.CSSProperties
          }
        />
        <EnvelopeIcon
          className="absolute top-40 right-20 w-24 h-24 text-gray-900 opacity-[0.10] animate-float-envelope-hero-2"
          style={
            { "--rotate": "-12deg", "--duration": "10s" } as React.CSSProperties
          }
        />
        <EnvelopeIcon
          className="absolute top-60 left-1/4 w-12 h-12 text-gray-900 opacity-[0.12] animate-float-envelope-hero-3"
          style={
            { "--rotate": "8deg", "--duration": "12s" } as React.CSSProperties
          }
        />
        <EnvelopeIcon
          className="absolute top-32 right-1/3 w-20 h-20 text-gray-900 opacity-[0.09] animate-float-envelope-hero-1"
          style={
            { "--rotate": "-20deg", "--duration": "9s" } as React.CSSProperties
          }
        />
        <EnvelopeIcon
          className="absolute top-96 right-10 w-14 h-14 text-gray-900 opacity-[0.11] animate-float-envelope-hero-2"
          style={
            { "--rotate": "10deg", "--duration": "11s" } as React.CSSProperties
          }
        />
        <EnvelopeIcon
          className="absolute top-80 left-1/3 w-18 h-18 text-gray-900 opacity-[0.15] animate-float-envelope-hero-3"
          style={
            {
              "--rotate": "-15deg",
              "--duration": "10s",
            } as React.CSSProperties
          }
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 mb-6 animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-700">Now with AI summaries</span>
        </div>

        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          All your newsletters.{" "}
          <span className="wavy-underline">One happy inbox.</span>
        </h1>

        <p
          className="font-body text-lg text-gray-500 mb-8 max-w-2xl mx-auto animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          Get a dedicated email address, subscribe to your favorite newsletters,
          and read them all in one clean, focused space. Every sender gets its
          own folder.
        </p>

        <div
          className="flex items-center justify-center gap-4 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          <a
            href="#start"
            className="group px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
          >
            Get started free
            <span className="inline-block transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
          <a
            href="#demo"
            className="px-6 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Watch demo
          </a>
        </div>
      </div>

      {/* App Mockup with 3D perspective */}
      <div
        className="mt-16 max-w-5xl mx-auto px-4 relative"
        style={{ perspective: "1200px" }}
      >
        <div className="relative group">
          <div
            className="bg-white rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] border border-gray-200 overflow-hidden transition-transform duration-700"
            style={{
              transform: "rotateX(8deg)",
              transformStyle: "preserve-3d",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "rotateX(2deg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "rotateX(8deg)";
            }}
          >
            {/* Top bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <div className="w-3 h-3 rounded-full bg-gray-300" />
              </div>
              <div className="ml-4 px-3 py-1 bg-gray-100 rounded-md text-sm font-medium">
                Inbox
              </div>
            </div>

            {/* Main content */}
            <div className="flex h-[400px]">
              {/* Sidebar */}
              <div className="w-56 border-r border-gray-200 p-4 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
                    ME
                  </div>
                  <span className="text-sm font-semibold">My Inbox</span>
                </div>

                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Folders
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>All</span>
                    <span className="ml-auto text-xs">24</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                    <span>Stratechery</span>
                    <span className="ml-auto text-xs text-gray-500">3</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>Pragmatic Eng.</span>
                    <span className="ml-auto text-xs text-gray-500">5</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Dense Discovery</span>
                    <span className="ml-auto text-xs text-gray-500">4</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Morning Brew</span>
                    <span className="ml-auto text-xs text-gray-500">6</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>Lenny's</span>
                    <span className="ml-auto text-xs text-gray-500">3</span>
                  </div>
                </div>
              </div>

              {/* Email list */}
              <div className="flex-1 overflow-hidden relative">
                <div className="space-y-px">
                  {[
                    {
                      name: "Stratechery",
                      subject: "The End of the Beginning",
                      time: "2h ago",
                    },
                    {
                      name: "Pragmatic Engineer",
                      subject: "Tech Layoffs in 2025",
                      time: "5h ago",
                    },
                    {
                      name: "Dense Discovery",
                      subject: "Issue #342",
                      time: "1d ago",
                    },
                    {
                      name: "Morning Brew",
                      subject: "Your daily dose of business",
                      time: "1d ago",
                    },
                    {
                      name: "Lenny's Newsletter",
                      subject: "How to run better meetings",
                      time: "2d ago",
                    },
                    {
                      name: "TLDR",
                      subject: "Tech news roundup",
                      time: "3d ago",
                    },
                  ].map((email, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">
                          {email.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {email.time}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        {email.subject}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Floating feature badges */}
          <div className="absolute -top-6 -left-6 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-200 text-sm font-medium animate-float-slow">
            AI Summaries ✨
          </div>
          <div className="absolute top-1/2 -right-8 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-200 text-sm font-medium animate-float-medium">
            Smart Folders
          </div>
          <div className="absolute -bottom-6 left-1/4 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-200 text-sm font-medium animate-float-fast">
            500+ sources
          </div>
        </div>
      </div>
    </section>
  );
}
