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
