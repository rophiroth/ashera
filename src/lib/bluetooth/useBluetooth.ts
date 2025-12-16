"use client";

import { useState, useCallback, useEffect } from 'react';
import { BluetoothState, ConnectionStatus, RingData } from './types';

// Nordic UART Service (NUS) UUIDs for Colmi R02
const UART_SERVICE_UUID = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Write
const UART_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Notify

const CMD_BATTERY = 3;

export function useBluetooth(): BluetoothState {
    const [device, setDevice] = useState<BluetoothDevice | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const [lastData, setLastData] = useState<RingData | null>(null);
    const [isAvailable, setIsAvailable] = useState<boolean>(false);
    const [rxChar, setRxChar] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

    // Command IDs
    const CMD_BATTERY = 3;
    const CMD_GET_STEP_SOMEDAY = 67; // 0x43
    const CMD_START_REAL_TIME = 105; // 0x69
    const CMD_STOP_REAL_TIME = 106; // 0x6A

    // Real-time Types
    const RT_HEART_RATE = 1;
    const RT_SPO2 = 3;
    const RT_FATIGUE = 4; // Stress?

    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.bluetooth) {
            navigator.bluetooth.getAvailability().then(setIsAvailable);
        }
    }, []);

    const constructPacket = (command: number, subData: number[] = []): Uint8Array => {
        const packet = new Uint8Array(16);
        packet[0] = command;
        for (let i = 0; i < subData.length && i < 14; i++) {
            packet[i + 1] = subData[i];
        }

        let sum = 0;
        for (let i = 0; i < 15; i++) {
            sum += packet[i];
        }
        packet[15] = sum & 0xFF;

        return packet;
    };

    const sendPacket = useCallback(async (command: number, subData: number[] = []) => {
        if (!rxChar) return;
        try {
            const packet = constructPacket(command, subData);
            await rxChar.writeValue(packet);
            console.log(`Sent CMD: ${command}`, packet);
        } catch (e) {
            console.error(`Failed to send CMD ${command}`, e);
        }
    }, [rxChar]);

    const onDisconnected = useCallback(() => {
        setStatus('disconnected');
        setDevice(null);
        setRxChar(null);
    }, []);

    const handleCharacteristicValueChanged = useCallback((event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;

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
                // 0 means invalid/measuring usually
                if (val > 0) {
                    if (type === RT_HEART_RATE) newData.heartRate = val;
                    if (type === RT_SPO2) newData.spo2 = val;
                    if (type === RT_FATIGUE) newData.stress = val;
                }
            }
            else if (command === CMD_GET_STEP_SOMEDAY) {
                // Steps format: [Cmd, Y, M, D, Idx, Count, Total, CalL, CalH, StepsL, StepsH, DistL, DistH ...]
                // This is a stream of packets. We just want to grab the total steps if available or summing them up.
                // The python code accumulates "SportDetail".
                // A quick hack for "Total Steps Today":
                // Byte 9 is Steps Low, Byte 10 is Steps High in a single 15-min segment.
                // WE might need to aggregate carefully.
                // For simplified UX, let's just log it for now or assume the "Total" byte (byte 6?) might be helpful?
                // Actually, packet[5] is index, packet[6] is total packets.
                const stepsL = dataView.getUint8(9);
                const stepsH = dataView.getUint8(10);
                const segmentSteps = stepsL | (stepsH << 8);

                // Aggregate logic is complex for React state without a reducer.
                // Let's just store the LAST segment's steps to prove we get data, or use a naive accumulation if possible.
                // Better yet, let's just create a "Steps" field that increments if we receive a stream?
                // No, re-rendering 100 times for 100 packets is bad.
                // Let's just take the first packet's segment as a "proof of life" for steps for now.
                // Ideally we'd sum valid packets.
                if (!newData.steps) newData.steps = 0;
                newData.steps += segmentSteps;
            }

            return newData;
        });
    }, [CMD_BATTERY, CMD_GET_STEP_SOMEDAY, CMD_START_REAL_TIME, RT_FATIGUE, RT_HEART_RATE, RT_SPO2]);

    const connect = useCallback(async () => {
        try {
            setStatus('connecting');
            setError(null);

            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'R0' }, { namePrefix: 'Colmi' }, { namePrefix: 'Q0' }],
                optionalServices: [UART_SERVICE_UUID]
            });

            setDevice(device);
            const server = await device.gatt?.connect();

            if (!server) throw new Error('Could not connect to GATT Server');

            const service = await server.getPrimaryService(UART_SERVICE_UUID);

            const rxCharacteristic = await service.getCharacteristic(UART_RX_CHAR_UUID);
            const txCharacteristic = await service.getCharacteristic(UART_TX_CHAR_UUID);

            setRxChar(rxCharacteristic);

            await txCharacteristic.startNotifications();
            // We need to bind the listener to a ref or use a stable callback effectively,
            // but for now, rely on `handleCharacteristicValueChanged` being stable or re-attached?
            // `handleCharacteristicValueChanged` depends on `setLastData` which is fine.
            // But we can't reference 'rxChar' inside it easily if it's not in closure.
            // Actually, we pass the event.
            txCharacteristic.addEventListener('characteristicvaluechanged', (e) => handleCharacteristicValueChanged(e));

            setStatus('connected');
            device.addEventListener('gattserverdisconnected', onDisconnected);

            // Initial Handshake
            setTimeout(async () => {
                await sendPacket(CMD_BATTERY);
                setTimeout(() => sendPacket(CMD_GET_STEP_SOMEDAY, [0, 0x0f, 0x00, 0x5f, 0x01]), 500);
            }, 500);

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setStatus('error');
        }
    }, [handleCharacteristicValueChanged, onDisconnected, sendPacket, CMD_BATTERY, CMD_GET_STEP_SOMEDAY]);

    const disconnect = useCallback(() => {
        if (device?.gatt?.connected) {
            device.gatt.disconnect();
        }
    }, [device]);

    const measureHeartRate = useCallback(async () => {
        await sendPacket(CMD_START_REAL_TIME, [RT_HEART_RATE, 1]); // 1 = Start
    }, [sendPacket, CMD_START_REAL_TIME, RT_HEART_RATE]);

    const measureSPO2 = useCallback(async () => {
        await sendPacket(CMD_START_REAL_TIME, [RT_SPO2, 1]);
    }, [sendPacket, CMD_START_REAL_TIME, RT_SPO2]);

    const measureStress = useCallback(async () => {
        await sendPacket(CMD_START_REAL_TIME, [RT_FATIGUE, 1]);
    }, [sendPacket, CMD_START_REAL_TIME, RT_FATIGUE]);

    // Simplified Steps Sync (Latest only)
    const syncSteps = useCallback(async () => {
        // [DayOffset, 0x0f, 0x00, 0x5f, 0x01] = Today
        await sendPacket(CMD_GET_STEP_SOMEDAY, [0, 0x0f, 0x00, 0x5f, 0x01]);
    }, [sendPacket, CMD_GET_STEP_SOMEDAY]);

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
        syncSteps
    };
}
