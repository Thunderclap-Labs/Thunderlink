/**
 * Downlink Data Rate Calculation Utilities
 * Calculates projected data rates based on environmental factors:
 * - Solar activity (affects ionosphere)
 * - Weather conditions (cloud coverage, precipitation)
 * - Frequency band characteristics
 * - Satellite elevation angle
 */

export type FrequencyBand = 'Ka-band' | 'Ku-band' | 'C-band' | 'X-band' | 'S-band' | 'L-band';

export type WeatherCondition = 'clear' | 'partly-cloudy' | 'overcast' | 'light-rain' | 'heavy-rain' | 'storm';

export type SolarActivityLevel = 'low' | 'moderate' | 'high' | 'severe';

export interface DetailedWeatherData {
  condition: WeatherCondition;
  cloudCoverage: number; // 0-100%
  precipitationRate: number; // mm/hr
  temperature: number; // Celsius
  humidity: number; // 0-100%
  atmosphericPressure: number; // hPa
  windSpeed: number; // km/h
  visibility: number; // km
}

export interface SolarActivityData {
  level: SolarActivityLevel;
  solarFluxIndex: number; // SFU (Solar Flux Units)
  geomagneticIndex: number; // Kp index 0-9
  solarWindSpeed: number; // km/s
  xRayFlux: string; // Class (e.g., C1.2, M5.3, X1.0)
  protonFlux: number; // particles/cm²/s/sr
}

export interface DownlinkPrediction {
  baseDataRate: number; // Mbps - ideal conditions
  adjustedDataRate: number; // Mbps - with environmental factors
  certaintyFactor: number; // 0-1 scale
  degradationFactors: {
    solar: number; // 0-1 multiplier
    weather: number; // 0-1 multiplier
    atmospheric: number; // 0-1 multiplier
    elevation: number; // 0-1 multiplier
  };
  recommendations: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  weatherData: DetailedWeatherData;
  solarData: SolarActivityData;
}

/**
 * Frequency band characteristics
 * Higher frequencies are more affected by atmospheric conditions
 */
const FREQUENCY_BAND_SPECS: Record<FrequencyBand, {
  baseRate: number; // Mbps
  weatherSensitivity: number; // 0-1 (higher = more affected)
  ionosphereSensitivity: number; // 0-1 (higher = more affected)
  atmosphericAttenuation: number; // dB/km
}> = {
  'Ka-band': { // 26.5-40 GHz
    baseRate: 1000,
    weatherSensitivity: 0.9, // Very sensitive to rain
    ionosphereSensitivity: 0.1, // Less affected by ionosphere
    atmosphericAttenuation: 0.5,
  },
  'Ku-band': { // 12-18 GHz
    baseRate: 500,
    weatherSensitivity: 0.7, // Moderately affected by rain
    ionosphereSensitivity: 0.2,
    atmosphericAttenuation: 0.3,
  },
  'X-band': { // 8-12 GHz
    baseRate: 300,
    weatherSensitivity: 0.4, // Less affected by weather
    ionosphereSensitivity: 0.3,
    atmosphericAttenuation: 0.2,
  },
  'C-band': { // 4-8 GHz
    baseRate: 200,
    weatherSensitivity: 0.3, // Minimal weather impact
    ionosphereSensitivity: 0.5, // More affected by ionosphere
    atmosphericAttenuation: 0.15,
  },
  'S-band': { // 2-4 GHz
    baseRate: 100,
    weatherSensitivity: 0.15,
    ionosphereSensitivity: 0.7, // Highly affected by ionosphere
    atmosphericAttenuation: 0.1,
  },
  'L-band': { // 1-2 GHz
    baseRate: 50,
    weatherSensitivity: 0.1, // Minimal weather impact
    ionosphereSensitivity: 0.8, // Most affected by ionosphere
    atmosphericAttenuation: 0.05,
  },
};

/**
 * Weather impact on signal quality
 * Higher frequencies experience more attenuation from precipitation
 */
const WEATHER_IMPACT: Record<WeatherCondition, {
  attenuation: number; // 0-1 (signal loss)
  variability: number; // 0-1 (uncertainty)
}> = {
  'clear': { attenuation: 0.0, variability: 0.05 },
  'partly-cloudy': { attenuation: 0.05, variability: 0.1 },
  'overcast': { attenuation: 0.15, variability: 0.15 },
  'light-rain': { attenuation: 0.35, variability: 0.25 },
  'heavy-rain': { attenuation: 0.65, variability: 0.35 },
  'storm': { attenuation: 0.85, variability: 0.5 },
};

