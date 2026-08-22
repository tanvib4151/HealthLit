import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../hooks/useTheme';

type IoniconName = keyof typeof Ionicons.glyphMap;

const ROUTE_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  log: { active: 'clipboard', inactive: 'clipboard-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

const INDICATOR_SIZE = 44;
const INDICATOR_TOP = 6;

/**
 * NOTE ON expo-glass-effect (removed for v1):
 * This tab bar previously rendered its indicator with GlassView when
 * Liquid Glass was available, falling back to a solid pill otherwise.
 * The dependency was dropped before submission for build reasons, not
 * aesthetic ones: it is a native module requiring a recent Xcode/iOS
 * SDK on the build image, and its version line did not match the
 * Expo SDK this project is pinned to. That is a failed EAS build
 * twenty minutes at a time, in exchange for a subtle effect visible
 * only on the newest iOS.
 *
 * The solid indicator below IS the fallback that already existed and
 * was already the path most devices took. To restore glass later:
 * reinstate the expo-glass-effect import, the useGlass state and its
 * reduce-transparency check, and the indicatorGlass style.
 *
 * Custom tab bar with a single "pill" that slides between tabs
 * (matching Apple's own tab bar behavior) rather than each icon
 * independently drawing its own highlight. This is also what fixes
 * two earlier problems: wrapping each icon individually in GlassView
 * gave it an ambiguous size that could visually crowd the label text
 * underneath, and made the glass render less cleanly — a single,
 * explicitly-sized shared pill sidesteps both.
 */
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const tabWidth = barWidth / Math.max(state.routes.length, 1);

  useEffect(() => {
    if (barWidth === 0) return;
    const target = state.index * tabWidth + (tabWidth - INDICATOR_SIZE) / 2;
    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [state.index, barWidth, tabWidth, translateX]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          flexDirection: 'row' as const,
          backgroundColor: theme.colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          minHeight: 56,
          paddingTop: 8,
          paddingBottom: 12 + insets.bottom,
        },
        indicator: {
          position: 'absolute' as const,
          top: INDICATOR_TOP,
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          borderRadius: theme.radius.md,
        },
        indicatorSolid: {
          backgroundColor: theme.colors.primarySoft,
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
        },
        tabButton: {
          flex: 1,
          alignItems: 'center' as const,
          justifyContent: 'flex-start' as const,
          minHeight: 52, // 52pt minimum touch target
        },
        iconZone: {
          height: INDICATOR_SIZE,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        label: {
          fontSize: 11,
          fontWeight: '600' as const,
          marginTop: 4,
        },
      }),
    [theme, insets.bottom],
  );

  return (
    <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
      {barWidth > 0 && (
        <Animated.View
          style={[styles.indicator, styles.indicatorSolid, { transform: [{ translateX }] }]}
        />
      )}

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const icons = ROUTE_ICONS[route.name] ?? ROUTE_ICONS.index;
        const label = typeof options.title === 'string' ? options.title : route.name;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabButton}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            <View style={styles.iconZone}>
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={22}
                color={focused ? theme.colors.primary : theme.colors.inkMuted}
              />
            </View>
            <Text
              style={[
                styles.label,
                { color: focused ? theme.colors.primary : theme.colors.inkMuted },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="log" options={{ title: 'Log' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
