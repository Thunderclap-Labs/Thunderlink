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
  
  // Reduced categories for better performance - only fetch key satellite networks
  const categories = [
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium&FORMAT=tle', name: 'Iridium', maxSatellites: 10 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=globalstar&FORMAT=tle', name: 'Globalstar', maxSatellites: 8 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=intelsat&FORMAT=tle', name: 'Intelsat', maxSatellites: 6 },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=ses&FORMAT=tle', name: 'SES', maxSatellites: 6 },
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
  { id: 'gs-1', name: 'North America Hub', location: { lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'USA' }, status: 'online' as const, capacity: 50, antennaType: 'Parabolic 15m', frequency: 'Ka-band' },
  { id: 'gs-2', name: 'Europe Hub', location: { lat: 51.5074, lon: -0.1278, city: 'London', country: 'UK' }, status: 'online' as const, capacity: 45, antennaType: 'Parabolic 12m', frequency: 'Ka-band' },
  { id: 'gs-3', name: 'Asia Pacific Hub', location: { lat: 35.6762, lon: 139.6503, city: 'Tokyo', country: 'Japan' }, status: 'online' as const, capacity: 40, antennaType: 'Parabolic 15m', frequency: 'Ku-band' },
  { id: 'gs-4', name: 'South America Hub', location: { lat: -23.5505, lon: -46.6333, city: 'São Paulo', country: 'Brazil' }, status: 'online' as const, capacity: 35, antennaType: 'Parabolic 10m', frequency: 'Ka-band' },
  { id: 'gs-5', name: 'Africa Hub', location: { lat: -33.9249, lon: 18.4241, city: 'Cape Town', country: 'South Africa' }, status: 'online' as const, capacity: 30, antennaType: 'Parabolic 12m', frequency: 'Ku-band' },
  { id: 'gs-6', name: 'Middle East Hub', location: { lat: 25.2048, lon: 55.2708, city: 'Dubai', country: 'UAE' }, status: 'online' as const, capacity: 40, antennaType: 'Parabolic 15m', frequency: 'Ka-band' },
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
