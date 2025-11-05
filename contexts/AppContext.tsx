// Mock AppContext for standalone PinCorp app
// This file exists only to prevent build errors
// The actual app uses PinProviderStandalone instead

import { createContext, useContext } from 'react';

const AppContext = createContext<any>(null);

export const useAppContext = () => {
  throw new Error('useAppContext should not be used in standalone PinCorp app. Use usePinStandaloneContext instead.');
};

export default AppContext;
