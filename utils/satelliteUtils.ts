import * as satellite from 'satellite.js';
import { GroundStation } from '@/types';

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
 * Ground stations around the world for satellite communication
 */
export const GROUND_STATIONS: GroundStation[] = [
  // North America
  { id: 'gs-001', name: 'Svalbard Ground Station', location: { lat: 78.2295, lon: 15.3868, city: 'Svalbard', country: 'Norway' }, status: 'online', capacity: 8, antennaType: 'X-Band', frequency: '8.0-8.4 GHz' },
  { id: 'gs-002', name: 'Alaska Ground Station', location: { lat: 64.8378, lon: -147.7164, city: 'Fairbanks', country: 'USA' }, status: 'online', capacity: 12, antennaType: 'S/X-Band', frequency: '2.2-8.4 GHz' },
  { id: 'gs-003', name: 'California Ground Station', location: { lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'USA' }, status: 'online', capacity: 10, antennaType: 'Ka-Band', frequency: '26.5-40 GHz' },
  { id: 'gs-004', name: 'Virginia Ground Station', location: { lat: 37.4316, lon: -78.6569, city: 'Virginia', country: 'USA' }, status: 'online', capacity: 10, antennaType: 'S/X-Band', frequency: '2.2-8.4 GHz' },
  
  // South America
  { id: 'gs-005', name: 'Brazil Ground Station', location: { lat: -15.7975, lon: -47.8919, city: 'Brasília', country: 'Brazil' }, status: 'online', capacity: 8, antennaType: 'S-Band', frequency: '2.2-2.3 GHz' },
  { id: 'gs-006', name: 'Chile Ground Station', location: { lat: -33.4489, lon: -70.6693, city: 'Santiago', country: 'Chile' }, status: 'online', capacity: 6, antennaType: 'X-Band', frequency: '8.0-8.4 GHz' },
  
  // Europe
  { id: 'gs-007', name: 'Germany Ground Station', location: { lat: 48.0817, lon: 11.2750, city: 'Munich', country: 'Germany' }, status: 'online', capacity: 12, antennaType: 'Ka-Band', frequency: '26.5-40 GHz' },
  { id: 'gs-008', name: 'UK Ground Station', location: { lat: 51.5074, lon: -0.1278, city: 'London', country: 'UK' }, status: 'online', capacity: 10, antennaType: 'S/X-Band', frequency: '2.2-8.4 GHz' },
  { id: 'gs-009', name: 'Spain Ground Station', location: { lat: 28.2916, lon: -16.6291, city: 'Canary Islands', country: 'Spain' }, status: 'online', capacity: 8, antennaType: 'X-Band', frequency: '8.0-8.4 GHz' },
  
  // Asia
  { id: 'gs-010', name: 'Japan Ground Station', location: { lat: 35.6762, lon: 139.6503, city: 'Tokyo', country: 'Japan' }, status: 'online', capacity: 15, antennaType: 'Ka-Band', frequency: '26.5-40 GHz' },
  { id: 'gs-011', name: 'Singapore Ground Station', location: { lat: 1.3521, lon: 103.8198, city: 'Singapore', country: 'Singapore' }, status: 'online', capacity: 12, antennaType: 'S/X-Band', frequency: '2.2-8.4 GHz' },
  { id: 'gs-012', name: 'India Ground Station', location: { lat: 28.6139, lon: 77.2090, city: 'New Delhi', country: 'India' }, status: 'online', capacity: 10, antennaType: 'S-Band', frequency: '2.2-2.3 GHz' },
  { id: 'gs-013', name: 'South Korea Ground Station', location: { lat: 37.5665, lon: 126.9780, city: 'Seoul', country: 'South Korea' }, status: 'online', capacity: 12, antennaType: 'X-Band', frequency: '8.0-8.4 GHz' },
  
  // Australia & Oceania
  { id: 'gs-014', name: 'Australia Ground Station', location: { lat: -35.2809, lon: 149.1300, city: 'Canberra', country: 'Australia' }, status: 'online', capacity: 10, antennaType: 'X-Band', frequency: '8.0-8.4 GHz' },
  { id: 'gs-015', name: 'New Zealand Ground Station', location: { lat: -41.2865, lon: 174.7762, city: 'Wellington', country: 'New Zealand' }, status: 'online', capacity: 6, antennaType: 'S-Band', frequency: '2.2-2.3 GHz' },
  
  // Africa
  { id: 'gs-016', name: 'South Africa Ground Station', location: { lat: -25.7479, lon: 28.2293, city: 'Pretoria', country: 'South Africa' }, status: 'online', capacity: 8, antennaType: 'X-Band', frequency: '8.0-8.4 GHz' },
  { id: 'gs-017', name: 'Kenya Ground Station', location: { lat: -1.2921, lon: 36.8219, city: 'Nairobi', country: 'Kenya' }, status: 'online', capacity: 6, antennaType: 'S-Band', frequency: '2.2-2.3 GHz' },
  
  // Middle East
  { id: 'gs-018', name: 'UAE Ground Station', location: { lat: 25.2048, lon: 55.2708, city: 'Dubai', country: 'UAE' }, status: 'online', capacity: 10, antennaType: 'Ka-Band', frequency: '26.5-40 GHz' },
  
  // Arctic & Antarctic
  { id: 'gs-019', name: 'Antarctica Ground Station', location: { lat: -77.8467, lon: 166.6686, city: 'McMurdo', country: 'Antarctica' }, status: 'online', capacity: 4, antennaType: 'S-Band', frequency: '2.2-2.3 GHz' },
];

