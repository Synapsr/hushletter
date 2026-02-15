import { m } from "@/paraglide/messages.js";
import { Star } from "lucide-react";
import { IconCarambolaFilled } from "@tabler/icons-react";

const testimonials = [
  {
    bgClass: "bg-violet-100",
    avatarClass: "bg-violet-300",
    quoteKey: "landing_testimonial1Quote" as const,
    nameKey: "landing_testimonial1Name" as const,
    roleKey: "landing_testimonial1Role" as const,
  },
  {
    bgClass: "bg-blue-100",
    avatarClass: "bg-blue-300",
    quoteKey: "landing_testimonial2Quote" as const,
    nameKey: "landing_testimonial2Name" as const,
    roleKey: "landing_testimonial2Role" as const,
  },
  {
    bgClass: "bg-emerald-100",
    avatarClass: "bg-emerald-300",
    quoteKey: "landing_testimonial3Quote" as const,
    nameKey: "landing_testimonial3Name" as const,
    roleKey: "landing_testimonial3Role" as const,
  },
];

export function LandingSocialProof() {
  return (
    <>
      {/* Wave divider */}
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
            {m.landing_socialProofTitle()}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.nameKey} className={`bg-sheer rounded-2xl p-6`}>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <IconCarambolaFilled
                      key={i}
                      className="size-5 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">"{m[t.quoteKey]()}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${t.avatarClass}`} />
                  <div>
                    <div className="font-semibold text-gray-900">
                      {m[t.nameKey]()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {m[t.roleKey]()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reverse wave */}
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
    </>
  );
}
