import { useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@hushletter/ui";
import { Loader2, Download, X, Sparkles, FolderOpen, Check } from "lucide-react";
import { toast } from "sonner";
import { m } from "@/paraglide/messages.js";

/**
 * Props for CommunityNewsletterPreviewModal
 * Story 9.8 Task 5.1-5.4
 */
interface CommunityNewsletterPreviewModalProps {
  contentId: Id<"newsletterContent">;
  subject: string;
  senderName?: string;
  senderEmail: string;
  onClose: () => void;
  alreadyOwned?: boolean;
}

/**
 * CommunityNewsletterPreviewModal - Preview newsletter content before importing
 * Story 9.8 Task 5.1-5.4
 *
 * Features:
 * - Fetches and displays newsletter content in an iframe
 * - Shows AI summary if available (Task 5.4)
 * - Import button to add to collection (Task 5.3)
 * - Handles loading and error states
 */
export function CommunityNewsletterPreviewModal({
  contentId,
  subject,
  senderName,
  senderEmail,
  onClose,
  alreadyOwned,
}: CommunityNewsletterPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | undefined>();
  const [isImporting, setIsImporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getContent = useAction(api.community.getCommunityNewsletterContent);
  const addToCollection = useMutation(api.community.addToCollection);

  // Load content on mount
  useEffect(() => {
    let isMounted = true;

    async function loadContent() {
      try {
        const result = await getContent({ contentId });
        if (!isMounted) return;

        if (result.contentStatus === "available" && result.contentUrl) {
          setContentUrl(result.contentUrl);
        } else if (result.contentStatus === "error") {
          setLoadError(m.communityPreview_errorFailedToLoad());
        } else {
          setLoadError(m.communityPreview_errorContentNotAvailable());
        }
        setSummary(result.summary);
      } catch (error) {
        if (!isMounted) return;
        console.error("[preview] Failed to load content:", error);
        setLoadError(m.communityPreview_errorFailedToLoad());
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [contentId, getContent]);

  // Handle import action
  // Story 9.9 Task 4.1-4.3: Enhanced import flow with folder confirmation
  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await addToCollection({ contentId });
      if (result.alreadyExists) {
        // Story 9.9 Task 4.3: Show info toast with folder name
        toast.info(m.communityPreview_toastAlreadyInCollection(), {
          description: result.folderName ? m.communityPreview_toastInFolder({ folderName: result.folderName }) : undefined,
        });
      } else {
        // Story 9.9 Task 4.2: Show success toast with folder name
        toast.success(m.communityPreview_toastAddedToCollection(), {
          description: result.folderName ? m.communityPreview_toastAddedToFolder({ folderName: result.folderName }) : undefined,
          icon: <FolderOpen className="h-4 w-4" />,
        });
      }
      onClose();
    } catch (error) {
      console.error("[preview] Failed to import:", error);
      toast.error(m.communityPreview_toastFailedToImport());
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="pr-8">{subject}</DialogTitle>
          <p className="text-sm text-muted-foreground">{m.communityPreview_from({ sender: senderName || senderEmail })}</p>
        </DialogHeader>

        {/* Summary section - Story 9.8 Task 5.4 */}
        {summary && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <h4 className="font-medium text-sm">{m.communityPreview_aiSummaryTitle()}</h4>
            </div>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
        )}

        {/* Content preview - Story 9.8 Task 5.2 */}
        <div className="flex-1 overflow-auto border rounded-lg min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">{m.communityPreview_loadingContent()}</span>
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {loadError}
            </div>
          ) : contentUrl ? (
            <iframe
              src={contentUrl}
              className="w-full h-full min-h-[400px]"
              sandbox="allow-same-origin"
              title={m.communityPreview_iframeTitle()}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {m.communityPreview_errorContentNotAvailable()}
            </div>
          )}
        </div>

        {/* Footer with actions - Story 9.8 Task 5.3 */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" aria-hidden="true" />
            {m.communityPreview_buttonClose()}
          </Button>
          {/* Story 9.9 Task 4.1: Enhanced import button with states */}
          {alreadyOwned ? (
            <Button disabled variant="secondary">
              <Check className="h-4 w-4 mr-2" aria-hidden="true" />
              {m.communityPreview_buttonInCollection()}
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  {m.communityPreview_buttonImporting()}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  {m.communityPreview_buttonImportToCollection()}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
