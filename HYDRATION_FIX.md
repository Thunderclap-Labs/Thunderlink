# Hydration Error Fix

## Problem

The app was experiencing a React hydration error with the following message:

```
Hydration failed because the server rendered text didn't match the client
```

The specific issue was in the satellite count label showing:
- Server: `200`
- Client: `50` (on mobile)

## Root Cause

The `maxSatelliteCount` state was initialized with a function that checked `window.innerWidth` to detect mobile devices:

```typescript
// ❌ WRONG - Causes hydration mismatch
const [maxSatelliteCount, setMaxSatelliteCount] = useState<number>(() => {
  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth < 768;
    return isMobile ? 50 : 200;
  }
  return 200;
});
```

### Why This Caused Issues

1. **Server-Side Rendering (SSR)**: Next.js renders the component on the server first where `window` doesn't exist
2. **Initial Value**: The server always rendered with `200` as the default
3. **Client Hydration**: When the client hydrated, mobile devices got `50` instead
4. **Mismatch**: React detected that the rendered HTML (200) didn't match what the client expected (50)

## Solution

Split the logic into two phases:

### Phase 1: Server & Initial Client Render
Use a consistent default value that works for both server and client:

```typescript
// ✅ CORRECT - Same value on server and client initially
const [maxSatelliteCount, setMaxSatelliteCount] = useState<number>(200);
```

### Phase 2: Client-Side Adjustment
Use `useEffect` to detect mobile and adjust after hydration is complete:

```typescript
// ✅ CORRECT - Runs only on client after hydration
useEffect(() => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  if (isMobile) {
    setMaxSatelliteCount(50); // Lower default for mobile
  }
}, []);
```

## Additional Fix: MobileGestureHelper

The `MobileGestureHelper` component had a similar issue checking `window.innerWidth` during render.

### Before (Caused Hydration Issues)
```typescript
const [hasSeenHelper, setHasSeenHelper] = useState(false);

useEffect(() => {
  const seen = localStorage.getItem('...');
  if (!seen && window.innerWidth < 768) { // ❌ Direct window access
    setHasSeenHelper(false);
    // ...
  } else {
    setHasSeenHelper(true);
  }
}, []);
```

### After (Fixed)
```typescript
const [hasSeenHelper, setHasSeenHelper] = useState(true); // ✅ Safe default for SSR
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
  
  if (typeof window === 'undefined') return; // ✅ Guard clause
  
  const seen = localStorage.getItem('...');
  const isMobile = window.innerWidth < 768;
  
  if (!seen && isMobile) {
    setHasSeenHelper(false);
    // ...
  }
}, []);

// ✅ Don't render until mounted
if (!isMounted || hasSeenHelper || !showHelper) {
  return null;
}
```

## Key Principles for Avoiding Hydration Errors

### 1. **Consistent Initial State**
Always use the same initial state value on both server and client:

```typescript
// ✅ Good
const [value, setValue] = useState(defaultValue);

// ❌ Bad
const [value, setValue] = useState(
  typeof window !== 'undefined' ? clientValue : serverValue
);
```

### 2. **Client-Only Logic in useEffect**
Move any client-specific logic into `useEffect`:

```typescript
useEffect(() => {
  // This only runs on the client
  const isMobile = window.innerWidth < 768;
  setValue(isMobile ? mobileValue : desktopValue);
}, []);
```

### 3. **Guard Clauses for Browser APIs**
Always check if browser APIs are available:

```typescript
if (typeof window === 'undefined') return;
if (typeof localStorage === 'undefined') return;
if (typeof navigator === 'undefined') return;
```

### 4. **Safe Defaults for SSR**
Choose defaults that work well for both server and client:

```typescript
// ✅ Good - Desktop default works everywhere
const [count, setCount] = useState(200);

// ✅ Good - Null is safe
const [user, setUser] = useState(null);

// ❌ Bad - Random values differ each time
const [id, setId] = useState(Math.random());

// ❌ Bad - Date changes each render
const [time, setTime] = useState(Date.now());
```

### 5. **Conditional Rendering After Mount**
Use a mounted state to prevent rendering until client-side:

```typescript
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

if (!isMounted) return null; // Or return skeleton
```

## Files Changed

1. **components/EarthScene.tsx**
   - Changed `maxSatelliteCount` initialization from conditional to static default
   - Added `useEffect` to adjust value on client-side for mobile

2. **components/MobileGestureHelper.tsx**
   - Added `isMounted` state to track hydration
   - Changed `hasSeenHelper` default from `false` to `true`
   - Added guard clause for `window` checks
   - Updated conditional rendering to wait for mount

## Testing

To verify the fix:

1. **Clear browser cache and storage**
2. **Restart the dev server**: `npm run dev`
3. **Open in mobile viewport** (DevTools responsive mode)
4. **Check console** - should see no hydration errors
5. **Verify behavior**:
   - Satellite count starts at 200, then adjusts to 50 on mobile
   - No flash of wrong content
   - Gesture helper appears only on mobile after mount

## Benefits

- ✅ No more hydration errors
- ✅ Consistent initial render between server and client
- ✅ Maintains mobile optimizations (just applies them after hydration)
- ✅ Better user experience (no content flash)
- ✅ Follows React and Next.js best practices

## Related Documentation

- [React Hydration Errors](https://react.dev/link/hydration-mismatch)
- [Next.js SSR Patterns](https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering)
- [useEffect Hook](https://react.dev/reference/react/useEffect)

---

**Issue**: Hydration Mismatch Error  
**Status**: ✅ Fixed  
**Date**: October 5, 2025  
**Impact**: High (Prevented console errors and improved stability)
