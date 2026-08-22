/**
 * Route: /story. HealthLit's signature feature — reached from Home.
 *
 * Wrapped in its own ErrorBoundary. This screen runs the entire
 * story pipeline over user data, so it is both the most
 * computation-heavy screen and the one most exposed to unusual data
 * shapes. Its own boundary means a failure here leaves the tab bar
 * and every other screen working, rather than escalating to the
 * app-level boundary and replacing everything.
 */
import React from 'react';

import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import StoryScreen from '../screens/StoryScreen';

export default function StoryRoute() {
  return (
    <ErrorBoundary context="your story">
      <StoryScreen />
    </ErrorBoundary>
  );
}
