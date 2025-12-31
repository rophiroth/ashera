import { useState, useEffect, useRef } from "react";
import { BluetoothState } from "@/lib/bluetooth/types";
import { X, Send, Trash2, Activity, Clipboard, Zap, Database, Search, Heart, Thermometer, Droplet } from "lucide-react";
import { RingParser, HealthPacket } from "@/lib/bluetooth/RingParser";
import { saveRingData, subscribeToRingData } from "@/lib/firebase/ringData";

// Define LiveStats locally or import
interface LiveStats {
    hr: number;
    hrv: number;
    steps: number;
    spo2: number;
    temperature: number;
    raw?: number[];
}

interface BluetoothDebuggerProps {
    isOpen: boolean;
    onClose: () => void;
    // packetLog is string[] (Hex strings)
    bt: BluetoothState & { packetLog?: string[]; sendRaw?: (cmd: number, subParams: number[]) => Promise<void>; lastData?: any };
}

export function BluetoothDebugger({ isOpen, onClose, bt }: BluetoothDebuggerProps) {
    const [log, setLog] = useState<string[]>([]);
    const [cmdInput, setCmdInput] = useState<string>("0x44 0x00");
    const [isScanning, setIsScanning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Persistence Debug Stats
    const [persistStats, setPersistStats] = useState({ storedId: '', availableCount: 0, supported: true });

    // Live Stats
    const [liveStats, setLiveStats] = useState<LiveStats>({ hr: 0, hrv: 0, steps: 0, spo2: 0, temperature: 0, raw: [] });

    // Type Explorer State
    const [targetType, setTargetType] = useState(5);

    // Cloud Mirror State
    const [cloudData, setCloudData] = useState<any[]>([]);
    const [isCloudExpanded, setIsCloudExpanded] = useState(true);

    useEffect(() => {
        const unsub = subscribeToRingData((data) => {
            setCloudData(data);
        });
        return () => unsub();
    }, []);

    const endRef = useRef<HTMLDivElement>(null);
    const lastLogLengthRef = useRef(0);
    const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const zeroCountRef = useRef(0);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    // ... rest of code

    // Check Persistence
    useEffect(() => {
        const check = async () => {
            const stored = localStorage.getItem('ashera_ring_id');
            let count = 0;
            let supported = false;
            if (navigator.bluetooth && 'getDevices' in navigator.bluetooth) {
                supported = true;
                const devices = await navigator.bluetooth.getDevices();
                count = devices.length;
            }
            setPersistStats({ storedId: stored || 'None', availableCount: count, supported });
        };
        const interval = setInterval(check, 2000);
        check();
        return () => clearInterval(interval);
    }, []);

    const stopScan = async () => {
        if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
        setIsScanning(false);
        setIsLoading(false);
        zeroCountRef.current = 0;

        // STOP KNOWN & CANDIDATES
        await sendPacket(0x69, [0x01, 0x00, 0x00]); // Type 1
        await sendPacket(0x69, [0x02, 0x00, 0x00]); // Type 2
        await sendPacket(0x69, [0x03, 0x00, 0x00]); // Type 3 (SPO2)
        await sendPacket(0x69, [0x04, 0x00, 0x00]); // Type 4
        await sendPacket(0x69, [0x08, 0x00, 0x00]); // Type 8
        await sendPacket(0x69, [0x10, 0x00, 0x00]); // Type 16
        await sendPacket(0x69, [0x00, 0x00, 0x00]); // Type 0
        await sendPacket(0x69, [0x05, 0x00, 0x00]); // Type 5
        await sendPacket(0x69, [0x09, 0x00, 0x00]); // Type 9
    };

    useEffect(() => {
        if (bt.packetLog && bt.packetLog.length > lastLogLengthRef.current) {
            const newPackets = bt.packetLog.slice(lastLogLengthRef.current);
            const formatted = newPackets.map(p => {
                // p is "BC 25 01..." string
                const hex = p;

                try {
                    // Convert Hex String back to Byte Array for Parsing
                    const bytes = p.trim().split(' ').map(b => parseInt(b, 16));
                    let decoded = '';

                    // 1. Real-Time V2: 0xBC (Big Data)
                    if (bytes[0] === 0xBC) {
                        const v2Data = RingParser.parseBC(bytes[0], bytes.slice(1));
                        if (v2Data) {
                            const t = v2Data.temperature ? v2Data.temperature.toString() : 'N/A';
                            const o = v2Data.bloodOxygen ? v2Data.bloodOxygen.toString() : 'N/A';
                            decoded = ` 🌊 V2 Data: Temp=${t}°C | SpO2=${o}%`;

                            // PERSISTENCE -> V2
                            saveRingData({ ...v2Data, source: "v2", raw: hex });
                        }
                    }

                    // 1b. Real-Time (0x69) - Now Persisted!
                    else if (bytes[0] === 0x69) {
                        const rtData = RingParser.parseRealTime(bytes);
                        if (rtData && rtData.decoded && rtData.decoded.heartRate) {
                            const bpm = rtData.decoded.heartRate;
                            decoded = ` ⚡ Real-Time: ${bpm} BPM`;
                            // Only save if BPM > 0 to avoid noise, but user wants everything.
                            if (bpm > 0) {
                                saveRingData({ ...rtData.decoded, isHealth: true, source: "realtime", raw: hex });
                            }
                        }
                    }

                    // Legacy Real-Time (0x69 equivalent response is complex/not parsed here yet for persistence, usually just display)
                    // HR Real-Time (Notification)
                    else if (bytes.length === 2 && bytes[0] !== 0) {
                        const val = (bytes[0] << 8) | bytes[1]; // Raw reading?
                        // This part of original code was messy guesses.
                        // Let's rely on standard parsers.
                    }
                    // 2. Summary: 0x73 
                    else if (bytes[0] === 0x73) {
                        const summary = RingParser.parseSummary(bytes);
                        if (summary && summary.decoded) {
                            decoded = ` 🏁 Summary (0x73): HR=${summary.decoded.heartRate} | Bat=${summary.decoded.battery}%`;
                            // PERSISTENCE -> Legacy
                            saveRingData({ ...summary.decoded, isHealth: true, source: "legacy", raw: hex });
                        }
                    }

                    // 3. LEGACY HR / Health: 0x48 OR Generic Type 4 Notification
                    // Note: Type 4 Notification is often just 2 bytes [value_h, value_l] if raw, 
                    // or structured [0x48, ...].
                    else if (bytes[0] === 0x48) {
                        const healthData = RingParser.parseHealth(bytes);
                        if (healthData && healthData.decoded) {
                            const { heartRate, hrv, steps } = healthData.decoded;
                            decoded = ` 🏥 Health: HR=${heartRate} | 💓 HRV=${hrv ? hrv.toFixed(2) : 0}ms | Steps=${steps}`;

                            // PERSISTENCE -> Realtime
                            saveRingData({ ...healthData.decoded, isHealth: true, source: "realtime", raw: hex });
                        }
                    }

                    // 4. Steps History (0x43)
                    else if (bytes[0] === 0x43) {
                        const stepsVal = bytes[9] | (bytes[10] << 8);
                        const cals = bytes[7] | (bytes[8] << 8);
                        decoded = ` 👣 Steps History: ${stepsVal} steps, ${cals} cals`;

                        // PERSISTENCE -> Steps
                        saveRingData({ isHealth: true, steps: stepsVal, raw: hex, source: "v2" });
                    }

                    return `RX: ${hex}${decoded ? `\n   ↳${decoded}` : ''}`;
                } catch (e: any) {
                    return `RX: ${hex} (Err: ${e.message})`;
                }
            });
            setLog(prev => [...prev, ...formatted].slice(-500));
            lastLogLengthRef.current = bt.packetLog.length;
        }
    }, [bt.packetLog, isScanning]);

    const makePacket = (cmd: number, subData: number[] = []): number[] => {
        const packet = new Array(16).fill(0);
        packet[0] = cmd;
        for (let i = 0; i < subData.length && i < 14; i++) packet[i + 1] = subData[i];
        let sum = 0;
        for (let i = 0; i < 15; i++) sum += packet[i];
        packet[15] = sum & 0xFF;
        return packet;
    };

    const sendPacket = async (cmd: number, subData: number[]) => {
        if (!bt.sendRaw) return;

        // V2 PROTOCOL SPECIAL CASE: 0xBC
        // Do NOT use makePacket (which pads to 16 bytes). 
        // Pass subData directly to useBluetooth, which handles V2 specific formatting.
        if (cmd === 0xBC) {
            await bt.sendRaw(cmd, subData);
            setLog(prev => [...prev.slice(-499), `TX: BC ${subData.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`]);
            return;
        }

        const packet = makePacket(cmd, subData);
        await bt.sendRaw(cmd, packet.slice(1));
        setLog(prev => [...prev.slice(-499), `TX: ${packet.map(n => n.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`]);
    };

    if (!isOpen) return null;

    const handleSend = () => {
        try {
            const parts = cmdInput.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
            const bytes = parts.map(p => parseInt(p, 16));
            if (bytes.length === 0) return;
            sendPacket(bytes[0], bytes.slice(1));
        } catch (e: any) { setLog(prev => [...prev, `ERR: ${e.message}`]); }
    };

    const copyLog = () => {
        navigator.clipboard.writeText(log.join('\n'));
        alert("📋 Log copied!");
    };

    // Standalone Gadgetbridge Commands
    const stopRealTime = async () => {
        setLog(prev => [...prev, ">> SENDING GB STOP (0x1E 0x02)..."]);
        await sendPacket(0x1e, [0x02]); // Stop Real-time Measurement
    };

    const enableAutoTemp = async () => {
        setLog(prev => [...prev, ">> ENABLING AUTO TEMP (0x3A)..."]);
        await sendPacket(0x3a, [0x03, 0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    };

    const fetchTempHistory = async () => {
        setLog(prev => [...prev, ">> FETCHING TEMP HISTORY (0xBC)..."]);
        await sendPacket(0xbc, [0x25, 0x01, 0x00, 0x3e, 0x81, 0x02]);
    };

    const killSwitch = async () => {
        setLog(prev => [...prev, ">> 🛑 KILLING ALL SENSORS..."]);
        await sendPacket(0x1e, [0x02]); // GB Stop
        await sendPacket(0x69, [0x01, 0x04, 0x00]); // Stop Type 1
        await sendPacket(0x69, [0x03, 0x04, 0x00]); // Stop Type 3
        await sendPacket(0x69, [0x05, 0x04, 0x00]); // Stop Type 5
        await sendPacket(0x69, [0x00, 0x04, 0x00]); // Stop Type 0
        await sendPacket(0x69, [targetType, 0x04, 0x00]); // Stop Current Type
    };

    // Composite Workflow
    const forceMeasureAndSync = async () => {
        setLog(prev => [...prev, ">> STEP 0: SETTING TIME (0x01)..."]);
        await setTime();
        await new Promise(resolve => setTimeout(resolve, 500));

        setLog(prev => [...prev, ">> STEP 1: ENABLE AUTO-TEMP (0x3A)..."]);
        await enableAutoTemp();

        setLog(prev => [...prev, ">> STEP 2: WAKING SENSOR (0x69 01)..."]);
        await sendPacket(0x69, [0x01, 0x00, 0x00]); // Force HR/Process

        // Countdown
        for (let i = 20; i > 0; i--) {
            setLog(prev => [...prev, `>> MEASURING... ${i}s ⏳`]);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setLog(prev => [...prev, ">> STEP 3: STOPPING SENSORS (0x6A per Python Client)..."]);
        // Python Client: CMD_STOP_REAL_TIME = 106 (0x6A)
        // Packet: make_packet(106, [type, 0, 0])
        await sendPacket(0x6A, [0x01, 0x00, 0x00]);

        setLog(prev => [...prev, ">> COOLING DOWN (1.5s)..."]);
        await new Promise(resolve => setTimeout(resolve, 1500));

        setLog(prev => [...prev, ">> STEP 4: SYNC LEGACY (0x15) (Standard Protocol)..."]);

        // Python Client uses "Start of Day" (Midnight) as the key for the log.
        // Sending "Now" results in 0xFF (No Data).
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const midnightTs = Math.floor(today.getTime() / 1000);

        setLog(prev => [...prev, `>> REQUESTING DAY LOG: ${today.toISOString()} (TS: ${midnightTs})`]);

        const timestampBytes = [
            midnightTs & 0xFF,
            (midnightTs >> 8) & 0xFF,
            (midnightTs >> 16) & 0xFF,
            (midnightTs >> 24) & 0xFF
        ];
        await sendPacket(0x15, timestampBytes);
    };

    // Helper: BCD Encoding
    const toBCD = (val: number) => {
        const tens = Math.floor(val / 10);
        const ones = val % 10;
        return (tens << 4) | ones;
    };

    const sendTypeCommand = async (action: 'start' | 'stop') => {
        const op = action === 'start' ? 0x01 : 0x04; // 0x69 [type] 01/04
        setLog(prev => [...prev, `>> TX: 0x69 ${targetType.toString(16).toUpperCase().padStart(2, '0')} ${op.toString(16).toUpperCase().padStart(2, '0')}...`]);
        await sendPacket(0x69, [targetType, op, 0x00]);
    };

    // Set Time (0x01) - Required for correct history indexing?
    const setTime = async () => {
        const now = new Date(); // Use local time or UTC? Python does UTC.
        // Let's stick to Local for now as the user is visual.
        const y = now.getFullYear() % 100;
        const m = now.getMonth() + 1;
        const d = now.getDate();
        const h = now.getHours();
        const min = now.getMinutes();
        const s = now.getSeconds();

        setLog(prev => [...prev, `>> SETTING TIME (0x01): ${y}/${m}/${d} ${h}:${min}:${s}`]);

        // Packet: 01 Y M D H M S Language(1=EN)
        const payload = [
            toBCD(y), toBCD(m), toBCD(d),
            toBCD(h), toBCD(min), toBCD(s),
            0x01 // English
        ];

        await sendPacket(0x01, payload);
    };

    // Check Battery (0x03)
    const checkBattery = async () => {
        setLog(prev => [...prev, ">> CHECKING BATTERY (0x03)..."]);
        await sendPacket(0x03, []);
    };

    // Get Steps (0x43) - Steps History
    // Payload: [Offset, 0x0F, 0x00, 0x5F, 0x01]
    const fetchSteps = async (dayOffset = 0) => {
        setLog(prev => [...prev, `>> FETCHING STEPS (0x43) - Day Offset ${dayOffset}...`]);
        // 0x43 | 00 0F 00 5F 01 ...
        await sendPacket(0x43, [dayOffset, 0x0F, 0x00, 0x5F, 0x01]);
    };

    const forceMeasureAndSyncFull = async () => {
        await forceMeasureAndSync();
        // Add final battery check
        await new Promise(resolve => setTimeout(resolve, 1000));
        await checkBattery();

        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchSteps(0); // Fetch detailed steps for today
    };

    // V1 Legacy Sync (0x15) - Used by Python Client
    const fetchLegacyHR = async () => {
        setLog(prev => [...prev, ">> PROBING LEGACY SYNC (0x15)..."]);
        // Timestamp (Today Midnight or Now?) Python client uses Midnight. 
        // Let's try "Now - 1 day"? Or just 0?
        // Python: int(target.timestamp()) -> 4 bytes Little Endian.
        const now = Math.floor(Date.now() / 1000);
        const timestampBytes = [
            now & 0xFF,
            (now >> 8) & 0xFF,
            (now >> 16) & 0xFF,
            (now >> 24) & 0xFF
        ];
        // Packet: 15 [TS_0, TS_1, TS_2, TS_3] ...
        await sendPacket(0x15, timestampBytes);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-neutral-950 border border-neutral-800 w-full max-w-2xl h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden font-mono text-sm relative">

                {/* Header */}
                <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {bt.status === 'connected' ? <Zap className="text-green-500 animate-pulse" /> : <Zap className="text-red-500" />}
                        <div>
                            <span className="font-bold text-white block">Ring Sniffer v0.1.53 (STEPS)</span>
                            <span className="text-emerald-400 font-bold tracking-wider">PROTOCOL V2 (DE5B) 🩹</span>
                            {bt.isHealthSupported ? (
                                <span className="text-[10px] text-green-500 block">✅ V2 SERVICE FOUND</span>
                            ) : (
                                <span className="text-[10px] text-red-500 block animate-pulse">❌ V2 SERVICE MISSING (RE-PAIR!)</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ABSOLUTE CLOSE BUTTON (Safety Hatch) */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg z-50 active:scale-90 transition-transform"
                    style={{ zIndex: 9999 }}
                >
                    <X size={20} />
                </button>

                {/* CLOUD MIRROR */}
                <div className={`p-2 bg-blue-900/10 border-b border-blue-500/20 text-[10px] font-mono shrink-0 transition-all duration-300 ${isCloudExpanded ? 'max-h-32' : 'max-h-8'} overflow-hidden flex flex-col`}>
                    <div
                        className="flex items-center gap-2 mb-1 text-blue-400 font-bold cursor-pointer hover:text-blue-300 select-none"
                        onClick={() => setIsCloudExpanded(!isCloudExpanded)}
                    >
                        <Database size={12} />
                        <span>☁️ CLOUD MIRROR (Last 5 Writes) {isCloudExpanded ? '▼' : '▲'}</span>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {cloudData.length === 0 && <span className="text-white/20 italic">Waiting for writes...</span>}
                        {cloudData.map((d: any, i: number) => (
                            <div key={i} className="flex gap-2 text-blue-200/70 border-b border-white/5 py-1">
                                <span className="text-blue-500">{d.source?.toUpperCase() || 'UNK'}</span>
                                <span className="truncate flex-1">
                                    {d.temperature && `Temp:${d.temperature}°C `}
                                    {d.bloodOxygen && `SpO2:${d.bloodOxygen}% `}
                                    {d.steps && `Steps:${d.steps} `}
                                    {d.heartRate && `HR:${d.heartRate} `}
                                    {d.battery && `Bat:${d.battery}% `}
                                </span>
                                <span className="text-white/30">{d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toLocaleTimeString() : '...'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PARSED DATA AREA (Bypasses Regex Log Parsing) */}
                {bt.lastData?.readings && bt.lastData.readings.length > 0 && (
                    <div className="bg-yellow-900/10 border-b border-yellow-500/20 p-2 text-xs font-mono shrink-0 max-h-32 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-1 text-yellow-500 font-bold">
                            <Database size={12} />
                            <span>LATEST BATCH ({bt.lastData.readings.length} pts):</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {bt.lastData.readings.map((r: any, i: number) => (
                                <span key={i} className="bg-yellow-500/10 text-yellow-200 px-1 rounded border border-yellow-500/20">{r}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Log Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-black text-xs font-mono">
                    {log.map((line, i) => {
                        // Quick Parse Logic for Display
                        let extInfo = "";
                        if (line.startsWith("RX") && line.includes("BC 25")) {
                            // Try to extract bytes from Hex string
                            try {
                                const bytes = line.replace(/RX: /, '').split(' ').map(h => parseInt(h, 16));
                                if (bytes.length > 8) {
                                    // Quick decode for visibility
                                    const temps = bytes.slice(8).map(b => (b / 10) + 20).filter(t => t > 30 && t < 43);
                                    if (temps.length > 0) extInfo = ` 🌡️ [${temps.slice(-3).map(t => t.toFixed(1)).join(', ')}]`;
                                }
                            } catch (e) { }
                        }

                        return (
                            <div key={i} className={`break-all border-l-2 pl-2 whitespace-pre-wrap ${line.startsWith('RX') ? 'border-blue-500/50 text-blue-400' :
                                line.startsWith('TX') ? 'border-green-500/50 text-green-400' :
                                    'border-neutral-500/50 text-neutral-400'
                                }`}>
                                <span className="opacity-30 inline-block w-8 mr-2 select-none">{i + 1}</span>
                                {line}
                                {extInfo && <span className="text-yellow-400 font-bold">{extInfo}</span>}
                            </div>
                        )
                    })}
                    <div ref={endRef} />
                </div>

                {/* Controls Area */}
                <div className="p-4 bg-neutral-900 border-t border-neutral-800 space-y-4">

                    {/* PRIMARY ACTIONS */}
                    <div className="grid grid-cols-2 gap-4 border-b border-white/10 pb-4">
                        <button
                            onClick={forceMeasureAndSync}
                            className="col-span-2 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded shadow-lg shadow-cyan-900/20 flex flex-col items-center justify-center gap-1"
                        >
                            <div className="flex items-center gap-2"><Thermometer size={20} /> FORCE MEASURE & SYNC</div>
                            <span className="text-[10px] opacity-75 font-normal">0x69 &rarr; 20s &rarr; 0x6A(STOP) &rarr; 0x15(SYNC)</span>
                        </button>

                        <button
                            onClick={fetchTempHistory}
                            className="py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded shadow-lg shadow-purple-900/20 flex flex-col items-center justify-center"
                        >
                            <span>📡 SYNC ONLY (0xBC)</span>
                            <span className="text-[10px] opacity-75 font-normal">Check History</span>
                        </button>

                        <button
                            onClick={forceMeasureAndSyncFull}
                            className="bg-blue-600 hover:bg-blue-700 text-white w-full py-6 text-lg font-bold shadow-lg shadow-blue-500/30 border border-blue-400/50"
                            disabled={bt.status !== 'connected'}
                        >
                            FULL SYNC (V2 + BAT + STEPS) 🔋👣
                        </button>
                        <button
                            onClick={killSwitch}
                            className="py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg shadow-red-900/20 flex flex-col items-center justify-center"
                        >
                            <span>🛑 KILL ALL (STOP)</span>
                            <span className="text-[10px] opacity-75 font-normal">0x1E(02) + 0x69(04)</span>
                        </button>
                    </div>

                    {/* MANUAL PROBE (Advanced) */}
                    <div className="flex flex-col gap-2 items-center">
                        <span className="text-[10px] uppercase text-white/50 font-bold tracking-widest">Type Explorer (Advanced)</span>
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col items-center">
                                <label className="text-[10px] text-white/50">ID</label>
                                <input
                                    type="number"
                                    value={targetType}
                                    onChange={(e) => setTargetType(parseInt(e.target.value) || 0)}
                                    className="w-12 bg-white/10 text-white text-center rounded p-2 font-bold"
                                />
                            </div>
                            <button onClick={() => sendTypeCommand('start')} className="px-4 py-2 bg-green-900/50 hover:bg-green-800 text-green-200 text-xs font-bold rounded border border-green-800">START TYPE</button>
                            <button onClick={() => sendTypeCommand('stop')} className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs font-bold rounded border border-red-800">STOP TYPE</button>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-center pb-2">
                        {/* Quick Presets */}
                        {[1, 3, 5, 20].map(t => (
                            <button key={t} onClick={() => setTargetType(t)} className="px-2 py-1 bg-white/5 text-xs rounded hover:bg-white/10 border border-white/10">
                                Type {t}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs opacity-50">
                        <div className="bg-black/40 rounded p-1 text-white/40">HR: <span className="text-green-400 text-lg block">{liveStats.hr}</span></div>
                        <div className="bg-black/40 rounded p-1 text-white/40">SPO2: <span className="text-red-500 text-lg block">{liveStats.spo2 || '--'}</span></div>
                        <div className="bg-black/40 rounded p-1 text-white/40">TEMP: <span className="text-blue-400 text-lg block animate-pulse">{liveStats.temperature > 0 ? liveStats.temperature + '°' : '--'}</span></div>
                    </div>

                    <div className="flex gap-2">
                        <input value={cmdInput} onChange={(e) => setCmdInput(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded px-2 text-white font-mono" />
                        <button onClick={handleSend} className="px-3 bg-white/10 rounded hover:bg-white/20"><Send size={14} /></button>
                        <button onClick={copyLog} className="px-3 bg-white/10 rounded hover:bg-white/20"><Clipboard size={14} /></button>
                        <button onClick={() => setLog([])} className="px-3 bg-white/10 rounded hover:bg-white/20"><Trash2 size={14} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
