'use client';

import { useState, useEffect } from 'react';
import { Card, CardBody } from '@heroui/card';
import { Button } from '@heroui/button';

export default function MobileGestureHelper() {
  const [showHelper, setShowHelper] = useState(false);
  const [hasSeenHelper, setHasSeenHelper] = useState(true); // Default to true for SSR
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Only run on client after mount
    if (typeof window === 'undefined') return;
    
    // Check if user has seen the helper before
    const seen = localStorage.getItem('thunderlink_gesture_helper_seen');
    const isMobile = window.innerWidth < 768;
    
    if (!seen && isMobile) {
      setHasSeenHelper(false);
      // Show helper after 2 seconds
      const timer = setTimeout(() => {
        setShowHelper(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setShowHelper(false);
    localStorage.setItem('thunderlink_gesture_helper_seen', 'true');
    setHasSeenHelper(true);
  };

  // Don't render anything during SSR or before mount
  if (!isMounted || hasSeenHelper || !showHelper) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="max-w-sm border-2 border-primary/50 shadow-2xl">
        <CardBody className="p-6 space-y-4">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">👋 Welcome to Thunderlink!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Here are some quick tips for mobile navigation
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg">
              <span className="text-2xl">☰</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Control Panel</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Tap top-left menu or swipe right from edge
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-secondary/10 rounded-lg">
              <span className="text-2xl">➕</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Quick Actions</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Tap the FAB button (bottom-right)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-success/10 rounded-lg">
              <span className="text-2xl">🖐️</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Globe Controls</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Swipe to rotate • Pinch to zoom • Tap objects
                </p>
              </div>
            </div>
          </div>

          <Button
            color="primary"
            size="lg"
            fullWidth
            onPress={handleClose}
            className="mt-4"
          >
            Got it! 🚀
          </Button>

          <button
            onClick={handleClose}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 w-full text-center"
          >
            Don't show this again
          </button>
        </CardBody>
      </Card>
    </div>
  );
}