/**
 * Solar activity impact on ionosphere
 * Affects lower frequency bands more significantly
 */
const SOLAR_ACTIVITY_IMPACT: Record<SolarActivityLevel, {
  ionosphereDisturbance: number; // 0-1
  variability: number; // 0-1
}> = {
  'low': { ionosphereDisturbance: 0.0, variability: 0.05 },
  'moderate': { ionosphereDisturbance: 0.2, variability: 0.15 },
  'high': { ionosphereDisturbance: 0.5, variability: 0.3 },
  'severe': { ionosphereDisturbance: 0.8, variability: 0.5 },
};

/**
 * Calculate signal degradation based on elevation angle
 * Lower elevation = longer path through atmosphere
 */
function calculateElevationFactor(elevationDegrees: number): number {
  // Optimal at 90° (directly overhead), degrades as angle decreases
  if (elevationDegrees >= 70) return 1.0;
  if (elevationDegrees >= 45) return 0.95;
  if (elevationDegrees >= 30) return 0.85;
  if (elevationDegrees >= 20) return 0.7;
  if (elevationDegrees >= 10) return 0.5;
  return 0.3; // Below 10° is very poor
}

/**
 * Get current solar activity level (simulated - in production, fetch from NOAA/SWPC)
 */
export function getCurrentSolarActivity(): SolarActivityData {
  // Simulate based on time of day and random variation
  const hour = new Date().getHours();
  const random = Math.random();
  
  // Solar activity typically peaks during solar noon
  let level: SolarActivityLevel;
  let solarFluxIndex: number;
  let geomagneticIndex: number;
  let solarWindSpeed: number;
  let xRayFlux: string;
  
  if (hour >= 10 && hour <= 14 && random > 0.6) {
    level = 'high';
    solarFluxIndex = 150 + random * 100; // 150-250 SFU
    geomagneticIndex = 5 + random * 3; // Kp 5-8
    solarWindSpeed = 500 + random * 200; // 500-700 km/s
    xRayFlux = `M${(1 + random * 5).toFixed(1)}`;
  } else if (random > 0.8) {
    level = 'moderate';
    solarFluxIndex = 100 + random * 50; // 100-150 SFU
    geomagneticIndex = 3 + random * 2; // Kp 3-5
    solarWindSpeed = 400 + random * 100; // 400-500 km/s
    xRayFlux = `C${(5 + random * 5).toFixed(1)}`;
  } else {
    level = 'low';
    solarFluxIndex = 70 + random * 30; // 70-100 SFU
    geomagneticIndex = random * 3; // Kp 0-3
    solarWindSpeed = 300 + random * 100; // 300-400 km/s
    xRayFlux = `B${(1 + random * 9).toFixed(1)}`;
  }
  
  const protonFlux = level === 'high' ? 10 + random * 100 : random * 10;
  
  return {
    level,
    solarFluxIndex,
    geomagneticIndex,
    solarWindSpeed,
    xRayFlux,
    protonFlux,
  };
}

/**
 * Get current weather conditions (simulated - in production, fetch from weather API)
 */
export function getCurrentWeather(lat: number, lon: number): DetailedWeatherData {
  // Simulate weather based on location and randomness
  const random = Math.random();
  
  let condition: WeatherCondition;
  let cloudCoverage: number;
  let precipitationRate: number;
  let visibility: number;
  
  // Simulated weather distribution
  if (random > 0.9) {
    condition = 'storm';
    cloudCoverage = 95 + random * 5;
    precipitationRate = 20 + random * 30;
    visibility = 1 + random * 2;
  } else if (random > 0.75) {
    condition = 'heavy-rain';
    cloudCoverage = 90 + random * 10;
    precipitationRate = 10 + random * 10;
    visibility = 3 + random * 2;
  } else if (random > 0.6) {
    condition = 'light-rain';
    cloudCoverage = 70 + random * 20;
    precipitationRate = 2 + random * 5;
    visibility = 5 + random * 5;
  } else if (random > 0.4) {
    condition = 'overcast';
    cloudCoverage = 80 + random * 20;
    precipitationRate = 0;
    visibility = 10 + random * 10;
  } else if (random > 0.2) {
    condition = 'partly-cloudy';
    cloudCoverage = 30 + random * 40;
    precipitationRate = 0;
    visibility = 15 + random * 10;
  } else {
    condition = 'clear';
    cloudCoverage = random * 20;
    precipitationRate = 0;
    visibility = 20 + random * 30;
  }
  
  // Simulate other weather parameters
  const temperature = 15 + random * 15 - lat / 10; // Rough temperature based on latitude
  const humidity = cloudCoverage * 0.7 + random * 20; // Correlation with cloud coverage
  const atmosphericPressure = 1013 + (random - 0.5) * 30; // 998-1028 hPa
  const windSpeed = condition === 'storm' ? 40 + random * 40 : random * 30;
  
  return {
    condition,
    cloudCoverage,
    precipitationRate,
    temperature,
    humidity: Math.min(100, humidity),
    atmosphericPressure,
    windSpeed,
    visibility,
  };
}

