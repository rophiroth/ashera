"use client";

import { useAuth } from "@/context/AuthContext";
import LoginButton from "@/components/LoginButton";
import Dashboard from "@/components/Dashboard";

export default function AppShell() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
        );
    }

    if (!user) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-4 relative overflow-hidden bg-black text-white">
                {/* Landing Page Content */}
                <div className="z-10 flex flex-col items-center gap-8 text-center">
                    <div className="relative h-32 w-32 rounded-full bg-gradient-to-tr from-purple-500 to-amber-300 blur-sm animate-pulse">
                        <div className="absolute inset-0 flex items-center justify-center bg-black rounded-full m-[2px]">
                            <span className="text-4xl">🌑</span>
                        </div>
                    </div>

                    <h1 className="text-6xl font-bold tracking-tighter bg-gradient-to-r from-purple-200 via-pink-200 to-amber-100 bg-clip-text text-transparent">
                        ASHERA
                    </h1>
                    <p className="max-w-[600px] text-zinc-400 md:text-xl">
                        Sync your cycle with the cosmos.
                        <br />
                        Smart ring insights meets astrological wisdom.
                    </p>

                    <LoginButton />
                </div>

                {/* Background Effects */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-purple-900/20 blur-3xl" />
                    <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-blue-900/10 blur-3xl" />
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black text-zinc-100 flex justify-center">
            <Dashboard />
        </main>
    );
}
