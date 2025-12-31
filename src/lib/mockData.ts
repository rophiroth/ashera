export const MOCK_TEMPERATURE_DATA = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));

    // Cycle simulation (approximate)
    const cycleDay = (i % 28) + 1;
    let phase = "Follicular";
    let baseTemp = 36.3;

    if (cycleDay > 13) {
        phase = "Luteal";
        baseTemp = 36.8;
    }

    // Random variations
    const temp = baseTemp + (Math.random() * 0.3);
    const sleep = 6 + (Math.random() * 3); // 6-9 hours
    const hrv = 40 + (Math.random() * 40); // 40-80 ms
    const rhr = 60 + (Math.random() * 10); // 60-70 bpm

    // Sleep Stages (approximate breakdown)
    const deep = sleep * (0.15 + Math.random() * 0.1); // 15-25%
    const rem = sleep * (0.20 + Math.random() * 0.1); // 20-30%
    const awake = sleep * (0.05 + Math.random() * 0.05); // 5-10%
    const light = sleep - deep - rem - awake;

    return {
        date: date.toISOString().split('T')[0],
        temp: Number(temp.toFixed(2)),
        sleep: Number(sleep.toFixed(1)),
        sleepStages: {
            deep: Number(deep.toFixed(1)),
            rem: Number(rem.toFixed(1)),
            light: Number(light.toFixed(1)),
            awake: Number(awake.toFixed(1))
        },
        hrv: Math.round(hrv),
        rhr: Math.round(rhr),
        phase
    };
});

export const generateIntradayData = (baseDate: Date) => {
    const data = [];
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);

    // Generate 24 hours of data (every 30 mins = 48 points)
    for (let i = 0; i < 48; i++) {
        const time = new Date(start);
        time.setMinutes(i * 30);

        // Simulate circadian rhythm (lower at night, higher in day)
        const hour = time.getHours();
        let circadianFactor = 0;
        if (hour >= 23 || hour < 5) circadianFactor = -0.4; // Night dip
        if (hour >= 5 && hour < 10) circadianFactor = -0.2; // Morning rise
        if (hour >= 10 && hour < 18) circadianFactor = 0.3; // Day peak

        // Base temp around 36.5 + circadian + noise
        const temp = 36.5 + circadianFactor + (Math.random() * 0.1);

        data.push({
            date: time.toISOString(), // ISO string for recharts
            temp: Number(temp.toFixed(2)),
            hrv: Math.round(50 + (Math.random() * 20)),
            rhr: Math.round(60 + (Math.random() * 10)),
            sleep: 0, // Sleep is usually a summary, but could be "asleep" state
            sleepStages: { deep: 0, rem: 0, light: 0, awake: 0 },
            phase: "Follicular"
        });
    }
    return data;
};
