import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/{-$locale}/5")({
  component: Design5,
});

// Helper hook for intersection observer
function useInView(options = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, isInView] as const;
}

// Helper hook for animated counter
function useCounter(end: number, duration = 2000, isInView = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [end, duration, isInView]);

  return count;
}

// Envelope icon component
function EnvelopeIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  );
}

// Envelope with heart icon for header
function EnvelopeWithHeartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 7l10 7 10-7" />
      <path d="M14 11c0-1.1.9-2 2-2s2 .9 2 2c0 1.5-2 3-2 3s-2-1.5-2-3z" fill="currentColor" />
    </svg>
  );
}

function Design5() {
  const [featuresRef, featuresInView] = useInView({ threshold: 0.1 });
  const [statsRef, statsInView] = useInView({ threshold: 0.3 });

  const stat1 = useCounter(50, 2000, statsInView);
  const stat2 = useCounter(2, 2000, statsInView);
  const stat3 = useCounter(500, 2000, statsInView);

  return (
    <div className="min-h-screen bg-white font-body antialiased">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700&display=swap');

          .font-display {
            font-family: 'Bricolage Grotesque', sans-serif;
          }

          .font-body {
            font-family: 'Nunito', sans-serif;
          }

          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes float-envelope-1 {
            0%, 100% { transform: translateY(0) rotate(var(--rotate, 0deg)); }
            25% { transform: translateY(-15px) rotate(calc(var(--rotate, 0deg) + 3deg)); }
            75% { transform: translateY(10px) rotate(calc(var(--rotate, 0deg) - 2deg)); }
          }

          @keyframes float-envelope-2 {
            0%, 100% { transform: translateY(0) rotate(var(--rotate, 0deg)); }
            33% { transform: translateY(-10px) rotate(calc(var(--rotate, 0deg) - 4deg)); }
            66% { transform: translateY(8px) rotate(calc(var(--rotate, 0deg) + 2deg)); }
          }

          @keyframes float-envelope-3 {
            0%, 100% { transform: translateY(0) rotate(var(--rotate, 0deg)); }
            50% { transform: translateY(-12px) rotate(calc(var(--rotate, 0deg) + 5deg)); }
          }

          @keyframes bounce-subtle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }

          @keyframes wiggle {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(2deg); }
            75% { transform: rotate(-2deg); }
          }

          @keyframes wave-dash {
            to { stroke-dashoffset: -20; }
          }

          .animate-bounce-subtle {
            animation: bounce-subtle 2s ease-in-out infinite;
          }

          .animate-fade-in-up {
            animation: fadeInUp 0.6s ease-out forwards;
            opacity: 0;
          }

          .animate-float-1 {
            animation: float-envelope-1 var(--duration, 12s) ease-in-out infinite;
          }

          .animate-float-2 {
            animation: float-envelope-2 var(--duration, 14s) ease-in-out infinite;
          }

          .animate-float-3 {
            animation: float-envelope-3 var(--duration, 16s) ease-in-out infinite;
          }

          .wavy-underline {
            position: relative;
          }

          .wavy-underline::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: -4px;
            height: 8px;
            background-image: url("data:image/svg+xml,%3Csvg width='100' height='8' viewBox='0 0 100 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 4C10 0 20 8 30 4C40 0 50 8 60 4C70 0 80 8 90 4C95 2 98 4 100 4' stroke='%23fbbf24' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
            background-repeat: repeat-x;
            background-size: 100px 8px;
            animation: wave-dash 1s linear infinite;
          }
        `}
      </style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <EnvelopeWithHeartIcon className="w-7 h-7 text-gray-900" />
            <span className="font-display text-lg font-semibold lowercase text-gray-900">
              hushletter
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-sm font-body text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5">
              Sign in
            </button>
            <button className="bg-gray-900 text-white px-5 py-2 rounded-full text-sm font-body font-medium hover:bg-gray-800 hover:shadow-lg hover:scale-105 transition-all duration-300 active:scale-95">
              Try it free
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-32 relative overflow-hidden">
        {/* Floating Envelopes */}
        <EnvelopeIcon
          className="absolute top-16 left-[10%] w-8 h-8 text-gray-300 opacity-10 animate-float-1"
          style={{ "--rotate": "12deg", "--duration": "12s" } as React.CSSProperties}
        />
        <EnvelopeIcon
          className="absolute top-32 right-[15%] w-12 h-12 text-gray-400 opacity-[0.08] animate-float-2"
          style={{ "--rotate": "-8deg", "--duration": "16s" } as React.CSSProperties}
        />
        <EnvelopeIcon
          className="absolute bottom-24 left-[20%] w-6 h-6 text-gray-300 opacity-[0.12] animate-float-3"
          style={{ "--rotate": "20deg", "--duration": "10s" } as React.CSSProperties}
        />
        <EnvelopeIcon
          className="absolute top-1/2 right-[8%] w-10 h-10 text-gray-400 opacity-[0.09] animate-float-1"
          style={{ "--rotate": "-15deg", "--duration": "14s" } as React.CSSProperties}
        />
        <EnvelopeIcon
          className="absolute top-[20%] left-[40%] w-7 h-7 text-gray-300 opacity-[0.11] animate-float-2"
          style={{ "--rotate": "5deg", "--duration": "18s" } as React.CSSProperties}
        />
        <EnvelopeIcon
          className="absolute bottom-[30%] right-[30%] w-9 h-9 text-gray-400 opacity-[0.1] animate-float-3"
          style={{ "--rotate": "-10deg", "--duration": "11s" } as React.CSSProperties}
        />
        <EnvelopeIcon
          className="absolute top-[60%] left-[8%] w-11 h-11 text-gray-300 opacity-[0.08] animate-float-1"
          style={{ "--rotate": "15deg", "--duration": "15s" } as React.CSSProperties}
        />
        <EnvelopeIcon
          className="absolute bottom-16 right-[45%] w-6 h-6 text-gray-400 opacity-[0.15] animate-float-2"
          style={{ "--rotate": "-5deg", "--duration": "20s" } as React.CSSProperties}
        />

        {/* Content */}
        <div className="relative z-10 text-center max-w-2xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm font-body text-gray-600 mb-6 animate-bounce-subtle">
            <span>📬</span>
            <span>Your newsletters deserve better</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
            All your
            <br />
            newsletters,
            <br />
            one <span className="wavy-underline">happy</span> inbox.
          </h1>

          <p className="font-body text-lg text-gray-500 mt-6 max-w-md mx-auto leading-relaxed">
            Get a dedicated email just for newsletters. Subscribe everywhere. Read
            everything in one cozy spot.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <button className="bg-gray-900 text-white px-7 py-3 rounded-full font-body font-semibold text-base hover:bg-gray-800 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 active:scale-[0.98] flex items-center gap-2 group">
              <span>Get started</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
            <button className="bg-gray-100 text-gray-700 px-7 py-3 rounded-full font-body font-medium text-base hover:bg-gray-200 transition-all duration-300">
              See how it works
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-400 font-body">
            <span>✓ Free forever</span>
            <span>✓ No spam</span>
            <span>✓ 30s setup</span>
          </div>
        </div>
      </section>

      {/* Wave Divider */}
      <svg
        viewBox="0 0 1440 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto -mb-1"
      >
        <path
          d="M0 32C240 0 480 64 720 32C960 0 1200 64 1440 32V64H0V32Z"
          fill="currentColor"
          className="text-gray-50"
        />
      </svg>

      {/* Features Section */}
      <section className="bg-gray-50 py-20" ref={featuresRef}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900">
              What makes it special
            </h2>
            <p className="text-gray-500 font-body mt-3">
              Everything you need to fall in love with newsletters
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                icon: "📮",
                bg: "bg-violet-50",
                title: "Your own email",
                description:
                  "Get a unique @hushletter.com address that's just for newsletters. No more mixing personal and subscription emails.",
                delay: 0,
              },
              {
                icon: "✨",
                bg: "bg-blue-50",
                title: "AI summaries",
                description:
                  "Too busy to read? Get smart summaries of any newsletter in seconds. Dive deeper when you want.",
                delay: 100,
                offset: true,
              },
              {
                icon: "📁",
                bg: "bg-emerald-50",
                title: "Smart Folders",
                description:
                  "Every sender gets its own folder automatically. Merge folders into custom collections that fit your workflow.",
                delay: 200,
              },
              {
                icon: "🔍",
                bg: "bg-amber-50",
                title: "Search everything",
                description:
                  "Find that article from three months ago in an instant. Full-text search across all your newsletters.",
                delay: 300,
                offset: true,
              },
              {
                icon: "📊",
                bg: "bg-rose-50",
                title: "Reading insights",
                badge: "Coming soon",
                description:
                  "See how you read. Track your habits, discover patterns, and make the most of your reading time.",
                delay: 400,
              },
              {
                icon: "👥",
                bg: "bg-cyan-50",
                title: "Community picks",
                badge: "Coming soon",
                description:
                  "Discover what others love. See trending newsletters and get recommendations from the community.",
                delay: 500,
                offset: true,
              },
            ].map((feature, index) => (
              <div
                key={index}
                className={`bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:-translate-y-2 hover:border-gray-200 transition-all duration-500 cursor-pointer group ${
                  feature.offset ? "md:translate-y-4" : ""
                } ${featuresInView ? "animate-fade-in-up" : ""}`}
                style={
                  featuresInView
                    ? ({ animationDelay: `${feature.delay}ms` } as React.CSSProperties)
                    : undefined
                }
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${feature.bg}`}
                >
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-display font-bold text-gray-900 text-lg">
                    {feature.title}
                  </h3>
                  {feature.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-medium text-gray-400 uppercase tracking-wide font-body">
                      {feature.badge}
                    </span>
                  )}
                </div>
                <p className="font-body text-sm text-gray-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reverse Wave Divider */}
      <svg
        viewBox="0 0 1440 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto -mb-1 rotate-180"
      >
        <path
          d="M0 32C240 0 480 64 720 32C960 0 1200 64 1440 32V64H0V32Z"
          fill="currentColor"
          className="text-gray-50"
        />
      </svg>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-center font-display text-3xl font-bold mb-16 text-gray-900">
            Super simple to start
          </h2>

          <div className="space-y-0">
            {[
              {
                number: "1",
                title: "Grab your email",
                description:
                  "Sign up in seconds and get your very own @hushletter.com address. It's yours forever.",
                visual: (
                  <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100 text-xs font-body text-gray-600 mt-2">
                    you@hushletter.com
                  </div>
                ),
                hasLine: true,
              },
              {
                number: "2",
                title: "Subscribe to everything",
                description:
                  "Use your Hushletter email to subscribe to newsletters everywhere — Substack, Mailchimp, Beehiiv, anything.",
                visual: (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className="px-3 py-1 rounded-full bg-violet-50 text-xs font-body text-violet-700">
                      Substack
                    </div>
                    <div className="px-3 py-1 rounded-full bg-blue-50 text-xs font-body text-blue-700">
                      Mailchimp
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-50 text-xs font-body text-emerald-700">
                      Beehiiv
                    </div>
                  </div>
                ),
                hasLine: true,
              },
              {
                number: "3",
                title: "Read & enjoy",
                description:
                  "All your newsletters arrive in your beautiful inbox. Read, search, organize, and discover — all in one place.",
                visual: (
                  <div className="mt-3 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded-full w-3/4"></div>
                    <div className="h-3 bg-gray-100 rounded-full w-full"></div>
                    <div className="h-3 bg-gray-100 rounded-full w-2/3"></div>
                  </div>
                ),
                hasLine: false,
              },
            ].map((step, index) => (
              <div key={index} className="flex items-start gap-6 text-left mb-12 last:mb-0 relative">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-gray-900 text-white font-display font-bold text-xl flex items-center justify-center shadow-lg">
                    {step.number}
                  </div>
                  {step.hasLine && (
                    <div className="absolute left-7 top-14 w-px h-12 border-l-2 border-dashed border-gray-200"></div>
                  )}
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="font-display font-bold text-lg text-gray-900">
                    {step.title}
                  </h3>
                  <p className="font-body text-gray-500 mt-1 text-sm leading-relaxed">
                    {step.description}
                  </p>
                  {step.visual}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave Divider */}
      <svg
        viewBox="0 0 1440 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto -mb-1"
      >
        <path
          d="M0 32C240 0 480 64 720 32C960 0 1200 64 1440 32V64H0V32Z"
          fill="currentColor"
          className="text-gray-50"
        />
      </svg>

      {/* Social Proof */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              People love it
            </h2>
            <p className="text-gray-500 font-body mt-2 text-sm">
              Don't just take our word for it
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                stars: "⭐⭐⭐⭐⭐",
                quote:
                  "I used to lose newsletters in my Gmail. Now they're all in one beautiful place. It's like Marie Kondo for my inbox!",
                avatar: "S",
                avatarBg: "bg-violet-100 text-violet-600",
                name: "Sarah K.",
                role: "Designer",
              },
              {
                stars: "⭐⭐⭐⭐⭐",
                quote:
                  "The AI summaries are incredible. I get through 20 newsletters at breakfast now. Absolute game-changer.",
                avatar: "J",
                avatarBg: "bg-blue-100 text-blue-600",
                name: "James M.",
                role: "Founder",
              },
              {
                stars: "⭐⭐⭐⭐⭐",
                quote:
                  "Finally, something that makes reading newsletters feel like a treat, not a chore. Gorgeous app.",
                avatar: "E",
                avatarBg: "bg-emerald-100 text-emerald-600",
                name: "Emma L.",
                role: "Writer",
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300"
              >
                <div className="text-sm mb-3">{testimonial.stars}</div>
                <p className="font-body text-gray-600 text-sm leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${testimonial.avatarBg}`}
                  >
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-body font-semibold text-sm text-gray-900">
                      {testimonial.name}
                    </div>
                    <div className="font-body text-xs text-gray-400">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reverse Wave Divider */}
      <svg
        viewBox="0 0 1440 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto -mb-1 rotate-180"
      >
        <path
          d="M0 32C240 0 480 64 720 32C960 0 1200 64 1440 32V64H0V32Z"
          fill="currentColor"
          className="text-gray-50"
        />
      </svg>

      {/* Stats Bar */}
      <section className="py-16 bg-white" ref={statsRef}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl font-extrabold text-gray-900">
                {stat1}K+
              </div>
              <div className="font-body text-xs text-gray-400 mt-1">Happy readers</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl font-extrabold text-gray-900">
                {stat2}M+
              </div>
              <div className="font-body text-xs text-gray-400 mt-1">Newsletters read</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl font-extrabold text-gray-900">
                {stat3}+
              </div>
              <div className="font-body text-xs text-gray-400 mt-1">Sources</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl font-extrabold text-gray-900">
                4.9★
              </div>
              <div className="font-body text-xs text-gray-400 mt-1">App rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6">
          <div className="bg-gray-900 rounded-3xl p-10 md:p-14 text-white relative overflow-hidden">
            {/* Decorative floating envelopes */}
            <EnvelopeIcon className="absolute top-6 right-8 w-10 h-10 text-white opacity-10 rotate-12" />
            <EnvelopeIcon className="absolute bottom-8 left-6 w-8 h-8 text-white opacity-10 rotate-[-20deg]" />
            <EnvelopeIcon className="absolute top-1/2 left-[15%] w-6 h-6 text-white opacity-10 rotate-[8deg]" />
            <EnvelopeIcon className="absolute bottom-12 right-[20%] w-7 h-7 text-white opacity-10 rotate-[-15deg]" />

            <div className="relative z-10 text-center">
              <h2 className="font-display text-3xl md:text-4xl font-bold">
                Ready to fall in love with newsletters again?
              </h2>
              <p className="font-body text-gray-400 mt-3 text-base">
                Join thousands of happy readers who've found their newsletter home.
              </p>
              <button className="mt-8 bg-white text-gray-900 px-8 py-3.5 rounded-full font-body font-bold text-base hover:bg-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 active:scale-[0.98] inline-flex items-center gap-2 group">
                <span>Get started free</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <p className="mt-4 text-gray-500 text-xs font-body">
                Free forever · Setup in 30 seconds
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <EnvelopeIcon className="w-5 h-5 text-gray-400" />
              <span className="font-display font-semibold text-sm lowercase text-gray-400">
                hushletter
              </span>
            </div>
            <div className="hidden md:flex gap-6 text-xs text-gray-400 font-body">
              <a href="#" className="hover:text-gray-600 transition-colors">
                Features
              </a>
              <a href="#" className="hover:text-gray-600 transition-colors">
                Pricing
              </a>
              <a href="#" className="hover:text-gray-600 transition-colors">
                Blog
              </a>
              <a href="#" className="hover:text-gray-600 transition-colors">
                Support
              </a>
            </div>
            <div className="text-xs text-gray-300 font-body">© 2025 Hushletter</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
