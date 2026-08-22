import React, { ReactNode, useMemo } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from './AppHeader';
import { useTheme } from '../../hooks/useTheme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. Defaults to true. */
  scroll?: boolean;
  /** Show the HealthLit brand header. Defaults to false. */
  showHeader?: boolean;
  /** Extra styles for the content container. */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Base container for every screen: safe area, app background, optional
 * brand header, and consistent content padding. Keeps layout rhythm
 * identical across the app.
 */
export function Screen({
  children,
  scroll = true,
  showHeader = false,
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        flex: {
          flex: 1,
        },
        content: {
          padding: theme.spacing.xl,
          paddingBottom: theme.spacing.xxxl,
          gap: theme.spacing.lg,
        },
      }),
    [theme],
  );

  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {showHeader ? <AppHeader /> : null}
      {content}
    </SafeAreaView>
  );
}
