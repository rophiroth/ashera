"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from 'recharts';
// Define DateRange locally if not exported from DateFilter (it was removed there)
export interface DateRange {
    from: Date;
    to: Date;
}
import { Toggle } from "@/components/ui/toggle";

import { MOCK_TEMPERATURE_DATA } from "@/lib/mockData";

interface TemperatureChartProps {
    data?: any[];
    dateRange?: DateRange;
    isExpanded?: boolean;
}

// Custom Shapes for STM
const CustomMucusShape = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.mucus) return null;

    // Color mapping
    let fill = "#ffffff20";
    if (payload.mucus === "Eggwhite") fill = "#60a5fa"; // Blue
    if (payload.mucus === "Creamy") fill = "#f472b6"; // Pink
    if (payload.mucus === "Sticky") fill = "#fbbf24"; // Yellow
    if (payload.mucus === "Dry") fill = "#a1a1aa"; // Gray

    // Droplet Path
    return (
        <path
            d={`M${cx} ${cy - 10} Q${cx + 8} ${cy} ${cx} ${cy + 8} Q${cx - 8} ${cy} ${cx} ${cy - 10} Z`}
            fill={fill}
            opacity={0.9}
        />
    );
};

const CustomCervixShape = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.cervix) return null;

    const isHigh = payload.cervix.includes("High");
    const isOpen = payload.cervix.includes("Open");

    return (
        <circle
            cx={cx}
            cy={cy}
            r={5}
            fill={isHigh ? "transparent" : "#a1a1aa"} // High = Hollow (Ring) look? Or maybe High = filled pink? Let's use Open = High Contrast Stroke
            stroke={isHigh ? "#f472b6" : "#a1a1aa"}
            strokeWidth={isOpen ? 2.5 : 1.5}
            fillOpacity={0.2}
        />
    );
};

