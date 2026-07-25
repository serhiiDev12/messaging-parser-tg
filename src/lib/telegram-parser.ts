import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { PDFDocumentProxy } from "pdfjs-dist";

let _pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function getPdfjsLib() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import("pdfjs-dist");
    _pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url
    ).toString();
  }
  return _pdfjsLib;
}

async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjsLib = await getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

/**
 * Get the total number of pages in a PDF file.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdf = await loadPdf(file);
  return pdf.numPages;
}

/**
 * Render a single PDF page to a data URL for preview.
 */
export async function renderPagePreview(
  file: File,
  pageNum: number,
  scale = 1.5
): Promise<string> {
  const pdf = await loadPdf(file);
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}

export interface ParsedMessage {
  sender: string;
  message: string;
}

interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
}

/**
 * Parse a Telegram-exported PDF chat into structured messages.
 *
 * Telegram PDFs have a consistent layout:
 * - Sender name is bold (font name contains "Bold") followed by a date/time string
 * - Message text appears on subsequent lines below the sender
 * - Messages are visually separated by sender blocks
 */
export async function parseTelegramPdf(
  file: File,
  onProgress?: (progress: number) => void,
  selectedPages?: Set<number>
): Promise<ParsedMessage[]> {
  const pdf = await loadPdf(file);

  const totalPages = pdf.numPages;
  const allItems: PositionedTextItem[] = [];

  // Extract text items from selected pages (or all pages if none specified)
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (selectedPages && !selectedPages.has(pageNum)) {
      onProgress?.(Math.round((pageNum / totalPages) * 100));
      continue;
    }
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    for (const item of textContent.items) {
      const textItem = item as TextItem;
      if (!textItem.str || textItem.str.trim() === "") continue;

      // PDF coordinate system has origin at bottom-left; flip Y for top-down reading order
      const x = textItem.transform[4];
      const y = viewport.height - textItem.transform[5];

      allItems.push({
        text: textItem.str,
        x,
        y: y + (pageNum - 1) * viewport.height, // global Y across pages
        fontSize: textItem.transform[0],
        fontName: (textItem as TextItem & { fontName?: string }).fontName ?? "",
      });
    }

    onProgress?.(Math.round((pageNum / totalPages) * 100));
  }

  // Sort items by Y (top-to-bottom), then X (left-to-right)
  allItems.sort((a, b) => a.y - b.y || a.x - b.x);

  // Group text items into lines (items within ~3px of same Y are on the same line)
  const lines = groupIntoLines(allItems);

  // Parse lines into messages
  return extractMessages(lines);
}

interface TextLine {
  items: PositionedTextItem[];
  text: string;
  y: number;
  hasBold: boolean;
}

function groupIntoLines(items: PositionedTextItem[]): TextLine[] {
  const lines: TextLine[] = [];
  let currentLine: PositionedTextItem[] = [];
  let currentY = -Infinity;

  const Y_THRESHOLD = 3; // pixels tolerance for same-line grouping

  for (const item of items) {
    if (currentLine.length === 0 || Math.abs(item.y - currentY) <= Y_THRESHOLD) {
      currentLine.push(item);
      if (currentLine.length === 1) currentY = item.y;
    } else {
      lines.push(buildLine(currentLine));
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) {
    lines.push(buildLine(currentLine));
  }

  return lines;
}

function buildLine(items: PositionedTextItem[]): TextLine {
  // Sort items left-to-right within the line
  items.sort((a, b) => a.x - b.x);

  return {
    items,
    text: items.map((i) => i.text).join(""),
    y: items[0].y,
    hasBold: items.some(
      (i) => i.fontName.toLowerCase().includes("bold") || i.fontName.toLowerCase().includes("heavy")
    ),
  };
}

// Telegram date/time patterns:
// "DD.MM.YYYY HH:MM:SS" or "DD.MM.YYYY HH:MM" or similar
const DATETIME_REGEX =
  /\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}[\s,]+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/i;

// Also handle "Month DD, YYYY HH:MM" style
const DATETIME_REGEX_ALT =
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}[\s,]+\d{1,2}:\d{2}/i;

function isSenderLine(line: TextLine): { sender: string } | null {
  const text = line.text.trim();

  // Check if line contains a datetime pattern
  const dateMatch = text.match(DATETIME_REGEX) || text.match(DATETIME_REGEX_ALT);

  if (dateMatch) {
    // Sender name is the part before the date
    const dateIndex = text.indexOf(dateMatch[0]);
    const senderPart = text.substring(0, dateIndex).trim();

    // Remove trailing comma if present
    const sender = senderPart.replace(/,\s*$/, "").trim();

    if (sender.length > 0 && sender.length < 100) {
      return { sender };
    }
  }

  // Fallback: check if line has bold text and looks like a name
  if (line.hasBold && line.items.length > 0) {
    // Get only the bold items as potential sender name
    const boldItems = line.items.filter(
      (i) => i.fontName.toLowerCase().includes("bold") || i.fontName.toLowerCase().includes("heavy")
    );
    if (boldItems.length > 0) {
      const boldText = boldItems.map((i) => i.text).join("").trim();
      // Check if remaining text looks like a date
      const remainingText = line.text.replace(boldText, "").trim();
      if (
        (DATETIME_REGEX.test(remainingText) || DATETIME_REGEX_ALT.test(remainingText)) &&
        boldText.length > 0 &&
        boldText.length < 100
      ) {
        return { sender: boldText.replace(/,\s*$/, "").trim() };
      }
    }
  }

  return null;
}

function extractMessages(lines: TextLine[]): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  let currentSender: string | null = null;
  let currentMessageLines: string[] = [];

  for (const line of lines) {
    const senderMatch = isSenderLine(line);

    if (senderMatch) {
      // Save previous message
      if (currentSender !== null && currentMessageLines.length > 0) {
        messages.push({
          sender: currentSender,
          message: currentMessageLines.join("\n").trim(),
        });
      }
      currentSender = senderMatch.sender;
      currentMessageLines = [];
    } else if (currentSender !== null) {
      // This line is part of the current message
      const text = line.text.trim();
      if (text.length > 0) {
        currentMessageLines.push(text);
      }
    }
  }

  // Don't forget the last message
  if (currentSender !== null && currentMessageLines.length > 0) {
    messages.push({
      sender: currentSender,
      message: currentMessageLines.join("\n").trim(),
    });
  }

  return messages;
}

/**
 * Format parsed messages into the desired text output.
 */
export function formatMessages(messages: ParsedMessage[]): string {
  return messages
    .map((m) => `${m.sender}:\n${m.message}`)
    .join("\n");
}
