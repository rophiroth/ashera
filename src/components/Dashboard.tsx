"use client";

import { useBluetooth } from "@/lib/bluetooth/useBluetooth";
import { Activity, Battery, Heart, Moon, Thermometer, Footprints, Wind, Zap } from "lucide-react";
import TemperatureChart from "./TemperatureChart";

export default function Dashboard() {
    const { device, status, lastData, connect, disconnect, measureHeartRate, measureSPO2, measureStress, syncSteps } = useBluetooth();

    return (
        <div className="p-6 max-w-md mx-auto space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Ashera
                    </h1>
                    <p className="text-xs text-white/50">Bio-feedback Interface</p>
                </div>
                <div className="flex items-center gap-2">
                    {status === 'connected' && lastData?.batteryLevel !== undefined && (
                        <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10">
                            <Battery className="w-3 h-3 text-green-400" />
                            <span>{lastData.batteryLevel}%</span>
                        </div>
                    )}
                    <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' :
                        status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                        }`} />
                </div>
            </header>

            {/* Connection State */}
            {status === 'disconnected' ? (
                <div className="text-center py-20 space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Activity className="w-10 h-10 text-white/20" />
                    </div>
                    <button
                        onClick={connect}
                        className="bg-white text-black px-8 py-3 rounded-full font-medium hover:scale-105 transition-transform active:scale-95 flex items-center gap-2 mx-auto"
                    >
                        Connect Ring
                    </button>
                    <p className="text-sm text-white/30 max-w-[200px] mx-auto">
                        Make sure your Bluetooth is on and the ring is nearby.
                    </p>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* Primary Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Heart Rate */}
                        <div onClick={measureHeartRate} className="bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer active:scale-95">
                            <div className="flex justify-between items-start mb-2">
                                <Heart className="w-5 h-5 text-rose-400" />
                                <span className="text-[10px] uppercase tracking-wider text-white/40">BPM</span>
                            </div>
                            <div className="text-3xl font-light">
                                {lastData?.heartRate || "--"}
                            </div>
                            <div className="text-xs text-rose-400/50 mt-1">Tap to measure</div>
                        </div>

                        {/* SPO2 */}
                        <div onClick={measureSPO2} className="bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer active:scale-95">
                            <div className="flex justify-between items-start mb-2">
                                <Wind className="w-5 h-5 text-sky-400" />
                                <span className="text-[10px] uppercase tracking-wider text-white/40">SPO2</span>
                            </div>
                            <div className="text-3xl font-light">
                                {lastData?.spo2 ? `${lastData.spo2}%` : "--"}
                            </div>
                            <div className="text-xs text-sky-400/50 mt-1">Tap to measure</div>
                        </div>

                        {/* Steps */}
                        <div onClick={syncSteps} className="bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer active:scale-95">
                            <div className="flex justify-between items-start mb-2">
                                <Footprints className="w-5 h-5 text-emerald-400" />
                                <span className="text-[10px] uppercase tracking-wider text-white/40">Steps</span>
                            </div>
                            <div className="text-3xl font-light">
                                {lastData?.steps?.toLocaleString() || "--"}
                            </div>
                            <div className="text-xs text-emerald-400/50 mt-1">Tap to sync</div>
                        </div>

                        {/* Stress */}
                        <div onClick={measureStress} className="bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer active:scale-95">
                            <div className="flex justify-between items-start mb-2">
                                <Zap className="w-5 h-5 text-amber-400" />
                                <span className="text-[10px] uppercase tracking-wider text-white/40">Stress</span>
                            </div>
                            <div className="text-3xl font-light">
                                {lastData?.stress || "--"}
                            </div>
                            <div className="text-xs text-amber-400/50 mt-1">Tap to measure</div>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                        <div className="flex items-center gap-2 mb-6">
                            <Thermometer className="w-4 h-4 text-orange-300" />
                            <h3 className="text-sm font-medium text-white/70">Temperature Trend</h3>
                        </div>
                        <TemperatureChart />
                    </div>

                    <button
                        onClick={disconnect}
                        className="w-full py-4 text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                        Disconnect Device
                    </button>

                    <div className="text-center text-[10px] text-white/20">
                        v0.0.3 (Sensors Enabled)
                    </div>
                </div>
            )}
        </div>
    );
}
