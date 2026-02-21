import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Smile, Sparkles, Inbox, Heart, Star, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/{-$locale}/4")({
  component: Design4,
});

function Design4() {
  return (
    <div className="min-h-screen bg-[#FFF9F2] text-stone-800 font-sans overflow-hidden">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap');
          
          .font-title { font-family: 'Outfit', sans-serif; }
          .font-body { font-family: 'Quicksand', sans-serif; }

          .blob {
            border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
            animation: morph 8s ease-in-out infinite both alternate;
          }

          @keyframes morph {
            0%, 100% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
            34% { border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%; }
            67% { border-radius: 100% 60% 60% 100% / 100% 100% 60% 60%; }
          }
          
          .btn-pop {
            box-shadow: 0 4px 0 0 rgba(0,0,0,1);
            transition: all 0.15s ease;
          }
          .btn-pop:active {
            box-shadow: 0 0px 0 0 rgba(0,0,0,1);
            transform: translateY(4px);
          }
        `}
      </style>

      {/* Decorative Background Blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="blob absolute -top-40 -left-40 w-96 h-96 bg-[#FFE4D6] opacity-60"></div>
        <div className="blob absolute top-1/4 -right-20 w-80 h-80 bg-[#E6F4F1] opacity-60" style={{ animationDelay: '-2s' }}></div>
        <div className="blob absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[#F3E8FF] opacity-60" style={{ animationDelay: '-4s' }}></div>
      </div>

      {/* Navbar */}
      <header className="relative z-10 px-6 py-6 max-w-6xl mx-auto flex justify-between items-center">
        <div className="font-title font-bold text-2xl tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 bg-stone-900 rounded-xl flex items-center justify-center rotate-3">
            <Heart className="w-4 h-4 text-[#FFF9F2] fill-current" />
          </div>
          Hushletter
        </div>
        <div className="flex items-center gap-4 font-body font-bold">
          <button className="text-stone-500 hover:text-stone-900">Login</button>
          <button className="btn-pop bg-[#FFB8D0] border-2 border-stone-900 text-stone-900 px-5 py-2 rounded-xl">
            Sign Up
          </button>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO SECTION */}
        <section className="px-6 pt-20 pb-32 max-w-5xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border-2 border-stone-900 shadow-[2px_2px_0_0_rgba(0,0,0,1)] font-body font-bold text-sm mb-8 rotate-[-2deg]"
          >
            <Star className="w-4 h-4 text-[#FFD166] fill-current" />
            Make reading fun again!
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="font-title text-5xl md:text-7xl lg:text-8xl font-black leading-[1.1] mb-6 text-stone-900"
          >
            Your newsletters, <br />
            <span className="relative inline-block">
              <span className="relative z-10">without the mess.</span>
              <svg className="absolute -bottom-2 left-0 w-full h-4 text-[#C1E1C1] -z-10" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="M0,10 Q50,20 100,10" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round"/>
              </svg>
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="font-body text-xl text-stone-600 max-w-2xl mx-auto mb-10 font-medium"
          >
            A cozy, dedicated inbox for your favorite reads. Every creator gets their own cute folder. Goodbye, spam!
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: "spring", bounce: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button className="btn-pop bg-[#C1E1C1] border-2 border-stone-900 text-stone-900 px-8 py-4 rounded-2xl font-title font-bold text-lg flex items-center gap-2">
              Start Reading
              <ArrowRight className="w-5 h-5" />
            </button>
            <span className="font-body text-stone-500 font-medium text-sm">It's free to try!</span>
          </motion.div>

          {/* Cute App Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, type: "spring", bounce: 0.3 }}
            className="mt-20 relative mx-auto max-w-3xl"
          >
            <div className="absolute -inset-1 bg-stone-900 rounded-3xl translate-y-3 translate-x-3 z-0"></div>
            <div className="relative z-10 bg-white border-2 border-stone-900 rounded-3xl p-4 sm:p-6 flex flex-col h-[400px]">
              {/* Window Bar */}
              <div className="flex gap-2 border-b-2 border-stone-100 pb-4 mb-4">
                <div className="w-4 h-4 rounded-full bg-[#FFB8D0] border-2 border-stone-900"></div>
                <div className="w-4 h-4 rounded-full bg-[#FFD166] border-2 border-stone-900"></div>
                <div className="w-4 h-4 rounded-full bg-[#C1E1C1] border-2 border-stone-900"></div>
              </div>
              
              <div className="flex flex-1 gap-6">
                {/* Folders */}
                <div className="w-1/3 flex flex-col gap-3">
                  <div className="bg-[#F3E8FF] border-2 border-stone-900 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border-2 border-stone-900 flex items-center justify-center">💌</div>
                    <div className="h-2 w-12 bg-stone-900 rounded-full"></div>
                  </div>
                  <div className="bg-white border-2 border-stone-200 rounded-xl p-3 flex items-center gap-3 opacity-60">
                    <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">🎨</div>
                    <div className="h-2 w-16 bg-stone-300 rounded-full"></div>
                  </div>
                  <div className="bg-white border-2 border-stone-200 rounded-xl p-3 flex items-center gap-3 opacity-60">
                    <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">🚀</div>
                    <div className="h-2 w-10 bg-stone-300 rounded-full"></div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-[#FFF9F2] border-2 border-stone-900 rounded-2xl p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4">
                     <div className="w-16 h-16 bg-[#FFD166] rounded-full blur-2xl opacity-50"></div>
                   </div>
                   <div className="space-y-4 relative z-10">
                     <div className="h-4 w-3/4 bg-stone-900 rounded-full mb-8"></div>
                     <div className="h-2 w-full bg-stone-300 rounded-full"></div>
                     <div className="h-2 w-full bg-stone-300 rounded-full"></div>
                     <div className="h-2 w-5/6 bg-stone-300 rounded-full"></div>
                     <div className="h-2 w-full bg-stone-300 rounded-full mt-6"></div>
                     <div className="h-2 w-2/3 bg-stone-300 rounded-full"></div>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* FEATURES */}
        <section className="py-24 px-6 relative">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-title text-4xl md:text-5xl font-black text-center mb-16">
              Why you'll love it
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: "One Happy Place", icon: <Inbox />, color: "bg-[#FFB8D0]" },
                { title: "Smart Sorting", icon: <Sparkles />, color: "bg-[#FFD166]" },
                { title: "Peace of Mind", icon: <Smile />, color: "bg-[#C1E1C1]" }
              ].map((feat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.2, type: "spring", bounce: 0.4 }}
                  whileHover={{ y: -10 }}
                  className="bg-white border-2 border-stone-900 rounded-3xl p-8 shadow-[4px_4px_0_0_rgba(0,0,0,1)] text-center group cursor-pointer"
                >
                  <div className={`w-16 h-16 mx-auto rounded-2xl ${feat.color} border-2 border-stone-900 flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform`}>
                    <div className="text-stone-900">{feat.icon}</div>
                  </div>
                  <h3 className="font-title font-bold text-2xl mb-3">{feat.title}</h3>
                  <p className="font-body font-medium text-stone-600">
                    We keep everything tidy so you can just sit back, relax, and read.
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-24 px-6 bg-stone-900 text-white rounded-[3rem] mx-4 md:mx-10 mb-20 relative overflow-hidden">
          {/* Decorative squiggles */}
          <svg className="absolute top-10 right-10 w-24 h-24 text-[#FFD166]" viewBox="0 0 100 100">
            <path d="M10,50 Q25,25 50,50 T90,50" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/>
          </svg>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="font-title text-4xl md:text-5xl font-black mb-16">
              Easy as 1, 2, 3!
            </h2>

            <div className="flex flex-col md:flex-row justify-between items-center gap-12">
              {[
                { num: "1", text: "Get an address" },
                { num: "2", text: "Subscribe" },
                { num: "3", text: "Read happily" }
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-[#FFF9F2] text-stone-900 rounded-full font-title font-black text-2xl flex items-center justify-center mb-4 rotate-[-6deg]">
                    {step.num}
                  </div>
                  <div className="font-body font-bold text-xl">{step.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-12 text-center">
          <div className="font-title font-bold text-2xl mb-4 flex items-center justify-center gap-2">
            <Heart className="w-5 h-5 text-[#FFB8D0] fill-current" />
            Hushletter
          </div>
          <div className="font-body font-medium text-stone-500">
            Made with love and joy.
          </div>
        </footer>
      </main>
    </div>
  );
}
