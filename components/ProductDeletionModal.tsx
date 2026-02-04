/**
 * Enhanced Product Deletion Confirmation Modal
 * Shows detailed impact analysis and provides deletion options
 */

import React, { useMemo, useState } from "react";
import { Icon, IconName, IconTone } from "./common/Icon";
import { PinProduct, PinBOM } from "../types";
import {
  useProductDeletion,
  ProductDeletionImpact,
  DeletionOptions,
} from "../lib/hooks/useProductDeletion";
import { usePinContext } from "../contexts/PinContext";

interface ProductDeletionModalProps {
  product: PinProduct | null;
  onClose: () => void;
  onConfirm: (product: PinProduct, options: DeletionOptions) => Promise<void>;
}

const RECOMMENDATION_ICON_MAP: Record<
  "safe" | "warning" | "blocked" | "default",
  { name: IconName; tone: IconTone }
> = {
  safe: { name: "success", tone: "success" },
  warning: { name: "warning", tone: "warning" },
  blocked: { name: "danger", tone: "danger" },
  default: { name: "info", tone: "info" },
};

const ProductDeletionModal: React.FC<ProductDeletionModalProps> = ({
  product,
  onClose,
  onConfirm,
}) => {
  const { getProductDeletionPreview } = useProductDeletion();
  const ctx = usePinContext();
  const { addToast } = ctx;
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<DeletionOptions>({
    returnMaterials: true,
    deleteBOMs: false,
    cancelActiveOrders: false,
    completeActiveOrders: false,
    forceDelete: false,
  });
  const [quantity, setQuantity] = useState<number>(product?.stock || 1);
  const [forceAck, setForceAck] = useState<boolean>(false);

  // IMPORTANT: Hooks must run on every render (even when product is null)
  const returnPreview = useMemo(() => {
    if (!product || !options.returnMaterials || !ctx) return null;
    const bom = ctx.pinBOMs.find(
      (b: PinBOM) =>
        b.productSku === product.sku || b.productName === product.name
    );
    if (!bom || !Array.isArray(bom.materials) || bom.materials.length === 0)
      return { items: [], total: 0, hasBOM: false } as const;
    const items = bom.materials
      .map(
        (m: {
          materialId: string;
          quantity: number;
          materialName?: string;
          unit?: string;
        }) => {
          const mat = ctx.pinMaterials.find((x: any) => x.id === m.materialId);
          const qty = (m.quantity || 0) * (quantity || 0);
          return {
            id: m.materialId,
            name: mat?.name || m.materialName || m.materialId,
            qty,
            unit: mat?.unit || m.unit || "",
          };
        }
      )
      .filter((x: { qty: number }) => x.qty > 0);
    const total = items.reduce(
      (s: number, it: { qty: number }) => s + it.qty,
      0
    );
    return { items, total, hasBOM: true } as const;
  }, [product, options.returnMaterials, quantity, ctx]);

  if (!product) return null;

  const preview = getProductDeletionPreview(product);
  const { title, impact, recommendedAction } = preview;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(product, { ...options, quantity });
      onClose();
    } catch (error) {
      addToast?.({
        id: crypto.randomUUID(),
        message: "Lỗi khi xóa sản phẩm: " + (error as Error).message,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = () => {
    switch (recommendedAction) {
      case "safe":
        return "text-green-600 bg-green-50 border-green-200";
      case "warning":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "blocked":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getRecommendationIcon = () => {
    const key = (recommendedAction ??
      "default") as keyof typeof RECOMMENDATION_ICON_MAP;
    const iconMeta =
      RECOMMENDATION_ICON_MAP[key] || RECOMMENDATION_ICON_MAP.default;

    return <Icon name={iconMeta.name} tone={iconMeta.tone} size="md" />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Xác nhận xóa sản phẩm
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Icon name="close" size="lg" className="text-current" />
            </button>
          </div>

          {/* Recommendation Banner */}
          <div
            className={`border rounded-lg p-4 mb-6 ${getRecommendationColor()}`}
          >
            <div className="flex items-start space-x-3">
              {getRecommendationIcon()}
              <div>
                <h3 className="font-medium mb-1">{title}</h3>
                <p className="text-sm opacity-90">
                  Sản phẩm: <strong>{product.name}</strong> ({product.sku})
                </p>
              </div>
            </div>
          </div>

          {/* Impact Analysis */}
          <div className="space-y-4 mb-6">
            {/* Blockers */}
            {impact.blockers.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2 flex items-center">
                  <Icon
                    name="danger"
                    size="sm"
                    tone="danger"
                    className="mr-2"
                  />
                  Vấn đề nghiêm trọng ({impact.blockers.length})
                </h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {impact.blockers.map((blocker, index) => (
                    <li key={`blocker-${index}`}>• {blocker}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {impact.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2 flex items-center">
                  <Icon
                    name="warning"
                    size="sm"
                    tone="warning"
                    className="mr-2"
                  />
                  Cảnh báo ({impact.warnings.length})
                </h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {impact.warnings.map((warning, index) => (
                    <li key={`warning-${index}`}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related Data */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <Icon name="info" size="sm" tone="info" className="mr-2" />
                Dữ liệu liên quan
              </h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• {impact.relatedBOMs.length} công thức sản xuất (BOMs)</p>
                <p>• {impact.activeOrders.length} đơn hàng đang hoạt động</p>
                <p>• {impact.completedOrders.length} đơn hàng đã hoàn thành</p>
              </div>
            </div>

            {/* Suggested Actions */}
            {impact.suggestedActions.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">
                  Hành động được khuyến nghị
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {impact.suggestedActions.map((action, index) => (
                    <li key={`action-${index}`}>• {action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Deletion Options */}
          {!impact.canDelete ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">
                <strong>Không thể xóa sản phẩm này</strong> do có đơn hàng sản
                xuất đang hoạt động. Vui lòng hoàn thành hoặc hủy các đơn hàng
                trước khi xóa sản phẩm.
              </p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <h4 className="font-medium text-gray-900">Tùy chọn xóa</h4>

              {/* Quantity */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 min-w-[110px]">
                  Số lượng xóa
                </label>
                <input
                  type="number"
                  min={1}
                  max={product.stock}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(
                          product.stock || 1,
                          Number(e.target.value) || 1
                        )
                      )
                    )
                  }
                  className="w-24 p-2 border rounded-md border-gray-300"
                />
                <span className="text-xs text-gray-500">
                  Tồn hiện tại: <strong>{product.stock}</strong>
                </span>
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={options.returnMaterials}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        returnMaterials: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    Hoàn trả nguyên liệu về kho khi xóa
                  </span>
                </label>

                {/* Return preview */}
                {options.returnMaterials && (
                  <div className="ml-6">
                    {!returnPreview ? null : returnPreview.items.length ===
                      0 ? (
                      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
                        Không tìm thấy BOM hoặc BOM không có nguyên liệu để hoàn
                        trả.
                      </div>
                    ) : (
                      <div className="text-xs text-gray-700 bg-green-50 border border-green-200 rounded p-3">
                        <div className="font-medium text-green-800 mb-1">
                          Nguyên liệu dự kiến hoàn trả (
                          {returnPreview.items.length} loại)
                        </div>
                        <ul className="space-y-1">
                          {returnPreview.items.slice(0, 8).map((it) => (
                            <li key={it.id}>
                              • {it.name}: <strong>{it.qty}</strong> {it.unit}
                            </li>
                          ))}
                          {returnPreview.items.length > 8 && (
                            <li>
                              … và {returnPreview.items.length - 8} nguyên liệu
                              khác
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {impact.relatedBOMs.length > 0 && (
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={options.deleteBOMs}
                      onChange={(e) =>
                        setOptions({ ...options, deleteBOMs: e.target.checked })
                      }
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">
                      Xóa các công thức sản xuất liên quan (
                      {impact.relatedBOMs.length} BOMs)
                    </span>
                  </label>
                )}

                {impact.activeOrders.length > 0 && (
                  <>
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="orderAction"
                        checked={options.cancelActiveOrders}
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            cancelActiveOrders: e.target.checked,
                            completeActiveOrders: false,
                          })
                        }
                        className="text-blue-600"
                      />
                      <span className="text-sm text-gray-700">
                        Hủy các đơn hàng đang hoạt động (
                        {impact.activeOrders.length} orders)
                      </span>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="orderAction"
                        checked={options.completeActiveOrders}
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            completeActiveOrders: e.target.checked,
                            cancelActiveOrders: false,
                          })
                        }
                        className="text-blue-600"
                      />
                      <span className="text-sm text-gray-700">
                        Đánh dấu hoàn thành các đơn hàng đang hoạt động
                      </span>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={options.forceDelete}
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            forceDelete: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-red-600"
                      />
                      <span className="text-sm text-red-700 font-medium">
                        ⚠️ Buộc xóa (không an toàn - có thể gây mất dữ liệu)
                      </span>
                    </label>

                    {options.forceDelete && (
                      <div className="ml-6 mt-2 p-3 border border-red-200 bg-red-50 rounded">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={forceAck}
                            onChange={(e) => setForceAck(e.target.checked)}
                            className="rounded border-gray-300 text-red-600"
                          />
                          <span className="text-sm text-red-800">
                            Tôi hiểu rủi ro và xác nhận thực hiện thao tác này
                          </span>
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                loading ||
                (!impact.canDelete && !options.forceDelete) ||
                quantity <= 0 ||
                quantity > (product.stock || 0) ||
                (options.forceDelete && !forceAck)
              }
              className={`px-4 py-2 rounded-lg transition-colors ${
                impact.canDelete || options.forceDelete
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {loading ? "Đang xóa..." : "Xác nhận xóa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDeletionModal;
