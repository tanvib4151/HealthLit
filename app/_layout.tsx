import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { AnimatedSplash } from '../components/ui/AnimatedSplash';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { useAuthStore } from '../store/authStore';
import { useAppPrefsStore } from '../store/appPrefsStore';
import { useCustomSymptomStore } from '../store/customSymptomStore';
import { useLogStore } from '../store/logStore';
import { useMedicationStore } from '../store/medicationStore';
import { useOnsetStore } from '../store/onsetStore';
import { useProfileStore } from '../store/profileStore';
import { useWellnessStore } from '../store/wellnessStore';
import { useThemeModeStore } from '../store/themeModeStore';
import { pullAndMergeAllFromCloud } from '../services/syncOrchestrator';
import { useTheme } from '../hooks/useTheme';

// Keep the native splash on screen until we explicitly hide it — see
// AnimatedSplash's onReady, which hides it the instant our own splash
// (using the identical image) is ready to paint, so the handoff is
// invisible. Recommended to call this here, at module scope, rather
// than inside the component — otherwise it can fire too late.
void SplashScreen.preventAutoHideAsync();

/**
 * Root navigation layout.
 * - Loads the Inter font family (theme typography depends on it).
 * - Hydrates saved entries, profile, medications, custom symptoms,
 *   and the theme mode preference from device storage once at
 *   launch.
 * - Starts the (optional) Firebase auth session listener. If a
 *   previous sign-in is restored at launch, pulls and merges cloud
 *   data once. A fresh interactive sign-in from AuthScreen handles
 *   its own pull, so this never double-syncs.
 */
export default function RootLayout() {
  const theme = useTheme();
  // Loading these still matters (theme typography depends on Inter) —
  // just no longer gates the first render, since AnimatedSplash fully
  // covers the screen for the brief window before they're ready.
  // The loaded flag was previously discarded. In Expo Go that was
  // survivable, but a standalone build renders the tree the moment it
  // is ready, and every style in the theme names an Inter family
  // directly — so text could paint in the system font and visibly
  // reflow a moment later. Holding the splash until fonts resolve
  // costs nothing: it overlaps loading that is happening anyway.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);

  // Font loading can genuinely fail (corrupt asset, out of memory).
  // Treating an error as "done" means the app starts in the system
  // font rather than sitting on a splash screen forever, which is the
  // far better failure.
  const fontsSettled = fontsLoaded || fontError !== null;
  const showAnimatedSplash = !splashAnimationDone || !fontsSettled;

  const handleSplashReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    void useLogStore.getState().hydrate();
    void useProfileStore.getState().hydrate();
    void useCustomSymptomStore.getState().hydrate();
    void useMedicationStore.getState().hydrate();
    void useOnsetStore.getState().hydrate();
    void useAppPrefsStore.getState().hydrate();
    void useWellnessStore.getState().hydrate();
    void useThemeModeStore.getState().hydrate();

    let isFirstAuthCheck = true;
    const unsubscribeAuth = useAuthStore.getState().initAuthListener();
    const unsubscribeInitialCheck = useAuthStore.subscribe((state) => {
      if (isFirstAuthCheck && state.authChecked) {
        isFirstAuthCheck = false;
        if (state.user) {
          void pullAndMergeAllFromCloud();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeInitialCheck();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {/* Outermost net. A render crash anywhere below this shows a
          readable message instead of unmounting the app to a white
          screen — which in a standalone build is unrecoverable. */}
      <ErrorBoundary context="the app">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ErrorBoundary>
      {showAnimatedSplash && (
        <AnimatedSplash
          onReady={handleSplashReady}
          onFinished={() => setSplashAnimationDone(true)}
        />
      )}
      {/* First launch only. Explains what the app is, offers a daily
          reminder, and carries the medical disclaimer as its final
          step — one flow rather than two stacked modals. */}
      {!showAnimatedSplash && <OnboardingFlow />}
    </SafeAreaProvider>
  );
}
