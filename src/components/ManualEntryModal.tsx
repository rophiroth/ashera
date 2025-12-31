"use client";

import { useState } from 'react';
import { X, Save, Thermometer, Calendar, Activity } from 'lucide-react';

interface ManualEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { type: 'temperature' | 'cycle' | 'hrv'; value: any; date: string }) => void;
}

export default function ManualEntryModal({ isOpen, onClose, onSave }: ManualEntryModalProps) {
    const [activeTab, setActiveTab] = useState<'temperature' | 'cycle' | 'hrv'>('temperature');
    const [temperature, setTemperature] = useState<string>('');
    const [hrv, setHrv] = useState<string>('');
    // Helper for Local YYYY-MM-DD
    const getTodayStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState<string>(getTodayStr());
    const [cycleStart, setCycleStart] = useState<string>(getTodayStr());

    if (!isOpen) return null;

    const handleSave = () => {
        if (activeTab === 'temperature') {
            if (!temperature) return;
            onSave({
                type: 'temperature',
                value: parseFloat(temperature),
                date: date
            });
        } else if (activeTab === 'hrv') {
            if (!hrv) return;
            onSave({
                type: 'hrv',
                value: parseInt(hrv),
                date: date
            });
        } else {
            onSave({
                type: 'cycle',
                value: 'Start',
                date: cycleStart
            });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative z-[201]">
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-white/5 bg-zinc-900/50">
                    <h3 className="text-lg font-medium text-white">Add Data</h3>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-2 gap-2 bg-black/20">
                    <button
                        onClick={() => setActiveTab('temperature')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-all ${activeTab === 'temperature' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:bg-white/5'
                            }`}
                    >
                        <Thermometer className="w-4 h-4" />
                        Temperature
                    </button>
                    {/* HRV Tab */}
                    <button
                        onClick={() => setActiveTab('hrv')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-all ${activeTab === 'hrv' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:bg-white/5'
                            }`}
                    >
                        <Activity className="w-4 h-4" />
                        HRV
                    </button>
                    <button
                        onClick={() => setActiveTab('cycle')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-all ${activeTab === 'cycle' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:bg-white/5'
                            }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Cycle
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {activeTab === 'temperature' ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs text-white/50 uppercase tracking-wider">Temperature (°C)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={temperature}
                                    onChange={(e) => setTemperature(e.target.value)}
                                    placeholder="36.5"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl text-white focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-white/10"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-white/50 uppercase tracking-wider">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </div>
                        </div>
                    ) : activeTab === 'hrv' ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs text-white/50 uppercase tracking-wider">HRV (ms)</label>
                                <input
                                    type="number"
                                    value={hrv}
                                    onChange={(e) => setHrv(e.target.value)}
                                    placeholder="60"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl text-white focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-white/10"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-white/50 uppercase tracking-wider">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <p className="text-sm text-purple-200">
                                    Log the start of your menstrual cycle to improve tracking accuracy.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-white/50 uppercase tracking-wider">Start Date</label>
                                <input
                                    type="date"
                                    value={cycleStart}
                                    onChange={(e) => setCycleStart(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleSave}
                        disabled={activeTab === 'temperature' && !temperature}
                        className="w-full bg-white text-black font-medium py-3 rounded-xl hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Entry
                    </button>
                </div>
            </div>
        </div>
    );
}
