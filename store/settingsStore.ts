import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  filters: {
    country: string;
    timezone: string;
    amount: number;
  };
  selectedSatelliteFilter: string | null;
  accessibleGroundStations: string[];
  setCountry: (country: string) => void;
  setTimezone: (timezone: string) => void;
  setAmount: (amount: number) => void;
  setSelectedSatelliteFilter: (satelliteName: string | null) => void;
  setAccessibleGroundStations: (stationIds: string[]) => void;
  clearSatelliteFilter: () => void;
  loadFromStorage: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      filters: {
        country: 'all',
        timezone: 'all',
        amount: 200,
      },
      selectedSatelliteFilter: null,
      accessibleGroundStations: [],
      setCountry: (country) => set((state) => ({ filters: { ...state.filters, country } })),
      setTimezone: (timezone) => set((state) => ({ filters: { ...state.filters, timezone } })),
      setAmount: (amount) => set((state) => ({ filters: { ...state.filters, amount } })),
      setSelectedSatelliteFilter: (satelliteName) => set({ selectedSatelliteFilter: satelliteName }),
      setAccessibleGroundStations: (stationIds) => set({ accessibleGroundStations: stationIds }),
      clearSatelliteFilter: () => set({ selectedSatelliteFilter: null, accessibleGroundStations: [] }),
      loadFromStorage: () => {
        // This is handled automatically by persist middleware
      },
    }),
    {
      name: 'satellite-settings',
    }
  )
);
