import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SatelliteBooking, GroundStation, AuctionBid } from '@/types';

interface BookingState {
  bookings: SatelliteBooking[];
  groundStations: GroundStation[];
  selectedSatellite: string | null;
  auctionBids: AuctionBid[];
  addBooking: (booking: SatelliteBooking) => void;
  removeBooking: (id: string) => void;
  updateBooking: (id: string, updates: Partial<SatelliteBooking>) => void;
  setSelectedSatellite: (id: string | null) => void;
  getActiveBookings: () => SatelliteBooking[];
  setGroundStations: (stations: GroundStation[]) => void;
  placeBid: (bookingId: string, bidAmount: number, bidderId: string, bidderName: string) => void;
  getAuctionBids: (bookingId: string) => AuctionBid[];
  checkAndCloseAuctions: () => void;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      bookings: [],
      groundStations: [],
      selectedSatellite: null,
      auctionBids: [],
      
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
      
      placeBid: (bookingId, bidAmount, bidderId, bidderName) => set((state) => {
        const booking = state.bookings.find((b) => b.id === bookingId);
        if (!booking || !booking.isAuction) return state;
        
        const currentHighBid = booking.currentHighBid || booking.price;
        
        if (bidAmount <= currentHighBid) {
          alert('Bid must be higher than current bid!');
          return state;
        }
        
        // Mark previous highest bidder as outbid
        const updatedBids = state.auctionBids.map((bid) => 
          bid.bookingId === bookingId && bid.status === 'active'
            ? { ...bid, status: 'outbid' as const }
            : bid
        );
        
        // Add new bid
        const newBid: AuctionBid = {
          id: `bid-${Date.now()}`,
          bookingId,
          bidderId,
          bidderName,
          amount: bidAmount,
          timestamp: new Date(),
          status: 'active',
        };
        
        return {
          auctionBids: [...updatedBids, newBid],
          bookings: state.bookings.map((b) =>
            b.id === bookingId
              ? { ...b, currentHighBid: bidAmount, bidderId }
              : b
          ),
        };
      }),
      
      getAuctionBids: (bookingId) => {
        const state = get();
        return state.auctionBids
          .filter((bid) => bid.bookingId === bookingId)
          .sort((a, b) => b.amount - a.amount);
      },
      
      checkAndCloseAuctions: () => set((state) => {
        const now = new Date();
        const updatedBookings = state.bookings.map((booking) => {
          if (booking.isAuction && booking.auctionEndTime && now >= booking.auctionEndTime) {
            // Auction has ended
            if (booking.currentHighBid && booking.bidderId) {
              return { ...booking, status: 'pending' as const, price: booking.currentHighBid };
            } else {
              return { ...booking, status: 'cancelled' as const };
            }
          }
          return booking;
        });
        
        return { bookings: updatedBookings };
      }),
    }),
    {
      name: 'booking-storage',
    }
  )
);
