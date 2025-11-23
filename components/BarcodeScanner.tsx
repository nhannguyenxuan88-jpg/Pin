import React, { useState, useEffect, useRef } from "react";
import { usePinContext } from "../contexts/PinContext";
import { createBarcodeService } from "../lib/services/BarcodeService";
import type { ScanResult } from "../lib/services/BarcodeService";
import { Card } from "./ui/Card";
import { Icon } from "./common/Icon";
import { XMarkIcon, CameraIcon, DocumentArrowDownIcon } from "./common/Icons";

interface BarcodeScannerProps {
  onScanSuccess?: (result: ScanResult) => void;
  mode?: "scanner" | "generator";
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  mode: initialMode = "scanner",
}) => {
  const ctx = usePinContext();
  const barcodeService = createBarcodeService();

  const [mode, setMode] = useState<"scanner" | "generator">(initialMode);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Generator mode
  const [textToEncode, setTextToEncode] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load available cameras
    barcodeService.getCameras().then((cams) => {
      setCameras(cams);
      if (cams.length > 0) {
        setSelectedCamera(cams[0].id);
      }
    });

    // Cleanup on unmount
    return () => {
      if (scanning) {
        barcodeService.stopScanner();
      }
    };
  }, []);

  const handleStartScan = async () => {
    try {
      setError("");
      setScanResult(null);

      await barcodeService.startScanner(
        "qr-reader",
        (result) => {
          setScanResult(result);
          setScanning(false);
          barcodeService.stopScanner();

          if (onScanSuccess) {
            onScanSuccess(result);
          }

          // Auto-search for product
          searchProduct(result.text);
        },
        (err) => {
          setError(err);
        }
      );

      setScanning(true);
    } catch (err: any) {
      setError(err?.message || "Failed to start scanner");
    }
  };

  const handleStopScan = async () => {
    try {
      await barcodeService.stopScanner();
      setScanning(false);
    } catch (err: any) {
      setError(err?.message || "Failed to stop scanner");
    }
  };

  const searchProduct = (code: string) => {
    const parsed = barcodeService.parseProductCode(code);

    if (parsed.type === "sku") {
      // Search in products
      const product = ctx.pinProducts?.find(
        (p) => p.sku.toUpperCase() === parsed.value
      );
      if (product) {
        ctx.addToast?.({
          type: "success",
          title: "Tìm thấy sản phẩm",
          message: `${product.name} - ${product.sku}`,
        });
      } else {
        // Search in materials
        const material = ctx.pinMaterials?.find(
          (m) => m.sku.toUpperCase() === parsed.value
        );
        if (material) {
          ctx.addToast?.({
            type: "success",
            title: "Tìm thấy nguyên liệu",
            message: `${material.name} - ${material.sku}`,
          });
        } else {
          ctx.addToast?.({
            type: "warn",
            title: "Không tìm thấy",
            message: `Không tìm thấy sản phẩm với mã ${code}`,
          });
        }
      }
    } else {
      ctx.addToast?.({
        type: "info",
        title: "Mã quét được",
        message: code,
      });
    }
  };

  const handleGenerateQR = async () => {
    try {
      setError("");
      if (!textToEncode.trim()) {
        setError("Vui lòng nhập nội dung để tạo QR code");
        return;
      }

      const dataUrl = await barcodeService.generateQRCode(textToEncode, 400);
      setQrCodeUrl(dataUrl);
    } catch (err: any) {
      setError(err?.message || "Failed to generate QR code");
    }
  };

  const handleDownloadQR = async () => {
    try {
      if (!textToEncode.trim()) return;

      const filename = textToEncode.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      await barcodeService.downloadQRCode(textToEncode, `qr_${filename}`, 800);

      ctx.addToast?.({
        type: "success",
        title: "Tải xuống thành công",
        message: "QR code đã được tải xuống",
      });
    } catch (err: any) {
      setError(err?.message || "Failed to download QR code");
    }
  };

  const handleGenerateForProduct = async () => {
    const product = ctx.pinProducts?.find((p) => p.id === selectedProduct);
    if (!product) return;

    setTextToEncode(product.sku);
    const dataUrl = await barcodeService.generateQRCode(product.sku, 400);
    setQrCodeUrl(dataUrl);
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-100">
            📷 Quét & Tạo Mã vạch
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Quét QR code hoặc tạo mã cho sản phẩm
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("scanner")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === "scanner"
                ? "bg-blue-500 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            📷 Quét mã
          </button>
          <button
            onClick={() => setMode("generator")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === "generator"
                ? "bg-blue-500 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            ✨ Tạo QR
          </button>
        </div>
      </div>

      {/* Scanner Mode */}
      {mode === "scanner" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner */}
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Quét mã QR / Barcode
              </h3>

              {/* Camera Selector */}
              {cameras.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Chọn camera
                  </label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    disabled={scanning}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Scanner View */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
                <div
                  id="qr-reader"
                  ref={scannerRef}
                  className="w-full h-full"
                />
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                    <div className="text-center text-white">
                      <CameraIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Nhấn "Bắt đầu quét" để bắt đầu</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                {!scanning ? (
                  <button
                    onClick={handleStartScan}
                    className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <CameraIcon className="w-5 h-5" />
                    Bắt đầu quét
                  </button>
                ) : (
                  <button
                    onClick={handleStopScan}
                    className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <XMarkIcon className="w-5 h-5" />
                    Dừng quét
                  </button>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    ⚠️ {error}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Results */}
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Kết quả quét
              </h3>

              {scanResult ? (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">✅</div>
                      <div className="flex-1">
                        <div className="font-semibold text-green-800 dark:text-green-200 mb-2">
                          Quét thành công!
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300 break-all font-mono bg-green-100 dark:bg-green-900/30 p-3 rounded">
                          {scanResult.text}
                        </div>
                        {scanResult.format && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                            Format: {scanResult.format}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(scanResult.text);
                      ctx.addToast?.({
                        type: "success",
                        title: "Đã sao chép",
                        message: "Mã đã được sao chép vào clipboard",
                      });
                    }}
                    className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                  >
                    📋 Sao chép mã
                  </button>

                  <button
                    onClick={() => {
                      setScanResult(null);
                      setError("");
                    }}
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Quét mã mới
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Chưa có kết quả quét
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                    Hãy bắt đầu quét để xem kết quả
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Generator Mode */}
      {mode === "generator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generator Form */}
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Tạo QR Code
              </h3>

              {/* Text Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Nội dung QR Code
                </label>
                <textarea
                  value={textToEncode}
                  onChange={(e) => setTextToEncode(e.target.value)}
                  placeholder="Nhập SKU, URL, hoặc nội dung bất kỳ..."
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Quick Select Product */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Hoặc chọn sản phẩm
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Chọn sản phẩm --</option>
                    {ctx.pinProducts?.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleGenerateForProduct}
                    disabled={!selectedProduct}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    Tạo
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateQR}
                disabled={!textToEncode.trim()}
                className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                ✨ Tạo QR Code
              </button>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    ⚠️ {error}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* QR Code Preview */}
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Xem trước QR Code
              </h3>

              {qrCodeUrl ? (
                <div className="space-y-4">
                  <div className="bg-white border-2 border-slate-200 dark:border-slate-700 rounded-lg p-8 flex items-center justify-center">
                    <img src={qrCodeUrl} alt="QR Code" className="max-w-full" />
                  </div>

                  <button
                    onClick={handleDownloadQR}
                    className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <DocumentArrowDownIcon className="w-5 h-5" />
                    Tải xuống QR Code
                  </button>

                  <button
                    onClick={() => {
                      setQrCodeUrl("");
                      setTextToEncode("");
                      setSelectedProduct("");
                    }}
                    className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Tạo mã mới
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📱</div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Chưa có QR Code
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                    Nhập nội dung và nhấn "Tạo QR Code"
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Info */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            💡 Hướng dẫn sử dụng
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                Quét mã:
              </h4>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                <li>Cho phép truy cập camera khi được yêu cầu</li>
                <li>Đưa mã QR/Barcode vào khung hình</li>
                <li>Kết quả sẽ hiện ngay khi quét thành công</li>
                <li>Hệ thống tự động tìm kiếm sản phẩm</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                Tạo QR:
              </h4>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                <li>Nhập SKU sản phẩm hoặc nội dung bất kỳ</li>
                <li>Hoặc chọn nhanh từ danh sách sản phẩm</li>
                <li>Nhấn "Tạo QR Code" để tạo</li>
                <li>Tải xuống để in hoặc sử dụng</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BarcodeScanner;
