import { useEffect } from "react";

/**
 * Custom hook to persist modal states in localStorage
 * Prevents modals from closing when switching browser tabs
 *
 * @param storageKey - Unique key for localStorage (e.g., 'serviceManager_modals')
 * @param modalStates - Object containing all modal state values
 * @param isAnyModalOpen - Boolean indicating if any modal is currently open
 * @param restoreCallback - Function to restore modal states from saved data
 */
export function useModalPersistence<T extends Record<string, any>>(
  storageKey: string,
  modalStates: T,
  isAnyModalOpen: boolean,
  restoreCallback?: (savedStates: T) => void
) {
  // Load saved modal states on mount
  useEffect(() => {
    const savedStates = localStorage.getItem(storageKey);
    if (savedStates && restoreCallback) {
      try {
        const parsed = JSON.parse(savedStates);
        restoreCallback(parsed);
      } catch (e) {
        console.error(`Error loading ${storageKey}:`, e);
      }
    }
  }, [storageKey, restoreCallback]);

  // Save modal states whenever they change
  useEffect(() => {
    if (isAnyModalOpen) {
      localStorage.setItem(storageKey, JSON.stringify(modalStates));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, modalStates, isAnyModalOpen]);
}
