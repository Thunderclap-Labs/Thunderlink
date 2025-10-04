import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// Ground Station Types
export interface GroundStation {
  id: string;
  name: string;
  location: {
    lat: number;
    lon: number;
    city: string;
    country: string;
  };
  status: 'online' | 'offline' | 'maintenance';
  capacity: number; // Max simultaneous connections
  antennaType: string;
  frequency: string;
}

// Satellite Booking Types
export interface SatelliteBooking {
  id: string;
  satelliteName: string;
  satelliteId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  price: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'outbid';
  userId?: string;
  groundStations: string[]; // IDs of ground stations used
  dataRate: string;
  purpose: string;
  bidAmount?: number; // User's bid amount (for auction)
  currentHighBid?: number; // Current highest bid (for auction)
  auctionEndTime?: Date; // When the auction closes
  isAuction?: boolean; // Whether this is an auction-based booking
  bidderId?: string; // Current highest bidder
}

export interface AuctionBid {
  id: string;
  bookingId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: Date;
  status: 'active' | 'outbid' | 'won' | 'lost';
}

export interface SatelliteAvailability {
  satelliteId: string;
  satelliteName: string;
  category: string;
  available: boolean;
  nextAvailable?: Date;
  pricePerMinute: number;
  capabilities: string[];
  orbitType: 'LEO' | 'MEO' | 'GEO';
  dataRate: string;
  coverage: string;
  auctionActive?: boolean; // Whether there's an active auction
  minimumBid?: number; // Minimum bid for auction
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  price: number;
  groundStationsInRange: string[];
}
