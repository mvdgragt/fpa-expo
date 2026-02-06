// context/BLEContext.tsx
import { Buffer } from "buffer";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { BleManager, Device } from "react-native-ble-plx";

// Polyfill for Buffer
global.Buffer = global.Buffer || Buffer;

interface BleContextType {
  connectedDevice: Device | null;
  isConnecting: boolean;
  distance: number | null;
  connectToESP32: () => Promise<void>;
}

const BleContext = createContext<BleContextType | undefined>(undefined);

// Keep manager outside the component to persist across renders
const bleManager = new BleManager();
const ESP32_NAME = "FPA HUB";
const SERVICE_UUID = "12345678-1234-1234-1234-123456789abc";
const CHARACTERISTIC_UUID = "87654321-4321-4321-4321-cba987654321";

export const BleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const lastDistanceUpdate = useRef<number>(0);
  const lastDistanceValue = useRef<number | null>(null);

  // Parse distance from BLE notification
  const parseDistance = useCallback((data: string) => {
    // Expected format: "D:123.45 S:67.89" or "ID:2,Dist:123.45,Str:67.89,ReadID:123"
    const distMatch = data.match(/(?:D:|Dist:)(\d+\.?\d*)/);
    if (distMatch && distMatch[1]) {
      return parseFloat(distMatch[1]);
    }
    return null;
  }, []);

  const connectToESP32 = useCallback(async () => {
    console.log("[BLE] connectToESP32 called", {
      alreadyConnected: !!connectedDevice,
      isConnecting,
    });
    if (connectedDevice || isConnecting) return;

    setIsConnecting(true);
    setDistance(null);

    try {
      // Check if already connected
      const connected = await bleManager.connectedDevices([]);
      const existing = connected.find((d) => d.name?.includes(ESP32_NAME));

      if (existing) {
        setConnectedDevice(existing);
        setIsConnecting(false);
        return;
      }

      console.log("[BLE] Starting scan...");
      bleManager.startDeviceScan(null, null, async (error, device) => {
        if (error) {
          console.error("BLE Scan Error:", error);
          setIsConnecting(false);
          return;
        }

        if (device?.name) {
          console.log("[BLE] Found device:", device.name, device.id);
        }
        if (device && device.name?.includes(ESP32_NAME)) {
          console.log("[BLE] Found ESP32! Stopping scan and connecting...");
          bleManager.stopDeviceScan();

          try {
            const connected = await device.connect();
            await connected.discoverAllServicesAndCharacteristics();

            // Set up notification listener for distance updates
            connected.monitorCharacteristicForService(
              SERVICE_UUID,
              CHARACTERISTIC_UUID,
              (error, characteristic) => {
                if (error) {
                  console.error("Monitor Error:", error);
                  return;
                }

                if (characteristic?.value) {
                  try {
                    const data = Buffer.from(
                      characteristic.value,
                      "base64",
                    ).toString("utf-8");
                    console.log("Received BLE data:", data);
                    const parsedDistance = parseDistance(data);
                    if (parsedDistance !== null) {
                      const now = Date.now();
                      const valueChanged =
                        parsedDistance !== lastDistanceValue.current;
                      if (
                        valueChanged ||
                        now - lastDistanceUpdate.current > 50
                      ) {
                        lastDistanceValue.current = parsedDistance;
                        lastDistanceUpdate.current = now;
                        setDistance(parsedDistance);
                      }
                    }
                  } catch (e) {
                    console.error("Error parsing BLE data:", e);
                  }
                }
              },
            );

            // Listen for disconnection
            connected.onDisconnected(() => {
              setConnectedDevice(null);
              setDistance(null);
            });

            console.log("[BLE] Connected and monitoring!");
            setConnectedDevice(connected);
          } catch (connError) {
            console.error("Connection Error:", connError);
          }

          setIsConnecting(false);
        }
      });

      setTimeout(() => {
        bleManager.stopDeviceScan();
        if (isConnecting) {
          setIsConnecting(false);
        }
      }, 10000);
    } catch (e) {
      console.error("BLE Connection Error:", e);
      setIsConnecting(false);
    }
  }, [connectedDevice, isConnecting, parseDistance]);

  useEffect(() => {
    const subscription = bleManager.onStateChange((state) => {
      console.log("[BLE] State changed:", state);
      if (state === "PoweredOn") connectToESP32();
    }, true);
    return () => subscription.remove();
  }, [connectToESP32]);

  return (
    <BleContext.Provider
      value={{ connectedDevice, isConnecting, distance, connectToESP32 }}
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
