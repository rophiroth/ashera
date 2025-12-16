"use client";

import { useState } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { DateRange } from './DateFilter';
import { Toggle } from "@/components/ui/toggle";
import { Eye, EyeOff } from "lucide-react";

import { MOCK_TEMPERATURE_DATA } from "@/lib/mockData";

interface TemperatureChartProps {
    data?: Array<{ date: string; temp: number; phase: string; sleep: number; hrv: number; rhr: number }>;
    dateRange?: DateRange;
}

export default function TemperatureChart({ data = MOCK_TEMPERATURE_DATA, dateRange }: TemperatureChartProps) {
    const [visibleMetrics, setVisibleMetrics] = useState({
        temp: true,
        sleep: false,
        hrv: false,
        rhr: false
    });

    // Simple date filtering logic (client-side for mock data)
    const filteredData = data.filter(d => {
        if (!dateRange?.from) return true;
        const current = new Date(d.date);
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = dateRange.to ? new Date(dateRange.to) : from;
        to.setHours(23, 59, 59, 999);
        return current >= from && current <= to;
    });

    const toggleMetric = (metric: keyof typeof visibleMetrics) => {
        setVisibleMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
    };

    return (
        <div className="space-y-4">
            {/* Toggles */}
            <div className="flex flex-wrap gap-2 justify-end mb-2">
                <Toggle
                    pressed={visibleMetrics.temp}
                    onPressedChange={() => toggleMetric('temp')}
                    className="data-[state=on]:bg-purple-900/50 data-[state=on]:text-purple-300 border border-zinc-700"
                    size="sm"
                >
                    Body Temp (BBT)
                </Toggle>
                <Toggle
                    pressed={visibleMetrics.sleep}
                    onPressedChange={() => toggleMetric('sleep')}
                    className="data-[state=on]:bg-blue-900/50 data-[state=on]:text-blue-300 border border-zinc-700"
                    size="sm"
                >
                    Sleep (hrs)
                </Toggle>
                <Toggle
                    pressed={visibleMetrics.rhr}
                    onPressedChange={() => toggleMetric('rhr')}
                    className="data-[state=on]:bg-red-900/50 data-[state=on]:text-red-300 border border-zinc-700"
                    size="sm"
                >
                    RHR (bpm)
                </Toggle>
                <Toggle
                    pressed={visibleMetrics.hrv}
                    onPressedChange={() => toggleMetric('hrv')}
                    className="data-[state=on]:bg-green-900/50 data-[state=on]:text-green-300 border border-zinc-700"
                    size="sm"
                >
                    HRV (ms)
                </Toggle>
            </div>

            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={filteredData}
                        margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis
                            dataKey="date"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        />

                        {/* Temp Axis (Left) */}
                        <YAxis
                            yAxisId="temp"
                            stroke="#d8b4fe"
                            domain={['dataMin - 0.5', 'dataMax + 0.5']}
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

                        <Tooltip
                            contentStyle={{ backgroundColor: "#1f1f1f", borderColor: "#333", borderRadius: "8px" }}
                            itemStyle={{ color: "#fff" }}
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <ReferenceLine yAxisId="temp" y={36.8} stroke="red" strokeDasharray="3 3" label="Coverline" />

                        {/* Metrics */}
                        {visibleMetrics.temp && (
                            <Line yAxisId="temp" type="monotone" dataKey="temp" stroke="#d8b4fe" strokeWidth={2} dot={{ r: 4, fill: "#d8b4fe" }} name="BBT" />
                        )}

                        {visibleMetrics.sleep && (
                            <Bar yAxisId="sleep" dataKey="sleep" fill="#60a5fa" fillOpacity={0.3} name="Sleep" unit="h" />
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
