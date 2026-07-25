import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { renderPagePreview } from "@/lib/telegram-parser";

interface PageSelectorProps {
  file: File;
  totalPages: number;
  selectedPages: Set<number>;
  onSelectionChange: (pages: Set<number>) => void;
  disabled?: boolean;
}

export function PageSelector({
  file,
  totalPages,
  selectedPages,
  onSelectionChange,
  disabled = false,
}: PageSelectorProps) {
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const allSelected = selectedPages.size === totalPages;

  const togglePage = useCallback(
    (page: number) => {
      if (disabled) return;
      const next = new Set(selectedPages);
      if (next.has(page)) {
        next.delete(page);
      } else {
        next.add(page);
      }
      onSelectionChange(next);
    },
    [selectedPages, onSelectionChange, disabled]
  );

  const toggleAll = useCallback(() => {
    if (disabled) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      const all = new Set<number>();
      for (let i = 1; i <= totalPages; i++) all.add(i);
      onSelectionChange(all);
    }
  }, [allSelected, totalPages, onSelectionChange, disabled]);

  const openPreview = useCallback(
    async (page: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setPreviewPage(page);
      setPreviewSrc(null);
      setLoadingPreview(true);
      try {
        const src = await renderPagePreview(file, page, 2);
        setPreviewSrc(src);
      } catch {
        setPreviewSrc(null);
      } finally {
        setLoadingPreview(false);
      }
    },
    [file]
  );

  const closePreview = useCallback(() => {
    setPreviewPage(null);
    setPreviewSrc(null);
  }, []);

  // Close on Escape + prevent body scroll when preview is open
  useEffect(() => {
    if (previewPage === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [previewPage, closePreview]);

  return (
    <>
      {/* Header row — tappable to collapse/expand */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("transition-transform duration-200", collapsed && "-rotate-90")}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          Pages
          <span className="text-xs font-normal text-muted-foreground">
            {selectedPages.size}/{totalPages}
          </span>
        </button>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled}
          className="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Page grid — collapsible */}
      <div
        className={cn(
          "flex flex-wrap gap-1 sm:gap-1.5 transition-all duration-200 overflow-hidden",
          collapsed && "max-h-0 opacity-0 mb-0",
          !collapsed && "max-h-[500px] opacity-100"
        )}
        id="page-selector-grid"
      >
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          const isSelected = selectedPages.has(page);
          return (
            <div
              key={page}
              className={cn(
                "group relative flex items-center justify-center rounded-md border text-[11px] font-medium transition-all duration-150 select-none sm:text-xs",
                "h-7 min-w-[1.75rem] px-1 sm:h-8 sm:min-w-[2.25rem] sm:px-1.5",
                isSelected
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-muted-foreground/15 bg-muted/30 text-muted-foreground hover:border-muted-foreground/30",
                disabled && "pointer-events-none opacity-50",
                "cursor-pointer"
              )}
              onClick={() => togglePage(page)}
            >
              {page}

              {/* Eye icon — appears on hover */}
              <button
                type="button"
                onClick={(e) => openPreview(page, e)}
                className={cn(
                  "absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full sm:h-4 sm:w-4",
                  "bg-foreground/80 text-background",
                  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150",
                  "hover:bg-foreground",
                  "touch-manipulation"
                )}
                title={`Preview page ${page}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Preview popup (modal overlay) */}
      {previewPage !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150 sm:items-center"
          onClick={closePreview}
        >
          <div
            className={cn(
              "relative w-full overflow-auto bg-card ring-1 ring-foreground/10 shadow-2xl animate-in duration-200",
              "max-h-[85vh] rounded-t-2xl slide-in-from-bottom-4",
              "sm:max-h-[90vh] sm:max-w-[90vw] sm:w-auto sm:rounded-xl sm:zoom-in-95 sm:fade-in-0"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="flex justify-center pt-2 pb-0 sm:hidden">
              <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
            </div>
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2.5">
              <span className="text-sm font-medium text-foreground">
                Page {previewPage}
              </span>
              <div className="flex items-center gap-2">
                {/* Toggle selection from preview */}
                <button
                  type="button"
                  onClick={() => togglePage(previewPage)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                    selectedPages.has(previewPage)
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {selectedPages.has(previewPage) ? "Selected ✓" : "Deselected"}
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={closePreview}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-1.5 sm:p-2">
              {loadingPreview ? (
                <div className="flex h-[50vh] w-full items-center justify-center sm:h-[400px] sm:w-[500px]">
                  <svg
                    className="animate-spin text-muted-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
              ) : previewSrc ? (
                <img
                  src={previewSrc}
                  alt={`Page ${previewPage}`}
                  className="w-full rounded-lg sm:max-w-full"
                />
              ) : (
                <div className="flex h-[50vh] w-full items-center justify-center text-sm text-muted-foreground sm:h-[400px] sm:w-[500px]">
                  Failed to render preview
                </div>
              )}
            </div>

            {/* Navigation arrows */}
            {previewPage > 1 && (
              <button
                type="button"
                onClick={(e) => openPreview(previewPage - 1, e)}
                className="absolute left-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 hover:bg-foreground/20 hover:text-foreground transition-colors backdrop-blur-sm sm:left-2 touch-manipulation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            )}
            {previewPage < totalPages && (
              <button
                type="button"
                onClick={(e) => openPreview(previewPage + 1, e)}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 hover:bg-foreground/20 hover:text-foreground transition-colors backdrop-blur-sm sm:right-2 touch-manipulation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
