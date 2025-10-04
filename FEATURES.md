# Thunderlink - Global Satellite Network System

## Overview
Thunderlink solves the hobbyist satellite connection problem by providing a global network of ground stations that enable users to connect to any satellite around the world - not just ones flying directly overhead.

## Key Features Implemented

### 1. **Global Ground Station Network** 🌍
- **19 Ground Stations** strategically placed worldwide:
  - North America (Alaska, San Francisco, Virginia)
  - South America (Brazil, Chile)
  - Europe (Germany, UK, Spain/Canary Islands, Norway/Svalbard)
  - Asia (Japan, Singapore, India, South Korea)
  - Africa (South Africa, Kenya)
  - Middle East (UAE)
  - Oceania (Australia, New Zealand)
  - Antarctica (McMurdo)

- Each station features:
  - Real-time status monitoring (online/offline/maintenance)
  - Different antenna types (S-Band, X-Band, Ka-Band, S/X-Band)
  - Frequency specifications
  - Connection capacity limits

### 2. **Real-Time Satellite Tracking** 🛰️
- Live satellite positions updated every second
- Multiple satellite categories:
  - Geostationary (GEO)
  - Intelsat & SES (communication satellites)
  - Iridium, Globalstar, Orbcomm (LEO constellations)
  - GOES (weather satellites)
  - Earth Resources & Disaster Monitoring
  - Search & Rescue (SARSAT)
  - Tracking and Data Relay (TDRSS)

### 3. **Visual Connection System** 🔗
- Real-time connection lines between satellites and ground stations
- Connection calculation based on:
  - Satellite elevation angle (minimum 10° above horizon)
  - Line-of-sight availability
  - Ground station visibility
- Live connection counter showing active satellite-to-ground links
- Toggle to show/hide connections and ground stations

### 4. **Satellite Booking System** 📅

#### Booking Features:
- **Browse & Select**: Choose from 50+ available satellites
- **Flexible Scheduling**: 
  - Select any start time
  - Duration: 15 minutes to 4 hours (240 minutes)
  - Real-time pricing calculation
- **Dynamic Pricing**:
  - LEO satellites: $10-15/minute
  - GEO satellites: $25/minute
  - Premium satellites (Intelsat/SES): $30/minute
- **Mission Planning**: Specify purpose for your satellite time

#### Booking Interface:
- Satellite selector with category information
- Date/time picker for scheduling
- Duration slider
- Purpose/mission description field
- Real-time price calculation
- Network features display

### 5. **Bookings Management Page** 📊
Located at `/bookings`, featuring:
- **Dashboard Statistics**:
  - Total bookings count
  - Active bookings
  - Pending bookings
  - Total amount spent

- **Booking Cards** with:
  - Satellite name and status
  - Start/end times
  - Duration and data rate
  - Purpose/mission info
  - Ground stations assigned
  - Price breakdown

- **Filtering Options**:
  - All bookings
  - Active only
  - Pending only
  - Completed only

- **Management Actions**:
  - Cancel pending/active bookings
  - Delete booking records
  - View detailed information

### 6. **Interactive 3D Visualization** 🌎
- Draggable Earth globe
- Clickable satellites for detailed info
- Hover tooltips showing satellite names
- Ground station markers (green towers for online stations)
- Orbit trails showing satellite paths
- Beautiful space environment with stars

### 7. **Satellite Information Modal** ℹ️
When clicking a satellite, view:
- Real-time position (lat/lon/altitude)
- Velocity
- Orbital period
- NORAD ID
- Category
- Direct "Book This Satellite" button

## Technical Implementation

### State Management
- **Zustand store** for booking management
- Persistent bookings across navigation
- Ground station configuration

### Data Sources
- Live TLE (Two-Line Element) data from CelesTrak
- Real-time position calculations using satellite.js
- Orbital mechanics for accurate satellite tracking

### 3D Rendering
- Three.js for WebGL rendering
- Custom geometry for ground stations
- Dynamic connection line generation
- Real-time position updates

### Pricing Model
```typescript
Base Rates:
- LEO Constellations: $10-15/minute
- Geostationary: $25/minute  
- Premium (Intelsat/SES): $30/minute

Example Booking:
- Satellite: Intelsat 14
- Duration: 60 minutes
- Rate: $30/min
- Total: $1,800
```

## User Flow

1. **Explore**: View Earth with satellites and ground stations
2. **Discover**: Click satellites to see details
3. **Book**: Select "Book Satellite Time" or "Book This Satellite"
4. **Configure**: Choose satellite, time slot, and duration
5. **Confirm**: Review pricing and confirm booking
6. **Manage**: View and manage bookings in /bookings page

## Network Advantages

### Traditional Hobbyist Approach:
❌ Can only connect when satellite passes overhead
❌ Limited to local ground station location
❌ Short connection windows (5-15 minutes)
❌ Unpredictable access times

### Thunderlink Network:
✅ Connect to any satellite, anywhere, anytime
✅ 19 ground stations worldwide
✅ Extended connection times
✅ Flexible scheduling
✅ Global coverage 24/7
✅ No need to wait for satellite passes

## Additional Features

### Network Statistics (Live Display):
- Total satellites tracked
- Ground stations online
- Active connections count

### Control Panel:
- Toggle ground station visibility
- Toggle connection lines
- One-click booking access

### Responsive Design:
- Works on desktop and mobile
- Touch-friendly controls
- Adaptive layouts

## Future Enhancements (Speculative)
- Real-time data relay through booked satellites
- Multi-satellite bookings for coverage
- Custom ground station selection
- Booking calendar view
- Email notifications for upcoming bookings
- API access for automated bookings
- Satellite health monitoring
- Weather-based availability adjustments
- Priority booking tiers
- Bulk booking discounts

## Technology Stack
- **Frontend**: Next.js 15, React 18, TypeScript
- **UI**: HeroUI (NextUI successor)
- **3D Graphics**: Three.js
- **State**: Zustand
- **Satellite Tracking**: satellite.js
- **Styling**: Tailwind CSS

## Getting Started
```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to explore the system!

---

**Thunderlink**: Connecting hobbyists to the stars, one satellite at a time. 🚀
