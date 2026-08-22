import React, { ReactNode, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';

interface FadeInViewProps {
  children: ReactNode;
  /** Stagger delay in ms, for sequencing sibling cards. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Subtle entrance: fade in + gentle 12px rise over 350ms. Purposeful
 * motion only — it orients the eye down the page, nothing more.
 *
 * ACCESSIBILITY: if the OS "Reduce Motion" setting is on, content
 * appears instantly with no animation.
 */
export function FadeInView({ children, delay = 0, style }: FadeInViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    let cancelled = false;
    // The native driver isn't available on react-native-web.
    const useNativeDriver = Platform.OS !== 'web';

    const showInstantly = () => {
      opacity.setValue(1);
      translateY.setValue(0);
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          showInstantly();
          return;
        }
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 350,
            delay,
            useNativeDriver,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 350,
            delay,
            useNativeDriver,
          }),
        ]).start();
      })
      .catch(showInstantly);

    return () => {
      cancelled = true;
    };
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
