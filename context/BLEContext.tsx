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
  hubDistance: number | null;
  remoteDistance: number | null;
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
  const isConnectingRef = useRef(false);
  const bleStateRef = useRef<string>("Unknown");
  const unsupportedLoggedRef = useRef(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [hubDistance, setHubDistance] = useState<number | null>(null);
  const [remoteDistance, setRemoteDistance] = useState<number | null>(null);
  const lastDistanceUpdate = useRef<number>(0);
  const lastDistanceValue = useRef<number | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopScan = useCallback(() => {
    try {
      bleManager.stopDeviceScan();
    } catch {
      // ignore
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  // Parse distance from BLE notification
  // Supports formats:
  //   Legacy: "D:123.45 S:67.89" or "ID:2,Dist:123.45,Str:67.89,ReadID:123"
  //   Flying twenty: "H:123.45,R:456.78" (H=hub/start gate, R=remote/stop gate)
  const parseDistance = useCallback((data: string) => {
    const distMatch = data.match(/(?:D:|Dist:)(\d+\.?\d*)/);
    if (distMatch && distMatch[1]) {
      return parseFloat(distMatch[1]);
    }
    return null;
  }, []);

  const parseGateDistances = useCallback((data: string) => {
    const hubMatch = data.match(/H:(\d+\.?\d*)/);
    const remMatch = data.match(/R:(\d+\.?\d*)/);
    return {
      hub: hubMatch ? parseFloat(hubMatch[1]) : null,
      remote: remMatch ? parseFloat(remMatch[1]) : null,
    };
  }, []);

  const connectToESP32 = useCallback(async () => {
    if (__DEV__) {
      console.log("[BLE] connectToESP32 called", {
        alreadyConnected: !!connectedDevice,
        isConnecting,
        state: bleStateRef.current,
      });
    }
    if (connectedDevice || isConnecting) return;

    if (bleStateRef.current !== "PoweredOn") {
      if (
        bleStateRef.current === "Unsupported" &&
        !unsupportedLoggedRef.current
      ) {
        unsupportedLoggedRef.current = true;
        console.log("[BLE] BluetoothLE is unsupported on this device");
      }
      return;
    }

    setIsConnecting(true);
    isConnectingRef.current = true;
    setDistance(null);
    setHubDistance(null);
    setRemoteDistance(null);

    try {
      // Check if already connected
      const connected = await bleManager.connectedDevices([]);
      const existing = connected.find((d) => d.name?.includes(ESP32_NAME));

      if (existing) {
        setConnectedDevice(existing);
        setIsConnecting(false);
        return;
      }

      if (__DEV__) console.log("[BLE] Starting scan...");
      stopScan();
      bleManager.startDeviceScan(null, null, async (error, device) => {
        if (error) {
          if (__DEV__) console.error("BLE Scan Error:", error);
          setIsConnecting(false);
          isConnectingRef.current = false;
          return;
        }

        if (__DEV__ && device?.name) {
          console.log("[BLE] Found device:", device.name, device.id);
        }
        if (device && device.name?.includes(ESP32_NAME)) {
          if (__DEV__)
            console.log("[BLE] Found ESP32! Stopping scan and connecting...");
          stopScan();

          try {
            const connected = await device.connect();
            await connected.discoverAllServicesAndCharacteristics();

            // Set up notification listener for distance updates
            connected.monitorCharacteristicForService(
              SERVICE_UUID,
              CHARACTERISTIC_UUID,
              (error, characteristic) => {
                if (error) {
                  if (__DEV__) console.error("Monitor Error:", error);
                  return;
                }

                if (characteristic?.value) {
                  try {
                    const data = Buffer.from(
                      characteristic.value,
                      "base64",
                    ).toString("utf-8");

                    // Try flying-twenty format first: "H:xxx,R:xxx"
                    const gateData = parseGateDistances(data);
                    if (gateData.hub !== null || gateData.remote !== null) {
                      if (gateData.hub !== null) setHubDistance(gateData.hub);
                      if (gateData.remote !== null)
                        setRemoteDistance(gateData.remote);
                      // Also set legacy distance to hub value for backward compat
                      if (gateData.hub !== null) setDistance(gateData.hub);
                    } else {
                      // Fallback: legacy single-distance format
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
                          setHubDistance(parsedDistance);
                        }
                      }
                    }
                  } catch (e) {
                    if (__DEV__) console.error("Error parsing BLE data:", e);
                  }
                }
              },
            );

            // Listen for disconnection
            connected.onDisconnected(() => {
              setConnectedDevice(null);
              setDistance(null);
              setHubDistance(null);
              setRemoteDistance(null);
            });

            if (__DEV__) console.log("[BLE] Connected and monitoring!");
            setConnectedDevice(connected);
          } catch (connError) {
            if (__DEV__) console.error("Connection Error:", connError);
          }

          setIsConnecting(false);
          isConnectingRef.current = false;
        }
      });

      scanTimeoutRef.current = setTimeout(() => {
        stopScan();
        if (isConnectingRef.current) {
          setIsConnecting(false);
          isConnectingRef.current = false;
        }
      }, 10000);
    } catch (e) {
      if (__DEV__) console.error("BLE Connection Error:", e);
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [
    connectedDevice,
    isConnecting,
    parseDistance,
    parseGateDistances,
    stopScan,
  ]);

  useEffect(() => {
    const subscription = bleManager.onStateChange((state) => {
      bleStateRef.current = state;
      if (__DEV__) console.log("[BLE] State changed:", state);

      if (state === "Unsupported") {
        if (!unsupportedLoggedRef.current) {
          unsupportedLoggedRef.current = true;
          console.log("[BLE] BluetoothLE is unsupported on this device");
        }
        return;
      }

      if (state === "PoweredOn" && !connectedDevice) {
        connectToESP32();
      }
    }, true);
    return () => subscription.remove();
  }, [connectToESP32, connectedDevice]);

  useEffect(() => {
    if (connectedDevice) {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      return;
    }

    if (retryIntervalRef.current) return;

    retryIntervalRef.current = setInterval(() => {
      if (
        !connectedDevice &&
        !isConnectingRef.current &&
        bleStateRef.current === "PoweredOn"
      ) {
        connectToESP32();
      }
    }, 8000);

    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [connectedDevice, connectToESP32]);

  return (
    <BleContext.Provider
      value={{
        connectedDevice,
        isConnecting,
        distance,
        hubDistance,
        remoteDistance,
        connectToESP32,
      }}
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
