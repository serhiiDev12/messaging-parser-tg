import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  disabled?: boolean;
}

export function FileDropzone({
  onFilesSelect,
  selectedFiles,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter(
        (file) => file.type === "application/pdf"
      );
      if (files.length > 0) {
        onFilesSelect(files);
      }
    },
    [disabled, onFilesSelect]
  );

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (file) => file.type === "application/pdf"
    );
    if (files.length > 0) {
      onFilesSelect(files);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      id="file-dropzone"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      className={cn(
        "relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300",
        "flex flex-col items-center justify-center gap-2 p-5 sm:gap-3 sm:p-8",
        "group hover:border-primary/50 hover:bg-primary/5",
        isDragOver && "border-primary bg-primary/10 scale-[1.02]",
        !isDragOver && selectedFiles.length === 0 && "border-muted-foreground/25",
        selectedFiles.length > 0 && "border-primary/30 bg-primary/5",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        onChange={handleChange}
        className="hidden"
        id="pdf-file-input"
      />

      {/* Upload icon */}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 sm:h-14 sm:w-14",
          selectedFiles.length > 0
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        )}
      >
        {selectedFiles.length > 0 ? (
          <svg
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
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="m9 15 2 2 4-4" />
          </svg>
        ) : (
          <svg
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>

      {selectedFiles.length > 0 ? (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {selectedFiles.length === 1
              ? selectedFiles[0].name
              : `${selectedFiles.length} files selected`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatSize(
              selectedFiles.reduce((acc, file) => acc + file.size, 0)
            )}{" "}
            · Click or drop to replace
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Drop your Telegram PDFs here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            or click to browse · PDF files only
          </p>
        </div>
      )}
    </div>
  );
}
