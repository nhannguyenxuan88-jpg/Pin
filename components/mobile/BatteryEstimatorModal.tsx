import React, { useState, useMemo, useEffect } from "react";
import { usePinContext } from "../../contexts/PinContext";
import { XMarkIcon } from "../common/Icons";
import type { PinMaterial, PinBomMaterial } from "../../types";

interface BatteryEstimatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Default presets in case inventory is empty or user wants standard models
const CELL_PRESETS = [
  { name: "LG MH1 3200mAh (Li-Ion 3.7V)", capacity: 3.2, voltage: 3.7, purchasePrice: 55000, retailPrice: 75000, isLiIon: true },
  { name: "EVE 26V 2550mAh (Li-Ion 3.7V)", capacity: 2.55, voltage: 3.7, purchasePrice: 35000, retailPrice: 50000, isLiIon: true },
  { name: "Samsung 29E 2850mAh (Li-Ion 3.7V)", capacity: 2.85, voltage: 3.7, purchasePrice: 42000, retailPrice: 60000, isLiIon: true },
  { name: "EVE LiFePO4 105Ah (3.2V LFP)", capacity: 105, voltage: 3.2, purchasePrice: 950000, retailPrice: 1300000, isLiIon: false },
  { name: "LiFePO4 32700 6000mAh (3.2V)", capacity: 6.0, voltage: 3.2, purchasePrice: 38000, retailPrice: 55000, isLiIon: false }
];

const BMS_PRESETS = [
  { name: "Mạch BMS Daly 72V 45A Common Port", purchasePrice: 280000, retailPrice: 420000 },
  { name: "Mạch bảo vệ JK Smart BMS 80A-200A Cân bằng chủ động", purchasePrice: 950000, retailPrice: 1350000 },
  { name: "Mạch BMS Daly 48V 30A LFP", purchasePrice: 220000, retailPrice: 330000 },
  { name: "Mạch BMS Daly 60V 40A Li-Ion", purchasePrice: 260000, retailPrice: 390000 }
];

const formatVND = (amount: number) => {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " đ";
};

