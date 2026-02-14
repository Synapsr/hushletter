import { motion, useDragControls } from "motion/react";
import { Button, ScrollArea } from "@hushletter/ui";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { X, GripVertical } from "lucide-react";
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
    <div className="p-4 text-center">
      <p className="text-destructive text-sm mb-2">
        {m.summaryPanel_errorTitle()}
      </p>
      <Button size="sm" onClick={resetErrorBoundary}>
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
      className="absolute top-20 right-6 z-40 w-[380px] max-h-[60vh] origin-top-right"
      // Avoid X-translation: with `right-*` positioning this looks like the panel
      // "shifts left" and can briefly appear flush against the border.
      //
      // Also: keep exit animation starting from the *current dragged position* by
      // animating a wrapper while the dragged element keeps its transform.
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      role="complementary"
      aria-label={m.floatingSummary_toggle()}
    >
      <motion.div
        className="max-h-[60vh] rounded-2xl border bg-card text-card-foreground shadow-lg flex flex-col overflow-hidden will-change-transform transform-gpu"
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintsRef}
        dragElastic={0.15}
        dragMomentum={false}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
        style={{ cursor: "default" }}
      >
        {/* Drag handle — only this header initiates drag */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={(e: React.PointerEvent) => {
            // Ensure scroll/select doesn't compete with dragging.
            e.preventDefault();
            dragControls.start(e);
          }}
        >
          <div className="flex items-center gap-2">
            <GripVertical
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="text-sm font-medium">
              {m.summaryPanel_aiSummary()}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label={m.floatingSummary_close()}
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(60vh-44px)]">
          <div className="p-1">
            <ErrorBoundary FallbackComponent={SummaryErrorFallback}>
              <SummaryPanel
                userNewsletterId={userNewsletterId}
                className="mb-0 border-0 shadow-none rounded-none"
              />
            </ErrorBoundary>
          </div>
        </ScrollArea>
      </motion.div>
    </motion.div>
  );
}