/**
 * Convert latitude and longitude to 3D coordinates on sphere
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
 * Calculate if a satellite is in range of a ground station
 * Uses horizon distance formula considering Earth's curvature
 */
export function isSatelliteInRange(
  satPosition: { x: number; y: number; z: number },
  gsPosition: { x: number; y: number; z: number },
  minElevationAngle: number = 10 // degrees
): boolean {
  // Calculate vector from ground station to satellite
  const dx = satPosition.x - gsPosition.x;
  const dy = satPosition.y - gsPosition.y;
  const dz = satPosition.z - gsPosition.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  // Calculate ground station's distance from origin (Earth center)
  const gsDistance = Math.sqrt(gsPosition.x * gsPosition.x + gsPosition.y * gsPosition.y + gsPosition.z * gsPosition.z);
  
  // Calculate satellite's distance from origin
  const satDistance = Math.sqrt(satPosition.x * satPosition.x + satPosition.y * satPosition.y + satPosition.z * satPosition.z);
  
  // Calculate elevation angle using dot product
  const dotProduct = (satPosition.x * gsPosition.x + satPosition.y * gsPosition.y + satPosition.z * gsPosition.z);
  const cosAngle = dotProduct / (satDistance * gsDistance);
  
  // Calculate angle from ground station horizon
  const angleFromCenter = Math.acos(cosAngle) * (180 / Math.PI);
  const elevationAngle = angleFromCenter - 90;
  
  // Satellite is in range if elevation angle is above minimum
  return elevationAngle >= minElevationAngle && distance < 50; // Also check reasonable distance
}

/**
 * Fetch TLE data from CelesTrak for communication and imaging satellites
 */
export async function fetchSatelliteTLEData(): Promise<SatelliteData[]> {
  const satellites: SatelliteData[] = [];
  
  // CelesTrak URLs for different satellite categories
  const categories = [
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=tle', name: 'Geostationary' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=intelsat&FORMAT=tle', name: 'Intelsat' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=ses&FORMAT=tle', name: 'SES' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium&FORMAT=tle', name: 'Iridium' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=orbcomm&FORMAT=tle', name: 'Orbcomm' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=globalstar&FORMAT=tle', name: 'Globalstar' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=goes&FORMAT=tle', name: 'GOES' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle', name: 'Earth Resources' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=sarsat&FORMAT=tle', name: 'Search & Rescue' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=dmc&FORMAT=tle', name: 'Disaster Monitoring' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=tdrss&FORMAT=tle', name: 'Tracking and Data Relay' },
  ];

  try {
    for (const category of categories) {
      try {
        const response = await fetch(category.url);
        if (!response.ok) continue;
        
        const data = await response.text();
        const lines = data.split('\n').filter(line => line.trim() !== '');
        
        // Parse TLE data (3 lines per satellite: name, line1, line2)
        for (let i = 0; i < lines.length - 2; i += 3) {
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
