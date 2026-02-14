import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/{-$locale}/6")({
  component: Design6,
});

// SVG Component
function EnvelopeIcon({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      style={style}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

// Hooks
function useInView(options = {}): [React.RefObject<HTMLDivElement | null>, boolean] {
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

function useCounter(target: number, isInView: boolean, duration = 2000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      setCount(Math.floor(easedProgress * target));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [target, isInView, duration]);

  return count;
}

function Design6() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Nunito:wght@400;600;700&display=swap');

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

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes float-envelope-1 {
          0%, 100% {
            transform: translateY(0) rotate(var(--rotate, 0deg));
          }
          50% {
            transform: translateY(-20px) rotate(calc(var(--rotate, 0deg) + 5deg));
          }
        }

        @keyframes float-envelope-2 {
          0%, 100% {
            transform: translateY(0) translateX(0) rotate(var(--rotate, 0deg));
          }
          50% {
            transform: translateY(-15px) translateX(10px) rotate(calc(var(--rotate, 0deg) - 5deg));
          }
        }

        @keyframes float-envelope-3 {
          0%, 100% {
            transform: translateY(0) translateX(0) rotate(var(--rotate, 0deg));
          }
          33% {
            transform: translateY(-10px) translateX(-5px) rotate(calc(var(--rotate, 0deg) + 3deg));
          }
          66% {
            transform: translateY(-20px) translateX(5px) rotate(calc(var(--rotate, 0deg) - 3deg));
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
          to {
            stroke-dashoffset: 0;
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-slide-in-right {
          animation: slideInRight 0.5s ease-out forwards;
        }

        .animate-float-1 {
          animation: float-envelope-1 var(--duration, 6s) ease-in-out infinite;
        }

        .animate-float-2 {
          animation: float-envelope-2 var(--duration, 7s) ease-in-out infinite;
        }

        .animate-float-3 {
          animation: float-envelope-3 var(--duration, 8s) ease-in-out infinite;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }

        .wavy-underline {
          position: relative;
          display: inline-block;
        }

        .wavy-underline::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 12px;
          background-image: url("data:image/svg+xml,%3Csvg width='100' height='12' viewBox='0 0 100 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 6 Q 12.5 0, 25 6 T 50 6 T 75 6 T 100 6' stroke='%23fbbf24' stroke-width='3' fill='none'/%3E%3C/svg%3E");
          background-size: 100px 12px;
          background-repeat: repeat-x;
          background-position: 0 100%;
          animation: wave-underline 2s linear infinite;
        }

        @keyframes wave-underline {
          to {
            background-position: 100px 100%;
          }
        }
      `}</style>

      <div className="min-h-screen bg-white font-body">
        {/* HEADER */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                <EnvelopeIcon className="w-5 h-5 text-white" />
              </div>
              <span className="font-body font-semibold text-gray-900">
                Hushletter
              </span>
            </div>

            {/* Center: Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Features
              </a>
              <a
                href="#integrations"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Integrations
              </a>
              <a
                href="#pricing"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#blog"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Blog
              </a>
            </nav>

            {/* Right: CTA */}
            <div className="flex items-center gap-4">
              <a
                href="#login"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Log in
              </a>
              <a
                href="#start"
                className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-1"
              >
                Start free
                <span className="inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </a>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="relative min-h-[85vh] flex items-center overflow-hidden">
          {/* Floating envelopes */}
          <EnvelopeIcon
            className="absolute w-8 h-8 text-gray-900 opacity-10 animate-float-1"
            style={
              {
                top: "10%",
                left: "5%",
                "--rotate": "-15deg",
                "--duration": "6s",
              } as React.CSSProperties
            }
          />
          <EnvelopeIcon
            className="absolute w-12 h-12 text-gray-900 opacity-8 animate-float-2"
            style={
              {
                top: "20%",
                right: "8%",
                "--rotate": "20deg",
                "--duration": "7s",
              } as React.CSSProperties
            }
          />
          <EnvelopeIcon
            className="absolute w-6 h-6 text-gray-900 opacity-12 animate-float-3"
            style={
              {
                top: "60%",
                left: "10%",
                "--rotate": "10deg",
                "--duration": "8s",
              } as React.CSSProperties
            }
          />
          <EnvelopeIcon
            className="absolute w-10 h-10 text-gray-900 opacity-10 animate-float-1"
            style={
              {
                top: "70%",
                right: "15%",
                "--rotate": "-10deg",
                "--duration": "9s",
              } as React.CSSProperties
            }
          />
          <EnvelopeIcon
            className="absolute w-7 h-7 text-gray-900 opacity-15 animate-float-2"
            style={
              {
                top: "40%",
                right: "3%",
                "--rotate": "15deg",
                "--duration": "6.5s",
              } as React.CSSProperties
            }
          />
          <EnvelopeIcon
            className="absolute w-9 h-9 text-gray-900 opacity-8 animate-float-3"
            style={
              {
                bottom: "15%",
                left: "8%",
                "--rotate": "-20deg",
                "--duration": "7.5s",
              } as React.CSSProperties
            }
          />

          <div className="max-w-6xl mx-auto px-6 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left side */}
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 animate-bounce-subtle">
                  <span className="text-sm">
                    📬 Your newsletters deserve better
                  </span>
                </div>

                <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] text-gray-900">
                  All your newsletters, one{" "}
                  <span className="wavy-underline">happy</span> inbox.
                </h1>

                <p className="font-body text-lg text-gray-500 max-w-xl">
                  Get a dedicated email just for newsletters. Every sender gets
                  its own folder — organized, clean, and always yours.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href="#start"
                    className="group bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800 transition-all inline-flex items-center gap-2"
                  >
                    Get started
                    <span className="inline-block transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </a>
                  <a
                    href="#demo"
                    className="bg-gray-100 text-gray-900 px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    See how it works
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="text-green-600">✓</span> Free forever
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-green-600">✓</span> No spam
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-green-600">✓</span> 30s setup
                  </span>
                </div>
              </div>

              {/* Right side - Inbox Mockup */}
              <div className="relative">
                <div className="max-w-md ml-auto bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                  {/* Top bar */}
                  <div className="h-12 bg-gray-50 border-b border-gray-100 flex items-center justify-between px-4">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      Inbox
                    </span>
                    <div className="w-12" />
                  </div>

                  <div className="flex">
                    {/* Folder sidebar */}
                    <div className="w-36 bg-gray-50/80 border-r border-gray-100 p-3 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 px-2">
                        Folders
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-gray-900" />
                          <span className="text-xs font-medium text-gray-900">
                            All
                          </span>
                          <span className="ml-auto text-[10px] text-gray-400">
                            24
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/50 rounded-lg transition-colors">
                          <div className="w-2 h-2 rounded-full bg-violet-400" />
                          <span className="text-xs text-gray-600">
                            Stratechery
                          </span>
                          <span className="ml-auto text-[10px] text-gray-400">
                            3
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/50 rounded-lg transition-colors">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-xs text-gray-600">
                            Dense Discovery
                          </span>
                          <span className="ml-auto text-[10px] text-gray-400">
                            5
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/50 rounded-lg transition-colors">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-xs text-gray-600">
                            The Hustle
                          </span>
                          <span className="ml-auto text-[10px] text-gray-400">
                            8
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/50 rounded-lg transition-colors">
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-xs text-gray-600">
                            Morning Brew
                          </span>
                          <span className="ml-auto text-[10px] text-gray-400">
                            4
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/50 rounded-lg transition-colors">
                          <div className="w-2 h-2 rounded-full bg-rose-400" />
                          <span className="text-xs text-gray-600">
                            Lenny's
                          </span>
                          <span className="ml-auto text-[10px] text-gray-400">
                            4
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Email list */}
                    <div className="flex-1 divide-y divide-gray-100">
                      <div
                        className="p-3 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-in-right"
                        style={{ animationDelay: "0.1s", opacity: 0 }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-900 truncate">
                                Stratechery
                              </span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                2m
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 truncate">
                              The AI Value Chain
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className="p-3 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-in-right"
                        style={{ animationDelay: "0.2s", opacity: 0 }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-900 truncate">
                                Dense Discovery
                              </span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                1h
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 truncate">
                              Issue #287: Design Systems
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className="p-3 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-in-right"
                        style={{ animationDelay: "0.3s", opacity: 0 }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs text-gray-500 truncate">
                                The Hustle
                              </span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                3h
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              Why startups are moving...
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className="p-3 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-in-right"
                        style={{ animationDelay: "0.4s", opacity: 0 }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs text-gray-500 truncate">
                                Morning Brew
                              </span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                5h
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              Markets are shifting fast
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className="p-3 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-in-right"
                        style={{ animationDelay: "0.5s", opacity: 0 }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs text-gray-500 truncate">
                                Lenny's Newsletter
                              </span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                1d
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              How to build products...
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BENTO GRID FEATURES */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="font-display text-4xl font-bold text-gray-900 mb-3">
                Everything you need
              </h2>
              <p className="font-body text-lg text-gray-500">
                A thoughtfully designed inbox for your newsletters
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
                  Unified Inbox
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  All your newsletters in one beautiful place. No more hunting
                  through your main inbox.
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
                  Smart Folders
                </h3>
                <p className="text-sm text-gray-300 mb-6">
                  Every sender gets its own folder. Merge them to create custom
                  collections.
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
                  AI Summaries
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Get the gist without reading everything
                </p>
                <div className="mt-auto space-y-2">
                  <div className="h-1.5 bg-gray-300 rounded w-full" />
                  <div className="h-1.5 bg-gray-300 rounded w-5/6" />
                  <div className="h-1.5 bg-gray-300 rounded w-4/6" />
                </div>
              </div>

              {/* Reading Insights - COMING SOON */}
              <div
                className="relative lg:col-span-1 bg-gray-50 rounded-2xl p-6 flex flex-col animate-fade-in-up"
                style={{ animationDelay: "0.4s" }}
              >
                <span className="absolute top-3 right-3 bg-gray-200 text-gray-600 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md">
                  Coming Soon
                </span>
                <h3 className="font-display text-lg font-bold text-gray-900 mb-2">
                  Reading Insights
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Track your reading habits and favorites
                </p>
                <div className="mt-auto flex items-end gap-1 opacity-40">
                  <div className="w-full h-8 bg-gray-300 rounded" />
                  <div className="w-full h-12 bg-gray-300 rounded" />
                  <div className="w-full h-6 bg-gray-300 rounded" />
                  <div className="w-full h-10 bg-gray-300 rounded" />
                </div>
              </div>

              {/* Community - COMING SOON */}
              <div
                className="relative lg:col-span-2 bg-gray-50 rounded-2xl p-6 flex flex-col animate-fade-in-up"
                style={{ animationDelay: "0.5s" }}
              >
                <span className="absolute top-3 right-3 bg-gray-200 text-gray-600 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md">
                  Coming Soon
                </span>
                <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                  Community
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Discover what newsletters your friends are reading
                </p>
                <div className="mt-auto flex -space-x-2 opacity-40">
                  <div className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white" />
                  <div className="w-10 h-10 rounded-full bg-gray-400 border-2 border-white" />
                  <div className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white" />
                  <div className="w-10 h-10 rounded-full bg-gray-400 border-2 border-white" />
                </div>
              </div>

              {/* Newsletter Discovery */}
              <div
                className="lg:col-span-2 bg-gray-900 text-white rounded-2xl p-6 flex flex-col animate-fade-in-up"
                style={{ animationDelay: "0.6s" }}
              >
                <h3 className="font-display text-xl font-bold mb-2">
                  Newsletter Discovery
                </h3>
                <p className="text-sm text-gray-300 mb-6">
                  Find and subscribe to amazing newsletters curated by topic
                </p>
                <div className="mt-auto flex flex-wrap gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                    📰
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                    💼
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                    🎨
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                    🚀
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SUPER SIMPLE TO START */}
        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="font-display text-3xl font-bold text-center text-gray-900 mb-12">
              Super simple to start
            </h2>

            <div className="space-y-8">
              {/* Step 1 */}
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div className="w-0.5 h-16 bg-gray-200 border-l-2 border-dashed border-gray-300 mt-2" />
                </div>
                <div className="pt-2">
                  <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                    Grab your email
                  </h3>
                  <p className="text-gray-500 mb-3">
                    Choose your perfect newsletter address
                  </p>
                  <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg text-sm font-mono text-gray-900">
                    you@hushletter.com
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div className="w-0.5 h-16 bg-gray-200 border-l-2 border-dashed border-gray-300 mt-2" />
                </div>
                <div className="pt-2">
                  <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                    Subscribe to everything
                  </h3>
                  <p className="text-gray-500 mb-3">
                    Use it on any newsletter platform
                  </p>
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
                    Read & enjoy
                  </h3>
                  <p className="text-gray-500 mb-3">
                    Everything organized, nothing missed
                  </p>
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

        {/* WAVE DIVIDER → SOCIAL PROOF */}
        <div className="relative">
          <svg
            className="w-full h-12 text-gray-50"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,0 Q300,60 600,30 T1200,0 L1200,120 L0,120 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="font-display text-3xl font-bold text-center text-gray-900 mb-12">
              People love it
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-violet-100 rounded-2xl p-6">
                <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
                <p className="text-gray-700 mb-4">
                  "Finally, my main inbox is clean! I can actually focus on
                  work emails now. Hushletter is a game-changer."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-300" />
                  <div>
                    <div className="font-semibold text-gray-900">Sarah K.</div>
                    <div className="text-sm text-gray-600">Designer</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-100 rounded-2xl p-6">
                <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
                <p className="text-gray-700 mb-4">
                  "I subscribe to 30+ newsletters. This is the ONLY way to keep
                  them organized. Love the auto-folders!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-300" />
                  <div>
                    <div className="font-semibold text-gray-900">James M.</div>
                    <div className="text-sm text-gray-600">Founder</div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-100 rounded-2xl p-6">
                <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
                <p className="text-gray-700 mb-4">
                  "Such a simple idea, so perfectly executed. I actually read
                  my newsletters now instead of letting them pile up."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-300" />
                  <div>
                    <div className="font-semibold text-gray-900">Emma L.</div>
                    <div className="text-sm text-gray-600">Writer</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* REVERSE WAVE → STATS BAR */}
        <div className="relative bg-gray-50">
          <svg
            className="w-full h-12 text-white"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,0 Q300,60 600,30 T1200,0 L1200,120 L0,120 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <StatsSection />

        {/* CTA */}
        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <div className="relative bg-gray-900 rounded-3xl p-10 md:p-14 text-white overflow-hidden">
              {/* Decorative envelopes */}
              <EnvelopeIcon
                className="absolute w-16 h-16 text-white opacity-5"
                style={{ top: "10%", left: "5%" }}
              />
              <EnvelopeIcon
                className="absolute w-12 h-12 text-white opacity-5"
                style={{ top: "60%", right: "8%" }}
              />
              <EnvelopeIcon
                className="absolute w-20 h-20 text-white opacity-5"
                style={{ bottom: "10%", right: "15%" }}
              />

              <div className="relative z-10 text-center">
                <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                  Ready to fall in love with newsletters again?
                </h2>
                <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
                  Join thousands of readers who've reclaimed their inbox and
                  rediscovered the joy of newsletters.
                </p>
                <a
                  href="#start"
                  className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition-colors group"
                >
                  Get started free
                  <span className="inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </a>
                <p className="text-sm text-gray-400 mt-4">
                  Free forever · Setup in 30 seconds
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-12 bg-white border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gray-900 flex items-center justify-center">
                  <EnvelopeIcon className="w-4 h-4 text-white" />
                </div>
                <span className="font-body font-semibold text-gray-900">
                  hushletter
                </span>
              </div>

              <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                <a href="#features" className="hover:text-gray-900">
                  Features
                </a>
                <a href="#pricing" className="hover:text-gray-900">
                  Pricing
                </a>
                <a href="#blog" className="hover:text-gray-900">
                  Blog
                </a>
                <a href="#support" className="hover:text-gray-900">
                  Support
                </a>
              </nav>

              <p className="text-sm text-gray-400">© 2025 Hushletter</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

function StatsSection() {
  const [ref, isInView] = useInView();
  const readers = useCounter(50, isInView, 2000);
  const newsletters = useCounter(2, isInView, 2000);
  const sources = useCounter(500, isInView, 2000);

  return (
    <section ref={ref} className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              {readers}K+
            </div>
            <div className="text-sm text-gray-500">Happy readers</div>
          </div>
          <div>
            <div className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              {newsletters}M+
            </div>
            <div className="text-sm text-gray-500">Newsletters read</div>
          </div>
          <div>
            <div className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              {sources}+
            </div>
            <div className="text-sm text-gray-500">Sources</div>
          </div>
          <div>
            <div className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              4.9★
            </div>
            <div className="text-sm text-gray-500">App rating</div>
          </div>
        </div>
      </div>
    </section>
  );
}
