/**
 * EmlDropZone Component
 * Story 8.2: Task 1 (AC #1, #6, #7)
 *
 * Provides a drag-and-drop zone for .eml file import with file picker fallback.
 * Features:
 * - HTML5 drag-and-drop with visual feedback
 * - File picker button as alternative
 * - Extension validation (.eml only)
 * - Visual state changes on drag
 * - Keyboard accessible (Enter/Space to browse)
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmlDropZoneProps {
  /** Callback when valid .eml files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Callback for validation errors */
  onError: (message: string) => void;
  /** Disable the drop zone during processing */
  disabled?: boolean;
}

/**
 * Drag-and-drop zone for .eml files with file picker fallback
 */
export function EmlDropZone({ onFilesSelected, onError, disabled = false }: EmlDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle drag over - required to enable drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  // Handle drag leave - clear visual feedback
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Handle drop - validate and process files
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer?.files ?? []);
    validateAndProcessFiles(files);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    validateAndProcessFiles(files);
    // Reset input to allow selecting the same file again
    e.target.value = "";
  };

  // Validate file extensions and call callback
  const validateAndProcessFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    // Filter for .eml files (AC #6)
    const emlFiles = files.filter((f) => f.name.toLowerCase().endsWith(".eml"));

    if (emlFiles.length === 0) {
      onError("Only .eml files are supported");
      return;
    }

    // Warn if some files were skipped
    if (emlFiles.length !== files.length) {
      const skippedCount = files.length - emlFiles.length;
      console.warn(
        `[EmlDropZone] ${skippedCount} non-.eml file(s) skipped. Processing ${emlFiles.length} .eml file(s).`,
      );
    }

    onFilesSelected(emlFiles);
  };

  // Open file picker
  const handleBrowseClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  // Handle keyboard navigation (Enter/Space to browse)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drop zone for email files. Press Enter to browse files."
      aria-disabled={disabled}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isDragging && !disabled ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".eml"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled}
      />

      {/* Icon */}
      <div className="flex justify-center mb-4">
        <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          {isDragging && !disabled ? (
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          ) : (
            <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          {isDragging && !disabled ? "Drop files here" : "Drag .eml files here"}
        </p>
        <p className="text-sm text-muted-foreground">
          {isDragging && !disabled
            ? "Release to import"
            : "Supports single or multiple file import"}
        </p>
      </div>

      {/* Browse button (AC #7) */}
      <div className="mt-4">
        <Button variant="outline" onClick={handleBrowseClick} disabled={disabled} type="button">
          Browse Files
        </Button>
      </div>

      {/* File type hint */}
      <p className="mt-4 text-xs text-muted-foreground">
        Only .eml files are supported. Export newsletters from your email client as .eml format.
      </p>
    </div>
  );
}
