import type { PinContextType } from "../../../contexts/pincorp/types";
import type { PinMaterial } from "../../types";

export interface MaterialsService {
  upsertMaterial: (material: PinMaterial) => Promise<void>;
  deleteMaterial: (materialId: string) => Promise<void>;
  reloadHistory: () => Promise<void>;
}

export function createMaterialsService(ctx: PinContextType): MaterialsService {
  return {
    upsertMaterial: async (material) => {
      // Delegate to existing context implementation for now
      await ctx.upsertPinMaterial(material);
    },
    deleteMaterial: async (materialId) => {
      await ctx.deletePinMaterial(materialId);
    },
    reloadHistory: async () => {
      await ctx.reloadPinMaterialHistory();
    },
  };
}
