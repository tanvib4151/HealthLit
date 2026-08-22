import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, useColorScheme } from 'react-native';

interface AnimatedSplashProps {
  /**
   * Called the instant this component has rendered its first frame —
   * the signal to hide the native (static) splash screen, so the
   * handoff from native splash to this animated one is invisible.
   * Uses the exact same image as the native splash for that reason.
   */
  onReady: () => void;
  /** Called once the heartbeat has finished and the fade-out completes. */
  onFinished: () => void;
}

const LIGHT_BG = '#F7F4FB';
const DARK_BG = '#18141F';

/**
 * A single, brief "lub-dub" heartbeat on the launch mark, then a
 * quick fade to reveal the real app underneath. This is a one-time
 * launch moment before the person starts actually using the app —
 * a genuinely different context from the in-app screens, which
 * deliberately avoid decorative motion (vestibular/accessibility
 * reasons, and the app's own "no decorative animation" principle).
 * This doesn't add perceptible delay: it plays during the loading
 * that's already happening (fonts, store hydration), not on top of it.
 *
 * Uses the system color scheme directly (not the in-app theme store),
 * since the store may not have finished hydrating its persisted
 * preference at this exact moment — matches how the native splash
 * screen itself already picks light/dark.
 */
export function AnimatedSplash({ onReady, onFinished }: AnimatedSplashProps) {
  const scheme = useColorScheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    onReady();

    Animated.sequence([
      // "Lub" — the stronger first beat.
      Animated.timing(scale, {
        toValue: 1.14,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.delay(90),
      // "Dub" — the softer second beat.
      Animated.timing(scale, {
        toValue: 1.07,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.delay(150),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onFinished());
    // Runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          backgroundColor: scheme === 'dark' ? DARK_BG : LIGHT_BG,
          opacity,
        },
      ]}
    >
      <Animated.Image
        source={require('../../assets/images/splash-icon.png')}
        style={[styles.mark, { transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  mark: {
    width: 140,
    height: 140,
  },
});
