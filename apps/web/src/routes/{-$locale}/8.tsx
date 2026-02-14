import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/{-$locale}/8")({
  component: Design8,
});

// ========================================
// HOOKS
// ========================================

function useInView(options?: IntersectionObserverInit) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return [ref, isInView] as const;
}

function useCounter(end: number, duration: number, isInView: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [end, duration, isInView]);

  return count;
}

// ========================================
// COMPONENTS
// ========================================

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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

function Design8() {
  const [bentoRef, bentoInView] = useInView({ threshold: 0.1 });
  const [stepsRef, stepsInView] = useInView({ threshold: 0.1 });
  const [testimonialsRef, testimonialsInView] = useInView({ threshold: 0.1 });
  const [statsRef, statsInView] = useInView({ threshold: 0.1 });

  const newsletters = useCounter(127000, 2000, statsInView);
  const users = useCounter(12500, 2000, statsInView);
  const timesSaved = useCounter(48, 2000, statsInView);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=Nunito:wght@400;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Nunito', sans-serif;
        }

        .font-display {
          font-family: 'Bricolage Grotesque', sans-serif;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes wave-dash {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -100;
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-slide-in-right {
          animation: slideInRight 0.6s ease-out forwards;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }

        .backdrop-blur-sm {
          backdrop-filter: blur(8px);
        }
      `}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <EnvelopeIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold">Hushletter</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#integrations" className="hover:text-gray-900 transition-colors">
              Integrations
            </a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">
              Pricing
            </a>
            <a href="#blog" className="hover:text-gray-900 transition-colors">
              Blog
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <a href="#login" className="text-sm font-medium hover:text-gray-900 transition-colors">
              Log in
            </a>
            <a
              href="#start"
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors"
            >
              Start free →
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium mb-6 animate-bounce-subtle">
            <span>📬</span>
            <span>Your newsletters deserve better</span>
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            One inbox for every newsletter you love.
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Get a dedicated email address. Every sender gets its own folder. Subscribe everywhere, read beautifully.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <a
              href="#start"
              className="px-8 py-4 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
            >
              Get started free →
            </a>
            <button className="px-8 py-4 bg-gray-100 text-gray-900 font-semibold rounded-full hover:bg-gray-200 transition-colors">
              Watch demo
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
            <span className="flex items-center gap-2">
              <span className="text-green-600">✓</span> Free forever
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-600">✓</span> No spam
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-600">✓</span> 30s setup
            </span>
          </div>
        </div>
      </section>

      {/* FULL-WIDTH MOCKUP */}
      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
              {/* Top bar */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex items-center gap-6 flex-1">
                  <span className="font-semibold text-sm">Inbox</span>
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Search newsletters..."
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* 3-column layout */}
              <div className="flex h-[420px]">
                {/* Left: Folders */}
                <div className="w-48 border-r border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Folders
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>All</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm">
                      <div className="w-2 h-2 rounded-full bg-violet-400" />
                      <span>Stratechery</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>Pragmatic Eng.</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Dense Discovery</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Morning Brew</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm">
                      <div className="w-2 h-2 rounded-full bg-rose-400" />
                      <span>Lenny's</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>TLDR</span>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-6 mb-3">
                    Merged
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg text-sm font-medium border border-gray-200">
                    <span>Tech Bundle</span>
                    <span className="text-xs">✦</span>
                  </div>
                </div>

                {/* Middle: Email list */}
                <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                  {[
                    { sender: "Stratechery", subject: "The AI Value Chain", time: "9:42 AM", dotClass: "bg-violet-400" },
                    { sender: "Morning Brew", subject: "Tech earnings season recap", time: "8:15 AM", dotClass: "bg-amber-400" },
                    { sender: "Dense Discovery", subject: "Issue #312: Creative tools", time: "Yesterday", dotClass: "bg-emerald-400" },
                    { sender: "The Pragmatic Engineer", subject: "Big Tech compensation", time: "Yesterday", dotClass: "bg-blue-400" },
                    { sender: "Lenny's Newsletter", subject: "Product market fit", time: "2 days ago", dotClass: "bg-rose-400" },
                    { sender: "TLDR", subject: "Daily tech roundup", time: "2 days ago", dotClass: "bg-cyan-400" },
                  ].map((email, i) => (
                    <div
                      key={i}
                      className={`p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors ${
                        i === 0 ? "bg-gray-50 border-gray-200" : "bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${email.dotClass}`} />
                          <span className="font-semibold text-sm">{email.sender}</span>
                        </div>
                        <span className="text-xs text-gray-500">{email.time}</span>
                      </div>
                      <p className="text-sm text-gray-600">{email.subject}</p>
                    </div>
                  ))}
                </div>

                {/* Right: Reader pane */}
                <div className="hidden lg:block w-80 border-l border-gray-200 bg-white p-6">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="text-xs font-semibold text-gray-500">STRATECHERY</span>
                    </div>
                    <h3 className="font-display text-lg font-bold mb-1">The AI Value Chain</h3>
                    <p className="text-xs text-gray-500">Today at 9:42 AM</p>
                  </div>

                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-11/12" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-10/12" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-9/12" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO GRID */}
      <section ref={bentoRef} className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Everything you need
            </h2>
            <p className="text-xl text-gray-600">
              Powerful features to organize and enjoy your newsletters
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[200px]">
            {/* Unified Inbox */}
            <div
              className={`col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-2 bg-gray-50 border border-gray-200 rounded-2xl p-8 ${
                bentoInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: "0s" }}
            >
              <div className="mb-6">
                <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-4">
                  <EnvelopeIcon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-2">Unified Inbox</h3>
                <p className="text-gray-600">
                  One email address for all your subscriptions. Never expose your personal email again.
                </p>
              </div>
              <div className="space-y-2">
                <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm font-medium">
                  you@hushletter.com
                </div>
                <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-500">
                  Subscribe anywhere with this address
                </div>
              </div>
            </div>

            {/* Smart Folders */}
            <div
              className={`col-span-1 lg:col-span-2 bg-gray-900 text-white rounded-2xl p-8 ${
                bentoInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: "0.1s" }}
            >
              <div className="mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl font-bold mb-2">Smart Folders</h3>
                <p className="text-gray-300">
                  Every sender gets its own folder automatically. Merge related newsletters into bundles.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 bg-white/10 rounded-full text-sm">Stratechery</span>
                <span className="px-3 py-1.5 bg-white/10 rounded-full text-sm">Morning Brew</span>
                <span className="px-3 py-1.5 bg-white/10 rounded-full text-sm">TLDR</span>
                <span className="px-3 py-1.5 bg-white/10 rounded-full text-sm">Lenny's</span>
                <span className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-full text-sm font-semibold">
                  Tech Bundle ✦
                </span>
              </div>
            </div>

            {/* AI Summaries */}
            <div
              className={`col-span-1 bg-gradient-to-br from-gray-700 to-gray-900 text-white rounded-2xl p-8 ${
                bentoInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: "0.2s" }}
            >
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-display text-xl font-bold mb-2">AI Summaries</h3>
              <p className="text-white/90 text-sm">
                Get the gist in seconds. Perfect for busy mornings.
              </p>
            </div>

            {/* Reading Insights */}
            <div
              className={`col-span-1 bg-gray-100 border border-gray-200 rounded-2xl p-8 relative overflow-hidden ${
                bentoInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: "0.3s" }}
            >
              <div className="relative z-10">
                <div className="w-12 h-12 bg-gray-300 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-display text-xl font-bold mb-2 text-gray-900">Reading Insights</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Track your reading habits and discover patterns.
                </p>
                <div className="inline-block px-3 py-1 bg-gray-900 text-white text-xs font-semibold rounded-full">
                  COMING SOON
                </div>
              </div>
              <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-0" />
            </div>

            {/* Community */}
            <div
              className={`col-span-1 lg:col-span-2 bg-gray-100 border border-gray-200 rounded-2xl p-8 relative overflow-hidden ${
                bentoInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: "0.4s" }}
            >
              <div className="relative z-10">
                <div className="w-12 h-12 bg-gray-300 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="font-display text-xl font-bold mb-2 text-gray-900">Community</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Share recommendations and discover hidden gems with other readers.
                </p>
                <div className="inline-block px-3 py-1 bg-gray-900 text-white text-xs font-semibold rounded-full">
                  COMING SOON
                </div>
              </div>
              <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-0" />
            </div>

            {/* Newsletter Discovery */}
            <div
              className={`col-span-1 lg:col-span-2 bg-gray-900 text-white rounded-2xl p-8 ${
                bentoInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: "0.5s" }}
            >
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl font-bold mb-2">Newsletter Discovery</h3>
              <p className="text-gray-300">
                Curated recommendations based on your interests. Find your next favorite newsletter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SUPER SIMPLE TO START */}
      <section ref={stepsRef} className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Super simple to start
            </h2>
            <p className="text-xl text-gray-600">Three steps to newsletter nirvana</p>
          </div>

          <div className="space-y-12">
            {[
              {
                step: "1",
                title: "Sign up in 30 seconds",
                description: "Create your account and get your personal @hushletter.com address instantly.",
              },
              {
                step: "2",
                title: "Subscribe everywhere",
                description: "Use your new address when signing up for newsletters. We'll organize everything automatically.",
              },
              {
                step: "3",
                title: "Read beautifully",
                description: "Open Hushletter to find all your newsletters perfectly organized and ready to enjoy.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex gap-8 items-start ${
                  stepsInView ? "animate-fade-in-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center font-display text-xl font-bold">
                  {item.step}
                </div>
                <div className="pt-1">
                  <h3 className="font-display text-2xl font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-lg">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WAVE DIVIDER */}
      <div className="relative h-24 bg-white">
        <svg
          className="absolute bottom-0 w-full h-24"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0,50 Q360,0 720,50 T1440,50 L1440,100 L0,100 Z"
            fill="#F9FAFB"
          />
        </svg>
      </div>

      {/* TESTIMONIALS */}
      <section ref={testimonialsRef} className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "Hushletter turned my newsletter chaos into pure zen. I actually look forward to reading now!",
                author: "Sarah Chen",
                role: "Product Designer",
              },
              {
                quote: "The smart folders are genius. Finally, my tech newsletters are separate from my creative ones.",
                author: "Marcus Rivera",
                role: "Startup Founder",
              },
              {
                quote: "I've tried every newsletter app. This is the one that stuck. Simple, beautiful, perfect.",
                author: "Emma Watson",
                role: "Content Strategist",
              },
            ].map((testimonial, i) => (
              <div
                key={i}
                className={`bg-white border border-gray-200 rounded-2xl p-8 ${
                  testimonialsInView ? "animate-fade-in-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg
                      key={j}
                      className="w-5 h-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVERSE WAVE */}
      <div className="relative h-24 bg-gray-50">
        <svg
          className="absolute bottom-0 w-full h-24"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0,50 Q360,100 720,50 T1440,50 L1440,100 L0,100 Z"
            fill="white"
          />
        </svg>
      </div>

      {/* STATS */}
      <section ref={statsRef} className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className={statsInView ? "animate-fade-in-up" : "opacity-0"}>
              <div className="font-display text-5xl md:text-6xl font-bold text-gray-900 mb-2">
                {newsletters.toLocaleString()}+
              </div>
              <div className="text-xl text-gray-600">Newsletters organized</div>
            </div>
            <div
              className={statsInView ? "animate-fade-in-up" : "opacity-0"}
              style={{ animationDelay: "0.1s" }}
            >
              <div className="font-display text-5xl md:text-6xl font-bold text-gray-900 mb-2">
                {users.toLocaleString()}+
              </div>
              <div className="text-xl text-gray-600">Happy readers</div>
            </div>
            <div
              className={statsInView ? "animate-fade-in-up" : "opacity-0"}
              style={{ animationDelay: "0.2s" }}
            >
              <div className="font-display text-5xl md:text-6xl font-bold text-gray-900 mb-2">
                {timesSaved}hrs
              </div>
              <div className="text-xl text-gray-600">Average time saved/month</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gray-900 text-white rounded-3xl p-12 md:p-16 text-center">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Ready to fall in love with newsletters again?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of readers who've transformed their newsletter experience.
            </p>
            <a
              href="#start"
              className="inline-block px-8 py-4 bg-white text-gray-900 font-semibold rounded-full hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl"
            >
              Get started free →
            </a>
            <p className="text-sm text-gray-400 mt-6">Free forever · No credit card required</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <EnvelopeIcon className="w-5 h-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold">Hushletter</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
              <a href="#features" className="hover:text-gray-900 transition-colors">
                Features
              </a>
              <a href="#pricing" className="hover:text-gray-900 transition-colors">
                Pricing
              </a>
              <a href="#blog" className="hover:text-gray-900 transition-colors">
                Blog
              </a>
              <a href="#privacy" className="hover:text-gray-900 transition-colors">
                Privacy
              </a>
              <a href="#terms" className="hover:text-gray-900 transition-colors">
                Terms
              </a>
            </nav>

            <div className="text-sm text-gray-500">© 2026 Hushletter</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