/**
 * Calculate projected downlink data rate with environmental factors
 */
export function calculateDownlinkDataRate(
  frequencyBand: FrequencyBand,
  elevationAngle: number,
  solarActivity: SolarActivityData,
  weather: DetailedWeatherData,
  groundStationLat: number,
  groundStationLon: number
): DownlinkPrediction {
  const bandSpec = FREQUENCY_BAND_SPECS[frequencyBand];
  const weatherImpact = WEATHER_IMPACT[weather.condition];
  const solarImpact = SOLAR_ACTIVITY_IMPACT[solarActivity.level];
  
  // Calculate individual degradation factors
  const elevationFactor = calculateElevationFactor(elevationAngle);
  
  // Weather affects signal based on frequency band's weather sensitivity
  const weatherFactor = 1 - (weatherImpact.attenuation * bandSpec.weatherSensitivity);
  
  // Solar activity affects ionosphere, which impacts lower frequencies more
  const solarFactor = 1 - (solarImpact.ionosphereDisturbance * bandSpec.ionosphereSensitivity);
  
  // Atmospheric attenuation increases with path length (inverse of elevation)
  const atmosphericFactor = 1 - (bandSpec.atmosphericAttenuation * (1 - elevationFactor) * 0.3);
  
  // Combined degradation
  const totalDegradation = elevationFactor * weatherFactor * solarFactor * atmosphericFactor;
  
  // Calculate adjusted data rate
  const baseDataRate = bandSpec.baseRate;
  const adjustedDataRate = baseDataRate * totalDegradation;
  
  // Calculate certainty factor (inverse of variability)
  const weatherVariability = weatherImpact.variability * bandSpec.weatherSensitivity;
  const solarVariability = solarImpact.variability * bandSpec.ionosphereSensitivity;
  const elevationVariability = elevationAngle < 20 ? 0.3 : 0.1;
  
  const totalVariability = Math.min(
    weatherVariability + solarVariability + elevationVariability,
    0.9
  );
  const certaintyFactor = 1 - totalVariability;
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (elevationAngle < 20) {
    recommendations.push('⚠️ Low elevation angle - expect significant signal degradation');
  }
  
  if (weather.condition === 'heavy-rain' || weather.condition === 'storm') {
    if (bandSpec.weatherSensitivity > 0.6) {
      recommendations.push('🌧️ Heavy precipitation - consider rescheduling or using lower frequency band');
    } else {
      recommendations.push('🌧️ Weather conditions detected - C-band or lower recommended');
    }
  }
  
  if (solarActivity.level === 'high' || solarActivity.level === 'severe') {
    if (bandSpec.ionosphereSensitivity > 0.5) {
      recommendations.push('☀️ High solar activity - consider using higher frequency bands (Ka/Ku)');
    } else {
      recommendations.push('☀️ Solar activity elevated - ionospheric effects possible');
    }
  }
  
  if (totalDegradation > 0.8) {
    recommendations.push('✅ Excellent conditions for high-speed data transmission');
  } else if (totalDegradation < 0.4) {
    recommendations.push('❌ Poor conditions - recommend waiting for improvement');
  }
  
  if (certaintyFactor < 0.5) {
    recommendations.push('📊 High uncertainty - actual performance may vary significantly');
  }
  
  // Determine risk level
  let riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  if (totalDegradation > 0.75 && certaintyFactor > 0.7) {
    riskLevel = 'low';
  } else if (totalDegradation > 0.5 && certaintyFactor > 0.5) {
    riskLevel = 'moderate';
  } else if (totalDegradation > 0.3 || certaintyFactor > 0.3) {
    riskLevel = 'high';
  } else {
    riskLevel = 'critical';
  }
  
  return {
    baseDataRate,
    adjustedDataRate: Math.max(adjustedDataRate, baseDataRate * 0.05), // Minimum 5% of base rate
    certaintyFactor,
    degradationFactors: {
      solar: solarFactor,
      weather: weatherFactor,
      atmospheric: atmosphericFactor,
      elevation: elevationFactor,
    },
    recommendations,
    riskLevel,
    weatherData: weather,
    solarData: solarActivity,
  };
}

