import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { PageSelector } from "@/components/PageSelector";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseTelegramPdf, parseTelegramHtml, formatMessages, getPdfPageCount } from "@/lib/telegram-parser";

type AppState = "idle" | "loading-pages" | "ready" | "parsing" | "done" | "error";

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<AppState>("idle");
  const [progress, setProgress] = useState(0);
  const [outputText, setOutputText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [messageCount, setMessageCount] = useState(0);

  // Page selection state
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  const handleFilesSelect = useCallback(async (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setOutputText("");
    setErrorMsg("");
    setProgress(0);
    setMessageCount(0);

    if (selectedFiles.length === 1 && selectedFiles[0].type === "application/pdf") {
      // Detect page count for single PDF file to show PageSelector
      setState("loading-pages");
      try {
        const count = await getPdfPageCount(selectedFiles[0]);
        setTotalPages(count);
        // Select all pages by default
        const allPages = new Set<number>();
        for (let i = 1; i <= count; i++) allPages.add(i);
        setSelectedPages(allPages);
        setState("ready");
      } catch (err) {
        console.error("Failed to read PDF:", err);
        setState("error");
        setErrorMsg("Failed to read PDF file. Make sure it's a valid PDF.");
      }
    } else {
      // For multiple files or single HTML, we parse everything
      setTotalPages(0);
      setSelectedPages(new Set());
      setState("ready");
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (files.length === 0) return;
    if (files.length === 1 && selectedPages.size === 0) return;

    setState("parsing");
    setProgress(0);
    setOutputText("");
    setErrorMsg("");

    try {
      let allMessages: any[] = [];
      
      // Sort files by name to ensure chronological order for multi-part exports (e.g. messages.pdf, messages2.pdf)
      const sortedFiles = [...files].sort((a, b) => {
        // Extract numbers from filenames if present (e.g. "messages2.pdf" -> 2)
        const aMatch = a.name.match(/\d+/);
        const bMatch = b.name.match(/\d+/);
        if (aMatch && bMatch) {
          return parseInt(aMatch[0]) - parseInt(bMatch[0]);
        }
        return a.name.localeCompare(b.name);
      });
      
      for (let i = 0; i < sortedFiles.length; i++) {
        const currentFile = sortedFiles[i];
        
        const progressCallback = (p: number) => {
          // Calculate global progress
          const fileWeight = 100 / sortedFiles.length;
          const previousFilesProgress = i * fileWeight;
          const currentFileProgress = p * (fileWeight / 100);
          setProgress(previousFilesProgress + currentFileProgress);
        };

        const isPdf = currentFile.type === "application/pdf" || currentFile.name.endsWith(".pdf");
        
        const fileMessages = isPdf 
          ? await parseTelegramPdf(currentFile, progressCallback, sortedFiles.length === 1 ? selectedPages : undefined)
          : await parseTelegramHtml(currentFile, progressCallback);
          
        allMessages = allMessages.concat(fileMessages);
      }

      if (allMessages.length === 0) {
        setState("error");
        setErrorMsg(
          "No messages found. Try selecting different pages or check the PDF format."
        );
        return;
      }

      const formatted = formatMessages(allMessages);
      setOutputText(formatted);
      setMessageCount(allMessages.length);
      setState("done");
      setProgress(100);
    } catch (err) {
      console.error("Parse error:", err);
      setState("error");
      setErrorMsg(
        err instanceof Error
          ? `Failed to parse files: ${err.message}`
          : "An unexpected error occurred while parsing the files."
      );
    }
  }, [files, selectedPages]);

  const handleDownload = useCallback(() => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = files.length === 1
      ? files[0].name.replace(/\.pdf$/i, "") + "_parsed.txt"
      : "telegram_chat_combined.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputText, files]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setState("idle");
    setProgress(0);
    setOutputText("");
    setErrorMsg("");
    setMessageCount(0);
    setTotalPages(0);
    setSelectedPages(new Set());
  }, []);

  const isParsing = state === "parsing";
  const canGenerate =
    (state === "ready" || state === "done" || state === "error") &&
    (files.length > 1 || (files.length === 1 && selectedPages.size > 0));

  return (
    <div className="dark min-h-screen bg-background">
      {/* Gradient background effect */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/2 right-0 h-[600px] w-[600px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl px-3 py-6 sm:px-4 sm:py-12">
        {/* Header */}
        <header className="mb-6 text-center sm:mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary sm:mb-4 sm:px-4 sm:py-1.5 sm:text-xs">
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
              <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
            </svg>
            Telegram Chat Parser
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            Chat Export Converter
          </h1>
          <p className="mt-2 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
            Upload Telegram-exported PDF or HTML chats and convert them to clean, readable text.
          </p>
        </header>

        {/* Main Card */}
        <Card className="border-0 ring-foreground/5 shadow-2xl shadow-black/20">
          <CardHeader>
            <CardTitle>Upload Chat Export</CardTitle>
            <CardDescription>
              Export your Telegram chat as PDF or HTML, then drop it below
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-5">
            {/* File Dropzone */}
            <FileDropzone
              onFilesSelect={handleFilesSelect}
              selectedFiles={files}
              disabled={isParsing}
            />

            {/* Loading pages indicator */}
            {state === "loading-pages" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in-0 duration-200">
                <svg
                  className="animate-spin"
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
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Reading PDF pages…
              </div>
            )}

            {/* Page Selector (only for single PDF file) */}
            {files.length === 1 && files[0].type === "application/pdf" && totalPages > 0 && state !== "loading-pages" && (
              <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
                <PageSelector
                  file={files[0]}
                  totalPages={totalPages}
                  selectedPages={selectedPages}
                  onSelectionChange={setSelectedPages}
                  disabled={isParsing}
                />
              </div>
            )}

            {/* Progress Bar */}
            {(isParsing || state === "done") && (
              <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
                <Progress value={progress} className="gap-1.5">
                  <ProgressLabel className="text-muted-foreground">
                    {isParsing ? "Parsing files…" : "Complete"}
                  </ProgressLabel>
                  <ProgressValue />
                </Progress>
              </div>
            )}

            {/* Error Message */}
            {state === "error" && (
              <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                <p className="text-sm text-destructive">{errorMsg}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                id="generate-btn"
                size="lg"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex-1 transition-all duration-200"
              >
                {isParsing ? (
                  <>
                    <svg
                      className="animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Parsing…
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                    {files.length > 1
                      ? `Generate (${files.length} files)`
                      : selectedPages.size > 0 && selectedPages.size < totalPages
                      ? `Generate (${selectedPages.size} pages)`
                      : "Generate"}
                  </>
                )}
              </Button>

              {state === "done" && (
                <Button
                  id="download-btn"
                  size="lg"
                  variant="outline"
                  onClick={handleDownload}
                  className="animate-in fade-in-0 slide-in-from-right-2 duration-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download .txt
                </Button>
              )}

              {(state === "done" || state === "error") && (
                <Button
                  id="reset-btn"
                  size="lg"
                  variant="ghost"
                  onClick={handleReset}
                  className="animate-in fade-in-0 duration-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                  Reset
                </Button>
              )}
            </div>

            {/* Output Textarea */}
            {state === "done" && outputText && (
              <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="output-text"
                    className="text-sm font-medium text-foreground"
                  >
                    Parsed Conversation
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {messageCount} messages
                  </span>
                </div>
                <Textarea
                  id="output-text"
                  readOnly
                  value={outputText}
                  className="min-h-[200px] max-h-[60vh] resize-y font-mono text-[11px] leading-relaxed sm:min-h-[300px] sm:max-h-[500px] sm:text-xs"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-6 text-center text-[10px] text-muted-foreground/50 sm:mt-8 sm:text-xs">
          All processing happens locally in your browser. No data is uploaded.
        </footer>
      </div>
    </div>
  );
}

export default App;
