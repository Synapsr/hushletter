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
    style: {
      top: "10%",
      left: "5%",
      "--rotate": "-15deg",
      "--duration": "6s",
    } as React.CSSProperties,
  },
  {
    className: "absolute w-12 h-12 text-gray-900 opacity-8 animate-float-2",
    style: {
      top: "20%",
      right: "8%",
      "--rotate": "20deg",
      "--duration": "7s",
    } as React.CSSProperties,
  },
  {
    className: "absolute w-6 h-6 text-gray-900 opacity-12 animate-float-3",
    style: {
      top: "60%",
      left: "10%",
      "--rotate": "10deg",
      "--duration": "8s",
    } as React.CSSProperties,
  },
  {
    className: "absolute w-10 h-10 text-gray-900 opacity-10 animate-float-1",
    style: {
      top: "70%",
      right: "15%",
      "--rotate": "-10deg",
      "--duration": "9s",
    } as React.CSSProperties,
  },
  {
    className: "absolute w-7 h-7 text-gray-900 opacity-15 animate-float-2",
    style: {
      top: "40%",
      right: "3%",
      "--rotate": "15deg",
      "--duration": "6.5s",
    } as React.CSSProperties,
  },
  {
    className: "absolute w-9 h-9 text-gray-900 opacity-8 animate-float-3",
    style: {
      bottom: "15%",
      left: "8%",
      "--rotate": "-20deg",
      "--duration": "7.5s",
    } as React.CSSProperties,
  },
];

export function LandingHero() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {floatingEnvelopes.map((envelope, i) => (
        <EnvelopeIcon
          key={i}
          className={envelope.className}
          style={envelope.style}
        />
      ))}

      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side */}
          <div className="space-y-6">
            {/*  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100">
              <span className="text-sm">{m.landing_heroBadge()}</span>
            </div> */}

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] text-gray-900">
              {m.landing_heroTitle()}
              <span className="wavy-underline">
                {m.landing_heroTitleHighlight()}
              </span>
              {m.landing_heroTitleEnd()}
            </h1>

            <p className="font-body text-lg text-gray-500 max-w-xl">
              {m.landing_heroSubtitle()}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <LandingButton render={<a href="#start" />} className="group">
                {m.landing_heroCtaPrimary()}
                <span className="inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </LandingButton>
              <LandingButton variant="secondary" render={<a href="#demo" />}>
                {m.landing_heroCtaSecondary()}
              </LandingButton>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span>{" "}
                {m.landing_heroCheckFree()}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span>{" "}
                {m.landing_heroCheckNoSpam()}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span>{" "}
                {m.landing_heroCheckSetup()}
              </span>
            </div>
          </div>

          {/* Right side - Inbox Mockup */}
          <div className="relative">
            <img
              src="/images/landing-hero-3.webp"
              alt="Hero Mockup"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
