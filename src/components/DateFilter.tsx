"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DateFilterProps {
    startDate: Date;
    setStartDate: (date: Date) => void;
    rangeStr: string;
    onRangeChange: (range: string) => void;
    className?: string;
}

export function DateFilter({ startDate, setStartDate, rangeStr, onRangeChange, className }: DateFilterProps) {

    // Format YYYY-MM-DD for input
    const dateValue = startDate ? startDate.toISOString().split('T')[0] : '';

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            // Parse local date strictly
            const [y, m, d] = e.target.value.split('-').map(Number);
            const newDate = new Date(y, m - 1, d);
            setStartDate(newDate);
        }
    };

    return (
        <div className={cn("flex flex-col md:flex-row gap-2 items-center", className)}>

            {/* Range Presets */}
            <div className="flex items-center bg-zinc-900/50 rounded-lg p-1 border border-zinc-700">
                {['1d', '7d', '30d', 'ALL'].map((r) => (
                    <Button
                        key={r}
                        variant="ghost"
                        size="sm"
                        onClick={() => onRangeChange(r)}
                        className={cn(
                            "h-7 px-3 text-xs hover:bg-zinc-800 hover:text-white transition-colors uppercase",
                            rangeStr === r ? "bg-zinc-700 text-white" : "text-zinc-400"
                        )}
                    >
                        {r}
                    </Button>
                ))}
            </div>

            {/* Single Start Date Picker */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-medium">Start:</span>
                <input
                    type="date"
                    value={dateValue}
                    onChange={handleDateChange}
                    className="h-8 px-2 text-xs bg-zinc-900/50 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
            </div>
        </div>
    );
}
