import { motion, useDragControls } from "motion/react";
import { Button, ScrollArea, SparklesIcon } from "@hushletter/ui";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { AlertCircle, GripVertical, X } from "lucide-react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { SummaryPanel } from "@/components/SummaryPanel";
import { m } from "@/paraglide/messages.js";

interface FloatingSummaryPanelProps {
  userNewsletterId: Id<"userNewsletters">;
  onClose: () => void;
  /** Ref to the constraint container (parent wrapper) */
  constraintsRef: React.RefObject<HTMLDivElement | null>;
}

function SummaryErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle
          className="size-4 text-destructive/70"
          aria-hidden="true"
        />
      </div>
      <p className="text-[13px] text-muted-foreground">
        {m.summaryPanel_errorTitle()}
      </p>
      <Button size="sm" variant="outline" onClick={resetErrorBoundary}>
        {m.common_tryAgain()}
      </Button>
    </div>
  );
}

export function FloatingSummaryPanel({
  userNewsletterId,
  onClose,
  constraintsRef,
}: FloatingSummaryPanelProps) {
  const dragControls = useDragControls();

  return (
    <motion.div
      className="absolute top-20 right-6 z-40 w-[360px] max-h-[60vh] origin-top-right"
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      role="complementary"
      aria-label={m.floatingSummary_toggle()}
    >
      <motion.div
        className="max-h-[60vh] rounded-2xl border border-border/60 bg-card/95 text-card-foreground shadow-xl shadow-black/8 backdrop-blur-xl flex flex-col overflow-hidden will-change-transform transform-gpu dark:bg-card/90 dark:shadow-black/20"
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintsRef}
        dragElastic={0.15}
        dragMomentum={false}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
        style={{ cursor: "default" }}
      >
        {/* Drag handle header */}
        <div
          className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/40 cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={(e: React.PointerEvent) => {
            e.preventDefault();
            dragControls.start(e);
          }}
        >
          <div className="flex items-center gap-2">
            {/* <GripVertical
              className="size-3.5 text-muted-foreground/40"
              aria-hidden="true"
            /> */}
            <div className="flex items-center gap-1.5">
              <SparklesIcon
                className="size-3.5 text-muted-foreground/60"
                aria-hidden="true"
              />
              <span className="text-[13px] font-medium text-foreground/80">
                {m.summaryPanel_aiSummary()}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label={m.floatingSummary_close()}
            className="text-muted-foreground/50 hover:text-foreground"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <ScrollArea scrollFade scrollbarGutter={false}>
          <ErrorBoundary FallbackComponent={SummaryErrorFallback}>
            <SummaryPanel
              userNewsletterId={userNewsletterId}
              className="mb-0 border-0 shadow-none rounded-none"
            />
          </ErrorBoundary>
        </ScrollArea>
      </motion.div>
    </motion.div>
  );
}
