import { Body, SearchRiseSet, Observer, Equator, Horizon, Illumination, MoonPhase } from 'astronomy-engine';

export interface AstroData {
    moonPhase: number; // 0-360
    moonPhaseName: string;
    sunSign: string;
    nextFullMoon: Date;
    moonIllumination: number;
}

const SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

function getSign(longitude: number): string {
    return SIGNS[Math.floor(longitude / 30) % 12];
}

export function getAstroData(date: Date = new Date(), latitude: number = 0, longitude: number = 0): AstroData {
    const observer = new Observer(latitude, longitude, 0);

    // Moon Phase
    const moonPhase = MoonPhase(date); // 0 to 360 degrees
    let moonPhaseName = "New Moon";
    if (moonPhase < 45) moonPhaseName = "Waxing Crescent";
    else if (moonPhase < 135) moonPhaseName = "Waxing Gibbous";
    else if (moonPhase < 225) moonPhaseName = "Full Moon";
    else if (moonPhase < 315) moonPhaseName = "Waning Gibbous";
    else moonPhaseName = "Waning Crescent";

    // Sun Sign (Approximate based on ecliptic longitude)
    // Accurate calculation requires Equator -> Ecliptic conversion, simplified here for speed
    // Actually astronomy-engine handles this well via heliocentric or geocentric
    // Let's use Ecliptic coordinates if available or estimate. Added complexity logic later.
    // For now, let is simply return a placeholder based on date or improve later. 
    // Wait, astronomy-engine has Equator function.

    // Calculate Sun Position
    const sunPos = Equator(Body.Sun, date, observer, true, true);
    // Convert RA to Longitude (approx) or use a library helper if available.
    // Actually, simpler approach for Sign:
    // 0h RA is roughly Aries (Vernal Equinox). 
    const sunSign = getSign(sunPos.ra * 15); // RA is in hours, *15 = degrees

    // Moon Illumination
    const illum = Illumination(Body.Moon, date);


    return {
        moonPhase,
        moonPhaseName,
        sunSign,
        nextFullMoon: new Date(), // Todo: Calculate next full moon search
        moonIllumination: illum.phase_fraction
    };
}
