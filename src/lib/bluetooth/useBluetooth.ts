"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { BluetoothState, ConnectionStatus, RingData } from './types';
import { RingParser } from './RingParser';

// Nordic UART Service (NUS) UUIDs for Colmi R02
const UART_SERVICE_UUID = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Write
const UART_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Notify

// V2 SERVICE (Big Data / Health)
const V2_SERVICE_UUID = "de5bf728-d711-4e47-af26-65e3012a5dc7";
const V2_CMD_CHAR_UUID = "de5bf72a-d711-4e47-af26-65e3012a5dc7"; // Write (0xBC goes here)
const V2_NOTIFY_CHAR_UUID = "de5bf729-d711-4e47-af26-65e3012a5dc7"; // Notify (Response comes here)

const CMD_BATTERY = 3;
const CMD_GET_STEP_SOMEDAY = 67; // 0x43
const CMD_START_REAL_TIME = 105; // 0x69
const CMD_STOP_REAL_TIME = 106; // 0x6A

const RT_HEART_RATE = 1;
const RT_SPO2 = 3;
const RT_FATIGUE = 4; // Stress?

export function useBluetooth(): BluetoothState {
    const [device, setDevice] = useState<BluetoothDevice | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const [lastData, setLastData] = useState<RingData | null>(null);
    const [isAvailable, setIsAvailable] = useState<boolean>(false);
    const [rxChar, setRxChar] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
    const [v2Char, setV2Char] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

    // Debugging State - Store LOG instead of single packet
    const [packetLog, setPacketLog] = useState<string[]>([]);
    const [autoConnectTrigger, setAutoConnectTrigger] = useState(false);

    // --- PACKET HANDLING ---
    const handleCharacteristicValueChanged = useCallback((event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;

        // HEX Debug Logging
        const hex = Array.from(new Uint8Array(value.buffer))
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');

        // BUFFER LOG: Keep last 50 packets
        setPacketLog(prev => [...prev.slice(-49), hex]);

        const dataView = new DataView(value.buffer);
        const command = dataView.getUint8(0);

        setLastData(prev => {
            const newData = { ...prev, timestamp: Date.now() };

            if (command === CMD_BATTERY) {
                newData.batteryLevel = dataView.getUint8(1);
                newData.isCharging = dataView.getUint8(2) !== 0;
            }
            else if (command === CMD_START_REAL_TIME) {
                const type = dataView.getUint8(1);
                const val = dataView.getUint8(3);
                if (val > 0) {
                    if (type === RT_HEART_RATE) newData.heartRate = val;
                    if (type === RT_SPO2) newData.spo2 = val;
                    if (type === RT_FATIGUE) newData.stress = val;
                }
            }
            else if (command === CMD_GET_STEP_SOMEDAY) {
                const stepsL = dataView.getUint8(9);
                const stepsH = dataView.getUint8(10);
                const segmentSteps = stepsL | (stepsH << 8);

                if (!newData.steps) newData.steps = 0;
                newData.steps += segmentSteps;
            }
            // 0xBC: Big Data (Temperature)
            // Gadgetbridge protocol: 0xBC 0x25 ...
            else if (command === 0xBC) {
                const packetArr = Array.from(new Uint8Array(value.buffer));
                const parsed = RingParser.parseBC(command, packetArr);
                if (parsed && parsed.decoded && parsed.decoded.temperature) {
                    newData.temperature = parsed.decoded.temperature;
                }
            }

            return newData;
        });
    }, []);

    const isIntentionalDisconnect = useRef(false);

    const onDisconnected = useCallback(() => {
        console.log("Device Disconnected");
        setStatus('disconnected');
        setRxChar(null);
        // DO NOT setDevice(null) to allow reconnection

        if (!isIntentionalDisconnect.current) {
            console.log("Unexpected disconnect. Reconnecting in 2s...");
            setTimeout(() => setAutoConnectTrigger(true), 2000);
        }
        isIntentionalDisconnect.current = false;
    }, []);

    // --- SENDING ---
    const constructPacket = (command: number, subData: number[] = [], noPadding: boolean = false): Uint8Array => {
        // Special case for 0xBC (Big Data) on Health Characteristic: 7 bytes only, no checksum?
        // Gadgetbridge sends: BC 25 01 00 3E 81 02 (7 bytes)
        // Checksum? 0xBC+0x25+0x01+0x00+0x3E+0x81+0x02 = 1FC + ... wait.
        // If noPadding is true, we send exactly command + subData.

        if (noPadding) {
            const size = 1 + subData.length;
            const packet = new Uint8Array(size);
            packet[0] = command;
            for (let i = 0; i < subData.length; i++) {
                packet[i + 1] = subData[i];
            }
            return packet;
        }

        const packet = new Uint8Array(16);
        packet[0] = command;
        for (let i = 0; i < subData.length && i < 14; i++) {
            packet[i + 1] = subData[i];
        }
        let sum = 0;
        for (let i = 0; i < 15; i++) {
            sum += packet[i];
        }
        packet[15] = sum & 0xFF; // Checksum
        return packet;
    };

    const sendPacket = useCallback(async (command: number, subData: number[] = []) => {
        // ROUTING LOGIC
        // ROUTING LOGIC: DATA V2 (0xBC)
        if (command === 0xBC) {
            if (!v2Char) {
                console.error("Cannot send 0xBC: V2 Characteristic not found.");
                return;
            }
            try {
                // Send RAW unpadded packet to V2 Command Char
                // Gadgetbridge sends: BC 25 01 00 3E 81 02 (7 bytes)
                const packet = constructPacket(command, subData, true); // noPadding=true
                await v2Char.writeValue(packet as any);
                console.log(`Sent CMD (V2): ${command}`, packet);
            } catch (e) {
                console.error(`Failed to send CMD ${command} to V2 Char`, e);
            }
            return;
        }

        // STANDARD LOGIC (Control Char)
        if (!rxChar) return;
        try {
            const packet = constructPacket(command, subData);
            await rxChar.writeValue(packet as any);
            console.log(`Sent CMD: ${command}`, packet);
        } catch (e) {
            console.error(`Failed to send CMD ${command}`, e);
        }
    }, [rxChar, v2Char]);


    // --- CONNECTION LOGIC ---
    useEffect(() => {
        const init = async () => {
            console.log("Persistence: Initializing...");
            // 1. Recover device from permissions
            if (typeof navigator !== 'undefined' && navigator.bluetooth) {
                try {
                    const isAvailable = await navigator.bluetooth.getAvailability();
                    setIsAvailable(isAvailable);
                    console.log(`Persistence: BT Available=${isAvailable}`);

                    if ('getDevices' in navigator.bluetooth) {
                        const devices = await navigator.bluetooth.getDevices();
                        console.log(`Persistence: getDevices found ${devices.length} devices.`);

                        const lastDeviceId = localStorage.getItem('ashera_ring_id');
                        console.log(`Persistence: stored ID="${lastDeviceId}"`);

                        if (devices.length > 0) {
                            // Try to match stored ID, otherwise pick first permitted device
                            // If no ID stored, but we have permission, use the first one?
                            const match = lastDeviceId ? devices.find(d => d.id === lastDeviceId) : devices[0];

                            if (match) {
                                console.log("Persistence: Found permitted device:", match.name, match.id);
                                setDevice(match);
                                // If we found a match, we should try to connect ONLY if we are sure.
                                // But for now, let's just restore the object. 
                                // To auto-connect, we set the trigger.
                                setAutoConnectTrigger(true);
                            } else {
                                console.log("Persistence: No matching device found in permitted list.");
                            }
                        }
                    } else {
                        console.warn("Persistence: navigator.bluetooth.getDevices NOT supported in this browser.");
                    }
                } catch (e) { console.error("Bluetooth Init Error:", e); }
            }
        };
        init();
    }, []);

    // Auto-Connect Effect
    useEffect(() => {
        if (autoConnectTrigger && device && status === 'disconnected') {
            const attemptAutoConnect = async () => {
                console.log("Executing Auto-Connect...");
                setAutoConnectTrigger(false);
                try {
                    setStatus('connecting');
                    if (device.gatt) {
                        try { await device.gatt.connect(); } catch (e) { console.warn("Already connected or error:", e); }

                        // Get Services
                        const server = device.gatt;
                        if (!server.connected) throw new Error("GATT not connected");
                        console.log("Connected to GATT Server");
                        setStatus('connected');

                        // PRIMARY SERVICE (NUS / Control)
                        const service = await server.getPrimaryService(UART_SERVICE_UUID);
                        const rx = await service.getCharacteristic(UART_RX_CHAR_UUID);
                        setRxChar(rx);

                        // V2 SERVICE (Big Data / Health)
                        try {
                            const v2Service = await server.getPrimaryService(V2_SERVICE_UUID);
                            const v2Cmd = await v2Service.getCharacteristic(V2_CMD_CHAR_UUID);
                            setV2Char(v2Cmd);

                            const v2Notify = await v2Service.getCharacteristic(V2_NOTIFY_CHAR_UUID);
                            await v2Notify.startNotifications();
                            v2Notify.addEventListener('characteristicvaluechanged', (e) => handleCharacteristicValueChanged(e as any));
                            console.log("Found V2 Service (Health/BigData)");
                        } catch (e) {
                            console.warn("Could not find V2 Service (de5b...), is it paired/authorized?", e);
                        }

                        // Notifications
                        const tx = await service.getCharacteristic(UART_TX_CHAR_UUID);
                        await tx.startNotifications();
                        tx.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
                        console.log("Notifications started");
                        // Remove old listener first?
                        device.removeEventListener('gattserverdisconnected', onDisconnected);
                        device.addEventListener('gattserverdisconnected', onDisconnected);

                        setStatus('connected');
                        console.log("Auto-Connect Success!");
                    }
                } catch (e: any) {
                    console.error("Auto-Connect Failed:", e);
                    setStatus('disconnected');
                }
            };
            attemptAutoConnect();
        }
    }, [autoConnectTrigger, device, status, handleCharacteristicValueChanged, onDisconnected]);


    const connect = useCallback(async () => {
        try {
            isIntentionalDisconnect.current = false;
            setStatus('connecting');
            setError(null);

            let targetDevice = device;
            if (!targetDevice || !targetDevice.gatt) {
                targetDevice = await navigator.bluetooth.requestDevice({
                    filters: [{ namePrefix: 'R0' }, { namePrefix: 'Colmi' }, { namePrefix: 'Q0' }],
                    optionalServices: [
                        UART_SERVICE_UUID,
                        V2_SERVICE_UUID // V2 Service (de5bf728...)
                    ]
                });
                setDevice(targetDevice);
            }

            // Race connection to prevent hang
            const connectPromise = new Promise<BluetoothRemoteGATTServer>((resolve, reject) => {
                if (!targetDevice?.gatt) { reject(new Error("No GATT")); return; }
                targetDevice.gatt.connect().then(resolve).catch(reject);
                setTimeout(() => reject(new Error("Connection timeout")), 10000);
            });

            const server = await connectPromise;
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            const rxCharacteristic = await service.getCharacteristic(UART_RX_CHAR_UUID);
            const txCharacteristic = await service.getCharacteristic(UART_TX_CHAR_UUID);

            setRxChar(rxCharacteristic);

            await txCharacteristic.startNotifications();
            txCharacteristic.addEventListener('characteristicvaluechanged', (e) => handleCharacteristicValueChanged(e));

            // V2 SERVICE (Big Data / Health)
            try {
                const v2Service = await server.getPrimaryService(V2_SERVICE_UUID);
                const v2Cmd = await v2Service.getCharacteristic(V2_CMD_CHAR_UUID);
                setV2Char(v2Cmd);

                const v2Notify = await v2Service.getCharacteristic(V2_NOTIFY_CHAR_UUID);
                await v2Notify.startNotifications();
                v2Notify.addEventListener('characteristicvaluechanged', (e) => handleCharacteristicValueChanged(e));
                console.log("Found V2 Service (Health/BigData)");
            } catch (e) {
                console.warn("Could not find V2 Service (de5b...), is it paired/authorized?", e);
            }

            setStatus('connected');
            targetDevice.removeEventListener('gattserverdisconnected', onDisconnected);
            targetDevice.addEventListener('gattserverdisconnected', onDisconnected);

            if (targetDevice.id) localStorage.setItem('ashera_ring_id', targetDevice.id);

            // Initial Handshake
            setTimeout(async () => {
                // Use internal sendPacket or the one in scope? 
                // logic moved above `connect` to be safe
                // But `connect` uses `sendPacket`. circular?
                // constructPacket is pure.
                // We can manually construct to be safe or rely on `sendPacket` hoisted.
                // sendPacket is defined before connect in new code?
                // Check replacement content. Yes sendPacket is above connection logic.
                // But `sendPacket` requires `rxChar`. We just set it.
                // It relies on state `rxChar`. 
                // State updates are async! `setRxChar` logic won't reflect efficiently in closure?
                // Wait. `setRxChar(rxCharacteristic)` queues update. 
                // `rxChar` in `sendPacket` (cached callback) might be null?
                // `sendPacket` depends on `[rxChar]`. 
                // If we call it inside `connect` immediately after `setRxChar`, the closure `sendPacket` sees *old* `rxChar` (null).
                // FIX: Use `rxCharacteristic.writeValue` directly for handshake inside connect, OR wait for re-render.
                // Better: pass the char to a helper or just use the local var.

                const packet = constructPacket(CMD_BATTERY);
                await rxCharacteristic.writeValue(packet as any);
                console.log("Handshake sent");
            }, 500);

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setStatus('disconnected');
            // setDevice(null); // KEEP DEVICE!
        }
    }, [device, handleCharacteristicValueChanged, onDisconnected]); // removed sendPacket dep

    const disconnect = useCallback(() => {
        isIntentionalDisconnect.current = true;
        if (device?.gatt?.connected) {
            device.gatt.disconnect();
        }
    }, [device]);

    const measureHeartRate = useCallback(async () => {
        await sendPacket(CMD_START_REAL_TIME, [RT_HEART_RATE, 1]);
    }, [sendPacket]);

    const measureSPO2 = useCallback(async () => {
        await sendPacket(CMD_START_REAL_TIME, [RT_SPO2, 1]);
    }, [sendPacket]);

    const measureStress = useCallback(async () => {
        await sendPacket(CMD_START_REAL_TIME, [RT_FATIGUE, 1]);
    }, [sendPacket]);

    const syncSteps = useCallback(async () => {
        await sendPacket(CMD_GET_STEP_SOMEDAY, [0, 0x0f, 0x00, 0x5f, 0x01]);
    }, [sendPacket]);

    const sendRaw = useCallback(async (cmdIdx: number, subIds: number[]) => {
        await sendPacket(cmdIdx, subIds);
    }, [sendPacket]);

    return {
        device: device as any,
        status,
        error,
        lastData,
        connect,
        disconnect,
        isAvailable,
        measureHeartRate,
        measureSPO2,
        measureStress,
        syncSteps,
        packetLog,
        sendRaw,
        isHealthSupported: !!v2Char // Expose status
    };
}
