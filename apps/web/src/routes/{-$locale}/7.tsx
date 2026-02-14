import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/{-$locale}/7")({
  component: Design7,
});

// ============================================================================
// COMPONENTS
// ============================================================================

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

// ============================================================================
// HOOKS
// ============================================================================

function useInView(
  options: IntersectionObserverInit = { threshold: 0.1 }
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return [ref, isInView];
}

function useCounter(end: number, duration: number, isInView: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    const startValue = 0;

    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const currentCount = Math.floor(startValue + (end - startValue) * easedProgress);

      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration, isInView]);

  return count;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function Design7() {
  const [statsRef, statsInView] = useInView({ threshold: 0.3 });
  const usersCount = useCounter(50, 2000, statsInView);
  const emailsCount = useCounter(2, 2000, statsInView);
  const sourcesCount = useCounter(500, 2000, statsInView);
  const ratingCount = useCounter(49, 2000, statsInView);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-body">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Nunito:wght@400;500;600;700&display=swap');

        .font-display {
          font-family: 'Bricolage Grotesque', sans-serif;
        }

        .font-body {
          font-family: 'Nunito', sans-serif;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

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

        @keyframes float-envelope {
          0%, 100% {
            transform: translateY(0px) rotate(var(--rotate, 0deg));
          }
          50% {
            transform: translateY(-30px) rotate(var(--rotate, 0deg));
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes wave-dash {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: 20;
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
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

        .animate-float-envelope-1 {
          animation: float-envelope var(--duration, 8s) ease-in-out infinite;
        }

        .animate-float-envelope-2 {
          animation: float-envelope var(--duration, 10s) ease-in-out infinite;
          animation-delay: -2s;
        }

        .animate-float-envelope-3 {
          animation: float-envelope var(--duration, 12s) ease-in-out infinite;
          animation-delay: -4s;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }

        .animate-wave-dash {
          animation: wave-dash 1s linear infinite;
        }

        .wavy-underline {
          position: relative;
          display: inline-block;
        }

        .wavy-underline::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -4px;
          width: 100%;
          height: 8px;
          background-image: url("data:image/svg+xml,%3Csvg width='100' height='8' viewBox='0 0 100 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 4C10 0 10 8 20 4S30 0 40 4 50 8 60 4 70 0 80 4 90 8 100 4' stroke='%23fbbf24' fill='none' stroke-width='2'/%3E%3C/svg%3E");
          background-repeat: repeat-x;
          background-size: 100px 8px;
        }
      `}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <EnvelopeIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-body font-semibold text-lg">Hushletter</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#integrations" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Integrations
            </a>
            <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Pricing
            </a>
            <a href="#blog" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Blog
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm text-gray-700 hover:text-gray-900 transition-colors">
              Log in
            </a>
            <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
              Start free →
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="pt-24 pb-16 relative overflow-hidden">
        {/* Floating envelope background */}
        <div className="absolute inset-0 pointer-events-none">
          <EnvelopeIcon
            className="absolute top-20 left-10 w-16 h-16 text-gray-900 opacity-[0.08] animate-float-envelope-1"
            style={{ "--rotate": "15deg", "--duration": "8s" } as React.CSSProperties}
          />
          <EnvelopeIcon
            className="absolute top-40 right-20 w-24 h-24 text-gray-900 opacity-[0.10] animate-float-envelope-2"
            style={{ "--rotate": "-12deg", "--duration": "10s" } as React.CSSProperties}
          />
          <EnvelopeIcon
            className="absolute top-60 left-1/4 w-12 h-12 text-gray-900 opacity-[0.12] animate-float-envelope-3"
            style={{ "--rotate": "8deg", "--duration": "12s" } as React.CSSProperties}
          />
          <EnvelopeIcon
            className="absolute top-32 right-1/3 w-20 h-20 text-gray-900 opacity-[0.09] animate-float-envelope-1"
            style={{ "--rotate": "-20deg", "--duration": "9s" } as React.CSSProperties}
          />
          <EnvelopeIcon
            className="absolute top-96 right-10 w-14 h-14 text-gray-900 opacity-[0.11] animate-float-envelope-2"
            style={{ "--rotate": "10deg", "--duration": "11s" } as React.CSSProperties}
          />
          <EnvelopeIcon
            className="absolute top-80 left-1/3 w-18 h-18 text-gray-900 opacity-[0.15] animate-float-envelope-3"
            style={{ "--rotate": "-15deg", "--duration": "10s" } as React.CSSProperties}
          />
        </div>

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 mb-6 animate-fadeInUp">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-gray-700">Now with AI summaries</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
            All your newsletters.{" "}
            <span className="wavy-underline">One happy inbox.</span>
          </h1>

          <p className="font-body text-lg text-gray-500 mb-8 max-w-2xl mx-auto animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
            Get a dedicated email address, subscribe to your favorite newsletters, and read them all in one clean, focused space. Every sender gets its own folder.
          </p>

          <div className="flex items-center justify-center gap-4 animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
            <button className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors">
              Get started free →
            </button>
            <button className="px-6 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              Watch demo
            </button>
          </div>
        </div>

        {/* App Mockup */}
        <div className="mt-16 max-w-5xl mx-auto px-4 relative" style={{ perspective: "1200px" }}>
          <div className="relative group">
            <div
              className="bg-white rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] border border-gray-200 overflow-hidden transition-transform duration-700"
              style={{ transform: "rotateX(8deg)", transformStyle: "preserve-3d" }}
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
                      { name: "Stratechery", subject: "The End of the Beginning", time: "2h ago" },
                      { name: "Pragmatic Engineer", subject: "Tech Layoffs in 2025", time: "5h ago" },
                      { name: "Dense Discovery", subject: "Issue #342", time: "1d ago" },
                      { name: "Morning Brew", subject: "Your daily dose of business", time: "1d ago" },
                      { name: "Lenny's Newsletter", subject: "How to run better meetings", time: "2d ago" },
                      { name: "TLDR", subject: "Tech news roundup", time: "3d ago" },
                    ].map((email, i) => (
                      <div
                        key={i}
                        className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">{email.name}</span>
                          <span className="text-xs text-gray-500">{email.time}</span>
                        </div>
                        <div className="text-sm text-gray-700">{email.subject}</div>
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

      {/* LOGOS/TRUST */}
      <section className="py-16 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center text-sm text-gray-500 mb-8">Loved by readers of</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {[
              "Stratechery",
              "Morning Brew",
              "The Hustle",
              "Lenny's Newsletter",
              "Pragmatic Engineer",
              "Dense Discovery",
            ].map((name, i) => (
              <div key={i} className="text-2xl font-bold text-gray-300">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENTO GRID FEATURES */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              A complete newsletter reading experience designed to help you stay informed without the overwhelm.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[200px] gap-4">
            {/* Unified Inbox */}
            <div className="lg:col-span-2 lg:row-span-2 bg-gray-50 rounded-2xl p-6 flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mb-4">
                <EnvelopeIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">Unified Inbox</h3>
              <p className="text-gray-600 text-sm mb-6">
                All your newsletters in one place. No more cluttered Gmail inbox.
              </p>
              <div className="mt-auto space-y-2">
                <div className="h-12 bg-white rounded-lg border border-gray-200" />
                <div className="h-12 bg-white rounded-lg border border-gray-200" />
                <div className="h-12 bg-white rounded-lg border border-gray-200" />
              </div>
            </div>

            {/* Smart Folders */}
            <div className="lg:col-span-2 bg-gray-900 text-white rounded-2xl p-6 flex flex-col">
              <h3 className="font-display text-xl font-bold mb-2">Smart Folders</h3>
              <p className="text-gray-300 text-sm mb-4">
                Every sender gets its own folder. Automatic organization.
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm">
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  Stratechery
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  Pragmatic Eng.
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  Dense Discovery
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  Morning Brew
                </div>
              </div>
            </div>

            {/* AI Summaries */}
            <div className="lg:col-span-1 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 flex flex-col">
              <h3 className="font-display text-lg font-bold text-gray-900 mb-2">AI Summaries</h3>
              <p className="text-gray-500 text-sm mb-4">
                Get the gist in seconds.
              </p>
              <div className="mt-auto space-y-2">
                <div className="h-2 bg-gray-300 rounded-full w-full" />
                <div className="h-2 bg-gray-300 rounded-full w-4/5" />
                <div className="h-2 bg-gray-300 rounded-full w-3/5" />
              </div>
            </div>

            {/* Reading Insights */}
            <div className="lg:col-span-1 bg-gray-50 rounded-2xl p-6 flex flex-col relative">
              <div className="absolute top-4 right-4 px-2 py-1 bg-gray-200 text-gray-600 text-[10px] uppercase tracking-wider font-bold rounded-md">
                Coming Soon
              </div>
              <h3 className="font-display text-lg font-bold mb-2">Reading Insights</h3>
              <p className="text-gray-600 text-sm mb-4">
                Track your habits.
              </p>
              <div className="mt-auto flex items-end gap-2 h-16 opacity-40">
                <div className="w-full bg-gray-300 rounded-t" style={{ height: "40%" }} />
                <div className="w-full bg-gray-300 rounded-t" style={{ height: "70%" }} />
                <div className="w-full bg-gray-300 rounded-t" style={{ height: "55%" }} />
                <div className="w-full bg-gray-300 rounded-t" style={{ height: "90%" }} />
              </div>
            </div>

            {/* Community */}
            <div className="lg:col-span-2 bg-gray-50 rounded-2xl p-6 flex flex-col relative">
              <div className="absolute top-4 right-4 px-2 py-1 bg-gray-200 text-gray-600 text-[10px] uppercase tracking-wider font-bold rounded-md">
                Coming Soon
              </div>
              <h3 className="font-display text-xl font-bold mb-2">Community</h3>
              <p className="text-gray-600 text-sm mb-4">
                Discover what other readers love. Share your favorites.
              </p>
              <div className="flex items-center gap-2 mt-auto opacity-40">
                <div className="w-10 h-10 rounded-full bg-gray-300" />
                <div className="w-10 h-10 rounded-full bg-gray-300 -ml-3" />
                <div className="w-10 h-10 rounded-full bg-gray-300 -ml-3" />
                <div className="w-10 h-10 rounded-full bg-gray-300 -ml-3" />
                <span className="text-sm text-gray-600 ml-2">+2,453 readers</span>
              </div>
            </div>

            {/* Newsletter Discovery */}
            <div className="lg:col-span-2 bg-gray-900 text-white rounded-2xl p-6 flex flex-col">
              <h3 className="font-display text-xl font-bold mb-2">Newsletter Discovery</h3>
              <p className="text-gray-300 text-sm mb-4">
                Browse 500+ curated newsletters across tech, design, business, and more.
              </p>
              <div className="flex flex-wrap gap-3 mt-auto">
                <span className="text-2xl">💼</span>
                <span className="text-2xl">🎨</span>
                <span className="text-2xl">💻</span>
                <span className="text-2xl">📈</span>
                <span className="text-2xl">🚀</span>
                <span className="text-2xl">✍️</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUPER SIMPLE TO START */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Super simple to start
            </h2>
            <p className="text-lg text-gray-500">
              Three steps to a cleaner newsletter experience.
            </p>
          </div>

          <div className="space-y-16">
            {/* Step 1 */}
            <div className="flex gap-8 items-start">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center text-xl font-bold">
                  1
                </div>
                <div className="w-0.5 h-24 bg-gray-200 mt-4 border-l-2 border-dashed border-gray-300" />
              </div>
              <div className="flex-1 pt-2">
                <h3 className="font-display text-xl font-bold mb-2">Get your inbox address</h3>
                <p className="text-gray-600 mb-4">
                  Sign up and get a unique @hushletter.com email address in seconds.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 inline-block">
                  <code className="text-sm font-mono">yourname@hushletter.com</code>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-8 items-start">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center text-xl font-bold">
                  2
                </div>
                <div className="w-0.5 h-24 bg-gray-200 mt-4 border-l-2 border-dashed border-gray-300" />
              </div>
              <div className="flex-1 pt-2">
                <h3 className="font-display text-xl font-bold mb-2">Subscribe to newsletters</h3>
                <p className="text-gray-600 mb-4">
                  Use your new address to subscribe. Browse our directory or add your favorites.
                </p>
                <div className="flex gap-2">
                  <div className="px-3 py-1.5 bg-gray-900 text-white rounded-full text-sm">
                    Stratechery
                  </div>
                  <div className="px-3 py-1.5 bg-gray-900 text-white rounded-full text-sm">
                    Morning Brew
                  </div>
                  <div className="px-3 py-1.5 bg-gray-900 text-white rounded-full text-sm">
                    + 500 more
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-8 items-start">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center text-xl font-bold">
                  3
                </div>
              </div>
              <div className="flex-1 pt-2">
                <h3 className="font-display text-xl font-bold mb-2">Enjoy your organized inbox</h3>
                <p className="text-gray-600 mb-4">
                  Read in a clean, distraction-free environment. Every newsletter automatically organized.
                </p>
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="text-sm text-gray-900 font-medium">
                    ✓ No more Gmail clutter
                  </div>
                  <div className="text-sm text-gray-900 font-medium mt-1">
                    ✓ Auto-organized folders
                  </div>
                  <div className="text-sm text-gray-900 font-medium mt-1">
                    ✓ AI summaries included
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WAVE DIVIDER */}
      <div className="relative">
        <svg
          className="w-full h-24 text-gray-50"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,64 C360,20 720,100 1080,64 C1260,46 1350,10 1440,0 L1440,120 L0,120 Z" />
        </svg>
      </div>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              People love it
            </h2>
            <p className="text-lg text-gray-500">
              Hear from newsletter enthusiasts who've reclaimed their inbox.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "Hushletter transformed how I consume newsletters. Everything in one place, beautifully organized.",
                author: "Sarah Chen",
                role: "Product Designer",
              },
              {
                quote: "I was drowning in newsletter subscriptions. Hushletter gave me my inbox back.",
                author: "Michael Torres",
                role: "Engineering Manager",
              },
              {
                quote: "The AI summaries are a game-changer. I can scan 10 newsletters in the time it used to take to read one.",
                author: "Emma Wilson",
                role: "Startup Founder",
              },
            ].map((testimonial, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg
                      key={j}
                      className="w-5 h-5 text-amber-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 mb-4">&ldquo;{testimonial.quote}&rdquo;</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVERSE WAVE DIVIDER */}
      <div className="relative">
        <svg
          className="w-full h-24 text-gray-50 rotate-180"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,64 C360,20 720,100 1080,64 C1260,46 1350,10 1440,0 L1440,120 L0,120 Z" />
        </svg>
      </div>

      {/* STATS */}
      <section className="py-20 bg-white" ref={statsRef}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="font-display text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
                {usersCount}K+
              </div>
              <div className="text-gray-600">Happy readers</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
                {emailsCount}M+
              </div>
              <div className="text-gray-600">Emails organized</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
                {sourcesCount}+
              </div>
              <div className="text-gray-600">Newsletter sources</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
                {ratingCount / 10}★
              </div>
              <div className="text-gray-600">Average rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="relative bg-gray-900 rounded-3xl p-12 text-center overflow-hidden">
            {/* Decorative envelopes */}
            <EnvelopeIcon className="absolute top-4 left-4 w-16 h-16 text-white opacity-10" />
            <EnvelopeIcon className="absolute bottom-4 right-4 w-20 h-20 text-white opacity-10" />
            <EnvelopeIcon className="absolute top-1/2 left-1/4 w-12 h-12 text-white opacity-5" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to fall in love with newsletters again?
              </h2>
              <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
                Join thousands of readers who've transformed their newsletter experience.
              </p>
              <button className="px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors">
                Get started free →
              </button>
              <p className="text-gray-400 text-sm mt-4">
                No credit card required · 14-day free trial
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <EnvelopeIcon className="w-6 h-6" />
              <span className="font-body font-semibold text-lg">hushletter</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </a>
              <a href="#blog" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Blog
              </a>
              <a href="#about" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                About
              </a>
              <a href="#privacy" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Privacy
              </a>
              <a href="#terms" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Terms
              </a>
            </nav>

            <div className="text-sm text-gray-500">
              © 2025 Hushletter. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
