"use client";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function LoginButton() {
    const { user, signInWithGoogle, signOut, loading } = useAuth();

    if (loading) return <div className="animate-spin"><Loader2 className="h-4 w-4" /></div>;

    if (user) {
        return (
            <div className="flex items-center gap-4">
                <span className="hidden md:block text-sm">Hello, {user.displayName}</span>
                {user.photoURL && <img src={user.photoURL} alt="Profile" className="h-8 w-8 rounded-full border border-zinc-700" />}
                <button
                    onClick={signOut}
                    className="rounded-full border border-red-500/50 bg-red-500/10 px-4 py-1 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                >
                    Sign Out
                </button>
                <div className="absolute bottom-4 text-xs text-white/30">
                    v0.0.3 (Sensors Enabled)
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={signInWithGoogle}
            className="group relative flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm font-semibold backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-purple-500/20"
        >
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent group-hover:from-purple-300 group-hover:to-pink-300">
                Sign in with Google
            </span>
        </button>
    );
}
