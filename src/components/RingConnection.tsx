"use client";

import { useBluetooth } from "@/lib/bluetooth/useBluetooth";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bluetooth, Activity, AlertCircle } from "lucide-react";

export default function RingConnection() {
    const { connect, disconnect, status, error, lastData, device, isAvailable } = useBluetooth();
    const { user } = useAuth();

    if (!user) return null;

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-200">
                    <Bluetooth className={status === "connected" ? "text-blue-400" : "text-zinc-500"} size={20} />
                    Ring Connection
                </CardTitle>
                <CardDescription>Colmi R09 Integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!isAvailable && (
                    <div className="flex items-center gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-500">
                        <AlertCircle size={16} className="shrink-0" />
                        <div>
                            <p className="font-semibold">Bluetooth Unavailable Here</p>
                            <p>Open this App on <strong>Chrome for Android</strong> to connect your Ring.</p>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Status</span>
                    <span className={`text-sm font-medium ${status === "connected" ? "text-green-400" :
                        status === "connecting" ? "text-amber-400" : "text-zinc-500"
                        }`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </div>

                {status === "connected" && lastData && (
                    <div className="rounded-lg border border-zinc-800 bg-black/20 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-400">Heart Rate</span>
                            <span className="flex items-center gap-2 text-lg font-bold text-white">
                                <Activity className="animate-pulse text-red-500" size={16} />
                                {lastData.heartRate} BPM
                            </span>
                        </div>
                        {lastData.temperature && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-400">Temperature</span>
                                <span className="text-lg font-bold text-white">
                                    {lastData.temperature.toFixed(1)}°C
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {status === "disconnected" || status === "error" ? (
                    <Button
                        onClick={connect}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Connect Ring
                    </Button>
                ) : status === "connecting" ? (
                    <Button disabled className="w-full bg-zinc-800 text-zinc-400">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                    </Button>
                ) : (
                    <Button
                        onClick={disconnect}
                        variant="outline"
                        className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                        Disconnect
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
