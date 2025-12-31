
export interface StepPacket {
    type: 'steps';
    timestamp: string;
    steps: number;
}

export interface HealthPacket {
    type: 'health' | 'temperature_history' | 'v2_stats' | 'steps_history';
    timestamp: string;
    data?: number[];
    // Flattened Properties for Compatibility
    steps?: number;
    heartRate?: number;
    hrv?: number;
    temperature?: number;
    bloodOxygen?: number;
    battery?: number;
    readings?: string[];
    source?: string;
    isHealth?: boolean;
    raw?: string;

    decoded?: {
        steps?: number;
        heartRate?: number;
        battery?: number; // mV or %
        temperature?: number; // C
        hrv?: number; // ms
        spo2?: number; // %
        stress?: number;
        readings?: string[]; // Temp candidates
    };
}

export class RingParser {
    // 0x43: Rich Packet (Steps + Date)
    public static parseSteps(data: number[]): StepPacket | null {
        try {
            if (data[0] !== 0x43) return null;
            if (data.length < 12) return null;

            const year = 2000 + data[1];
            const month = data[2];
            const day = data[3];

            // Big Endian? Log: 01 70 -> 368
            const steps = (data[9] << 8) | data[10];
            const timestamp = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`;

            return { type: 'steps', timestamp, steps };
        } catch (e) {
            console.error("Parse Error 0x43:", e);
            return null;
        }
    }

    // 0x69: Real-Time Sensor Data Notification
    public static parseRealTime(data: number[]): HealthPacket | null {
        if (data[0] !== 0x69) return null;

        const type = data[1];
        // Little Endian for multi-byte values
        const val = data[6] | (data[7] << 8);

        let derivedBpm = 0;
        let spo2Val = 0;
        let stressVal = 0;

        // Type Mapping from Python Client
        // 1: HR, 2: BP, 3: SPO2, 4: Fatigue, 5: Health Check, 7: ECG, 8: Pressure, 9: Blood Sugar, 10: HRV

        // Type 1, 2, 4, 8, 16 -> Heart Rate / RR
        if ([1, 2, 4, 8, 16].includes(type) && val > 0) {
            // RR Interval in ms
            if (val > 300) derivedBpm = Math.round(60000 / val);
            else derivedBpm = val; // Direct BPM?
        }

        // Parse 0x48 (Health Snapshot / Periodic Data)
        if (type === 0x48) {
            // Payload: [CMD, LEN, SEQ, ..., CRC]
            // Often bytes 4-5, 6-7, etc.
            // Let's look for "Temperature-like" values (350-380 for 35.0-38.0C)
            const possibleTemp = [];
            for (let i = 0; i < data.length - 1; i++) {
                const val16 = (data[i] << 8) | data[i + 1];
                const val16LE = (data[i + 1] << 8) | data[i]; // Try Little Endian too

                if (val16 >= 350 && val16 <= 380) possibleTemp.push({ idx: i, val: val16, format: 'BE' });
                if (val16LE >= 350 && val16LE <= 380) possibleTemp.push({ idx: i, val: val16LE, format: 'LE' });

                // Also check single byte (36, 37)
                if (data[i] >= 34 && data[i] <= 42) possibleTemp.push({ idx: i, val: data[i], format: 'INT8' });
            }

            // HRV is bytes 8-9 (Big Endian?)
            const hrv = (data[8] << 8) | data[9];

            let tempDetected = 0;
            if (possibleTemp.length > 0) {
                console.log("🌡️ CANDIDATE TEMP FOUND:", possibleTemp);
                // Heuristic: Prefer Big Endian roughly in mid-packet
                const match = possibleTemp.find(p => p.format === 'BE' || p.format === 'INT8');
                if (match) tempDetected = match.format === 'INT8' ? match.val : match.val / 10;
            }

            return {
                type: 'health',
                timestamp: new Date().toISOString(),
                data: data.slice(1),
                decoded: {
                    heartRate: data[14], // Usually Byte 14 or 15
                    temperature: tempDetected,
                    steps: 0,
                    battery: 0,
                    spo2: data[12], // Guess
                    stress: hrv, // HRV as Stress proxy
                }
            };
        }

        // Type 3 -> SPO2
        if (type === 0x03) {
            spo2Val = val; // Raw Value? Usually < 100? Or needs div?
            // User log showed Val=0 when red light on. Maybe it takes time.
        }

        if (type === 4) stressVal = val; // Fatigue

        return {
            type: 'health',
            timestamp: new Date().toISOString(),
            data: data.slice(1),
            decoded: {
                heartRate: derivedBpm,
                temperature: 0,
                steps: val, // Keep Raw in Steps for debug
                battery: type, // Store Type here
                spo2: spo2Val,
                stress: stressVal
            }
        };
    }

    // 0x73: Measurement Summary
    public static parseSummary(data: number[]): HealthPacket | null {
        if (data[0] !== 0x73) return null;
        const hr = data[4];
        const rawVal = (data[6] << 8) | data[7]; // 4534
        const spo2 = data[10];

        return {
            type: 'health',
            timestamp: new Date().toISOString(),
            data: data.slice(1),
            decoded: {
                heartRate: hr,
                steps: 0,
                battery: spo2,
                temperature: 0,
                hrv: rawVal / 100 // Consistent with 0x48 hypothesis
            }
        };
    }

    // Parse 0xBC (Big Data V2) - Confirmed via Gadgetbridge/ColmiR0xConstants
    // Payload Structure: [BC, TYPE, LEN_L, LEN_H, TS0, TS1, TS2, TS3, DATA...]
    public static parseBC(type: number, data: number[]): Partial<HealthPacket> | null {
        if (type !== 0xBC) return null;

        const subType = data[0]; // Byte 0 of Payload (Byte 1 of Packet)

        // Common Header Extraction
        // const len = data[1] | (data[2] << 8); // Little Endian Length?
        // const ts = (data[6] << 24) | (data[5] << 16) | (data[4] << 8) | data[3];
        // Note: Timestamps in 0xBC seem to be standard Unix Epoch.

        switch (subType) {
            case 0x25: // Temperature (R09/R02 Pro)
                // Format: [BC, 25, LEN(2), TS(4), T0, T1, T2...]
                // Data bytes are raw values. formula: val/10 + 20? 
                const candidates = [];
                for (let i = 8; i < data.length; i++) {
                    const val = data[i];
                    if (val > 0) {
                        const temp = (val / 10.0) + 20.0;
                        if (temp > 30 && temp < 43) candidates.push(temp.toFixed(1));
                    }
                }
                if (candidates.length > 0) {
                    return {
                        // Timestamp: Use current time as fallback if decoding is risky, 
                        // but ideally we decode the TS bytes.
                        timestamp: new Date().toISOString(),
                        temperature: parseFloat(candidates[candidates.length - 1]),
                        readings: candidates
                    };
                }
                break;

            case 0x27: // Sleep (Ref: Gadgetbridge BIG_DATA_TYPE_SLEEP)
                console.log(`💤 V2 SLEEP DATA DETECTED (Type 0x27). Len=${data.length}`);
                // Parsing sleep is complex (nibbles?), just logging for now.
                break;

            case 0x2A: // SpO2 (Ref: Gadgetbridge BIG_DATA_TYPE_SPO2)
                console.log(`💨 V2 SPO2 DATA DETECTED (Type 0x2A). Len=${data.length}`);
                // Usually byte array of % values.
                const spo2 = data[8]; // Guessing first data byte
                if (spo2 > 80 && spo2 <= 100) {
                    return { bloodOxygen: spo2, timestamp: new Date().toISOString() };
                }
                break;

            default:
                console.log(`📦 V2 UNKNOWN DATA (Type 0x${subType.toString(16)}). Len=${data.length}`);
        }
        return null;
    }

    // Parse 0x15 (Legacy Heart Rate History) - Based on colmi_r02_client/hr.py
    public static parseLegacyHR(data: number[]) {
        // Packet: [15, SUB_TYPE, ... ]
        // Note: Input 'data' here usually excludes the Command Byte if handled by `parsePacket`?
        // Let's assume 'data' is the full payload payload starting AFTER 0x15 if passed from handleNotification?

        // subData[0] = SubType
        const subType = data[0];

        // 1. Metadata Packet
        if (subType === 0) {
            // [00, SIZE, RANGE, ...]
            const size = data[1];
            const range = data[2];
            console.log(`📜 LEGACY HR: Meta | Count=${size} Range=${range}m`);
            return { type: 'meta', size, range };
        }

        // 2. Timestamp Packet
        if (subType === 1) {
            // [01, TS0, TS1, TS2, TS3, ...]
            // Python: struct.unpack_from("<l", packet, offset=2) -> This implies starting at data[1]?
            // Python packet includes CMD? Yes. "first byte ... is CMD".
            // So packet[0]=15, packet[1]=subType.
            // If subType=1, "unpack_from(..., offset=2)". data[2] in Python is data[1] here.

            // TS is Little Endian 4 bytes.
            const ts0 = data[1];
            const ts1 = data[2];
            const ts2 = data[3];
            const ts3 = data[4];

            // Convert to 32-bit integer
            const ts = (ts3 << 24) | (ts2 << 16) | (ts1 << 8) | ts0;
            const date = new Date(ts * 1000);

            console.log(`📜 LEGACY HR: Timestamp | ${date.toISOString()} (${ts})`);
            return { type: 'timestamp', ts, date };
        }

        // 3. Data Packet
        // Bytes 2-15 (Python index 2:15) -> 13 bytes of samples?
        // Python: "self._raw_heart_rates[self.index : self.index + 13] = list(packet[2:15])"
        // Here data[0] is SubType. data[1..13] -> 13 items.
        // wait, Python says subType is at packet[1]. 
        // If we stripped the 0x15 command byte, data[0] IS subType.

        const samples = data.slice(1, 14); // Take 13 bytes
        const validSamples = samples.filter(s => s > 0 && s < 255);
        if (validSamples.length > 0) {
            console.log(`📜 LEGACY HR: Data | ${validSamples.join(', ')}`);
            return { type: 'data', samples: validSamples };
        }

        return null;
    }

    // 0x48: Real-time Health
    public static parseHealth(data: number[]): HealthPacket | null {
        const hr = data[12];
        const rawVal = (data[8] << 8) | data[9]; // 3450 or 4588

        // PIVOT: 3450 -> 34.50 (HRV/Stress?). User confirmed typical HRV range.

        return {
            type: 'health',
            timestamp: new Date().toISOString(),
            data: data.slice(1),
            decoded: {
                steps: 0,
                heartRate: hr,
                battery: 0,
                temperature: 0,
                hrv: rawVal / 100 // Unit: ms (RMSSD?)
            }
        };
    }
}
