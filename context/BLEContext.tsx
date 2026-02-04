import React, { createContext, useContext, useState } from "react";

interface BLEContextType {
  isConnected: boolean;
  deviceName: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const BLEContext = createContext<BLEContextType>({
  isConnected: false,
  deviceName: null,
  connect: async () => {},
  disconnect: () => {},
});

export const useBLE = () => useContext(BLEContext);

export function BLEProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const connect = async () => {
    // This will be implemented with actual BLE logic later
    setIsConnected(true);
    setDeviceName("FPA_Sensor");
  };

  const disconnect = () => {
    setIsConnected(false);
    setDeviceName(null);
  };

  return (
    <BLEContext.Provider
      value={{ isConnected, deviceName, connect, disconnect }}
    >
      {children}
    </BLEContext.Provider>
  );
}
