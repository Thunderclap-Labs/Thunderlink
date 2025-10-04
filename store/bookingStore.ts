import { create } from 'zustand';
import { SatelliteBooking, GroundStation } from '@/types';

interface BookingState {
  bookings: SatelliteBooking[];
  groundStations: GroundStation[];
  selectedSatellite: string | null;
  addBooking: (booking: SatelliteBooking) => void;
  removeBooking: (id: string) => void;
  updateBooking: (id: string, updates: Partial<SatelliteBooking>) => void;
  setSelectedSatellite: (id: string | null) => void;
  getActiveBookings: () => SatelliteBooking[];
  setGroundStations: (stations: GroundStation[]) => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  groundStations: [],
  selectedSatellite: null,
  
  addBooking: (booking) => set((state) => ({
    bookings: [...state.bookings, booking],
  })),
  
  removeBooking: (id) => set((state) => ({
    bookings: state.bookings.filter((b) => b.id !== id),
  })),
  
  updateBooking: (id, updates) => set((state) => ({
    bookings: state.bookings.map((b) => 
      b.id === id ? { ...b, ...updates } : b
    ),
  })),
  
  setSelectedSatellite: (id) => set({ selectedSatellite: id }),
  
  getActiveBookings: () => {
    const state = get();
    return state.bookings.filter((b) => b.status === 'active' || b.status === 'pending');
  },
  
  setGroundStations: (stations) => set({ groundStations: stations }),
}));
