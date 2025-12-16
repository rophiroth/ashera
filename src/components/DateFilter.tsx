"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface DateRange {
    from: Date;
    to: Date;
}

interface DateFilterProps {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    className?: string;
}

export function DateFilter({ date, setDate, className }: DateFilterProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    const handlePresetChange = (value: string) => {
        const today = new Date();
        let newDate: DateRange | undefined;

        switch (value) {
            case "1d":
                newDate = { from: today, to: today };
                break;
            case "7d":
                const prev7 = new Date(today);
                prev7.setDate(today.getDate() - 6);
                newDate = { from: prev7, to: today };
                break;
            case "30d":
                const prev30 = new Date(today);
                prev30.setDate(today.getDate() - 29);
                newDate = { from: prev30, to: today };
                break;
            // Todo: Add Perigee-Apogee logic here when API is available
        }

        if (newDate) {
            setDate(newDate);
        }
    };

    return (
        <div className={cn("grid gap-2", className)}>
            <div className="flex items-center gap-2">
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-auto justify-start text-left font-normal border-zinc-700 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-800 h-8 px-2 text-xs",
                                !date && "text-muted-foreground",
                                className
                            )}
                        >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {date?.from ? (
                                date.to ? (
                                    <>
                                        {format(date.from, "MMM d")} - {format(date.to, "MMM d")}
                                    </>
                                ) : (
                                    format(date.from, "MMM d")
                                )
                            ) : (
                                <span>Pick date</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date as any}
                            onSelect={setDate as any}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>

                <Select onValueChange={handlePresetChange}>
                    <SelectTrigger className="w-[140px] border-zinc-700 bg-zinc-900/50 text-zinc-100">
                        <SelectValue placeholder="Quick Select" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1d">Today</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="cycle">Current Cycle</SelectItem>
                        {/* Placeholder for Astro Logic */}
                        <SelectItem value="moon" disabled>Perigee - Apogee</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
