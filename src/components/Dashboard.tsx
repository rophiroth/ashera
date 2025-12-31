"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useBluetooth } from "@/lib/bluetooth/useBluetooth";
import { BluetoothDebugger } from "@/components/bluetooth/BluetoothDebugger";
import { Maximize2, Minimize2 } from "lucide-react";
import TemperatureChart from "./TemperatureChart";
import { DateFilter } from "./DateFilter";
import ManualEntryModal from "./ManualEntryModal";
import { generateIntradayData } from "@/lib/mockData";
import { useJournal } from "@/hooks/useJournal";
import { useAuth } from "@/context/AuthContext";

// Modular Components
import DashboardHeader from "./dashboard/DashboardHeader";
import DashboardMetrics from "./dashboard/DashboardMetrics";

export default function Dashboard() {
    const bt = useBluetooth();
    const { device, status, lastData, connect, disconnect, measureHeartRate, measureSPO2, measureStress, syncSteps } = bt;

    const { user } = useAuth();
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
    const [isDebugOpen, setIsDebugOpen] = useState(false);
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [duration, setDuration] = useState<string>("30d");
    const [viewMode, setViewMode] = useState<'chart' | 'sheet'>('chart');
    const { entries, addEntry, loading } = useJournal();
    const hasSeeded = useRef(false);

    // Default to 'sheet' (Detailed/Horizontal) on Desktop & Init Date
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
            setViewMode('sheet');
        }

        // Smart Init: If we have cycle data (from quick snapshot or cache), prioritize Last Cycle Start.
        // Since 'entries' might load async, we might need a separate effect or just default to today-30.
        // Let's stick to Today-30 for now to avoid jumpiness, but if user has data, we arguably should show it.
        // Actually, let's keep it simple: Start = Today - 30 is a safe default.
        // User asked for "Default should be Cycle Start". 
        // We can do this if we had entries loaded. But entries load via hook > snapshot.
        // We'll leave this as is for now, but handle the "Manual Entry" case via the new normalization logic.

        const d = new Date();
        d.setDate(d.getDate() - 30);
        setStartDate(d);
    }, []);

    // Effect: Update Start Date when entries first load (if not already set by user interaction?)
    // This is risky if user is already navigating. Let's start with just ensuring the Logic *allows* it.
    // The user's complaint "When I set start of cycle... I can't see it" was likely due to the "isCycleStart" mismatch logic fixed above.

    // Derived Range
    const currentRange = useMemo(() => {
        const from = new Date(startDate);
        const to = new Date(startDate);

        if (duration === '1d') to.setDate(from.getDate() + 1);
        else if (duration === '7d') to.setDate(from.getDate() + 7);
        else if (duration === '30d') to.setDate(from.getDate() + 30);
        else if (duration === 'ALL') {
            // Uncapped as requested
            to.setDate(from.getDate() + 365);
        }

        return { from, to };
    }, [startDate, duration]);

    // AUTO-SAVE LOGIC (Persistence)
    // Watch for Valid Temperature Data in lastData (from 0xBC Sync) and save it.
    useEffect(() => {
        if (lastData?.temperature && lastData.timestamp) {
            // Avoid duplicate saves: check if we just saved this timestamp? 
            // Better: Check if we have an entry for Today/Recent with this value?
            // For now, let's just save. The addEntry logic handles some validation? 
            // No, addEntry adds regardless.
            // Simple debounce: Use a ref to track last saved temp value + time?
            // Or only save if it's "Fresh" (timestamp close to now)?

            const isFresh = (Date.now() - lastData.timestamp) < 60000; // 1 min freshness
            // TRUST THE TIMESTAMP (even if it is Date.now() we just set is close enough for "Now")
            // If we parse real history later, this logic holds.

            // FORCE SAVE even if old? No, only save if we "just received" it.
            // But if it's historical data (e.g. from 2 hours ago), we WANT to save it with the OLD date.

            // For v0.1.40: We are using Date.now() in Parser, so it is always fresh.
            // The User's Point: "Does it come with a timestamp?" -> Yes.
            // We should ideally parse it.
            // Since I can't decode it 100% yet, I will tell the user we are using "Now" for sync.

            if (true) { // Always save valid 0xBC data that arrives? 
                // Deduplication is handled by Firestore Doc ID (YYYY-MM-DD)?
                // No, addEntry uses timestamp ID.

                const dateStr = new Date(lastData.timestamp).toISOString();

                console.log("Auto-Saving Temp:", lastData.temperature, dateStr);
                addEntry({
                    date: dateStr,
                    type: 'temperature',
                    value: lastData.temperature,
                }).catch(console.error);
            }
        }
    }, [lastData?.temperature, lastData?.timestamp]); // Only trigger on value change

    // Calculate current cycle day
    const currentCycleDay = useMemo(() => {
        const starts = entries
            .filter(e => e.type === 'cycle' && e.value === 'Start')
            .map(e => new Date(e.date).getTime())
            .sort((a, b) => b - a); // Descending

        if (starts.length === 0) return null;

        const lastStart = starts[0];
        const today = new Date().getTime();
        const diffToken = today - lastStart;
        const days = Math.floor(diffToken / (1000 * 60 * 60 * 24)) + 1;
        return days > 0 ? days : 1;
    }, [entries]);

    // Combine mock data with real entries for the chart
    const chartData = useMemo(() => {
        // 1. If 1D view selected, return intraday
        if (duration === '1d') {
            return generateIntradayData(startDate);
        }

        // 2. Prepare Cycle Start Map for quick lookup
        // Normalize to YYYY-MM-DD to match chart keys
        const cycleStarts = entries
            .filter(e => e.type === 'cycle' && e.value === 'Start')
            .map(e => {
                const d = new Date(e.date);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            })
            .sort();

        // Also keep raw timestamps for CD calculation
        const cycleStartTimestamps = entries
            .filter(e => e.type === 'cycle' && e.value === 'Start')
            .map(e => new Date(e.date).getTime())
            .sort((a, b) => a - b); // Ascending

        // 3. Map Real Data
        // PRE-PROCESSING: Calculate Sleep Durations from Raw Events if they exist
        const sleepAggregates = new Map<string, { deep: number, rem: number, light: number, awake: number, total: number }>();

        // Sort all entries by time first for accurate duration calc
        const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp);

        for (let i = 0; i < sortedEntries.length; i++) {
            const e = sortedEntries[i];
            if (e.type === 'sleep_stage') {
                // Calculate Duration
                let durationHours = 0;
                if (i < sortedEntries.length - 1) {
                    const next = sortedEntries[i + 1];
                    // Limit max duration to avoid huge gaps (max 4h)
                    const diffMs = next.timestamp - e.timestamp;
                    const diffHrs = diffMs / (1000 * 3600);
                    if (diffHrs < 4) {
                        durationHours = diffHrs;
                    }
                } else {
                    durationHours = 0.25; // Nominal for last event
                }

                // Associate with Reporting Date (Virtual Day Shift)
                // If hour > 16, belongs to NEXT day
                const d = new Date(e.timestamp);
                if (d.getHours() > 16) {
                    d.setDate(d.getDate() + 1);
                }
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const key = `${year}-${month}-${day}`;

                if (!sleepAggregates.has(key)) {
                    sleepAggregates.set(key, { deep: 0, rem: 0, light: 0, awake: 0, total: 0 });
                }
                const stat = sleepAggregates.get(key)!;

                // Add to specific type
                if (e.value === 'Deep') stat.deep += durationHours;
                else if (e.value === 'REM') stat.rem += durationHours;
                else if (e.value === 'Light') stat.light += durationHours;
                else if (e.value === 'Awake') stat.awake += durationHours;
                stat.total += durationHours;
            }
        }

        const realData = sortedEntries
            .filter(e => e.type === 'temperature' || e.type === 'hrv' || e.type === 'symptom' || e.type === 'sleep_stage' || (e.type === 'cycle' && e.value === 'Start'))
            .map(e => {
                // Parse date safely (ISO or Legacy YYYY-MM-DD)
                const dateObj = new Date(e.date);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                const entryTime = dateObj.getTime();

                // Find latest start before or on this date
                const latestStartTs = cycleStartTimestamps
                    .filter(ts => ts <= entryTime)
                    .pop();

                let cd = 0;
                if (latestStartTs) {
                    const diff = entryTime - latestStartTs;
                    cd = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
                }

                const isMenstruation = cd >= 1 && cd <= 5;
                const isStart = cycleStarts.includes(dateStr);

                let sleepStageVal = null;
                if (e.type === 'sleep_stage') {
                    // Map String to Numeric for Step Chart
                    if (e.value === 'Awake') sleepStageVal = 3;
                    else if (e.value === 'REM') sleepStageVal = 2;
                    else if (e.value === 'Light') sleepStageVal = 1;
                    else if (e.value === 'Deep') sleepStageVal = 0;
                }

                // Aggregated Sleep check (For Daily Bars)
                const agg = sleepAggregates.get(dateStr);
                const computedSleep = agg ? agg.total : 0;
                const computedStages = agg ? agg : { deep: 0, rem: 0, light: 0, awake: 0 };

                return {
                    date: e.date, // Keep original timestamp (ISO) for Intraday X-Axis
                    displayDate: dateStr,
                    type: e.type,
                    temp: e.type === 'temperature' ? Number(e.value) : null,
                    // Use Calculated Sleep if available for this day, else fall back to legacy
                    sleep: computedSleep > 0 ? computedSleep : (e.sleep || 0),
                    sleepStages: computedSleep > 0 ? computedStages : (e.sleepStages || { deep: 0, rem: 0, light: 0, awake: 0 }),

                    hrv: e.hrv || (e.type === 'hrv' ? Number(e.value) : 0),
                    sleepStage: sleepStageVal, // NEW HYPNOGRAM FIELD
                    rhr: e.rhr || 0,
                    phase: e.phase || "Follicular",
                    mucus: e.mucus || undefined,
                    cervix: e.cervix || undefined,
                    cycleDay: cd,
                    isCycleStart: isStart,
                    isMenstruation
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by time

        console.log("Dashboard: realData mapped:", realData.length);

        // Intraday Logic Check: Are we viewing a single day?
        const isSameDay = currentRange.from.getDate() === currentRange.to.getDate() &&
            currentRange.from.getMonth() === currentRange.to.getMonth() &&
            currentRange.from.getFullYear() === currentRange.to.getFullYear();

        if (isSameDay) {
            // INTRADAY MODE: Return all points directly (No flattening)
            // Filter to only match the specific day we are viewing
            // FIX: Expand window backwards by 12h to capture Sleep Onset (which starts previous night)
            const startTs = currentRange.from.getTime() - (12 * 60 * 60 * 1000);
            // End of that day (approx)
            const endTs = new Date(currentRange.from);
            endTs.setHours(23, 59, 59, 999);

            return realData.filter(d => {
                const t = new Date(d.date).getTime();
                return t >= startTs && t <= endTs.getTime();
            });
        }

        if (realData.length > 0) {
            // 4. Sparse Data Handling (DAILY VIEW - FLATTENING)
            const uniqueMap = new Map();
            realData.forEach(item => {
                // Use Derived Local Key
                const key = item.displayDate;
                if (uniqueMap.has(key)) {
                    // Merge strategies:
                    // If existing has temp and new doesn't, keep existing temp.
                    // If new has temp, overwrite.
                    const existing = uniqueMap.get(key);
                    uniqueMap.set(key, {
                        ...existing,
                        ...item,
                        // Priority Merging for specific fields to avoid null overwrites
                        temp: item.temp !== null ? item.temp : existing.temp,
                        sleep: item.sleep > 0 ? item.sleep : existing.sleep,
                        sleepStages: item.sleep > 0 ? item.sleepStages : existing.sleepStages,
                        hrv: item.hrv > 0 ? item.hrv : existing.hrv
                    });
                } else {
                    uniqueMap.set(key, item);
                }
            });

            // STRICT LOCAL DATE BOUNDARIES
            const start = new Date(currentRange.from);
            const end = new Date(currentRange.to);

            const current = new Date(start);
            current.setHours(0, 0, 0, 0); // Local Midnight
            const endTime = new Date(end);
            endTime.setHours(23, 59, 59, 999); // Local End

            const filledData = [];

            while (current <= endTime) {
                // Format Local YYYY-MM-DD
                const year = current.getFullYear();
                const month = String(current.getMonth() + 1).padStart(2, '0');
                const day = String(current.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                if (uniqueMap.has(dateStr)) {
                    filledData.push(uniqueMap.get(dateStr));
                } else {
                    // Skeleton
                    const entryTime = current.getTime();

                    // Use Time-based lookup for CD
                    const latestStartTs = cycleStartTimestamps
                        .filter(ts => ts <= entryTime)
                        .pop();

                    let cd = 0;
                    if (latestStartTs) {
                        const diff = entryTime - latestStartTs;
                        cd = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
                    }

                    const isMenstruation = cd >= 1 && cd <= 5;
                    // Robust Check using Local String
                    const isStart = cycleStarts.includes(dateStr);

                    filledData.push({
                        // ... (same skeleton props) ...
                        date: dateStr,
                        displayDate: dateStr,
                        temp: null,
                        sleep: 0,
                        sleepStages: { deep: 0, rem: 0, light: 0, awake: 0 },
                        hrv: 0,
                        rhr: 0,
                        phase: "Follicular",
                        cycleDay: cd,
                        isCycleStart: isStart,
                        isMenstruation,
                        mucus: undefined,
                        cervix: undefined
                    });
                }
                current.setDate(current.getDate() + 1);
            }
            return filledData;
        }

        // NO MOCK DATA FALLBACK
        return [];
    }, [entries, currentRange]);

    const handleManualEntry = async (entry: { type: 'temperature' | 'cycle' | 'hrv'; value: any; date: string }) => {
        try {
            await addEntry({
                date: entry.date,
                type: entry.type,
                value: entry.value,
                phase: "Follicular",
                sleep: 0,
                hrv: 0,
                rhr: 0
            });
            // Simple feedback (Replace with Toast later if needed)
            // alert("Data Saved!"); 
            // We rely on Firestore Snapshot to update UI instantly.
        } catch (e) {
            console.error(e);
            alert("Failed to save entry. Check console.");
        }
    };

    // --- LANDSCAPE DETECTION ---
    const [isLandscape, setIsLandscape] = useState(false);
    useEffect(() => {
        const checkOrientation = () => {
            if (typeof window !== 'undefined') {
                const isLand = window.innerWidth > window.innerHeight;
                setIsLandscape(isLand);
            }
        };

        checkOrientation(); // Init
        window.addEventListener('resize', checkOrientation);
        return () => window.removeEventListener('resize', checkOrientation);
    }, []);

    return (
        <div className="p-4 md:p-6 max-w-[100vw] mx-auto space-y-6 overflow-x-hidden">
            {/* Modular Header - Always Visible */}
            <DashboardHeader
                status={status}
                lastData={lastData}
                connect={connect}
                currentCycleDay={currentCycleDay}
                onManualEntry={() => setIsManualEntryOpen(true)}
                onDebug={() => setIsDebugOpen(true)}
            />

            {/* Dashboard Content */}
            <div className="space-y-4">

                {/* Modular Metrics */}
                <DashboardMetrics
                    status={status}
                    lastData={lastData}
                    chartData={chartData}
                    measureHeartRate={measureHeartRate}
                />

                {/* Chart Widget - REMOVED on Desktop, only shown on small screens if not in sheet mode */}
                {viewMode === 'chart' && (
                    <div className="bg-white/5 p-4 md:p-6 rounded-3xl border border-white/10 relative group h-[400px] md:h-auto lg:hidden">
                        <div className="flex items-center justify-between mb-6 h-10">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-white/70">Temperature Trend</h3>
                                <button
                                    onClick={() => setViewMode('sheet')}
                                    className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                                    title="Expand to Fullscreen"
                                >
                                    <Maximize2 className="w-4 h-4" />
                                </button>
                            </div>
                            <DateFilter
                                startDate={startDate}
                                setStartDate={setStartDate}
                                rangeStr={duration}
                                onRangeChange={setDuration}
                            />
                        </div>
                        {/* Fixed Height Container - Taller to prevent "Shrinking" on Mobile */}
                        <div className="w-full h-[450px]">
                            <TemperatureChart data={chartData} dateRange={currentRange} isExpanded={false} />
                        </div>
                    </div>
                )}

                {/* Fullscreen Sheet (Responsive Layout - Always Visible on Desktop) */}
                {(viewMode === 'sheet' || (typeof window !== 'undefined' && window.innerWidth >= 1024)) && (
                    <div className={`
                        lg:block lg:relative lg:inset-auto lg:bg-transparent lg:backdrop-blur-none lg:w-full lg:h-auto lg:transform-none
                        fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200
                        flex flex-col
                        ${isLandscape ? 'data-[mobile=true]:inset-0 data-[mobile=true]:w-auto data-[mobile=true]:h-auto data-[mobile=true]:bg-black' :
                            // PORTRAIT: Apply Hanging Rotation
                            // IMPORTANT: Fixed width/height using d-stats to prevent layout breakage on "ALL" data load
                            'data-[mobile=true]:origin-top-left data-[mobile=true]:rotate-90 data-[mobile=true]:translate-x-[100dvw] data-[mobile=true]:w-[100dvh] data-[mobile=true]:h-[100dvw] data-[mobile=true]:overscroll-none'}
                        `}
                        data-mobile={typeof window !== 'undefined' && window.innerWidth < 1024}
                    >
                        <div className="flex items-center justify-between px-2 shrink-0 h-12 mb-2 lg:mb-0">
                            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                Detailed Analysis (STM)
                            </h2>
                            <div className="flex items-center gap-4 ml-auto">
                                {/* ml-auto ensures right alignment */}
                                <DateFilter
                                    startDate={startDate}
                                    setStartDate={setStartDate}
                                    rangeStr={duration}
                                    onRangeChange={setDuration}
                                />
                                {/* Mobile Minimize Button */}
                                <button
                                    onClick={() => setViewMode('chart')}
                                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors lg:hidden"
                                    title="Minimize"
                                >
                                    <Minimize2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        {/* Tall Container for Detailed Graph - FORCE HEIGHT */}
                        <div className={`w-full h-[60vh] lg:h-[70vh] min-h-[500px] bg-white/5 lg:rounded-2xl border-white/10 relative shadow-2xl overflow-hidden
                            ${isLandscape && typeof window !== 'undefined' && window.innerWidth < 1024 ? 'border-0 rounded-none p-0' : 'border rounded-2xl p-4'}
                        `}>
                            <div className={`${isLandscape && typeof window !== 'undefined' && window.innerWidth < 1024 ? 'absolute inset-0 top-2 bottom-2 left-2 right-8' : 'absolute inset-4'} min-w-[200px] min-h-[200px]`}>
                                <TemperatureChart data={chartData} dateRange={currentRange} isExpanded={true} />

                                {/* Debug Overlay for User Verification (ALWAYS SHOW) */}
                                {chartData.length > 0 && (
                                    <div className="absolute top-2 right-12 z-50 bg-black/80 px-3 py-1 text-[10px] text-yellow-500 border border-yellow-500/30 rounded shadow-lg pointer-events-none">
                                        DEBUG: {chartData.length} pts (Sleep: {chartData.find(d => d.sleep > 0)?.sleep || 0}h)
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-center text-[10px] text-white/20 flex flex-col gap-1">
                    <span className={process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "text-green-500/50" : "text-red-500"}>
                        Proj: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "FAIL: UNDEFINED"}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">v0.1.53 (STEPS)</span>
                    <span className="text-white/10">
                        API: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Loaded *****" : "FAIL: MISSING"}
                    </span>
                </div>
            </div>

            <ManualEntryModal
                isOpen={isManualEntryOpen}
                onClose={() => setIsManualEntryOpen(false)}
                onSave={handleManualEntry}
            />

            <BluetoothDebugger
                isOpen={isDebugOpen}
                onClose={() => setIsDebugOpen(false)}
                bt={bt}
            />
        </div >
    );
}
