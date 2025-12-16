export interface BluetoothDeviceWithGATT extends BluetoothDevice {
    gatt?: BluetoothRemoteGATTServer;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface RingData {
    heartRate?: number;
    temperature?: number;
    spo2?: number;
    stress?: number;
    steps?: number;
    batteryLevel?: number;
    isCharging?: boolean;
    timestamp: number;
}

export interface BluetoothState {
    device: BluetoothDeviceWithGATT | null;
    status: ConnectionStatus;
    error: string | null;
    lastData: RingData | null;
    isAvailable: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    measureHeartRate: () => Promise<void>;
    measureSPO2: () => Promise<void>;
    measureStress: () => Promise<void>;
    syncSteps: () => Promise<void>;
}
