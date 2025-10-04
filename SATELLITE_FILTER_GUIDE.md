# Satellite Filter Feature - Quick Start Guide

## How to Use the Satellite Tracking Feature

### Step 1: Search for a Satellite
```
1. Look at the top-left control panel
2. Find the search box with 🔍 icon
3. Type any part of a satellite name (e.g., "IRIDIUM", "STARLINK", "ISS")
4. Autocomplete will show matching satellites
```

### Step 2: Select a Satellite
```
Option A: Click on a satellite from the dropdown list
Option B: Type the full name and press Enter
```

### Step 3: View Results
Once selected, you'll see:
```
✓ Only ONE satellite displayed (in MAGENTA/PURPLE color)
✓ Only accessible ground stations shown (in BRIGHT GREEN)
✓ Connection lines automatically enabled
✓ A tracking card showing the satellite name and station count
```

### Step 4: View Pass Predictions
```
1. Click "View Passes" button in the tracking card
2. See all ground station passes for the next 24 hours
3. Each pass shows:
   - Start and end times
   - Duration
   - Maximum elevation angle
4. Click any ground station card to view station details
5. Export to CSV if needed
```

### Step 5: Navigate to Ground Stations
```
NEW FEATURE: Click any ground station card in the pass predictions to:
- View full station details
- See currently accessible satellites
- Book satellite time through that station
```

### Step 6: Clear Filter
```
Option A: Click the ✕ button in the search field
Option B: Clear the search text and the filter will reset
```

## Visual Indicators

### Satellite Colors:
- 🔵 **Cyan/Blue**: Normal satellites (when no filter active)
- 🟣 **Magenta/Purple**: Filtered/tracked satellite (LARGER size)

### Ground Station Colors:
- 🟢 **Bright Green**: Accessible by the filtered satellite
- 🟡 **Yellow/Default**: Normal ground stations (when no filter active)
- ⚫ **Hidden**: Not accessible by filtered satellite

### Connection Lines:
- 🔵 **Cyan**: Normal satellite connections
- 🟣 **Magenta**: Filtered satellite connections (THICKER, more visible)

## Example Use Cases

### Use Case 1: Track a Specific Starlink Satellite
```
1. Type "STARLINK" in search
2. Select "STARLINK-1234" from dropdown
3. View which ground stations it passes over
4. Check pass times for data downlink planning
5. Click a ground station to book time
```

### Use Case 2: Plan Communication Window
```
1. Search for your satellite
2. Click "View Passes"
3. Find passes with high elevation angles (>30°)
4. Click the ground station card
5. View station details and book the time slot
6. Export to CSV for your team
```

### Use Case 3: Compare Ground Stations
```
1. Filter by satellite
2. View pass predictions
3. Click different ground station cards
4. Compare ratings, antenna types, and locations
5. Choose the best station for your needs
```

## Tips & Tricks

### For Better Visibility:
- ✓ Zoom in closer (mouse wheel) to see details
- ✓ Rotate Earth (click and drag) to see all accessible stations
- ✓ Connection lines update in real-time as satellite moves

### For Data Analysis:
- ✓ Export pass predictions to CSV for offline analysis
- ✓ Look for elevation angles >30° for best signal quality
- ✓ Check pass durations to plan data transfer windows

### For Multiple Satellites:
- ✓ Clear current filter
- ✓ Search for next satellite
- ✓ Compare accessible ground stations between satellites

## Keyboard Shortcuts
```
Enter       : Apply search filter
Escape      : (Future) Clear search filter
Click & Drag: Rotate Earth
Mouse Wheel : Zoom in/out
```

## Troubleshooting

### "No satellites found"
- Check spelling
- Try partial names (e.g., "IRD" for Iridium)
- Some satellites may not have loaded yet

### "No passes found"
- Satellite may be in a different orbital plane
- Try extending prediction time (future enhancement)
- Check if satellite is active

### Satellite not showing up
- Make sure filter is active (check tracking card)
- Satellite might be behind the Earth
- Rotate the globe to find it

## Performance Notes

- Predictions calculate for 24 hours ahead
- Updates every 2 seconds for real-time positions
- Connection lines limited to 50 simultaneous connections
- Larger satellites (filtered) may impact performance slightly

---

**Need Help?** Check the full feature documentation in SATELLITE_FILTER_FEATURE.md
