import * as satellite from 'satellite.js';

export interface SatelliteData {
  name: string;
  tleLine1: string;
  tleLine2: string;
  satrec: satellite.SatRec | null;
  position?: { x: number; y: number; z: number };
  category?: string;
}

export interface SatelliteInfo {
  name: string;
  position: { lat: number; lon: number; alt: number };
  velocity: number;
  category: string;
  noradId?: string;
  launchDate?: string;
  period?: number;
}

/**
 * Fetch TLE data from CelesTrak for communication and imaging satellites
 * Optimized to fetch fewer satellites for better performance
 */
export async function fetchSatelliteTLEData(): Promise<SatelliteData[]> {
  const satellites: SatelliteData[] = [];
  
  // Fetch comprehensive satellite networks for maximum coverage
  const categories = [
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium&FORMAT=tle', name: 'Iridium', maxSatellites: 100 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=globalstar&FORMAT=tle', name: 'Globalstar', maxSatellites: 50 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=intelsat&FORMAT=tle', name: 'Intelsat', maxSatellites: 60 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=ses&FORMAT=tle', name: 'SES', maxSatellites: 50 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=geostationary&FORMAT=tle', name: 'Geostationary', maxSatellites: 100 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=orbcomm&FORMAT=tle', name: 'Orbcomm', maxSatellites: 40 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle', name: 'Starlink', maxSatellites: 100 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=tle', name: 'OneWeb', maxSatellites: 80 },
  ];

  try {
    for (const category of categories) {
      try {
        const response = await fetch(category.url);
        if (!response.ok) continue;
        
        const data = await response.text();
        const lines = data.split('\n').filter(line => line.trim() !== '');
        
        let categoryCount = 0;
        // Parse TLE data (3 lines per satellite: name, line1, line2)
        for (let i = 0; i < lines.length - 2; i += 3) {
          // Limit satellites per category for performance
          if (categoryCount >= category.maxSatellites) break;
          
          const name = lines[i].trim();
          const tleLine1 = lines[i + 1].trim();
          const tleLine2 = lines[i + 2].trim();
          
          if (tleLine1.startsWith('1 ') && tleLine2.startsWith('2 ')) {
            const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
            
            satellites.push({
              name,
              tleLine1,
              tleLine2,
              satrec,
              category: category.name,
            });
            categoryCount++;
          }
        }
      } catch (error) {
        console.error(`Error fetching ${category.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error fetching satellite data:', error);
  }

  return satellites;
}

/**
 * Calculate satellite position at a given time
 */
export function calculateSatellitePosition(
  satrec: satellite.SatRec,
  date: Date = new Date()
): { x: number; y: number; z: number } | null {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);
    
    if (positionAndVelocity && positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
      const positionEci = positionAndVelocity.position;
      
      // Scale factor to convert km to Three.js units (Earth radius in scene units)
      const EARTH_RADIUS = 2; // Earth radius in scene units
      const SCALE_FACTOR = EARTH_RADIUS / 6371; // 6371 km is Earth's actual radius
      
      return {
        x: positionEci.x * SCALE_FACTOR,
        y: positionEci.y * SCALE_FACTOR,
        z: positionEci.z * SCALE_FACTOR,
      };
    }
  } catch (error) {
    console.error('Error calculating satellite position:', error);
  }
  
  return null;
}

/**
 * Get detailed satellite information
 */
export function getSatelliteInfo(satData: SatelliteData, date: Date = new Date()): SatelliteInfo | null {
  if (!satData.satrec) return null;

  try {
    const positionAndVelocity = satellite.propagate(satData.satrec, date);
    
    if (positionAndVelocity && positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
      const positionEci = positionAndVelocity.position;
      const velocityEci = positionAndVelocity.velocity;
      
      // Convert to geodetic coordinates
      const gmst = satellite.gstime(date);
      const positionGd = satellite.eciToGeodetic(positionEci, gmst);
      
      // Calculate velocity magnitude
      let velocityMagnitude = 0;
      if (velocityEci && typeof velocityEci !== 'boolean') {
        velocityMagnitude = Math.sqrt(
          velocityEci.x * velocityEci.x +
          velocityEci.y * velocityEci.y +
          velocityEci.z * velocityEci.z
        );
      }
      
      // Extract NORAD ID from TLE
      const noradId = satData.tleLine1.substring(2, 7).trim();
      
      // Calculate orbital period (approximate)
      const meanMotion = parseFloat(satData.tleLine2.substring(52, 63));
      const period = meanMotion > 0 ? 1440 / meanMotion : 0; // minutes
      
      return {
        name: satData.name,
        position: {
          lat: positionGd.latitude * (180 / Math.PI),
          lon: positionGd.longitude * (180 / Math.PI),
          alt: positionGd.height,
        },
        velocity: velocityMagnitude,
        category: satData.category || 'Unknown',
        noradId,
        period,
      };
    }
  } catch (error) {
    console.error('Error getting satellite info:', error);
  }
  
  return null;
}

/**
 * Ground stations around the world
 */
export const GROUND_STATIONS = [
  // North America
  { id: 'gs-1', name: 'San Francisco Hub', location: { lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'USA' }, status: 'online' as const, capacity: 50, antennaType: 'Parabolic 15m', frequency: 'Ka-band', rating: 4.8 },
  { id: 'gs-2', name: 'New York Station', location: { lat: 40.7128, lon: -74.0060, city: 'New York', country: 'USA' }, status: 'online' as const, capacity: 45, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.7 },
  { id: 'gs-3', name: 'Miami Gateway', location: { lat: 25.7617, lon: -80.1918, city: 'Miami', country: 'USA' }, status: 'online' as const, capacity: 40, antennaType: 'Parabolic 10m', frequency: 'Ka-band', rating: 4.5 },
  { id: 'gs-4', name: 'Seattle Uplink', location: { lat: 47.6062, lon: -122.3321, city: 'Seattle', country: 'USA' }, status: 'online' as const, capacity: 38, antennaType: 'Parabolic 12m', frequency: 'Ka-band', rating: 4.6 },
  { id: 'gs-5', name: 'Toronto Gateway', location: { lat: 43.6532, lon: -79.3832, city: 'Toronto', country: 'Canada' }, status: 'online' as const, capacity: 42, antennaType: 'Parabolic 15m', frequency: 'Ku-band', rating: 4.4 },
  { id: 'gs-6', name: 'Mexico City Hub', location: { lat: 19.4326, lon: -99.1332, city: 'Mexico City', country: 'Mexico' }, status: 'online' as const, capacity: 35, antennaType: 'Parabolic 10m', frequency: 'Ka-band', rating: 4.2 },
  
  // South America
  { id: 'gs-7', name: 'São Paulo Hub', location: { lat: -23.5505, lon: -46.6333, city: 'São Paulo', country: 'Brazil' }, status: 'online' as const, capacity: 35, antennaType: 'Parabolic 10m', frequency: 'Ka-band', rating: 4.3 },
  { id: 'gs-8', name: 'Buenos Aires Station', location: { lat: -34.6037, lon: -58.3816, city: 'Buenos Aires', country: 'Argentina' }, status: 'online' as const, capacity: 32, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.1 },
  { id: 'gs-9', name: 'Lima Gateway', location: { lat: -12.0464, lon: -77.0428, city: 'Lima', country: 'Peru' }, status: 'online' as const, capacity: 30, antennaType: 'Parabolic 10m', frequency: 'Ka-band', rating: 4.0 },
  { id: 'gs-10', name: 'Santiago Station', location: { lat: -33.4489, lon: -70.6693, city: 'Santiago', country: 'Chile' }, status: 'online' as const, capacity: 33, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.2 },
  
  // Europe
  { id: 'gs-11', name: 'London Hub', location: { lat: 51.5074, lon: -0.1278, city: 'London', country: 'UK' }, status: 'online' as const, capacity: 45, antennaType: 'Parabolic 12m', frequency: 'Ka-band', rating: 4.9 },
  { id: 'gs-12', name: 'Paris Gateway', location: { lat: 48.8566, lon: 2.3522, city: 'Paris', country: 'France' }, status: 'online' as const, capacity: 43, antennaType: 'Parabolic 15m', frequency: 'Ka-band', rating: 4.8 },
  { id: 'gs-13', name: 'Berlin Station', location: { lat: 52.5200, lon: 13.4050, city: 'Berlin', country: 'Germany' }, status: 'online' as const, capacity: 44, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.7 },
  { id: 'gs-14', name: 'Madrid Hub', location: { lat: 40.4168, lon: -3.7038, city: 'Madrid', country: 'Spain' }, status: 'online' as const, capacity: 40, antennaType: 'Parabolic 12m', frequency: 'Ka-band', rating: 4.6 },
  { id: 'gs-15', name: 'Rome Gateway', location: { lat: 41.9028, lon: 12.4964, city: 'Rome', country: 'Italy' }, status: 'online' as const, capacity: 38, antennaType: 'Parabolic 10m', frequency: 'Ku-band', rating: 4.5 },
  { id: 'gs-16', name: 'Stockholm Station', location: { lat: 59.3293, lon: 18.0686, city: 'Stockholm', country: 'Sweden' }, status: 'online' as const, capacity: 36, antennaType: 'Parabolic 12m', frequency: 'Ka-band', rating: 4.4 },
  { id: 'gs-17', name: 'Moscow Hub', location: { lat: 55.7558, lon: 37.6173, city: 'Moscow', country: 'Russia' }, status: 'online' as const, capacity: 42, antennaType: 'Parabolic 15m', frequency: 'Ku-band', rating: 4.3 },
  
  // Asia
  { id: 'gs-18', name: 'Tokyo Hub', location: { lat: 35.6762, lon: 139.6503, city: 'Tokyo', country: 'Japan' }, status: 'online' as const, capacity: 50, antennaType: 'Parabolic 15m', frequency: 'Ku-band', rating: 5.0 },
  { id: 'gs-19', name: 'Singapore Gateway', location: { lat: 1.3521, lon: 103.8198, city: 'Singapore', country: 'Singapore' }, status: 'online' as const, capacity: 48, antennaType: 'Parabolic 15m', frequency: 'Ka-band', rating: 4.9 },
  { id: 'gs-20', name: 'Seoul Station', location: { lat: 37.5665, lon: 126.9780, city: 'Seoul', country: 'South Korea' }, status: 'online' as const, capacity: 46, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.8 },
  { id: 'gs-21', name: 'Hong Kong Hub', location: { lat: 22.3193, lon: 114.1694, city: 'Hong Kong', country: 'China' }, status: 'online' as const, capacity: 44, antennaType: 'Parabolic 15m', frequency: 'Ka-band', rating: 4.7 },
  { id: 'gs-22', name: 'Mumbai Gateway', location: { lat: 19.0760, lon: 72.8777, city: 'Mumbai', country: 'India' }, status: 'online' as const, capacity: 42, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.4 },
  { id: 'gs-23', name: 'Bangkok Station', location: { lat: 13.7563, lon: 100.5018, city: 'Bangkok', country: 'Thailand' }, status: 'online' as const, capacity: 38, antennaType: 'Parabolic 10m', frequency: 'Ka-band', rating: 4.3 },
  { id: 'gs-24', name: 'Sydney Hub', location: { lat: -33.8688, lon: 151.2093, city: 'Sydney', country: 'Australia' }, status: 'online' as const, capacity: 45, antennaType: 'Parabolic 15m', frequency: 'Ku-band', rating: 4.8 },
  { id: 'gs-25', name: 'Beijing Gateway', location: { lat: 39.9042, lon: 116.4074, city: 'Beijing', country: 'China' }, status: 'online' as const, capacity: 47, antennaType: 'Parabolic 15m', frequency: 'Ka-band', rating: 4.6 },
  
  // Middle East
  { id: 'gs-26', name: 'Dubai Hub', location: { lat: 25.2048, lon: 55.2708, city: 'Dubai', country: 'UAE' }, status: 'online' as const, capacity: 48, antennaType: 'Parabolic 15m', frequency: 'Ka-band', rating: 4.9 },
  { id: 'gs-27', name: 'Tel Aviv Station', location: { lat: 32.0853, lon: 34.7818, city: 'Tel Aviv', country: 'Israel' }, status: 'online' as const, capacity: 40, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.5 },
  { id: 'gs-28', name: 'Riyadh Gateway', location: { lat: 24.7136, lon: 46.6753, city: 'Riyadh', country: 'Saudi Arabia' }, status: 'online' as const, capacity: 42, antennaType: 'Parabolic 12m', frequency: 'Ka-band', rating: 4.4 },
  { id: 'gs-29', name: 'Istanbul Hub', location: { lat: 41.0082, lon: 28.9784, city: 'Istanbul', country: 'Turkey' }, status: 'online' as const, capacity: 41, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.6 },
  
  // Africa
  { id: 'gs-30', name: 'Cape Town Hub', location: { lat: -33.9249, lon: 18.4241, city: 'Cape Town', country: 'South Africa' }, status: 'online' as const, capacity: 35, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.3 },
  { id: 'gs-31', name: 'Cairo Station', location: { lat: 30.0444, lon: 31.2357, city: 'Cairo', country: 'Egypt' }, status: 'online' as const, capacity: 37, antennaType: 'Parabolic 10m', frequency: 'Ka-band', rating: 4.2 },
  { id: 'gs-32', name: 'Lagos Gateway', location: { lat: 6.5244, lon: 3.3792, city: 'Lagos', country: 'Nigeria' }, status: 'online' as const, capacity: 32, antennaType: 'Parabolic 10m', frequency: 'Ku-band', rating: 4.0 },
  { id: 'gs-33', name: 'Nairobi Hub', location: { lat: -1.2864, lon: 36.8172, city: 'Nairobi', country: 'Kenya' }, status: 'online' as const, capacity: 33, antennaType: 'Parabolic 12m', frequency: 'Ka-band', rating: 4.1 },
  
  // Oceania
  { id: 'gs-34', name: 'Auckland Station', location: { lat: -36.8485, lon: 174.7633, city: 'Auckland', country: 'New Zealand' }, status: 'online' as const, capacity: 36, antennaType: 'Parabolic 12m', frequency: 'Ku-band', rating: 4.5 },
  { id: 'gs-35', name: 'Perth Gateway', location: { lat: -31.9505, lon: 115.8605, city: 'Perth', country: 'Australia' }, status: 'online' as const, capacity: 34, antennaType: 'Parabolic 10m', frequency: 'Ka-band', rating: 4.4 },
];

/**
 * Convert latitude and longitude to Three.js Vector3
 */
export function latLonToVector3(lat: number, lon: number, radius: number): { x: number; y: number; z: number } {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return { x, y, z };
}

/**
 * Check if satellite is in range of ground station
 */
export function isSatelliteInRange(
  satPos: { x: number; y: number; z: number },
  gsPos: { x: number; y: number; z: number },
  maxDistance: number
): boolean {
  const dx = satPos.x - gsPos.x;
  const dy = satPos.y - gsPos.y;
  const dz = satPos.z - gsPos.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return distance <= maxDistance;
}

/**
 * Calculate which ground stations a satellite will pass over during a time period
 * Returns a list of ground station IDs and pass predictions
 */
export interface PassPrediction {
  groundStationId: string;
  groundStationName: string;
  passes: Array<{
    startTime: Date;
    endTime: Date;
    duration: number; // in seconds
    maxElevation: number; // in degrees
  }>;
}

export function predictSatellitePasses(
  satrec: satellite.SatRec,
  groundStations: typeof GROUND_STATIONS,
  startDate: Date = new Date(),
  durationHours: number = 24
): PassPrediction[] {
  const predictions: PassPrediction[] = [];
  const EARTH_RADIUS = 2;
  const MAX_DISTANCE = 10; // Maximum visibility distance in scene units
  const TIME_STEP_MINUTES = 1; // Check every minute
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

  groundStations.forEach((gs) => {
    const gsPosition = latLonToVector3(gs.location.lat, gs.location.lon, EARTH_RADIUS + 0.02);
    const passes: PassPrediction['passes'] = [];
    let currentPass: { startTime: Date; maxElevation: number } | null = null;

    // Step through time to find passes
    for (let time = new Date(startDate); time <= endDate; time = new Date(time.getTime() + TIME_STEP_MINUTES * 60 * 1000)) {
      const satPos = calculateSatellitePosition(satrec, time);
      
      if (satPos && isSatelliteInRange(satPos, gsPosition, MAX_DISTANCE)) {
        // Calculate elevation angle (approximate)
        const distance = Math.sqrt(
          Math.pow(satPos.x - gsPosition.x, 2) +
          Math.pow(satPos.y - gsPosition.y, 2) +
          Math.pow(satPos.z - gsPosition.z, 2)
        );
        const elevation = 90 - (Math.acos(EARTH_RADIUS / distance) * 180 / Math.PI);

        if (!currentPass) {
          // Start of a new pass
          currentPass = {
            startTime: new Date(time),
            maxElevation: elevation,
          };
        } else {
          // Update max elevation for current pass
          currentPass.maxElevation = Math.max(currentPass.maxElevation, elevation);
        }
      } else if (currentPass) {
        // End of current pass
        const duration = (time.getTime() - currentPass.startTime.getTime()) / 1000;
        
        // Only include passes longer than 30 seconds
        if (duration > 30) {
          passes.push({
            startTime: currentPass.startTime,
            endTime: new Date(time),
            duration,
            maxElevation: currentPass.maxElevation,
          });
        }
        currentPass = null;
      }
    }

    // Add any ongoing pass at the end of the time period
    if (currentPass) {
      const duration = (endDate.getTime() - currentPass.startTime.getTime()) / 1000;
      if (duration > 30) {
        passes.push({
          startTime: currentPass.startTime,
          endTime: endDate,
          duration,
          maxElevation: currentPass.maxElevation,
        });
      }
    }

    if (passes.length > 0) {
      predictions.push({
        groundStationId: gs.id,
        groundStationName: gs.name,
        passes,
      });
    }
  });

  return predictions;
}

/**
 * Get all ground station IDs that a satellite will pass over
 */
export function getAccessibleGroundStations(
  satrec: satellite.SatRec,
  groundStations: typeof GROUND_STATIONS,
  durationHours: number = 24
): string[] {
  const predictions = predictSatellitePasses(satrec, groundStations, new Date(), durationHours);
  return predictions.map(p => p.groundStationId);
}

