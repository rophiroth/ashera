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

    return {
        date: date.toISOString().split('T')[0],
        temp: Number(temp.toFixed(2)),
        sleep: Number(sleep.toFixed(1)),
        hrv: Math.round(hrv),
        rhr: Math.round(rhr),
        phase
    };
});
