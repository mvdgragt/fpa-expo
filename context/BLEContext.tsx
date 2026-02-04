import React, { createContext, useContext, useEffect, useState } from "react";
import { BleManager, Device } from "react-native-ble-plx";

interface BleContextType {
  connectedDevice: Device | null;
  isConnecting: boolean;
  connectToESP32: () => Promise<void>;
}

const BleContext = createContext<BleContextType | undefined>(undefined);

// Keep manager outside the component to persist across renders
const bleManager = new BleManager();
const ESP32_NAME = "FPA HUB";

export const BleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectToESP32 = async () => {
    if (connectedDevice || isConnecting) return;

    setIsConnecting(true);
    try {
      // Check if already connected
      const connected = await bleManager.connectedDevices([]);
      const existing = connected.find((d) => d.name?.includes(ESP32_NAME));

      if (existing) {
        setConnectedDevice(existing);
        setIsConnecting(false);
        return;
      }

      bleManager.startDeviceScan(null, null, async (error, device) => {
        if (error) {
          setIsConnecting(false);
          return;
        }
        if (device && device.name?.includes(ESP32_NAME)) {
          bleManager.stopDeviceScan();
          const connected = await device.connect();
          await connected.discoverAllServicesAndCharacteristics();

          // Listen for disconnection
          connected.onDisconnected(() => {
            setConnectedDevice(null);
          });

          setConnectedDevice(connected);
          setIsConnecting(false);
        }
      });

      setTimeout(() => {
        bleManager.stopDeviceScan();
        setIsConnecting(false);
      }, 10000);
    } catch (e) {
      setIsConnecting(false);
      console.log(e);
    }
  };

  useEffect(() => {
    const subscription = bleManager.onStateChange((state) => {
      if (state === "PoweredOn") connectToESP32();
    }, true);
    return () => subscription.remove();
  }, []);

  return (
    <BleContext.Provider
      value={{ connectedDevice, isConnecting, connectToESP32 }}
    >
      {children}
    </BleContext.Provider>
  );
};

export const useBle = () => {
  const context = useContext(BleContext);
  if (!context) throw new Error("useBle must be used within a BleProvider");
  return context;
};