/**
 * Get optimal frequency band for current conditions
 */
export function getOptimalFrequencyBand(
  elevationAngle: number,
  solarActivity: SolarActivityData,
  weather: DetailedWeatherData,
  groundStationLat: number,
  groundStationLon: number
): { band: FrequencyBand; prediction: DownlinkPrediction } {
  const bands: FrequencyBand[] = ['Ka-band', 'Ku-band', 'X-band', 'C-band', 'S-band', 'L-band'];
  
  let bestBand: FrequencyBand = 'Ka-band';
  let bestScore = 0;
  let bestPrediction: DownlinkPrediction | null = null;
  
  for (const band of bands) {
    const prediction = calculateDownlinkDataRate(
      band,
      elevationAngle,
      solarActivity,
      weather,
      groundStationLat,
      groundStationLon
    );
    
    // Score based on adjusted data rate and certainty
    const score = prediction.adjustedDataRate * prediction.certaintyFactor;
    
    if (score > bestScore) {
      bestScore = score;
      bestBand = band;
      bestPrediction = prediction;
    }
  }
  
  return {
    band: bestBand,
    prediction: bestPrediction!,
  };
}

/**
 * Format data rate for display
 */
export function formatDataRate(mbps: number): string {
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(2)} Gbps`;
  }
  return `${mbps.toFixed(2)} Mbps`;
}

/**
 * Get risk level color for UI
 */
export function getRiskLevelColor(riskLevel: 'low' | 'moderate' | 'high' | 'critical'): string {
  switch (riskLevel) {
    case 'low': return 'success';
    case 'moderate': return 'warning';
    case 'high': return 'danger';
    case 'critical': return 'danger';
  }
}

/**
 * Get certainty level description
 */
export function getCertaintyDescription(certainty: number): string {
  if (certainty >= 0.9) return 'Very High';
  if (certainty >= 0.7) return 'High';
  if (certainty >= 0.5) return 'Moderate';
  if (certainty >= 0.3) return 'Low';
  return 'Very Low';
}

/**
 * Get weather condition emoji
 */
export function getWeatherEmoji(condition: WeatherCondition): string {
  switch (condition) {
    case 'clear': return '☀️';
    case 'partly-cloudy': return '⛅';
    case 'overcast': return '☁️';
    case 'light-rain': return '🌦️';
    case 'heavy-rain': return '🌧️';
    case 'storm': return '⛈️';
  }
}

/**
 * Get weather condition display name
 */
export function getWeatherDisplayName(condition: WeatherCondition): string {
  switch (condition) {
    case 'clear': return 'Clear Sky';
    case 'partly-cloudy': return 'Partly Cloudy';
    case 'overcast': return 'Overcast';
    case 'light-rain': return 'Light Rain';
    case 'heavy-rain': return 'Heavy Rain';
    case 'storm': return 'Storm';
  }
}

/**
 * Get solar activity emoji
 */
export function getSolarActivityEmoji(level: SolarActivityLevel): string {
  switch (level) {
    case 'low': return '🌑';
    case 'moderate': return '🌓';
    case 'high': return '🌕';
    case 'severe': return '☀️';
  }
}

/**
 * Get solar activity display name
 */
export function getSolarActivityDisplayName(level: SolarActivityLevel): string {
  switch (level) {
    case 'low': return 'Low Activity';
    case 'moderate': return 'Moderate Activity';
    case 'high': return 'High Activity';
    case 'severe': return 'Severe Activity';
  }
}

/**
 * Get solar activity color
 */
export function getSolarActivityColor(level: SolarActivityLevel): string {
  switch (level) {
    case 'low': return 'success';
    case 'moderate': return 'warning';
    case 'high': return 'danger';
    case 'severe': return 'danger';
  }
}