export default function TemperatureChart({ data = MOCK_TEMPERATURE_DATA, dateRange, isExpanded = false }: TemperatureChartProps) {
    const [visibleMetrics, setVisibleMetrics] = useState({
        temp: true,
        sleep: true, // Default ON
        hrv: false,
        rhr: false,
        stm: true
    });

    // Simplified: Trust the parent (Dashboard.tsx) has already filtered and correctly sourced the data.
    // This avoids "Double Filtering" which can hide valid data due to timezone discrepancies between
    // how Dashboard constructs the array and how this component filters it.
    const filteredData = data;

    const toggleMetric = (metric: keyof typeof visibleMetrics) => {
        setVisibleMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
    };

    // Prepare separate arrays if needed, or just map 'stm' value for Scatter
    // We map arbitrary Y values for the strips to place them on the secondary axis
    const stmData = filteredData.map(d => ({
        ...d,
        mucusY: d.mucus ? 0 : null, // Mucus Strip at Level 0
        cervixY: d.cervix ? 1 : null, // Cervix Strip at Level 1
        // Sleep Stack
        sleepDeep: (d.sleepStages as any)?.deep || 0,
        sleepRem: (d.sleepStages as any)?.rem || 0,
        sleepLight: (d.sleepStages as any)?.light || 0,
        sleepAwake: (d.sleepStages as any)?.awake || 0,
    }));

    // Identify menstruation ranges for ReferenceArea
    const menstruationRanges = useMemo(() => {
        const ranges: { start: string, end: string }[] = [];
        let start: string | null = null;
        let end: string | null = null;

        filteredData.forEach((d, i) => {
            if ((d as any).isMenstruation) {
                if (!start) start = d.date;
                end = d.date;
            } else {
                if (start && end) {
                    ranges.push({ start, end });
                    start = null;
                    end = null;
                }
            }
        });
        if (start && end) ranges.push({ start, end });
        return ranges;
    }, [filteredData]);

    const showStrips = visibleMetrics.stm;

    // REMOVED: Manual ResizeObserver Logic
    // We will trust ResponsiveContainer but ensure parent has defined height.

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Toggles */}
            <div className="flex flex-wrap gap-2 justify-end mb-2 shrink-0">
                {isExpanded && (
                    <Toggle
                        pressed={visibleMetrics.stm}
                        onPressedChange={() => toggleMetric('stm')}
                        className="data-[state=on]:bg-pink-900/50 data-[state=on]:text-pink-300 border border-zinc-700"
                        size="sm"
                    >
                        STM Strips
                    </Toggle>
                )}
                <Toggle
                    pressed={visibleMetrics.temp}
                    onPressedChange={() => toggleMetric('temp')}
                    className="data-[state=on]:bg-purple-900/50 data-[state=on]:text-purple-300 border border-zinc-700"
                    size="sm"
                >
                    Temp
                </Toggle>
                <Toggle
                    pressed={visibleMetrics.sleep}
                    onPressedChange={() => toggleMetric('sleep')}
                    className="data-[state=on]:bg-blue-900/50 data-[state=on]:text-blue-300 border border-zinc-700"
                    size="sm"
                >
                    Sleep
                </Toggle>
                <Toggle
                    pressed={visibleMetrics.rhr}
                    onPressedChange={() => toggleMetric('rhr')}
                    className="data-[state=on]:bg-red-900/50 data-[state=on]:text-red-300 border border-zinc-700"
                    size="sm"
                >
                    RHR
                </Toggle>
                <Toggle
                    pressed={visibleMetrics.hrv}
                    onPressedChange={() => toggleMetric('hrv')}
                    className="data-[state=on]:bg-green-900/50 data-[state=on]:text-green-300 border border-zinc-700"
                    size="sm"
                >
                    HRV
                </Toggle>
            </div>

            {/* Chart Container */}
            <div
                className={`w-full ${isExpanded ? 'flex-1 min-h-0' : 'h-[350px]'} relative bg-white/5 rounded-xl border border-white/5 overflow-hidden`}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={stmData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 20 }} // Extra bottom for labels
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />

                        {/* Menstruation Background Area */}
                        {menstruationRanges.map((range, i) => (
                            <ReferenceArea
                                key={`m-${i}`}
                                x1={range.start}
                                x2={range.end}
                                yAxisId="stm"
                                y1={-1}
                                y2={4}
                                fill="#ec4899"
                                fillOpacity={0.15}
                            />
                        ))}

                        <XAxis
                            dataKey="date"
                            stroke="#888888"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                            minTickGap={15} // Reduced gap to show more dates
                            padding={{ left: 10, right: 10 }} // Padding to fix Day 1 cutoff
                            tickFormatter={(value) => {
                                const date = new Date(value);
                                // If range is same day (calendar check), show time
                                const isSameDay = dateRange?.from && dateRange?.to &&
                                    dateRange.from.getDate() === dateRange.to.getDate() &&
                                    dateRange.from.getMonth() === dateRange.to.getMonth() &&
                                    dateRange.from.getFullYear() === dateRange.to.getFullYear();

                                if (isSameDay) {
                                    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                                }
                                return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                            }}
                        />

                        {/* Temp Axis (Left) */}
                        <YAxis
                            yAxisId="temp"
                            stroke="#d8b4fe"
                            domain={[35.8, 37.5]} // FIXED: Stable human range to prevent "Flat Line on Zoom" illusion
                            width={40}
                            hide={!visibleMetrics.temp}
                        />

                        {/* Sleep Axis (Right 1) */}
                        <YAxis
                            yAxisId="sleep"
                            orientation="right"
                            stroke="#60a5fa"
                            domain={[0, 12]}
                            width={40}
                            hide={!visibleMetrics.sleep}
                        />

                        {/* Heart Rate Axis (Right 2) - Reuse or separate? Let's hide if unused to avoid clutter */}
                        <YAxis
                            yAxisId="heart"
                            orientation="right"
                            stroke="#f87171"
                            domain={[40, 100]}
                            width={40}
                            hide={!visibleMetrics.rhr && !visibleMetrics.hrv}
                        />

                        {/* STM Strips Axis (Hidden/Overlaid) */}
                        <YAxis
                            yAxisId="stm"
                            orientation="left"
                            domain={[-1, 4]} // 0=Mucus, 1=Cervix. Reserve space.
                            hide={true}
                        />

                        <Tooltip
                            contentStyle={{ backgroundColor: "#1f1f1f", borderColor: "#333", borderRadius: "8px" }}
                            itemStyle={{ color: "#fff" }}
                            labelFormatter={(label: any) => {
                                if (!label) return '';
                                const date = new Date(label);
                                return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' });
                            }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-[#1f1f1f] border border-[#333] p-3 rounded-lg shadow-xl text-xs z-50">
                                            <p className="font-medium text-white mb-2">{new Date(label as string | number).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>

                                            {/* Cycle Day */}
                                            {data.cycleDay > 0 && (
                                                <div className={`mb-2 px-2 py-1 rounded border font-bold text-center ${data.isMenstruation ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-pink-500/10 border-pink-500/20 text-pink-300'}`}>
                                                    CD {data.cycleDay} {data.isMenstruation && '(Period)'}
                                                </div>
                                            )}

                                            {/* STM Details */}
                                            {(data.mucus || data.cervix) && (
                                                <div className="mb-2 pb-2 border-b border-white/10 space-y-1">
                                                    {data.mucus && <div className="text-blue-300">Mucus: {data.mucus}</div>}
                                                    {data.cervix && <div className="text-pink-300">Cervix: {data.cervix}</div>}
                                                </div>
                                            )}

                                            {/* Metrics Standard */}
                                            {visibleMetrics.temp && <div className="text-purple-300">Temp: {data.temp}°C</div>}
                                            {visibleMetrics.sleep && (
                                                <div className="text-blue-300">
                                                    Sleep: {data.sleep}h
                                                    {data.sleepStages && <span className="text-neutral-500 ml-1">({data.sleepStages.deep}h Deep)</span>}
                                                </div>
                                            )}
                                            {visibleMetrics.rhr && (
                                                <div className="text-red-300">RHR: {data.rhr} bpm</div>
                                            )}
                                            {visibleMetrics.hrv && (
                                                <div className="text-green-300">HRV: {data.hrv} ms</div>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        {/* Cycle Start Vertical Lines */}
                        {filteredData.map((d, i) => {
                            if ((d as any).isCycleStart) { // Cast because 'any' passed down
                                return <ReferenceLine key={i} x={d.date} stroke="#ec4899" strokeDasharray="3 3" label={{ position: 'top', value: 'Cycle Start', fill: '#ec4899', fontSize: 10 }} />;
                            }
                            return null;
                        })}

                        <ReferenceLine yAxisId="temp" y={36.5} stroke="red" strokeDasharray="3 3" label={{ value: "Coverline", fill: "red", fontSize: 10, position: 'right' }} />

                        {/* Metrics */}
                        {visibleMetrics.temp && (
                            <Line
                                yAxisId="temp"
                                type="monotone"
                                dataKey="temp"
                                stroke="#d8b4fe"
                                strokeWidth={2}
                                dot={(dateRange?.from && dateRange?.to && dateRange.from.getDate() === dateRange.to.getDate()) ? false : { r: 4, fill: "#d8b4fe" }}
                                connectNulls={true} // FIXED: Connects dots over missing days/nulls
                                name="BBT"
                            />
                        )}

                        {/* Stacked Sleep Bars */}
                        {/* Sleep Stage Axis (Hidden but used for mapping) */}
                        <YAxis
                            yAxisId="sleepStage"
                            orientation="right"
                            domain={[0, 4]} // 0=Deep, 1=Light, 2=REM, 3=Awake. Space for labels.
                            ticks={[0, 1, 2, 3]}
                            tickFormatter={(val) => {
                                if (val === 0) return 'Deep';
                                if (val === 1) return 'Light';
                                if (val === 2) return 'REM';
                                if (val === 3) return 'Awake';
                                return '';
                            }}
                            width={40}
                            hide={!visibleMetrics.sleep}
                            stroke="#60a5fa"
                            tick={{ fontSize: 10, fill: '#60a5fa' }}
                        />

                        {visibleMetrics.sleep && (
                            <>
                                {/* DAILY VIEW: Stacked Bars (Only show if NO granular stage data) */}
                                {/* We check if data has 'sleepStage' property to toggle modes? Or just render both? */}
                                {/* Step Chart renders over bars if present. */}

                                <Bar yAxisId="sleep" dataKey="sleepDeep" stackId="a" fill="#1e3a8a" name="Deep" barSize={40} />
                                <Bar yAxisId="sleep" dataKey="sleepRem" stackId="a" fill="#3b82f6" name="REM" barSize={40} />
                                <Bar yAxisId="sleep" dataKey="sleepLight" stackId="a" fill="#93c5fd" name="Light" barSize={40} />
                                <Bar yAxisId="sleep" dataKey="sleepAwake" stackId="a" fill="#fbbf24" name="Awake" barSize={40} />

                                {/* INTRADAY VIEW: Hypnogram Step Line */}
                                <Line
                                    yAxisId="sleepStage"
                                    type="stepAfter"
                                    dataKey="sleepStage"
                                    stroke="#60a5fa"
                                    strokeWidth={3}
                                    dot={false}
                                    name="Hypnogram"
                                    connectNulls={true}
                                />
                            </>
                        )}

                        {showStrips && (
                            <>
                                {/* Mucus Row (Squares) */}
                                <Line
                                    yAxisId="stm"
                                    dataKey="mucusY"
                                    stroke="transparent"
                                    dot={<CustomMucusShape />}
                                    isAnimationActive={false}
                                    activeDot={false}
                                />
                                {/* Cervix Row (Circles) */}
                                <Line
                                    yAxisId="stm"
                                    dataKey="cervixY"
                                    stroke="transparent"
                                    dot={<CustomCervixShape />}
                                    isAnimationActive={false}
                                    activeDot={false}
                                />
                            </>
                        )}

                        {visibleMetrics.rhr && (
                            <Line yAxisId="heart" type="monotone" dataKey="rhr" stroke="#f87171" strokeWidth={2} dot={false} name="RHR" />
                        )}

                        {visibleMetrics.hrv && (
                            <Line yAxisId="heart" type="monotone" dataKey="hrv" stroke="#4ade80" strokeWidth={2} dot={false} name="HRV" />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
