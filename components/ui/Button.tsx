import React, { useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../../hooks/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Read by screen readers to describe what happens on press. */
  accessibilityHint?: string;
  testID?: string;
}

/**
 * The app's only button. 52pt minimum height for accessibility —
 * a user in pain should never have to aim carefully.
 *
 * Press animation: scale 0.95 + fade over 120ms on press, respects
 * OS Reduce Motion. Provides confidence that the tap registered
 * without distracting from the interface.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const { styles, variantStyles, pressedStyles, labelStyles } = useMemo(() => {
    const styles = StyleSheet.create({
      base: {
        minHeight: theme.touchTarget.minHeight,
        borderRadius: theme.radius.lg,
        paddingHorizontal: theme.spacing.xxl,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
      },
      label: {
        ...theme.typography.button,
      },
      disabled: {
        opacity: 0.5,
      },
    });

    const variantStyles = StyleSheet.create({
      primary: {
        backgroundColor: theme.colors.primary,
      },
      secondary: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
    });

    const pressedStyles = StyleSheet.create({
      primary: {
        backgroundColor: theme.colors.primaryPressed,
      },
      secondary: {
        backgroundColor: theme.colors.surfaceMuted,
      },
      ghost: {
        opacity: 0.7,
      },
    });

    const labelStyles = StyleSheet.create({
      primary: {
        color: theme.colors.onPrimary,
      },
      secondary: {
        color: theme.colors.primary,
      },
      ghost: {
        color: theme.colors.primary,
      },
    });

    return { styles, variantStyles, pressedStyles, labelStyles };
  }, [theme]);

  const handlePressIn = async () => {
    try {
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (reduceMotion) return;

      const useNativeDriver = Platform.OS !== 'web';
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 120,
          useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 120,
          useNativeDriver,
        }),
      ]).start();
    } catch {
      // Accessibility check failed; skip animation gracefully.
    }
  };

  const handlePressOut = async () => {
    try {
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (reduceMotion) return;

      const useNativeDriver = Platform.OS !== 'web';
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 120,
          useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver,
        }),
      ]).start();
    } catch {
      // Accessibility check failed; reset gracefully.
      scale.setValue(1);
      opacity.setValue(1);
    }
  };

  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === 'primary' ? theme.colors.onPrimary : theme.colors.primary;

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={4}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          variantStyles[variant],
          pressed && !isDisabled && pressedStyles[variant],
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={spinnerColor} />
        ) : (
          <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
