import { createContext, useContext } from 'react';

export const NeuralWireContext = createContext(null);

export function useNeuralWireContext() {
  return useContext(NeuralWireContext);
}
