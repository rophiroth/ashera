"use client";

import { useEffect, useState } from 'react';
import { getAstroData, AstroData } from '@/lib/astrology';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Moon } from "lucide-react";

export default function CosmicCard() {
    const [astro, setAstro] = useState<AstroData | null>(null);

    useEffect(() => {
        // Default to Jerusalem or user location later. using 0,0 for now.
        const data = getAstroData();
        setAstro(data);
    }, []);

    if (!astro) return null;

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm bg-gradient-to-br from-purple-900/20 to-transparent">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-zinc-200 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-300" />
                        Cosmic Insight
                    </CardTitle>
                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <Moon className="h-3 w-3" />
                        {Math.round(astro.moonIllumination * 100)}%
                    </div>
                </div>
                <CardDescription>
                    Sun in {astro.sunSign} • {astro.moonPhaseName}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <p className="text-sm text-zinc-300">
                        The stars align with your cycle. With the Sun in {astro.sunSign}, focus on grounding your energy while the {astro.moonPhaseName} invites new beginnings.
                    </p>
                    <div className="rounded-lg bg-white/5 p-4 mix-blend-overlay">
                        <div className="text-xs font-mono text-pink-300">ENERGY: RISING</div>
                        <div className="text-xs font-mono text-purple-300">RECOMMENDATION: MEDITATION</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
