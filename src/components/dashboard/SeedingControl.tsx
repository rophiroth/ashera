"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
// import { useJournal } from "@/hooks/useJournal"; // No longer needed for batch
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase"; // Direct DB Access
import { writeBatch, doc, collection, getDocFromServer, setLogLevel, setDoc, getDocs, query } from "firebase/firestore";

export default function SeedingControl() {
    const { user } = useAuth();
    const [isSeeding, setIsSeeding] = useState(false);

    // Only visible for specific demo user -> REMOVED for Dev
    // if (user?.email !== 'universidadholistica72@gmail.com') return null;

    const triggerDemoSeed = async () => {
        if (!user) return;
        if (!confirm("⚠️ WARNING: This will WIPE all existing journal data and replace it with fresh Demo Data.\n\nAre you sure?")) return;

        setIsSeeding(true);
        console.log("Seeding Demo Data for:", user.email);

        try {
            // 0. Force Token Refresh (Solves "Stale Auth" / "Permission Denied" false positives)
            console.log("Refeshing Auth Token...");
            await user.getIdToken(true);

            // 0.2 Generic Internet Check (CDN Ping)
            console.log("Checking Internet Access...");
            try {
                await fetch("https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js", { method: 'HEAD', mode: 'no-cors' });
                console.log("Internet: OK (CDN Reachable)");
            } catch (netErr) {
                console.error("Internet Check Failed:", netErr);
                throw new Error("No Internet Connection. Verify wifi/cellular.");
            }

            // 0.5 Connectivity Probe
            // Relaxed Timeout: 25s to allow for Cold Start on slow networks
            console.log("Probing Database Connection (Server Check)...");
            // DIAGNOSTIC: Check if Firebase Config is actually loaded
            const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
            console.log(`Diagnostic: Connecting to Project -> ${projectId ? projectId : 'UNDEFINED/MISSING'}`);

            // 0.6 RAW REST API CHECK (The "Science" Verified Test)
            // Bypasses SDK logic. If this fails, the Network is blocking the DOMAIN itself.
            try {
                const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/probe/test`;
                console.log("Diagnostic: Testing Raw REST API Access...", restUrl);
                const restRes = await fetch(restUrl, { method: 'GET' });
                console.log("Diagnostic: REST API Status:", restRes.status);
            } catch (restErr) {
                console.error("Diagnostic: REST API FAILED (Network Block Confirmed):", restErr);
                throw new Error("Generic Internet is OK, but Google Firestore is BLOCKED by your network. (REST Check Failed)");
            }

            // ENABLE SDK DEBUGGING
            console.log("Enabling Firestore SDK Debug Logs...");
            setLogLevel('debug'); // This will spam the console with internal transport info

            // Try a tiny write to a path we KNOW acts as a "ping"
            const pingRef = doc(db, "users", user.uid, "system", "ping");
            await setDoc(pingRef, { timestamp: Date.now(), device: 'web-test' });

            // 0.5 Connectivity Probe (Standard)
            console.log("Probing Database Connection...");

            // We use a dedicated probe document to test read access
            const probeTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Probe Timeout")), 15000));

            await Promise.race([
                getDocFromServer(doc(db, "probe", "connection_test")),
                probeTimeout
            ]).catch(e => {
                if (e.message === "Probe Timeout") {
                    console.warn("Probe timed out, but we will attempt batch write anyway (optimistic).");
                } else {
                    console.log("Probe result:", e.message);
                }
            });


            console.log("Connection Verified. Wiping OLD Data...");

            // WIPE OLD DATA (Fixes 2024 vs 2025 Ghost Data Issue)
            const journalRef = collection(db, "users", user.uid, "ashera_journal");
            const existingDocs = await getDocs(query(journalRef));

            if (!existingDocs.empty) {
                console.log(`Found ${existingDocs.size} old documents. Deleting...`);
                const deleteBatch = writeBatch(db);
                existingDocs.forEach(doc => {
                    deleteBatch.delete(doc.ref);
                });
                await deleteBatch.commit();
                console.log("Old Data Wiped. Starting fresh seed...");
            }

            console.log("Connection Verified. Preparing Batch...");
            let batch = writeBatch(db);

            // Helper to add to batch
            const addToBatch = (data: any) => {
                // Extract YYYY-MM-DD from ISO string and append _00-00-00 for explicit ID
                // Fix: Ensure data.date exists and is string
                if (!data.date) return;

                const dateObj = new Date(data.date);
                const datePart = data.date.split('T')[0];

                // Extract Time (HH-mm-ss) manually
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                const seconds = String(dateObj.getSeconds()).padStart(2, '0');
                const timePart = `${hours}-${minutes}-${seconds}`;

                const docId = `${datePart}_${timePart}`;
                const newDocRef = doc(journalRef, docId); // Use explicit ID
                batch.set(newDocRef, {
                    ...data,
                    timestamp: data.timestamp || Date.now()
                });
            };


            // 1. Past Cycle (Previous Month)
            const today = new Date();
            const pastStart = new Date(today);
            pastStart.setDate(today.getDate() - 45); // Start 45 days ago

            // Cycle 1: 28 days
            for (let i = 0; i < 28; i++) {
                const d = new Date(pastStart);
                d.setDate(pastStart.getDate() + i);
                d.setHours(7, 30 + Math.floor(Math.random() * 30), 0); // 7:30 - 8:00 AM

                // ISO String for 'date' (Charts support this for intraday precision)
                const dateStr = d.toISOString();

                let temp = 36.3 + Math.random() * 0.2;
                if (i > 14) temp += 0.4; // Luteal shift

                addToBatch({
                    type: 'temperature',
                    value: Number(temp.toFixed(2)),
                    date: dateStr,
                    // REMOVED SUMMARY FIELDS to comply with Raw Model
                    hrv: 50 + Math.random() * 20,
                    rhr: 60 + Math.random() * 5,
                    timestamp: d.getTime()
                });

                // HISTORICAL SLEEP (Simplified Raw Model to save Batch Writes)
                // 1. Sleep Start (Deep)
                let sleepStart = new Date(d);
                sleepStart.setDate(sleepStart.getDate() - 1);
                sleepStart.setHours(23, 0, 0, 0);
                addToBatch({
                    type: 'sleep_stage',
                    value: 'Deep',
                    date: sleepStart.toISOString(),
                    timestamp: sleepStart.getTime()
                });

                // 2. Sleep End (Awake)
                let sleepEnd = new Date(d);
                sleepEnd.setHours(7, 0, 0, 0);
                addToBatch({
                    type: 'sleep_stage',
                    value: 'Awake',
                    date: sleepEnd.toISOString(),
                    timestamp: sleepEnd.getTime()
                });
            }

            // 2. Current Cycle Start (17 days ago approx)
            const currentStart = new Date(pastStart);
            currentStart.setDate(pastStart.getDate() + 28);
            currentStart.setHours(8, 0, 0);

            addToBatch({
                type: 'cycle',
                value: 'Start',
                date: currentStart.toISOString(),
                timestamp: currentStart.getTime()
            });

            // 3. Current Cycle Data (Last 17 days until today)
            for (let i = 0; i < 18; i++) {
                const d = new Date(currentStart);
                d.setDate(currentStart.getDate() + i);
                d.setHours(7, 30 + Math.floor(Math.random() * 30), 0);

                // Stop if future (just in case)
                if (d > today) break;

                const dateStr = d.toISOString();

                // Calculate stages
                const sleepTotal = 7 + Math.random();
                const deep = sleepTotal * 0.2;
                const rem = sleepTotal * 0.25;
                const awake = sleepTotal * 0.1;
                const light = sleepTotal - deep - rem - awake;

                // 1. MORNING LOG (7:00 - 9:00 AM)
                const morningDate = new Date(d);
                const morningIso = morningDate.toISOString();

                addToBatch({
                    type: 'temperature',
                    value: Number((36.3 + Math.random() * 0.2).toFixed(2)),
                    date: morningIso,
                    // REMOVED: sleep & sleepStages (We now use raw 'sleep_stage' events)
                    hrv: 55 + Math.random() * 20,
                    rhr: 62 + Math.random() * 5,
                    timestamp: morningDate.getTime()
                });

                // 2. INTRADAY DATA (For Last 3 Days Only)
                // This proves the "Multiple Entries Per Day" capability
                const daysDiff = (today.getTime() - d.getTime()) / (1000 * 3600 * 24);

                if (daysDiff <= 3 && daysDiff >= 0) {
                    // HYPNOGRAM DATA GENERATION (Simulated Sleep Cycles)
                    // Start at 23:00 previous day relative to 'd' (which is morning)
                    let sleepTime = new Date(d);
                    sleepTime.setDate(sleepTime.getDate() - 1);
                    sleepTime.setHours(23, 0, 0, 0);

                    // Simple Sleep Cycle Model (90 mins * 5 cycles)
                    const cycles = 5;

                    for (let c = 0; c < cycles; c++) {
                        // Approximate structure per cycle: Light -> Deep -> REM -> Light

                        // Light (N1/N2) - Start of cycle
                        addToBatch({
                            type: 'sleep_stage',
                            value: 'Light',
                            date: sleepTime.toISOString(),
                            timestamp: sleepTime.getTime()
                        });
                        sleepTime = new Date(sleepTime.getTime() + 30 * 60000); // +30m

                        // Deep (N3)
                        addToBatch({
                            type: 'sleep_stage',
                            value: 'Deep',
                            date: sleepTime.toISOString(),
                            timestamp: sleepTime.getTime()
                        });
                        sleepTime = new Date(sleepTime.getTime() + 40 * 60000); // +40m

                        // REM (Dreaming)
                        addToBatch({
                            type: 'sleep_stage',
                            value: 'REM',
                            date: sleepTime.toISOString(),
                            timestamp: sleepTime.getTime()
                        });
                        sleepTime = new Date(sleepTime.getTime() + 20 * 60000); // +20m
                    }

                    // Morning Wake Up
                    addToBatch({
                        type: 'sleep_stage',
                        value: 'Awake',
                        date: sleepTime.toISOString(),
                        timestamp: sleepTime.getTime()
                    });

                    // Afternoon (14:00)
                    const afternoon = new Date(d);
                    afternoon.setHours(14, 0, 0);
                    addToBatch({
                        type: 'symptom',
                        value: 'Energy Drop',
                        date: afternoon.toISOString(),
                        timestamp: afternoon.getTime()
                    });

                    // Evening (20:00)
                    const evening = new Date(d);
                    evening.setHours(20, 0, 0);
                    addToBatch({
                        type: 'hrv',
                        value: 45 + Math.random() * 10, // Lower HRV in evening
                        date: evening.toISOString(),
                        timestamp: evening.getTime()
                    });
                }
            }

            // Execute Batch (Atomic Commit) with Timeout
            // alert("⏳ Sending data to Firebase..."); // Optional diagnostic alert

            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Network Timeout: Database is unreachable.")), 60000)
            );

            await Promise.race([batch.commit(), timeout]);

            alert("✅ Demo Data Injected Successfully! Check daily view.");
            // window.location.reload(); // Removed to allow log inspection

        } catch (error: any) {
            console.error("Seeding failed FULL DETAIL:", error);
            console.error("Error Code:", error.code);
            console.error("Error Message:", error.message);

            let tip = "Unknown Error";
            if (error.code === 'permission-denied') tip = "Check Firestore Rules.";
            if (error.code === 'unavailable') tip = "Network Blocked / Offline.";
            if (error.message.includes("Timeout")) tip = "Firewall blocking Firebase.";

            alert(`❌ Error Seeding Data:\nCode: ${error.code}\nMessage: ${error.message}\n\nTip: ${tip}`);
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <button
            onClick={triggerDemoSeed}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 text-xs px-3 py-1.5 rounded-full border border-red-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isSeeding ? <Loader2 className="w-3 h-3 animate-spin" /> : "⚡"}
            {isSeeding ? "Wiping..." : "Wipe & Seed"}
        </button>
    );

}
