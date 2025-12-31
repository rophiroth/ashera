"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, where } from 'firebase/firestore';

export interface JournalEntry {
    id?: string;
    date: string; // YYYY-MM-DD
    type: 'temperature' | 'cycle' | 'symptom' | 'hrv' | 'sleep_stage';
    value: number | string; // 36.5 or "start_date" or "Deep" etc
    timestamp: number;
    // Optional additional fields we might strictly verify later
    sleep?: number;
    sleepStages?: { deep: number; rem: number; light: number; awake: number };
    hrv?: number;
    rhr?: number;
    // STM Fields
    mucus?: string;
    cervix?: string;
    phase?: string;
}

export function useJournal() {
    const { user } = useAuth();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setEntries([]);
            setLoading(false);
            return;
        }

        // DIAGNOSTIC LOG
        console.log(`[useJournal] Subscribing to: users/${user.uid}/ashera_journal`);

        const q = query(
            collection(db, "users", user.uid, "ashera_journal"),
            orderBy("date", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`[useJournal] Snapshot received. Size: ${snapshot.size}, Empty: ${snapshot.empty}`);

            if (snapshot.empty) {
                console.warn("[useJournal] Collection is empty. Check DB permissions or path.");
            }

            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as JournalEntry[];
            // console.log("[useJournal] Data sample:", data.slice(0, 1)); 
            setEntries(data);
            setLoading(false);
        }, (error) => {
            console.error("[useJournal] Error fetching journal:", error);
            console.error("[useJournal] Error Code:", error.code);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const addEntry = async (entry: Omit<JournalEntry, 'timestamp' | 'id'>) => {
        if (!user) return;

        try {
            // Refactor II: User wants Intraday support AND readable IDs.
            // Strategy: YYYY-MM-DD_HH-mm-ss
            // This preserves chronological sorting in the ID itself and allows multiple entries per day.

            // Normalize Date
            let datePart = entry.date;
            if (entry.date.includes('T')) {
                datePart = entry.date.split('T')[0];
            }

            // Get Time Part
            const now = new Date();
            const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-mm-ss

            const docId = `${datePart}_${timePart}`;

            // Import setDoc
            const { doc, setDoc } = await import('firebase/firestore');

            await setDoc(doc(db, "users", user.uid, "ashera_journal", docId), {
                ...entry,
                timestamp: Date.now()
            }, { merge: true });

        } catch (error) {
            console.error("Error adding entry:", error);
            throw error;
        }
    };

    return { entries, loading, addEntry };
}
