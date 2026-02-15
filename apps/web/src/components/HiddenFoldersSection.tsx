import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { toast } from "sonner";
import {
  Button,
  Skeleton,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@hushletter/ui";
import { FolderIcon, Eye, AlertCircle, EyeOff } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { AnimatePresence, motion } from "motion/react";

/** Type for hidden folder data */
interface HiddenFolderData {
  _id: string;
  name: string;
  color?: string;
  newsletterCount: number;
  senderCount: number;
}

/** Type guard for hidden folder data */
function isHiddenFolderData(item: unknown): item is HiddenFolderData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj._id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.newsletterCount === "number" &&
    typeof obj.senderCount === "number"
  );
}

export function HiddenFoldersSection() {
  const queryClient = useQueryClient();

  const {
    data: hiddenFoldersRaw,
    isPending,
    isError,
  } = useQuery(convexQuery(api.folders.listHiddenFolders, {}));

  const hiddenFolders =
    (hiddenFoldersRaw as unknown[] | undefined)?.filter(isHiddenFolderData) ??
    [];

  const unhideMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.unhideFolder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      toast.success(m.hiddenFolders_unhideSuccess());
    },
    onError: () => {
      toast.error(m.hiddenFolders_unhideError());
    },
  });

  if (isPending) {
    return (
      <div
        className="space-y-3"
        role="status"
        aria-label={m.hiddenFolders_loadingAriaLabel()}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        <span>{m.hiddenFolders_loadError()}</span>
      </div>
    );
  }

  if (hiddenFolders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <EyeOff className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {m.hiddenFolders_noHiddenFolders()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hidden folders will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 pl-4">Folder</TableHead>
            <TableHead className="h-10 text-center">Newsletters</TableHead>
            <TableHead className="h-10 text-center">Senders</TableHead>
            <TableHead className="h-10 pr-4 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence mode="popLayout">
            {hiddenFolders.map((folder) => (
              <motion.tr
                key={folder._id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24, filter: "blur(4px)" }}
                transition={{ duration: 0.2 }}
                className="border-b transition-colors hover:bg-muted/50 last:border-0"
              >
                <TableCell className="py-3 pl-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: folder.color
                          ? `${folder.color}18`
                          : undefined,
                      }}
                    >
                      <FolderIcon
                        className="size-4"
                        style={{
                          color: folder.color || undefined,
                        }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="font-medium">{folder.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-center">
                  <Badge variant="secondary" className="tabular-nums">
                    {folder.newsletterCount}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 text-center">
                  <Badge variant="secondary" className="tabular-nums">
                    {folder.senderCount}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 pr-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      unhideMutation.mutate({
                        folderId:
                          folder._id as Parameters<
                            typeof unhideMutation.mutate
                          >[0]["folderId"],
                      })
                    }
                    disabled={unhideMutation.isPending}
                    aria-label={m.hiddenFolders_unhideAriaLabel({
                      folderName: folder.name,
                    })}
                    className="gap-1.5"
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    {m.hiddenFolders_unhide()}
                  </Button>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}
