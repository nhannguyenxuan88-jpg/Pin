// Mock AppContext for standalone PinCorp app
// This file exists only to prevent build/type-check errors.
// The actual app uses PinProviderStandalone instead.

import { createContext, useContext } from "react";

type ToastInput = {
  title: string;
  message?: string;
  type?: "success" | "error" | "warn" | "info";
};

export type StandaloneAppContextShape = {
  currentUser: { id?: string } | null;
  pinMaterials: any[];
  productionOrders: any[];
  pinProducts: any[];
  pinSales: any[];
  addToast: (toast: ToastInput) => void;
};

const defaultValue: StandaloneAppContextShape = {
  currentUser: null,
  pinMaterials: [],
  productionOrders: [],
  pinProducts: [],
  pinSales: [],
  addToast: () => {},
};

const AppContext = createContext<StandaloneAppContextShape>(defaultValue);

export const useAppContext = () => {
  return useContext(AppContext);
};

export default AppContext;
