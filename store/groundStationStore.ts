import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomGroundStation {
  id: string;
  name: string;
  location: {
    lat: number;
    lon: number;
    city: string;
    country: string;
  };
  status: 'online' | 'offline';
  capacity: number;
  antennaType: string;
  frequency: string;
  rating: number;
  isCustom: boolean;
  createdAt: string;
}

interface GroundStationState {
  customStations: CustomGroundStation[];
  addStation: (station: Omit<CustomGroundStation, 'id' | 'createdAt' | 'isCustom'>) => void;
  removeStation: (id: string) => void;
  updateStation: (id: string, updates: Partial<CustomGroundStation>) => void;
  toggleStationStatus: (id: string) => void;
}

export const useGroundStationStore = create<GroundStationState>()(
  persist(
    (set) => ({
      customStations: [],
      addStation: (station) =>
        set((state) => ({
          customStations: [
            ...state.customStations,
            {
              ...station,
              id: `custom-gs-${Date.now()}`,
              isCustom: true,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      removeStation: (id) =>
        set((state) => ({
          customStations: state.customStations.filter((s) => s.id !== id),
        })),
      updateStation: (id, updates) =>
        set((state) => ({
          customStations: state.customStations.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      toggleStationStatus: (id) =>
        set((state) => ({
          customStations: state.customStations.map((s) =>
            s.id === id
              ? { ...s, status: s.status === 'online' ? 'offline' : 'online' }
              : s
          ),
        })),
    }),
    {
      name: 'custom-ground-stations',
    }
  )
);
