import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/{-$locale}/1")({
  component: Design1,
});

// Helper hook for intersection observer
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, isInView };
}

// Helper hook for animated counter
function useCounter(end: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const { ref, isInView } = useInView();
  useEffect(() => {
    if (!isInView) return;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);
  return { ref, count };
}

function Design1() {
  const heroInView = useInView();
  const bentoInView = useInView();
  const howItWorksInView = useInView();
  const testimonialsInView = useInView();

  const stats = {
    readers: useCounter(50, 2000),
    newsletters: useCounter(2, 2000),
    sources: useCounter(500, 2000),
    rating: useCounter(49, 2000),
  };

  const emails = [
    {
      avatar: "S",
      color: "bg-violet-100 text-violet-700",
      sender: "Stratechery",
      subject: "The AI Value Chain",
      time: "2m",
      unread: true,
    },
    {
      avatar: "D",
      color: "bg-blue-100 text-blue-700",
      sender: "Dense Discovery",
      subject: "Issue #287: Design Systems",
      time: "1h",
      unread: true,
    },
    {
      avatar: "T",
      color: "bg-emerald-100 text-emerald-700",
      sender: "The Hustle",
      subject: "Why startups are moving...",
      time: "3h",
      unread: false,
    },
    {
      avatar: "M",
      color: "bg-amber-100 text-amber-700",
      sender: "Morning Brew",
      subject: "Markets are shifting fast",
      time: "5h",
      unread: false,
    },
    {
      avatar: "L",
      color: "bg-rose-100 text-rose-700",
      sender: "Lenny's Newsletter",
      subject: "How to build products...",
      time: "1d",
      unread: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white font-body">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap');

          .font-display {
            font-family: 'Instrument Serif', serif;
          }

          .font-body {
            font-family: 'DM Sans', sans-serif;
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(24px);
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

          @keyframes float {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-6px);
            }
          }

          @keyframes pulse-dot {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }

          .animate-fade-in-up {
            animation: fadeInUp 0.7s ease-out forwards;
            opacity: 0;
          }

          .animate-slide-in-right {
            animation: slideInRight 0.5s ease-out forwards;
            opacity: 0;
          }

          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `}
      </style>

      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 h-16 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="font-display text-xl font-medium text-gray-900">
            Hushletter
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-600 hover:text-gray-900 transition font-body">
              Sign in
            </button>
            <button className="bg-gray-900 text-white px-5 py-2 rounded-full hover:bg-gray-800 transition-all hover:shadow-lg font-body">
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="min-h-[85vh] flex items-center">
        <div className="max-w-6xl mx-auto px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side */}
            <div ref={heroInView.ref}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-body animate-fade-in-up"
                style={{ animationDelay: "0s" }}
              >
                ✦ Your inbox, reimagined
              </div>
              <h1
                className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-gray-900 leading-[1.1] mt-6 animate-fade-in-up"
                style={{ animationDelay: "0.1s" }}
              >
                Read newsletters
                <br />
                the way they were
                <br />
                <span className="italic">meant to be read.</span>
              </h1>
              <p
                className="text-lg text-gray-500 font-body max-w-md mt-6 animate-fade-in-up"
                style={{ animationDelay: "0.2s" }}
              >
                One beautiful inbox for all your newsletters. Every sender
                gets its own folder — organized, clean, and always yours.
              </p>
              <div
                className="flex gap-3 mt-8 animate-fade-in-up"
                style={{ animationDelay: "0.3s" }}
              >
                <button className="bg-gray-900 text-white px-7 py-3 rounded-full font-body font-medium hover:bg-gray-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  Get Started Free
                </button>
                <button className="border border-gray-200 text-gray-700 px-7 py-3 rounded-full font-body hover:border-gray-300 hover:bg-gray-50 transition-all duration-300">
                  Watch Demo
                </button>
              </div>
            </div>

            {/* Right side - Animated Inbox */}
            <div
              className="animate-fade-in-up"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-w-md ml-auto">
                {/* Top bar */}
                <div className="h-12 bg-gray-50 border-b border-gray-100 flex items-center px-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 text-center text-sm font-medium text-gray-600">
                    Inbox
                  </div>
                </div>

                {/* Sidebar + Content */}
                <div className="flex">
                  {/* Folder sidebar */}
                  <div className="w-36 bg-gray-50/80 border-r border-gray-100 p-2 space-y-0.5">
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-2 pt-1 pb-1">Folders</div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white text-xs font-medium text-gray-900 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                      All
                      <span className="ml-auto text-[10px] text-gray-400">24</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-white transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Stratechery
                      <span className="ml-auto text-[10px] text-gray-400">3</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-white transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Dense Discovery
                      <span className="ml-auto text-[10px] text-gray-400">5</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-white transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      The Hustle
                      <span className="ml-auto text-[10px] text-gray-400">8</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-white transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Morning Brew
                      <span className="ml-auto text-[10px] text-gray-400">4</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-white transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      Lenny's
                      <span className="ml-auto text-[10px] text-gray-400">4</span>
                    </div>
                  </div>

                  {/* Email list */}
                  <div className="flex-1">
                  {emails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 animate-slide-in-right"
                      style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${email.color}`}
                      >
                        {email.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div
                            className={`text-sm truncate ${
                              email.unread
                                ? "font-medium text-gray-900"
                                : "text-gray-600"
                            }`}
                          >
                            {email.sender}
                          </div>
                          <div className="text-xs text-gray-400 ml-2">
                            {email.time}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {email.subject}
                        </div>
                      </div>
                      {email.unread && (
                        <div className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO GRID FEATURES */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div ref={bentoInView.ref}>
            <h2
              className="font-display text-4xl text-center text-gray-900 mb-4 animate-fade-in-up"
              style={{ animationDelay: "0s" }}
            >
              Everything you need
            </h2>
            <p
              className="text-gray-500 text-center mb-16 animate-fade-in-up"
              style={{ animationDelay: "0.1s" }}
            >
              A thoughtfully crafted experience for newsletter lovers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[200px]">
              {/* Unified Inbox */}
              <div
                className="lg:col-span-2 lg:row-span-2 bg-gray-50 rounded-2xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: "0.2s" }}
              >
                <svg
                  className="w-10 h-10 text-gray-900 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="font-display text-2xl text-gray-900 mb-2">
                  Unified Inbox
                </h3>
                <p className="text-gray-500 font-body">
                  All your newsletters in one beautiful place. No more hunting
                  through your email.
                </p>
                <div className="mt-6 space-y-2">
                  <div className="h-12 bg-white rounded-lg border border-gray-100 flex items-center px-3 gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100" />
                    <div className="h-2 bg-gray-100 rounded flex-1" />
                  </div>
                  <div className="h-12 bg-white rounded-lg border border-gray-100 flex items-center px-3 gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100" />
                    <div className="h-2 bg-gray-100 rounded flex-1" />
                  </div>
                </div>
              </div>

              {/* Smart Folders */}
              <div
                className="lg:col-span-2 bg-gray-900 text-white rounded-2xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: "0.3s" }}
              >
                <h3 className="font-display text-2xl mb-2">
                  Smart Folders
                </h3>
                <p className="text-gray-400 font-body mb-6">
                  Every sender gets its own folder. Merge them to create custom collections.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-4 py-2 bg-white/10 rounded-full text-sm font-body border border-white/20 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    Stratechery
                  </span>
                  <span className="px-4 py-2 bg-white/10 rounded-full text-sm font-body border border-white/20 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Morning Brew
                  </span>
                  <span className="px-4 py-2 bg-white/10 rounded-full text-sm font-body border border-white/20 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Tech Bundle ✦
                  </span>
                </div>
              </div>

              {/* AI Summaries */}
              <div
                className="lg:col-span-1 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: "0.4s" }}
              >
                <h3 className="font-display text-lg text-gray-900 mb-2">
                  AI Summaries
                </h3>
                <p className="text-gray-500 font-body text-sm">
                  Get the key points instantly.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="h-1.5 bg-gray-200 rounded w-full" />
                  <div className="h-1.5 bg-gray-200 rounded w-4/5" />
                  <div className="h-1.5 bg-gray-200 rounded w-3/5" />
                </div>
              </div>

              {/* Reading Stats - Coming Soon */}
              <div
                className="lg:col-span-1 bg-gray-50 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up relative overflow-hidden"
                style={{ animationDelay: "0.5s" }}
              >
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-gray-200 text-[10px] font-medium text-gray-500 font-body uppercase tracking-wide">
                  Coming soon
                </div>
                <h3 className="font-display text-lg text-gray-900 mb-2">
                  Reading Insights
                </h3>
                <p className="text-gray-500 font-body text-sm mb-4">
                  Track your reading habits.
                </p>
                <div className="flex items-end gap-1.5 h-20 opacity-40">
                  <div className="bg-gray-900 rounded w-1/5 h-1/3" />
                  <div className="bg-gray-900 rounded w-1/5 h-2/3" />
                  <div className="bg-gray-900 rounded w-1/5 h-full" />
                  <div className="bg-gray-900 rounded w-1/5 h-1/2" />
                  <div className="bg-gray-900 rounded w-1/5 h-4/5" />
                </div>
              </div>

              {/* Community - Coming Soon */}
              <div
                className="lg:col-span-2 bg-gray-50 rounded-2xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up relative overflow-hidden"
                style={{ animationDelay: "0.6s" }}
              >
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-gray-200 text-[10px] font-medium text-gray-500 font-body uppercase tracking-wide">
                  Coming soon
                </div>
                <h3 className="font-display text-2xl text-gray-900 mb-2">
                  Community
                </h3>
                <p className="text-gray-500 font-body">
                  Join thousands of readers discovering great content.
                </p>
                <div className="flex -space-x-3 mt-6 opacity-40">
                  <div className="w-12 h-12 rounded-full bg-violet-100 border-2 border-white flex items-center justify-center text-violet-700 font-medium">
                    A
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-blue-700 font-medium">
                    B
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-emerald-700 font-medium">
                    C
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-amber-700 font-medium">
                    D
                  </div>
                  <div className="w-12 h-12 rounded-full bg-rose-100 border-2 border-white flex items-center justify-center text-rose-700 font-medium">
                    E
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gray-900 border-2 border-white flex items-center justify-center text-white font-medium text-xs">
                    +50K
                  </div>
                </div>
              </div>

              {/* Newsletter Discovery */}
              <div
                className="lg:col-span-2 bg-gray-900 text-white rounded-2xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: "0.7s" }}
              >
                <h3 className="font-display text-2xl mb-2">
                  Newsletter Discovery
                </h3>
                <p className="text-gray-400 font-body mb-6">
                  Find your next favorite newsletter.
                </p>
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl">
                    📰
                  </div>
                  <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl">
                    🎨
                  </div>
                  <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl">
                    💼
                  </div>
                  <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl">
                    🚀
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="py-20 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div ref={stats.readers.ref}>
              <div className="font-display text-4xl md:text-5xl text-gray-900">
                {stats.readers.count}K+
              </div>
              <div className="text-sm text-gray-500 mt-2 font-body">
                Active readers
              </div>
            </div>
            <div ref={stats.newsletters.ref}>
              <div className="font-display text-4xl md:text-5xl text-gray-900">
                {stats.newsletters.count}M+
              </div>
              <div className="text-sm text-gray-500 mt-2 font-body">
                Newsletters read
              </div>
            </div>
            <div ref={stats.sources.ref}>
              <div className="font-display text-4xl md:text-5xl text-gray-900">
                {stats.sources.count}+
              </div>
              <div className="text-sm text-gray-500 mt-2 font-body">
                Newsletter sources
              </div>
            </div>
            <div ref={stats.rating.ref}>
              <div className="font-display text-4xl md:text-5xl text-gray-900">
                {(stats.rating.count / 10).toFixed(1)} ★
              </div>
              <div className="text-sm text-gray-500 mt-2 font-body">
                App Store rating
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div ref={howItWorksInView.ref}>
            <h2 className="font-display text-4xl text-center mb-16 text-gray-900">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Step 1 */}
              <div
                className="text-center animate-fade-in-up"
                style={{ animationDelay: "0s" }}
              >
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-display text-lg mx-auto">
                  1
                </div>
                <h3 className="font-body font-semibold text-lg mt-4 text-gray-900">
                  Get your address
                </h3>
                <p className="text-gray-500 text-sm mt-2 font-body">
                  Sign up and receive your unique @hushletter email address
                </p>
              </div>

              {/* Connector line (desktop only) */}
              <div className="hidden md:block absolute top-6 left-1/3 right-1/3 h-0.5 bg-gray-200" />

              {/* Step 2 */}
              <div
                className="text-center animate-fade-in-up"
                style={{ animationDelay: "0.1s" }}
              >
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-display text-lg mx-auto">
                  2
                </div>
                <h3 className="font-body font-semibold text-lg mt-4 text-gray-900">
                  Subscribe everywhere
                </h3>
                <p className="text-gray-500 text-sm mt-2 font-body">
                  Use your Hushletter address to subscribe to any newsletter
                </p>
              </div>

              {/* Connector line (desktop only) */}
              <div className="hidden md:block absolute top-6 left-2/3 right-0 h-0.5 bg-gray-200" />

              {/* Step 3 */}
              <div
                className="text-center animate-fade-in-up"
                style={{ animationDelay: "0.2s" }}
              >
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-display text-lg mx-auto">
                  3
                </div>
                <h3 className="font-body font-semibold text-lg mt-4 text-gray-900">
                  Read beautifully
                </h3>
                <p className="text-gray-500 text-sm mt-2 font-body">
                  All your newsletters arrive in one clean, beautiful inbox
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div ref={testimonialsInView.ref}>
            <h2 className="font-display text-4xl text-center mb-12 text-gray-900">
              Loved by readers
            </h2>
            <div className="flex gap-6 overflow-x-auto pb-4 snap-x">
              {/* Testimonial 1 */}
              <div
                className="bg-white rounded-2xl p-8 shadow-sm min-w-[320px] snap-center animate-fade-in-up"
                style={{ animationDelay: "0s" }}
              >
                <p className="text-gray-600 font-body text-base leading-relaxed italic">
                  "Hushletter completely transformed how I consume newsletters.
                  It's like having a personal reading room."
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-medium">
                    S
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      Sarah Chen
                    </div>
                    <div className="text-gray-400 text-xs">
                      Product Designer
                    </div>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div
                className="bg-white rounded-2xl p-8 shadow-sm min-w-[320px] snap-center animate-fade-in-up"
                style={{ animationDelay: "0.1s" }}
              >
                <p className="text-gray-600 font-body text-base leading-relaxed italic">
                  "I used to drown in newsletter emails. Now I actually look
                  forward to my reading time."
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
                    M
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      Marcus Rodriguez
                    </div>
                    <div className="text-gray-400 text-xs">
                      Startup Founder
                    </div>
                  </div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div
                className="bg-white rounded-2xl p-8 shadow-sm min-w-[320px] snap-center animate-fade-in-up"
                style={{ animationDelay: "0.2s" }}
              >
                <p className="text-gray-600 font-body text-base leading-relaxed italic">
                  "The AI summaries alone save me hours every week. Can't
                  imagine going back."
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium">
                    E
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      Emily Park
                    </div>
                    <div className="text-gray-400 text-xs">Tech Writer</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gray-900 rounded-3xl p-12 md:p-16 text-center text-white relative overflow-hidden">
            {/* Subtle gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-900 opacity-50" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl md:text-4xl">
                Ready to transform your reading?
              </h2>
              <p className="text-gray-400 font-body mt-4 max-w-lg mx-auto">
                Join thousands of readers who've already made the switch to a
                better newsletter experience.
              </p>
              <button className="mt-8 bg-white text-gray-900 px-8 py-3.5 rounded-full font-body font-medium hover:bg-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                Start Reading Better
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-400 text-sm font-body">
              © 2025 Hushletter
            </div>
            <div className="flex gap-6 text-sm font-body">
              <a
                href="#"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                Privacy
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                Terms
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                Twitter
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
