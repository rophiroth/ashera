import { db } from "../firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { HealthPacket } from "@/lib/bluetooth/RingParser";

export const saveRingData = async (data: Partial<HealthPacket>) => {
    if (!db) {
        console.warn("🔥 Firebase not initialized, skipping save.");
        return;
    }

    try {
        const payload = {
            ...data,
            createdAt: serverTimestamp(),
            syncedAt: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        // Filter out undefined
        (Object.keys(payload) as Array<keyof typeof payload>).forEach(key => payload[key] === undefined && delete payload[key]);

        await addDoc(collection(db, "ring_data"), payload);
        console.log("💾 Ring Data Saved to Firestore:", payload);
    } catch (e) {
        console.error("🔥 Error saving ring data:", e);
    }
};

export const subscribeToRingData = (callback: (data: any[]) => void) => {
    if (!db) return () => { };

    const q = query(collection(db, "ring_data"), orderBy("createdAt", "desc"), limit(5));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    });
};
