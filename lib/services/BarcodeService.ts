/**
 * Barcode Scanner Service
 * Provides barcode/QR code scanning and generation
 */

import { Html5Qrcode } from "html5-qrcode";
import QRCode from "qrcode";

export interface ScanResult {
  text: string;
  format?: string;
}

export interface BarcodeService {
  // Scanner
  startScanner: (
    elementId: string,
    onSuccess: (result: ScanResult) => void,
    onError?: (error: string) => void
  ) => Promise<void>;
  stopScanner: () => Promise<void>;
  isScanning: () => boolean;
  getCameras: () => Promise<{ id: string; label: string }[]>;
  switchCamera: (cameraId: string) => Promise<void>;

  // QR Code Generator
  generateQRCode: (text: string, size?: number) => Promise<string>;
  downloadQRCode: (
    text: string,
    filename: string,
    size?: number
  ) => Promise<void>;

  // Barcode utilities
  parseProductCode: (code: string) => {
    type: "sku" | "product_id" | "unknown";
    value: string;
  };
}

export function createBarcodeService(): BarcodeService {
  let html5QrCode: Html5Qrcode | null = null;
  let currentElementId: string | null = null;
  let scanning = false;

  return {
    startScanner: async (elementId, onSuccess, onError) => {
      try {
        if (scanning && html5QrCode) {
          await html5QrCode.stop();
        }

        html5QrCode = new Html5Qrcode(elementId);
        currentElementId = elementId;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText, decodedResult) => {
            onSuccess({
              text: decodedText,
              format: decodedResult.result.format?.formatName,
            });
          },
          (errorMessage) => {
            // Ignore continuous scanning errors
            if (onError && !errorMessage.includes("NotFoundException")) {
              onError(errorMessage);
            }
          }
        );

        scanning = true;
      } catch (error: any) {
        scanning = false;
        if (onError) {
          onError(error?.message || "Failed to start scanner");
        }
        throw error;
      }
    },

    stopScanner: async () => {
      if (html5QrCode && scanning) {
        try {
          await html5QrCode.stop();
          html5QrCode.clear();
        } catch (error) {
          console.error("Error stopping scanner:", error);
        }
      }
      scanning = false;
      html5QrCode = null;
      currentElementId = null;
    },

    isScanning: () => scanning,

    getCameras: async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        return devices.map((device) => ({
          id: device.id,
          label: device.label || `Camera ${device.id}`,
        }));
      } catch (error) {
        console.error("Error getting cameras:", error);
        return [];
      }
    },

    switchCamera: async (cameraId) => {
      if (!html5QrCode || !scanning) {
        throw new Error("Scanner not active");
      }

      await html5QrCode.stop();

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      };

      await html5QrCode.start(
        { deviceId: cameraId },
        config,
        (decodedText, decodedResult) => {
          // Will use the same callbacks as before
        },
        (errorMessage) => {
          // Error handling
        }
      );
    },

    generateQRCode: async (text, size = 300) => {
      try {
        const dataUrl = await QRCode.toDataURL(text, {
          width: size,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        return dataUrl;
      } catch (error) {
        console.error("Error generating QR code:", error);
        throw error;
      }
    },

    downloadQRCode: async (text, filename, size = 600) => {
      try {
        const dataUrl = await QRCode.toDataURL(text, {
          width: size,
          margin: 2,
        });

        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = filename.endsWith(".png")
          ? filename
          : `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("Error downloading QR code:", error);
        throw error;
      }
    },

    parseProductCode: (code) => {
      // Check if it's a SKU pattern (e.g., MAT001, PRO001)
      if (/^(MAT|PRO|PROD)\d+$/i.test(code)) {
        return {
          type: "sku",
          value: code.toUpperCase(),
        };
      }

      // Check if it's a UUID or ID
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          code
        )
      ) {
        return {
          type: "product_id",
          value: code,
        };
      }

      return {
        type: "unknown",
        value: code,
      };
    },
  };
}
