import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { Button } from "@hushletter/ui";
import { Mail, FolderOpen, Compass, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/onboarding")({
  component: OnboardingPage,
});

// Type for getCurrentUser — convexQuery doesn't infer return types
type CurrentUserData = {
  id: string;
  email: string;
  name: string | null;
  dedicatedEmail: string | null;
  onboardingCompletedAt: number | null;
  createdAt: number | null;
} | null;

// ---------------------------------------------------------------------------
// CSS Keyframes (injected via <style> tag, same pattern as landing pages)
// ---------------------------------------------------------------------------
const keyframes = `
@keyframes onb-fade-in-up {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes onb-slide-out-left {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-40px); }
}
@keyframes onb-slide-in-right {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes onb-slide-out-right {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(40px); }
}
@keyframes onb-slide-in-left {
  from { opacity: 0; transform: translateX(-40px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes onb-check-pop {
  0% { opacity: 0; transform: scale(0.5); }
  60% { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
}
`;

// ---------------------------------------------------------------------------
// Main Onboarding Page
// ---------------------------------------------------------------------------
function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Check if onboarding already completed — redirect to newsletters
  const { data: currentUserData } = useQuery(convexQuery(api.auth.getCurrentUser, {}));
  const currentUser = currentUserData as CurrentUserData | undefined;

  useEffect(() => {
    if (currentUser?.onboardingCompletedAt) {
      navigate({ to: "/newsletters" });
    }
  }, [currentUser?.onboardingCompletedAt, navigate]);

  const goToStep = useCallback((target: 1 | 2) => {
    if (isTransitioning) return;
    setDirection(target > step ? "forward" : "backward");
    setIsTransitioning(true);

    // Wait for exit animation, then swap step
    setTimeout(() => {
      setStep(target);
      setAnimKey((k) => k + 1);
      setIsTransitioning(false);
    }, 280);
  }, [isTransitioning, step]);

  // Determine animation style based on transition state
  const getStepAnimationStyle = (): CSSProperties => {
    if (isTransitioning) {
      return {
        animation: direction === "forward"
          ? "onb-slide-out-left 280ms ease-in forwards"
          : "onb-slide-out-right 280ms ease-in forwards",
      };
    }
    if (animKey === 0) return {}; // Initial mount — no transition animation
    return {
      animation: direction === "forward"
        ? "onb-slide-in-right 400ms ease-out both"
        : "onb-slide-in-left 400ms ease-out both",
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 pt-[18vh] overflow-auto">
      <style>{keyframes}</style>

      <div
        className="w-full max-w-lg"
        style={{ animation: "onb-fade-in-up 600ms ease-out both" }}
      >
        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {m.onboarding_step({ current: String(step), total: "2" })}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-10 mx-auto max-w-[120px] h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500 ease-out"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>

        {/* Step content with transition animations */}
        <div key={animKey} style={getStepAnimationStyle()}>
          {step === 1 ? (
            <StepWelcome onNext={() => goToStep(2)} />
          ) : (
            <StepChoosePrefix
              onBack={() => goToStep(1)}
              dedicatedEmail={currentUser?.dedicatedEmail ?? null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Welcome / How it works
// ---------------------------------------------------------------------------
function StepWelcome({ onNext }: { onNext: () => void }) {
  const features = [
    {
      icon: Mail,
      title: m.onboarding_featureReceiveTitle(),
      description: m.onboarding_featureReceiveDescription(),
      delay: 0,
    },
    {
      icon: FolderOpen,
      title: m.onboarding_featureOrganizeTitle(),
      description: m.onboarding_featureOrganizeDescription(),
      delay: 120,
    },
    {
      icon: Compass,
      title: m.onboarding_featureDiscoverTitle(),
      description: m.onboarding_featureDiscoverDescription(),
      delay: 240,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
        className="text-center space-y-2"
        style={{ animation: "onb-fade-in-up 600ms ease-out both" }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {m.onboarding_welcomeTitle()}
        </h1>
        <p className="text-muted-foreground text-sm">
          {m.onboarding_welcomeSubtitle()}
        </p>
      </div>

      {/* Feature cards */}
      <div className="space-y-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm"
            style={{
              animation: `onb-fade-in-up 500ms ease-out ${feature.delay}ms both`,
            }}
          >
            <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <feature.icon className="w-5 h-5 text-foreground/70" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {feature.title}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Next button */}
      <div
        className="flex justify-center pt-2"
        style={{ animation: "onb-fade-in-up 500ms ease-out 360ms both" }}
      >
        <Button
          onClick={onNext}
          className="min-w-[160px] gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {m.onboarding_nextButton()}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Choose email prefix
// ---------------------------------------------------------------------------
function StepChoosePrefix({
  onBack,
  dedicatedEmail,
}: {
  onBack: () => void;
  dedicatedEmail: string | null;
}) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const complete = useMutation(api.users.completeOnboarding);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await complete({});
      // Brief delay for success feel before redirect
      await new Promise((r) => setTimeout(r, 400));
      navigate({ to: "/newsletters" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
        className="text-center space-y-2"
        style={{ animation: "onb-fade-in-up 600ms ease-out both" }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {m.onboarding_chooseEmailTitle()}
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          {m.onboarding_chooseEmailDescription()}
        </p>
      </div>

      {/* Prefix input */}
      <div
        className="space-y-4"
        style={{ animation: "onb-fade-in-up 500ms ease-out 100ms both" }}
      >
        {/* Email preview */}
        <div
          className="rounded-xl border border-border/60 bg-muted/50 p-4 space-y-1.5"
          style={{ animation: "onb-fade-in-up 500ms ease-out 200ms both" }}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {m.onboarding_emailPreview()}
          </p>
          <p className="text-lg font-mono font-semibold text-foreground tracking-tight transition-all duration-200">
            {dedicatedEmail ?? "..."}
          </p>
          <p className="text-sm text-muted-foreground">
            Want a custom address? That’s available on Hushletter Pro in Settings.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div
        className="space-y-3 pt-2"
        style={{ animation: "onb-fade-in-up 500ms ease-out 300ms both" }}
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {m.onboarding_backButton()}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <Check className="w-4 h-4" />
            {m.onboarding_completeButton()}
          </Button>
        </div>

      </div>
    </div>
  );
}
