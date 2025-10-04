# Satellite Filter Feature

## Overview
Added a comprehensive satellite filtering feature that allows users to search for a specific satellite and view only that satellite on the map along with all the ground stations it passes through.

## Features Implemented

### 1. Satellite Search Functionality
- **Location**: Top-left control panel in the EarthScene component
- **Features**:
  - Search input field with autocomplete suggestions
  - Real-time filtering as you type (shows matching satellites after 2+ characters)
  - Displays satellite name and category in dropdown
  - Clear button (X) to reset the filter

### 2. Visual Filtering
When a satellite is selected:
- **Satellite Display**:
  - Only the selected satellite is shown on the map
  - Selected satellite is highlighted in magenta/purple color
  - Larger size (0.04 vs 0.02 units) for better visibility
  - Enhanced glow effect (opacity 0.8 vs 0.6)
  - Extended orbit trail (100 points vs 50)
  
- **Ground Station Display**:
  - Only ground stations that the satellite passes through are shown
  - Other ground stations are hidden
  - Accessible stations are highlighted in bright green
  - Enhanced emissive intensity for better visibility

- **Connection Lines**:
  - Automatically enabled when filtering
  - Shows real-time connections between satellite and accessible ground stations
  - Magenta/purple connections for filtered satellite (vs cyan for normal)
  - Higher opacity (0.6 vs 0.3) for better visibility

### 3. Pass Predictions Modal
- **Access**: Click "View Passes" button in the tracking card
- **Features**:
  - Lists all ground stations the satellite will pass over
  - Shows detailed pass information for the next 24 hours
  - For each pass:
    - Start time (date and time)
    - End time (date and time)
    - Duration (minutes and seconds)
    - Maximum elevation angle (degrees)
  - Export to CSV functionality
  - Beautiful card-based UI with color coding

### 4. Active Filter Display
Shows current filter status including:
- Currently tracked satellite name
- Number of accessible ground stations
- Quick access to view pass predictions

## Technical Implementation

### Store Updates (`store/settingsStore.ts`)
Added new state properties:
- `selectedSatelliteFilter`: Tracks the currently filtered satellite name
- `accessibleGroundStations`: Array of ground station IDs accessible by the filtered satellite
- `setSelectedSatelliteFilter()`: Updates the filtered satellite
- `setAccessibleGroundStations()`: Updates accessible stations list
- `clearSatelliteFilter()`: Clears all filters

### Utility Functions (`utils/satelliteUtils.ts`)
New functions added:

#### `predictSatellitePasses()`
- Calculates when a satellite will pass over ground stations
- Parameters:
  - `satrec`: Satellite record for TLE propagation
  - `groundStations`: List of ground stations to check
  - `startDate`: Start of prediction period (default: now)
  - `durationHours`: Prediction duration (default: 24 hours)
- Returns: Array of `PassPrediction` objects with pass times and elevations
- Time step: 1 minute intervals for accurate predictions
- Filters out passes shorter than 30 seconds

#### `getAccessibleGroundStations()`
- Simplified function to get just the IDs of accessible stations
- Uses `predictSatellitePasses()` internally
- Returns: Array of ground station IDs

#### `PassPrediction` Interface
```typescript
interface PassPrediction {
  groundStationId: string;
  groundStationName: string;
  passes: Array<{
    startTime: Date;
    endTime: Date;
    duration: number; // in seconds
    maxElevation: number; // in degrees
  }>;
}
```

### Component Updates (`components/EarthScene.tsx`)

#### New State Variables
- `satelliteSearchQuery`: Search input value
- `filteredSatelliteName`: Currently filtered satellite name
- `passPredictions`: Pass prediction data for display
- `showPassPredictions`: Controls pass predictions modal visibility

#### New Refs
- `selectedSatelliteFilterRef`: Ref for accessing filter state in animation loop

#### New useEffects
1. **Satellite Visibility Filter**: Filters satellites to show only the selected one
2. **Ground Station Visibility**: Shows/hides stations based on accessibility
3. **Auto-enable Connections**: Automatically shows connection lines when filtering
4. **Material Updates**: Updates ground station materials to highlight accessible ones

#### UI Components Added
1. **Search Input Field**: Autocomplete dropdown with satellite suggestions
2. **Active Filter Card**: Shows current filter status with quick actions
3. **Pass Predictions Modal**: Detailed view of all satellite passes

## Usage Instructions

### To Filter by Satellite:
1. Type a satellite name in the search box (top-left panel)
2. Select from the autocomplete dropdown OR press Enter
3. The map will update to show:
   - Only the selected satellite (in magenta/purple)
   - Only accessible ground stations (in bright green)
   - Connection lines between them

### To View Pass Predictions:
1. After filtering a satellite, click "View Passes" in the tracking card
2. Browse through all ground stations and their pass times
3. Export data to CSV if needed

### To Clear Filter:
1. Click the X button in the search field, OR
2. Click the X in the active filter card

## Performance Considerations
- Pass predictions calculated once on satellite selection
- Uses 1-minute time steps for 24-hour predictions
- Connection line pool pre-created for efficient reuse
- Ground station visibility updates without recreating meshes
- Ref-based state access in animation loop for real-time updates

## Future Enhancements
- Add date/time range selector for pass predictions
- Add elevation angle threshold filter
- Show satellite footprint on Earth surface
- Add notifications for upcoming passes
- Support multiple satellite filtering
- Add 3D path visualization for future passes
