import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useConvexMutation } from "@convex-dev/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { m } from "@/paraglide/messages.js";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Textarea,
} from "@hushletter/ui";
import { AlertTriangle, User, Mail, Calendar, ExternalLink, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Props for ModerationNewsletterModal */
interface Props {
  userNewsletterId: Id<"userNewsletters">;
  onClose: () => void;
  onActionComplete?: () => void;
}

/**
 * Moderation Newsletter Detail Modal
 * Story 9.6: Task 4.1-4.6 - Base modal with metadata and content preview
 * Story 9.7: Task 5 - Added Publish/Reject action buttons
 *
 * Displays newsletter metadata and content for admin review.
 * Features:
 * - Newsletter metadata (subject, sender, received date)
 * - User email for audit (not displayed to community)
 * - Sandboxed iframe for HTML content preview
 * - PII detection warnings
 * - Publish to Community / Reject action buttons
 */
export function ModerationNewsletterModal({ userNewsletterId, onClose, onActionComplete }: Props) {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [piiDetection, setPiiDetection] = useState<{
    hasPotentialPII: boolean;
    findings: Array<{ type: string; description: string; count: number; samples: string[] }>;
    recommendation: string;
  } | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const queryClient = useQueryClient();

  // Get newsletter detail (metadata)
  const { data: detail, isPending: detailLoading } = useQuery(
    convexQuery(api.admin.getModerationNewsletterDetail, { userNewsletterId }),
  );

  // Action to get content URL
  const getContent = useAction(api.admin.getModerationNewsletterContent);

  // Action to publish to community
  const publishAction = useAction(api.admin.publishToCommunity);

  // Mutation to reject
  const rejectFn = useConvexMutation(api.admin.rejectFromCommunity);
  const rejectMutation = useMutation({ mutationFn: rejectFn });

  // Load content URL and PII detection when modal opens
  useEffect(() => {
    async function loadContent() {
      try {
        setIsLoadingContent(true);
        setContentError(null);
        setPiiDetection(null);
        const result = await getContent({ userNewsletterId });
        setContentUrl(result.signedUrl);
        // Store PII detection results from the action
        if (result.piiDetection) {
          setPiiDetection(result.piiDetection);
        }
      } catch (error) {
        console.error("Failed to load newsletter content:", error);
        setContentError(error instanceof Error ? error.message : "Failed to load content");
      } finally {
        setIsLoadingContent(false);
      }
    }

    loadContent();
  }, [userNewsletterId, getContent]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await publishAction({ userNewsletterId });
      toast.success(
        result.reusedExisting
          ? m.modNewsletter_successLinkedExisting()
          : m.modNewsletter_successPublished(),
      );
      // Invalidate all queries to ensure moderation queue and related data refreshes
      // convexQuery generates keys based on function reference, broad invalidation is safest
      await queryClient.invalidateQueries();
      onActionComplete?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.modNewsletter_errorPublishFailed());
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error(m.modNewsletter_errorRejectReasonRequired());
      return;
    }

    setIsRejecting(true);
    try {
      await rejectMutation.mutateAsync({
        userNewsletterId,
        reason: rejectReason,
      });
      toast.success(m.modNewsletter_successRejected());
      // Invalidate all queries to ensure moderation queue and related data refreshes
      await queryClient.invalidateQueries();
      onActionComplete?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.modNewsletter_errorRejectFailed());
    } finally {
      setIsRejecting(false);
      setShowRejectDialog(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">
              {detailLoading ? (
                <Skeleton className="h-6 w-64" />
              ) : (
                (detail?.subject ?? m.modNewsletter_defaultSubject())
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">{m.modNewsletter_labelSender()}</span>
                  <span className="font-medium">{detail.senderName ?? detail.senderEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">{m.modNewsletter_labelReceived()}</span>
                  <span>{formatDate(detail.receivedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">{m.modNewsletter_labelSource()}</span>
                  <Badge variant="outline">{detail.source ?? m.modNewsletter_sourceEmail()}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">{m.modNewsletter_labelOwnerAudit()}</span>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{detail.userEmail}</code>
                </div>
              </div>

              {/* PII Detection Results */}
              {isLoadingContent ? (
                <Skeleton className="h-16 w-full" />
              ) : piiDetection?.hasPotentialPII ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>{m.modNewsletter_piiDetectedTitle()}</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">{piiDetection.recommendation}</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {piiDetection.findings.map((finding, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{finding.description}</span> (
                          {m.modNewsletter_piiFoundCount({ count: finding.count })})
                          {finding.samples.length > 0 && (
                            <span className="text-muted-foreground ml-1">
                              {m.modNewsletter_piiExample({ example: finding.samples[0] })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>{m.modNewsletter_noPiiTitle()}</AlertTitle>
                  <AlertDescription>
                    {piiDetection?.recommendation ??
                      m.modNewsletter_noPiiMessage()}
                  </AlertDescription>
                </Alert>
              )}

              {/* Content Preview */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-medium border-b">
                  {m.modNewsletter_contentPreviewTitle()}
                </div>
                {isLoadingContent ? (
                  <div className="p-4">
                    <Skeleton className="h-[400px] w-full" />
                  </div>
                ) : contentError ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>{m.modNewsletter_contentLoadError()}</p>
                    <p className="text-xs mt-1">{contentError}</p>
                  </div>
                ) : contentUrl ? (
                  <iframe
                    src={contentUrl}
                    className="w-full h-[500px] border-0"
                    sandbox="allow-same-origin"
                    title={m.modNewsletter_contentPreviewTitle()}
                  />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">{m.modNewsletter_noContentAvailable()}</div>
                )}
              </div>

              {/* Action Buttons - Story 9.7 */}
              {/* H2 FIX: Disable actions when content failed to load - admin must review content first */}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isPublishing || isRejecting || isLoadingContent || !!contentError}
                  title={contentError ? m.modNewsletter_cannotActWithoutContent() : undefined}
                >
                  <X className="h-4 w-4 mr-2" aria-hidden="true" />
                  {m.modNewsletter_buttonReject()}
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || isRejecting || isLoadingContent || !!contentError}
                  title={contentError ? m.modNewsletter_cannotActWithoutContent() : undefined}
                >
                  {isPublishing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                  )}
                  {m.modNewsletter_buttonPublish()}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">{m.modNewsletter_newsletterNotFound()}</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.modNewsletter_rejectDialogTitle()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {m.modNewsletter_rejectDialogMessage()}
            </p>
            <Textarea
              placeholder={m.modNewsletter_rejectReasonPlaceholder()}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              {m.modNewsletter_buttonCancel()}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !rejectReason.trim()}
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              ) : null}
              {m.modNewsletter_buttonConfirmRejection()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
