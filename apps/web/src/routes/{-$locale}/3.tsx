import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/{-$locale}/3")({
  component: Design3,
});

function Design3() {
  const [mockupHovered, setMockupHovered] = useState(false);

  const emailList = [
    { sender: "Stratechery", subject: "The future of AI distribution", time: "Just now", unread: true, avatar: "S", color: "violet" },
    { sender: "The Pragmatic Engineer", subject: "How Big Tech runs engineering", time: "2h ago", unread: true, avatar: "P", color: "blue" },
    { sender: "Dense Discovery", subject: "Issue #289 — Creative tools", time: "4h ago", unread: false, avatar: "D", color: "emerald" },
    { sender: "Morning Brew", subject: "AI chips are getting wild", time: "6h ago", unread: false, avatar: "M", color: "amber" },
    { sender: "Lenny's Newsletter", subject: "The best growth tactics of 2025", time: "1d ago", unread: false, avatar: "L", color: "rose" },
    { sender: "TLDR", subject: "Tech news roundup for busy devs", time: "1d ago", unread: false, avatar: "T", color: "cyan" },
  ];

  const getAvatarColor = (color: string) => {
    const colors: Record<string, string> = {
      violet: "bg-violet-100 text-violet-700",
      blue: "bg-blue-100 text-blue-700",
      emerald: "bg-emerald-100 text-emerald-700",
      amber: "bg-amber-100 text-amber-700",
      rose: "bg-rose-100 text-rose-700",
      cyan: "bg-cyan-100 text-cyan-700",
    };
    return colors[color] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

        * {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }

        @keyframes float-medium {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-1.5deg); }
        }

        @keyframes float-fast {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 5s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; opacity: 0; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-900">Hushletter</span>
          </div>

          {/* Center: Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#integrations" className="hover:text-gray-900 transition-colors">Integrations</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#blog" className="hover:text-gray-900 transition-colors">Blog</a>
          </nav>

          {/* Right: CTAs */}
          <div className="flex items-center gap-3">
            <a href="#login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Log in</a>
            <a href="#signup" className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-800 transition-all">
              Start free →
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-32 relative overflow-hidden">
        {/* Centered text */}
        <div className="text-center max-w-3xl mx-auto px-6 relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Now with AI summaries
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 tracking-tight leading-[1.1]">
            All your newsletters.<br />
            One beautiful inbox.
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-gray-500 mt-5 max-w-xl mx-auto leading-relaxed">
            Get a dedicated email address, subscribe to your favorite newsletters, and read them all in a clean, focused space.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <a href="#signup" className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 hover:shadow-lg transition-all duration-300 flex items-center gap-2">
              Get started free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a href="#demo" className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300">
              Watch demo
            </a>
          </div>
        </div>

        {/* App Mockup */}
        <div className="mt-16 relative max-w-5xl mx-auto px-6">
          <div style={{ perspective: '1200px' }}>
            <div
              className="transition-all duration-700"
              style={{
                transform: mockupHovered ? 'rotateX(2deg)' : 'rotateX(8deg)',
              }}
              onMouseEnter={() => setMockupHovered(true)}
              onMouseLeave={() => setMockupHovered(false)}
            >
              <div className="bg-white rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] border border-gray-200 overflow-hidden">
                {/* Top bar */}
                <div className="h-10 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200"></div>
                  </div>
                  <div className="ml-4 text-xs font-medium text-gray-700 border-b-2 border-gray-900 pb-2">
                    Inbox
                  </div>
                </div>

                {/* Main content */}
                <div className="flex h-[400px]">
                  {/* Sidebar */}
                  <div className="w-56 bg-gray-50/50 border-r border-gray-100 p-3">
                    {/* User */}
                    <div className="flex items-center gap-2 mb-4 px-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-[10px] font-semibold text-white">
                        ME
                      </div>
                      <span className="text-xs font-medium text-gray-700">My Inbox</span>
                    </div>

                    {/* Folder nav */}
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-3 mb-1">Folders</div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm bg-white shadow-sm">
                        <span className="text-gray-900 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-900" />All</span>
                        <span className="text-xs text-gray-400">24</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" />Stratechery</span>
                        <span className="text-xs text-gray-400">3</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Pragmatic Eng.</span>
                        <span className="text-xs text-gray-400">5</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Dense Discovery</span>
                        <span className="text-xs text-gray-400">4</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Morning Brew</span>
                        <span className="text-xs text-gray-400">6</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Lenny's</span>
                        <span className="text-xs text-gray-400">3</span>
                      </div>
                    </div>
                  </div>

                  {/* Email list */}
                  <div className="flex-1">
                    {emailList.map((email, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      >
                        <div className={`w-9 h-9 rounded-full ${getAvatarColor(email.color)} flex items-center justify-center text-xs font-semibold shrink-0`}>
                          {email.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm ${email.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'} truncate`}>
                              {email.sender}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">{email.time}</span>
                          </div>
                          <div className={`text-xs ${email.unread ? 'text-gray-700' : 'text-gray-500'} truncate mt-0.5`}>
                            {email.subject}
                          </div>
                        </div>
                        {email.unread && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Gradient fade */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Floating feature badges */}
          <div className="absolute -top-8 -right-8 animate-float-slow">
            <div className="bg-white shadow-lg rounded-full px-4 py-2 text-sm font-medium border border-gray-100">
              AI Summaries ✨
            </div>
          </div>
          <div className="absolute bottom-12 -left-4 animate-float-medium">
            <div className="bg-white shadow-lg rounded-full px-4 py-2 text-sm font-medium border border-gray-100">
              Smart Folders
            </div>
          </div>
          <div className="absolute top-1/2 -right-12 -translate-y-1/2 animate-float-fast">
            <div className="bg-white shadow-lg rounded-full px-4 py-2 text-sm font-medium border border-gray-100">
              500+ sources
            </div>
          </div>
        </div>
      </section>

      {/* Logos/Trust Section */}
      <section className="py-16 border-y border-gray-100">
        <p className="text-sm text-gray-400 text-center mb-8">Loved by readers of</p>
        <div className="flex items-center justify-center gap-8 md:gap-12 flex-wrap px-6">
          {["Stratechery", "Morning Brew", "The Hustle", "TLDR", "Dense Discovery", "Lenny's"].map((name) => (
            <span key={name} className="text-lg font-semibold text-gray-300 hover:text-gray-500 transition-colors cursor-default">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-gray-400 mb-3">FEATURES</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Everything you need to read better</h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto">
              A complete newsletter reading experience, built for the modern reader
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature 1 */}
            <div className="bg-gray-50 rounded-2xl p-6 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-gray-100 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Unified Inbox</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Every newsletter in one place. No more switching between email clients.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-50 rounded-2xl p-6 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-gray-100 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">AI Summaries</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Get instant summaries of long newsletters. Read the full version when you want.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-50 rounded-2xl p-6 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-gray-100 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Folders</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Every sender gets its own folder. Merge folders into custom collections for your workflow.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-gray-50 rounded-2xl p-6 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-gray-100 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Powerful Search</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Search across all your newsletters. Find that article you bookmarked months ago.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-gray-50 rounded-2xl p-6 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-gray-100 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">Reading Insights</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-[10px] font-medium text-gray-400 uppercase tracking-wide">Soon</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Track your reading habits. See which newsletters you engage with most.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-gray-50 rounded-2xl p-6 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-gray-100 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">Community</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-[10px] font-medium text-gray-400 uppercase tracking-wide">Soon</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Discover what others are reading. Share recommendations with friends.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900">Get started in 30 seconds</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 left-[20%] right-[20%] border-t-2 border-dashed border-gray-200"></div>

            {/* Step 1 */}
            <div>
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto text-xl font-bold text-gray-900 relative z-10 border border-gray-100">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mt-5">Get your address</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-[220px] mx-auto">
                Sign up and get your unique @hushletter.com email address
              </p>
            </div>

            {/* Step 2 */}
            <div>
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto text-xl font-bold text-gray-900 relative z-10 border border-gray-100">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mt-5">Subscribe</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-[220px] mx-auto">
                Use your Hushletter email to subscribe to any newsletter you love
              </p>
            </div>

            {/* Step 3 */}
            <div>
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto text-xl font-bold text-gray-900 relative z-10 border border-gray-100">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mt-5">Enjoy reading</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-[220px] mx-auto">
                All newsletters arrive in your clean, beautiful inbox
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">What people are saying</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Testimonial 1 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                Finally, a newsletter reader that doesn't feel like another email client. The reading experience is unmatched.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600">
                  SC
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">Sarah Chen</div>
                  <div className="text-xs text-gray-400">Product Designer at Figma</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                I subscribe to 30+ newsletters and Hushletter makes it manageable. The AI summaries are a game-changer.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600">
                  JP
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">James Park</div>
                  <div className="text-xs text-gray-400">Engineering Lead</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                Clean, fast, and exactly what I needed. I actually read my newsletters now instead of letting them pile up.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600">
                  MS
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">Maria Santos</div>
                  <div className="text-xs text-gray-400">Content Strategist</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="bg-gray-900 rounded-3xl p-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-950"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold">Ready to clean up your inbox?</h2>
              <p className="text-gray-400 mt-4 max-w-md mx-auto">
                Join thousands of readers who've already made the switch to a better newsletter experience.
              </p>
              <a href="#signup" className="mt-8 inline-flex bg-white text-gray-900 px-7 py-3 rounded-xl font-semibold text-sm hover:bg-gray-100 hover:shadow-xl transition-all duration-300">
                Get started for free
              </a>
              <p className="mt-4 text-gray-500 text-xs">Free forever · No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-6 h-6 rounded-lg bg-gray-900 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span>Hushletter</span>
            <span>·</span>
            <span>© 2025</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#twitter" className="hover:text-gray-600 transition-colors">Twitter</a>
            <a href="#github" className="hover:text-gray-600 transition-colors">GitHub</a>
            <a href="#privacy" className="hover:text-gray-600 transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-gray-600 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
