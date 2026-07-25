export async function convertHtmlToPdf(
  file: File,
  onProgress?: (p: number) => void
): Promise<void> {
  const text = await file.text();
  onProgress?.(20);

  // Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  // Inject custom CSS to make it look like Telegram
  const styleText = `
    .telegram-pdf-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f0f2f5;
      color: #000;
      padding: 20px;
    }
    .telegram-pdf-container .history {
      max-width: 600px;
      margin: 0 auto;
    }
    .telegram-pdf-container .message {
      background: white;
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 10px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      position: relative;
      page-break-inside: avoid;
    }
    .telegram-pdf-container .message.service {
      background: #e4e6eb;
      text-align: center;
      font-size: 12px;
      color: #606770;
      padding: 6px 12px;
      margin: 10px auto;
      border-radius: 16px;
      width: fit-content;
      box-shadow: none;
      page-break-inside: avoid;
    }
    .telegram-pdf-container .from_name {
      font-weight: 600;
      color: #2b5278;
      margin-bottom: 4px;
      font-size: 14px;
    }
    .telegram-pdf-container .text {
      font-size: 15px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    .telegram-pdf-container .date {
      font-size: 11px;
      color: #999;
      float: right;
      margin-left: 10px;
      margin-top: 4px;
    }
    .telegram-pdf-container .pull_right {
      float: right;
    }
  `;

  // We need to render this HTML somewhere isolated so it doesn't inherit 
  // Tailwind's global styles (which use oklch/lab colors that crash html2canvas).
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "800px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);
  
  const idoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!idoc) throw new Error("Failed to create isolated rendering frame");

  const container = idoc.createElement("div");
  container.className = "telegram-pdf-container";
  container.innerHTML = doc.body.innerHTML;
  idoc.body.appendChild(container);
  
  const mainStyle = idoc.createElement("style");
  mainStyle.textContent = styleText;
  idoc.head.appendChild(mainStyle);
  
  onProgress?.(50);
  
  const opt = {
    margin:       10,
    filename:     file.name.replace(/\.html$/i, "") + "_converted.pdf",
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  // @ts-ignore
  const html2pdfModule = await import("html2pdf.js");
  const html2pdf = html2pdfModule.default ? html2pdfModule.default : html2pdfModule;

  await html2pdf().set(opt).from(container).save();
  
  // Cleanup
  document.body.removeChild(iframe);
  
  onProgress?.(100);
}
