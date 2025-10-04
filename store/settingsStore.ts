import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  filters: {
    country: string;
    timezone: string;
    amount: number;
  };
  setCountry: (country: string) => void;
  setTimezone: (timezone: string) => void;
  setAmount: (amount: number) => void;
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
      setCountry: (country) => set((state) => ({ filters: { ...state.filters, country } })),
      setTimezone: (timezone) => set((state) => ({ filters: { ...state.filters, timezone } })),
      setAmount: (amount) => set((state) => ({ filters: { ...state.filters, amount } })),
      loadFromStorage: () => {
        // This is handled automatically by persist middleware
      },
    }),
    {
      name: 'satellite-settings',
    }
  )
);