export const BatteryEstimatorModal: React.FC<BatteryEstimatorModalProps> = ({ isOpen, onClose }) => {
  const { pinMaterials = [], upsertPinBOM, addToast, storeSettings } = usePinContext();
  const shopName = storeSettings?.name || "Nhạn Lâm SmartCare";

  // --- Target configuration inputs ---
  const [targetVoltage, setTargetVoltage] = useState<number>(72);
  const [targetCapacity, setTargetCapacity] = useState<number>(30);
  const [isLiIon, setIsLiIon] = useState<boolean>(true); // true = Li-Ion 3.7V, false = LiFePO4 3.2V

  // --- Component selections ---
  const [selectedCellId, setSelectedCellId] = useState<string>("preset-0");
  const [selectedBmsId, setSelectedBmsId] = useState<string>("preset-0");

  // --- Adjusters ---
  const [customCellPrice, setCustomCellPrice] = useState<number>(0);
  const [customCellRetailPrice, setCustomCellRetailPrice] = useState<number>(0);
  const [customCellCapacity, setCustomCellCapacity] = useState<number>(3.2);
  const [customCellVoltage, setCustomCellVoltage] = useState<number>(3.7);

  const [customBmsPrice, setCustomBmsPrice] = useState<number>(0);
  const [customBmsRetailPrice, setCustomBmsRetailPrice] = useState<number>(0);

  // --- Other fees ---
  const [accessoriesCost, setAccessoriesCost] = useState<number>(350000); // Vỏ hộp, kẽm, co nhiệt, vv.
  const [laborCost, setLaborCost] = useState<number>(300000); // Tiền công ráp
  const [markupPercent, setMarkupPercent] = useState<number>(20); // Markup percentage (%)

  // --- Manual Override overrides ---
  const [seriesOverride, setSeriesOverride] = useState<number | null>(null);
  const [parallelOverride, setParallelOverride] = useState<number | null>(null);

  // --- Dynamic data processing ---
  // Filter cells and BMS from active inventory
  const inventoryCells = useMemo(() => {
    return pinMaterials.filter(m => {
      const nameLower = m.name.toLowerCase();
      return (
        m.category === "material" &&
        (nameLower.includes("cell") || nameLower.includes("pin") || nameLower.includes("lg") || nameLower.includes("eve") || nameLower.includes("samsung") || nameLower.includes("lishen"))
      );
    });
  }, [pinMaterials]);

  const inventoryBms = useMemo(() => {
    return pinMaterials.filter(m => {
      const nameLower = m.name.toLowerCase();
      return (
        m.category === "material" &&
        (nameLower.includes("bms") || nameLower.includes("mạch bảo vệ") || nameLower.includes("mạch bms") || nameLower.includes("daly") || nameLower.includes("jk"))
      );
    });
  }, [pinMaterials]);

  // Combined cells list (presets + inventory)
  const cellOptions = useMemo(() => {
    const opts = [];
    // Inventory cells
    inventoryCells.forEach(cell => {
      opts.push({
        id: cell.id,
        name: `[Kho] ${cell.name} (${formatVND(cell.purchasePrice)})`,
        material: cell,
        isPreset: false
      });
    });
    // Preset cells
    CELL_PRESETS.forEach((p, idx) => {
      opts.push({
        id: `preset-${idx}`,
        name: `[Mẫu] ${p.name}`,
        preset: p,
        isPreset: true
      });
    });
    return opts;
  }, [inventoryCells]);

  // Combined BMS list (presets + inventory)
  const bmsOptions = useMemo(() => {
    const opts = [];
    // Inventory BMS
    inventoryBms.forEach(bms => {
      opts.push({
        id: bms.id,
        name: `[Kho] ${bms.name} (${formatVND(bms.purchasePrice)})`,
        material: bms,
        isPreset: false
      });
    });
    // Preset BMS
    BMS_PRESETS.forEach((p, idx) => {
      opts.push({
        id: `preset-${idx}`,
        name: `[Mẫu] ${p.name}`,
        preset: p,
        isPreset: true
      });
    });
    return opts;
  }, [inventoryBms]);

  // Helper: Auto parse capacity from name
  const parseCellCapacity = (name: string): number => {
    const mahMatch = name.match(/(\d+)\s*mah/i);
    if (mahMatch) return Number(mahMatch[1]) / 1000;
    const ahMatch = name.match(/(\d+(?:\.\d+)?)\s*ah/i);
    if (ahMatch) return Number(ahMatch[1]);
    return 3.2; // default
  };

  // Sync custom inputs when selections change
  useEffect(() => {
    const cellOpt = cellOptions.find(o => o.id === selectedCellId);
    if (cellOpt) {
      if (cellOpt.isPreset && cellOpt.preset) {
        setCustomCellPrice(cellOpt.preset.purchasePrice);
        setCustomCellRetailPrice(cellOpt.preset.retailPrice);
        setCustomCellCapacity(cellOpt.preset.capacity);
        setCustomCellVoltage(cellOpt.preset.voltage);
        setIsLiIon(cellOpt.preset.isLiIon);
      } else if (cellOpt.material) {
        const mat = cellOpt.material;
        setCustomCellPrice(mat.purchasePrice);
        setCustomCellRetailPrice(mat.retailPrice || Math.round(mat.purchasePrice * 1.3));
        setCustomCellCapacity(parseCellCapacity(mat.name));
        const detectedVoltage = mat.name.toLowerCase().includes("lfp") || mat.name.toLowerCase().includes("lifepo4") || mat.name.toLowerCase().includes("3.2v") ? 3.2 : 3.7;
        setCustomCellVoltage(detectedVoltage);
        setIsLiIon(detectedVoltage === 3.7);
      }
    }
  }, [selectedCellId, cellOptions]);

  useEffect(() => {
    const bmsOpt = bmsOptions.find(o => o.id === selectedBmsId);
    if (bmsOpt) {
      if (bmsOpt.isPreset && bmsOpt.preset) {
        setCustomBmsPrice(bmsOpt.preset.purchasePrice);
        setCustomBmsRetailPrice(bmsOpt.preset.retailPrice);
      } else if (bmsOpt.material) {
        const mat = bmsOpt.material;
        setCustomBmsPrice(mat.purchasePrice);
        setCustomBmsRetailPrice(mat.retailPrice || Math.round(mat.purchasePrice * 1.35));
      }
    }
  }, [selectedBmsId, bmsOptions]);

  // Adjust chemistry voltage when chemistry switch is toggled manually
  const handleChemistryChange = (liIon: boolean) => {
    setIsLiIon(liIon);
    setCustomCellVoltage(liIon ? 3.7 : 3.2);
    // Reset overrides
    setSeriesOverride(null);
    setParallelOverride(null);
  };

  // Reset values
  const handleReset = () => {
    setTargetVoltage(72);
    setTargetCapacity(30);
    setIsLiIon(true);
    setSelectedCellId("preset-0");
    setSelectedBmsId("preset-0");
    setAccessoriesCost(350000);
    setLaborCost(300000);
    setMarkupPercent(20);
    setSeriesOverride(null);
    setParallelOverride(null);
  };

  // --- MATH CALCULATION ENGINE ---
  const cellNominalVoltage = customCellVoltage || (isLiIon ? 3.7 : 3.2);
  const cellCapacityAh = customCellCapacity || 3.2;

  // Series (S) auto calculation
  const calculatedS = useMemo(() => {
    return Math.round(targetVoltage / cellNominalVoltage);
  }, [targetVoltage, cellNominalVoltage]);

  const activeS = seriesOverride !== null ? seriesOverride : calculatedS;

  // Parallel (P) auto calculation
  const calculatedP = useMemo(() => {
    return Math.ceil(targetCapacity / cellCapacityAh);
  }, [targetCapacity, cellCapacityAh]);

  const activeP = parallelOverride !== null ? parallelOverride : calculatedP;

  // Total cells
  const totalCells = activeS * activeP;

  // Total costs
  const totalCellCostPrice = totalCells * customCellPrice;
  const totalCellRetailPrice = totalCells * customCellRetailPrice;

  // BOM costs
  const rawCost = useMemo(() => {
    return totalCellCostPrice + customBmsPrice + accessoriesCost + laborCost;
  }, [totalCellCostPrice, customBmsPrice, accessoriesCost, laborCost]);

  // Suggested selling price based on profit margin markup or raw component retail price totals
  const retailPriceByComponents = useMemo(() => {
    return totalCellRetailPrice + customBmsRetailPrice + accessoriesCost + laborCost;
  }, [totalCellRetailPrice, customBmsRetailPrice, accessoriesCost, laborCost]);

  // Active prices
  const finalRawCost = rawCost;
  const finalRetailPrice = retailPriceByComponents; // components accumulation is extremely realistic for workshops

  // Selected cell & bms display names
  const cellDisplayName = useMemo(() => {
    const opt = cellOptions.find(o => o.id === selectedCellId);
    if (!opt) return "Cell pin";
    return opt.isPreset ? opt.preset?.name || "Cell pin" : opt.material?.name || "Cell pin";
  }, [selectedCellId, cellOptions]);

  const bmsDisplayName = useMemo(() => {
    const opt = bmsOptions.find(o => o.id === selectedBmsId);
    if (!opt) return "Mạch bảo vệ BMS";
    return opt.isPreset ? opt.preset?.name || "Mạch bảo vệ BMS" : opt.material?.name || "Mạch bảo vệ BMS";
  }, [selectedBmsId, bmsOptions]);

  // --- ACTIONS ---

  // Copy Zalo quote
  const handleCopyQuote = () => {
    const chemistryText = isLiIon ? "Lithium-Ion 3.7V" : "LiFePO4 3.2V";
    const quoteText = `⚡ BÁO GIÁ KHỐI PIN XE ĐIỆN THÔNG MINH ⚡
----------------------------------
🔋 Thông số yêu cầu:
- Điện áp mong muốn: ${targetVoltage}V (${chemistryText})
- Dung lượng thiết kế: ${targetCapacity}Ah
- Loại cell sử dụng: ${cellDisplayName.replace("[Mẫu] ", "").replace("[Kho] ", "")} (${(cellCapacityAh * 1000).toFixed(0)}mAh)
- Mạch bảo vệ: ${bmsDisplayName.replace("[Mẫu] ", "").replace("[Kho] ", "")}

🛠️ Cấu hình thiết kế:
- Cấu hình ghép khối: ${activeS}S ${activeP}P
- Tổng số cell pin sử dụng: ${totalCells} cell

💰 Chi tiết vật tư báo giá:
- Cell pin: ${totalCells} cell x ${formatVND(customCellRetailPrice)} = ${formatVND(totalCellRetailPrice)}
- Mạch BMS bảo vệ: ${formatVND(customBmsRetailPrice)}
- Hộp chống nước, khung chịu lực & kẽm hàn: ${formatVND(accessoriesCost)}
- Tiền công ráp & cân bằng kỹ thuật: ${formatVND(laborCost)}
----------------------------------
💸 TỔNG GIÁ RÁP THÀNH PHẨM: ${formatVND(finalRetailPrice)}
(Đã bao gồm vỏ hộp hoàn thiện, test tải xung dung lượng, sạc cân bằng chủ động bảo vệ)
✨ Thời gian bảo hành: 12 tháng tại cửa hàng ✨
----------------------------------
Cửa hàng ${shopName} - Hân hạnh phục vụ quý khách!`;

    navigator.clipboard.writeText(quoteText)
      .then(() => {
        addToast({
          title: "Đã sao chép!",
          message: "Báo giá định dạng Zalo đã được lưu vào khay nhớ tạm.",
          type: "success"
        });
      })
      .catch(err => {
        console.error("Copy failed: ", err);
        alert("Lỗi khi sao chép báo giá. Vui lòng thử lại!");
      });
  };

  // Create BOM dynamically in inventory database
  const handleCreateBOM = async () => {
    try {
      const bomMaterials: PinBomMaterial[] = [];

      // Cell pin item
      const cellOpt = cellOptions.find(o => o.id === selectedCellId);
      if (cellOpt && !cellOpt.isPreset && cellOpt.material) {
        bomMaterials.push({
          materialId: cellOpt.material.id,
          quantity: totalCells
        });
      } else {
        // Find if preset matches any cell in inventory by name or sku, otherwise mock one
        const matched = pinMaterials.find(m => m.name.toLowerCase().includes("cell") && m.name.toLowerCase().includes(customCellCapacity.toString()));
        if (matched) {
          bomMaterials.push({
            materialId: matched.id,
            quantity: totalCells
          });
        }
      }

      // BMS item
      const bmsOpt = bmsOptions.find(o => o.id === selectedBmsId);
      if (bmsOpt && !bmsOpt.isPreset && bmsOpt.material) {
        bomMaterials.push({
          materialId: bmsOpt.material.id,
          quantity: 1
        });
      }

      // Notes
      const notes = `Khối ráp pin thông minh ước tính ${targetVoltage}V ${targetCapacity}Ah (${activeS}S ${activeP}P). Cần ${totalCells} cell ${cellDisplayName} và 1 ${bmsDisplayName}.`;

      // Upsert BOM
      const bomId = `BOM-EST-${Date.now()}`;
      await upsertPinBOM({
        id: bomId,
        productName: `Khối Pin Ráp ${targetVoltage}V ${targetCapacity}Ah (${activeS}S ${activeP}P)`,
        productSku: `PIN-${targetVoltage}V-${targetCapacity}AH`,
        materials: bomMaterials,
        notes,
        estimatedCost: finalRawCost
      });

      addToast({
        title: "Thành công!",
        message: `Đã tạo Hóa đơn vật tư (BOM) "${targetVoltage}V ${targetCapacity}Ah" trong kho lưu trữ!`,
        type: "success"
      });
    } catch (err) {
      console.error("Create BOM error: ", err);
      addToast({
        title: "Lỗi tạo BOM",
        message: "Không thể lưu Hóa đơn vật tư vào dữ liệu. Vui lòng thử lại!",
        type: "error"
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Container */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-t-3xl sm:rounded-3xl w-full max-w-lg md:max-w-5xl h-[92vh] md:h-[88vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-300 text-slate-100 font-sans">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/60 border-b border-slate-800/50 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
              <span className="text-sm">🧮</span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-wide uppercase text-slate-200">
                Tính ráp Khối pin nhanh
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Smart EV Battery Estimator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 pb-28 md:pb-6 scrollbar-hide">
          <div className="md:flex md:gap-6">
            <div className="space-y-5 md:flex-1">
              {/* Section 1: Customer request */}
              <div className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-2xl space-y-3.5 shadow-sm">
            <h4 className="text-xs font-black tracking-wider text-blue-400 uppercase">
              1. Yêu cầu của Khách hàng
            </h4>
            
            {/* Chemistry Selector */}
            <div className="flex rounded-xl bg-slate-950 p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => handleChemistryChange(true)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-all ${isLiIon ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
              >
                Lithium-Ion (3.7V)
              </button>
              <button
                type="button"
                onClick={() => handleChemistryChange(false)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-all ${!isLiIon ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
              >
                LiFePO4 (3.2V)
              </button>
            </div>

            {/* Voltage Picker */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-400">Điện áp mong muốn (V)</label>
              <div className="flex gap-2">
                {[36, 48, 60, 72].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setTargetVoltage(v);
                      setSeriesOverride(null);
                    }}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg border transition-all ${targetVoltage === v ? "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/5" : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"}`}
                  >
                    {v}V
                  </button>
                ))}
                <div className="w-1/4">
                  <input
                    type="number"
                    value={targetVoltage}
                    onChange={(e) => {
                      setTargetVoltage(Number(e.target.value));
                      setSeriesOverride(null);
                    }}
                    className="w-full text-center py-2 text-xs font-extrabold bg-slate-950 border border-slate-800 text-white rounded-lg focus:outline-none focus:border-blue-500/50"
                    placeholder="Khác"
                  />
                </div>
              </div>
            </div>

            {/* Capacity Picker */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-400">Dung lượng mong muốn (Ah)</label>
              <div className="flex gap-2">
                {[10, 15, 20, 30].map(ah => (
                  <button
                    key={ah}
                    type="button"
                    onClick={() => {
                      setTargetCapacity(ah);
                      setParallelOverride(null);
                    }}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg border transition-all ${targetCapacity === ah ? "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/5" : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"}`}
                  >
                    {ah}Ah
                  </button>
                ))}
                <div className="w-1/4">
                  <input
                    type="number"
                    value={targetCapacity}
                    onChange={(e) => {
                      setTargetCapacity(Number(e.target.value));
                      setParallelOverride(null);
                    }}
                    className="w-full text-center py-2 text-xs font-extrabold bg-slate-950 border border-slate-800 text-white rounded-lg focus:outline-none focus:border-blue-500/50"
                    placeholder="Khác"
                  />
                </div>
              </div>
            </div>
              </div>

              {/* Section 2: Materials selection */}
              <div className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-2xl space-y-3.5 shadow-sm">
            <h4 className="text-xs font-black tracking-wider text-emerald-400 uppercase">
              2. Chọn Cell & Linh kiện từ Kho
            </h4>

            {/* Cell Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-400">Chọn Cell pin</label>
              <select
                value={selectedCellId}
                onChange={(e) => setSelectedCellId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-950 text-slate-200 border border-slate-800 rounded-xl outline-none focus:border-blue-500/50"
              >
                {cellOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Cell Fine-tuners */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/50 text-[10px]">
              <div>
                <span className="text-slate-400 block mb-0.5 font-semibold">Dung lượng cell (Ah):</span>
                <input
                  type="number"
                  step="0.05"
                  value={customCellCapacity}
                  onChange={(e) => setCustomCellCapacity(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded focus:outline-none font-bold"
                />
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5 font-semibold">Điện áp cell (V):</span>
                <input
                  type="number"
                  step="0.1"
                  value={customCellVoltage}
                  onChange={(e) => setCustomCellVoltage(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded focus:outline-none font-bold"
                />
              </div>
              <div className="mt-1">
                <span className="text-slate-400 block mb-0.5 font-semibold">Giá vốn cell (đ):</span>
                <input
                  type="number"
                  value={customCellPrice}
                  onChange={(e) => setCustomCellPrice(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded focus:outline-none font-bold text-blue-400"
                />
              </div>
              <div className="mt-1">
                <span className="text-slate-400 block mb-0.5 font-semibold">Giá bán cell (đ):</span>
                <input
                  type="number"
                  value={customCellRetailPrice}
                  onChange={(e) => setCustomCellRetailPrice(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded focus:outline-none font-bold text-emerald-400"
                />
              </div>
            </div>

            {/* BMS Selection */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800/40">
              <label className="block text-xs font-extrabold text-slate-400">Chọn bảo vệ BMS</label>
              <select
                value={selectedBmsId}
                onChange={(e) => setSelectedBmsId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-950 text-slate-200 border border-slate-800 rounded-xl outline-none focus:border-blue-500/50"
              >
                {bmsOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* BMS Price Customizer */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/50 text-[10px]">
              <div>
                <span className="text-slate-400 block mb-0.5 font-semibold">BMS Giá vốn (đ):</span>
                <input
                  type="number"
                  value={customBmsPrice}
                  onChange={(e) => setCustomBmsPrice(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded focus:outline-none font-bold text-blue-400"
                />
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5 font-semibold">BMS Giá bán (đ):</span>
                <input
                  type="number"
                  value={customBmsRetailPrice}
                  onChange={(e) => setCustomBmsRetailPrice(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded focus:outline-none font-bold text-emerald-400"
                />
              </div>
            </div>
              </div>

              {/* Section 3: Fine tune config and auxiliary costs */}
              <div className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-2xl space-y-3.5 shadow-sm">
            <h4 className="text-xs font-black tracking-wider text-amber-400 uppercase">
              3. Cấu hình Khối & Chi phí khác
            </h4>

            {/* Config adjusters */}
            <div className="grid grid-cols-2 gap-4">
              {/* S adjusting */}
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold text-slate-400 block">Số ghép nối tiếp (S)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSeriesOverride(Math.max(1, activeS - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-extrabold cursor-pointer border-none"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-black text-sm text-slate-200">
                    {activeS}S
                  </span>
                  <button
                    type="button"
                    onClick={() => setSeriesOverride(activeS + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-extrabold cursor-pointer border-none"
                  >
                    +
                  </button>
                </div>
                <span className="text-[9px] text-slate-500 block text-center">
                  ~ {(activeS * cellNominalVoltage).toFixed(1)}V Danh định
                </span>
              </div>

              {/* P adjusting */}
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold text-slate-400 block">Số ghép song song (P)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setParallelOverride(Math.max(1, activeP - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-extrabold cursor-pointer border-none"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-black text-sm text-slate-200">
                    {activeP}P
                  </span>
                  <button
                    type="button"
                    onClick={() => setParallelOverride(activeP + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-extrabold cursor-pointer border-none"
                  >
                    +
                  </button>
                </div>
                <span className="text-[9px] text-slate-500 block text-center">
                  ~ {(activeP * cellCapacityAh).toFixed(1)}Ah Dung lượng
                </span>
              </div>
            </div>

            {/* Accessories & Labor */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/40 text-[10px]">
              <div>
                <span className="text-slate-400 block mb-0.5 font-semibold">Phụ kiện & Hộp đựng (đ):</span>
                <input
                  type="number"
                  value={accessoriesCost}
                  onChange={(e) => setAccessoriesCost(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-white rounded-lg focus:outline-none font-bold"
                />
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5 font-semibold">Công ráp hoàn thiện (đ):</span>
                <input
                  type="number"
                  value={laborCost}
                  onChange={(e) => setLaborCost(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-white rounded-lg focus:outline-none font-bold"
                />
              </div>
            </div>
              </div>
            </div>

            <div className="space-y-5 md:w-[360px] md:flex-shrink-0 md:sticky md:top-4">
              {/* Section 4: SUMMARY & DECISIONS */}
              <div className="bg-gradient-to-tr from-slate-950 to-slate-900 border border-slate-700/60 p-5 rounded-2xl space-y-4 shadow-xl">
            <h4 className="text-xs font-black tracking-wider text-purple-400 uppercase">
              4. Kết quả & Đề xuất báo giá
            </h4>

            {/* Calculations Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-center">
                <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                  Cấu hình ghép
                </span>
                <span className="text-lg font-black text-blue-400">
                  {activeS}S {activeP}P
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-center">
                <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                  Tổng số Cell cần
                </span>
                <span className="text-lg font-black text-amber-400">
                  {totalCells} cell
                </span>
              </div>
            </div>

            {/* Cost vs Retail prices */}
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-850 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Tổng chi phí vốn (Giá gốc):</span>
                <span className="font-extrabold text-slate-200">{formatVND(finalRawCost)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Lợi nhuận gộp ước tính:</span>
                <span className="font-bold text-emerald-500">+{formatVND(finalRetailPrice - finalRawCost)}</span>
              </div>
              <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-sm font-extrabold">
                <span className="text-slate-100">Giá bán lẻ đề xuất:</span>
                <span className="text-xl font-black text-emerald-400">{formatVND(finalRetailPrice)}</span>
              </div>
            </div>

            {/* BOM Visual Material Summary */}
            <div className="text-[10px] bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5">
              <span className="font-extrabold text-slate-400 block uppercase">Danh mục vật tư lắp ráp (BOM):</span>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>🔋 Cell: {totalCells} x {cellDisplayName.replace("[Mẫu] ", "").replace("[Kho] ", "")}</span>
                  <span className="font-semibold">{formatVND(totalCellRetailPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>⚡ BMS: 1 x {bmsDisplayName.replace("[Mẫu] ", "").replace("[Kho] ", "")}</span>
                  <span className="font-semibold">{formatVND(customBmsRetailPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>📦 Vỏ hộp & Kẽm hàn gia cố</span>
                  <span className="font-semibold">{formatVND(accessoriesCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>🛠️ Tiền công lắp ráp hoàn thiện</span>
                  <span className="font-semibold">{formatVND(laborCost)}</span>
                </div>
              </div>
            </div>
              </div>

              {/* Desktop actions */}
              <div className="hidden md:block bg-slate-950/80 border border-slate-800/70 p-4 rounded-2xl shadow-lg">
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={handleCopyQuote}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm py-3 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-500/20"
                  >
                    <span>💬 Báo giá Zalo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateBOM}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/20"
                  >
                    <span>💾 Lưu BOM kho</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-3 w-full text-xs text-slate-500 hover:text-slate-300 font-extrabold text-center transition-colors cursor-pointer border-none bg-transparent"
                >
                  Đặt lại mặc định
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Floating action buttons footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800/80 p-4 grid grid-cols-2 gap-3 z-15 backdrop-blur-sm md:hidden">
          <button
            type="button"
            onClick={handleCopyQuote}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-500/20"
          >
            <span>💬 Báo giá Zalo</span>
          </button>
          
          <button
            type="button"
            onClick={handleCreateBOM}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/20"
          >
            <span>💾 Lưu BOM kho</span>
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            className="col-span-2 text-[10px] text-slate-500 hover:text-slate-300 font-extrabold text-center transition-colors cursor-pointer border-none bg-transparent"
          >
            Đặt lại mặc định
          </button>
        </div>

      </div>
    </div>
  );
};

export default BatteryEstimatorModal;
