import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportImage = async () => {
    if (!invoiceRef.current) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${title.replace(/\s+/g, "_")}_${new Date().getTime()}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch (error) {
      console.error("Error exporting image:", error);
      alert("Lỗi khi xuất hình ảnh. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!invoiceRef.current) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          // Create a File from Blob
          const fileName = `${title.replace(/\s+/g, "_")}.png`;
          const file = new File([blob], fileName, { type: "image/png" });

          // Check if Web Share API is supported with files
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: title,
                text: `Hóa đơn: ${title}`,
              });
            } catch (err) {
              if ((err as Error).name !== "AbortError") {
                console.error("Error sharing:", err);
                // Fallback to download
                downloadBlob(blob, fileName);
              }
            }
          } else {
            // Fallback: download the image with instructions
            downloadBlob(blob, fileName);
            alert(
              "Hình ảnh đã được tải xuống. Bạn có thể gửi file qua Zalo, Messenger hoặc Email."
            );
          }
        }
        setIsExporting(false);
      }, "image/png");
    } catch (error) {
      console.error("Error sharing:", error);
      alert("Lỗi khi chia sẻ. Vui lòng thử lại.");
      setIsExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow || !invoiceRef.current) return;

    const content = invoiceRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-medium { font-weight: 500; }
          .text-blue-700 { color: #1d4ed8; }
          .text-blue-600 { color: #2563eb; }
          .text-green-600 { color: #16a34a; }
          .text-green-700 { color: #15803d; }
          .text-red-600 { color: #dc2626; }
          .text-slate-500 { color: #64748b; }
          .text-slate-600 { color: #475569; }
          .text-slate-700 { color: #334155; }
          .bg-slate-50 { background-color: #f8fafc; }
          .bg-slate-100 { background-color: #f1f5f9; }
          .border { border: 1px solid #e2e8f0; }
          .border-slate-200 { border-color: #e2e8f0; }
          .border-slate-300 { border-color: #cbd5e1; }
          .rounded-lg { border-radius: 8px; }
          .p-3 { padding: 12px; }
          .p-4 { padding: 16px; }
          .mb-4 { margin-bottom: 16px; }
          .mb-6 { margin-bottom: 24px; }
          .mt-8 { margin-top: 32px; }
          .pt-4 { padding-top: 16px; }
          .pb-4 { padding-bottom: 16px; }
          .gap-3 { gap: 12px; }
          .gap-4 { gap: 16px; }
          .flex { display: flex; }
          .items-start { align-items: flex-start; }
          .items-center { align-items: center; }
          .justify-between { justify-content: space-between; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
          .gap-8 { gap: 32px; }
          .text-sm { font-size: 14px; }
          .text-xs { font-size: 12px; }
          .text-lg { font-size: 18px; }
          .text-xl { font-size: 20px; }
          .text-base { font-size: 16px; }
          .w-14 { width: 56px; }
          .h-14 { height: 56px; }
          .w-16 { width: 64px; }
          .h-16 { height: 64px; }
          .space-y-0\\.5 > * + * { margin-top: 2px; }
          .space-y-2 > * + * { margin-top: 8px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex justify-center items-start p-4 overflow-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl my-4">
        {/* Header - Blue gradient like the reference */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-t-xl border-b border-slate-200 dark:border-slate-700 px-6 py-4 print:hidden">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Xem trước phiếu in
            </h2>
            <div className="flex items-center gap-3">
              {/* Share Button - Green */}
              <button
                onClick={handleShare}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                {isExporting ? "Đang xử lý..." : "Chia sẻ"}
              </button>

              {/* Print Button - Blue */}
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                In phiếu
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Invoice Content - White background for proper screenshot */}
        <div className="max-h-[75vh] overflow-auto">
          <div ref={invoiceRef} className="p-6 bg-white">
            {children}
          </div>
        </div>

        {/* Footer with download option */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-b-xl border-t border-slate-200 dark:border-slate-700 px-6 py-3 print:hidden">
          <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
            <span>💡 Mẹo: Bấm "Chia sẻ" để gửi hình ảnh qua Zalo, Messenger</span>
            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
            >
              Tải ảnh về máy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
