"use client";

import { Battery, Plus } from "lucide-react";
import SeedingControl from "./SeedingControl";
import { ConnectionStatus } from "@/lib/bluetooth/types";

interface DashboardHeaderProps {
    status: ConnectionStatus;
    lastData: any;
    connect: () => void;
    currentCycleDay: number | null;
    onManualEntry: () => void;
    onDebug: () => void;
}

export default function DashboardHeader({ status, lastData, connect, currentCycleDay, onManualEntry, onDebug }: DashboardHeaderProps) {
    return (
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Ashera
                </h1>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-white/50">Bio-feedback Interface</p>
                    {currentCycleDay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            CD {currentCycleDay}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Demo Control Isolated Component */}
                <SeedingControl />

                <button
                    onClick={onManualEntry}
                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                    title="Add Manual Entry"
                >
                    <Plus className="w-4 h-4" />
                </button>

                {status === 'disconnected' && (
                    <button
                        onClick={connect}
                        className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
                    >
                        Connect Ring
                    </button>
                )}

                {status === 'connected' && lastData?.batteryLevel !== undefined && (
                    <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10">
                        <Battery className="w-3 h-3 text-green-400" />
                        <span>{lastData.batteryLevel}%</span>
                    </div>
                )}

                {/* Sniffer Button */}
                <button
                    onClick={onDebug}
                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                    title="Bluetooth Sniffer"
                >
                    <span className="text-xl">🕵️‍♂️</span>
                </button>

                <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' :
                    status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                    } `} />
            </div>
        </header>
    );
}
