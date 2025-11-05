// Lightweight print helpers that avoid mutating document.body and reloading the app
// Usage: printElementById('receipt-content') or printHtmlContent(html)

export function printHtmlContent(html: string, options?: { title?: string }) {
  try {
    const printWindow = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=800,height=600"
    );
    if (!printWindow) return;

    const doc = printWindow.document;
    const title = options?.title || document.title || "Print";
    const styles = `
      <style>
        @media print { @page { margin: 10mm; } }
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: sans-serif; }
      </style>
    `;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>${styles}</head><body>${html}</body></html>`
    );
    doc.close();

    // Give the new window a tick to render before printing
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } finally {
        // Close to avoid leaving a blank tab open
        printWindow.close();
      }
    }, 50);
  } catch (err) {
    console.error("printHtmlContent error:", err);
  }
}

export function printElementById(
  elementId: string,
  options?: { title?: string }
) {
  const el = document.getElementById(elementId);
  if (!el) return;
  printHtmlContent(el.innerHTML, options);
}
