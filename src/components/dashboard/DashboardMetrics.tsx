"use client";

import { Activity, Heart, Wind, Zap } from "lucide-react";
import { ConnectionStatus } from "@/lib/bluetooth/types";

interface DashboardMetricsProps {
    status: ConnectionStatus;
    lastData: any;
    chartData: any[];
    measureHeartRate: () => void;
}

export default function DashboardMetrics({ status, lastData, chartData, measureHeartRate }: DashboardMetricsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Heart Rate */}
            <div
                onClick={status === 'connected' ? measureHeartRate : undefined}
                className={`bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors ${status === 'connected' ? 'cursor-pointer active:scale-95' : 'opacity-70'} `}
            >
                <div className="flex justify-between items-start mb-2">
                    <Heart className="w-5 h-5 text-rose-400" />
                    <span className="text-[10px] uppercase tracking-wider text-white/40">BPM</span>
                </div>
                <div className="text-3xl font-light">
                    {lastData?.heartRate || "--"}
                </div>
                <div className="text-xs text-rose-400/50 mt-1">{status === 'connected' ? 'Tap to measure' : 'Last recorded'}</div>
            </div>

            {/* Temperature (NEW) */}
            <div className={`bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors ${status === 'connected' ? '' : 'opacity-70'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1 text-orange-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /></svg>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-white/40">TEMP</span>
                </div>
                <div className="text-3xl font-light">
                    {lastData?.temperature ? `${lastData.temperature}°` : "--"}
                </div>
                <div className="text-xs text-orange-400/50 mt-1">Skin Temp (C)</div>
            </div>

            {/* SPO2 */}
            <div className={`bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors ${status === 'connected' ? '' : 'opacity-70'}`}>
                <div className="flex justify-between items-start mb-2">
                    <Wind className="w-5 h-5 text-sky-400" />
                    <span className="text-[10px] uppercase tracking-wider text-white/40">SPO2</span>
                </div>
                <div className="text-3xl font-light">
                    {lastData?.spo2 ? `${lastData.spo2}% ` : "--"}
                </div>
                <div className="text-xs text-sky-400/50 mt-1">Oxygen Saturation</div>
            </div>

            {/* HRV */}
            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] uppercase tracking-wider text-white/40">HRV</span>
                </div>
                <div className="text-3xl font-light">
                    {chartData.length > 0 ? chartData[chartData.length - 1].hrv || "--" : "--"}
                </div>
                <div className="text-xs text-emerald-400/50 mt-1">Variability (ms)</div>
            </div>

            {/* Stress */}
            <div className={`bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors ${status === 'connected' ? '' : 'opacity-70'}`}>
                <div className="flex justify-between items-start mb-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] uppercase tracking-wider text-white/40">Stress</span>
                </div>
                <div className="text-3xl font-light">
                    {lastData?.stress || "--"}
                </div>
                <div className="text-xs text-amber-400/50 mt-1">Level (0-100)</div>
            </div>
        </div>
    );
}
