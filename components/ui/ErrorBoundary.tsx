import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Catches render-time crashes so a failure in one screen degrades to
 * a readable message instead of a white screen.
 *
 * WHY THIS IS NOT OPTIONAL
 *
 * React unmounts the entire tree when a render throws and nothing
 * catches it. In a standalone build that means a permanent blank
 * screen with no way back — the app is simply dead until it is
 * force-quit, and often after that too, if the crash is in data that
 * gets rehydrated on launch.
 *
 * For App Review that is an automatic rejection under Guideline 2.1,
 * and it is the single most likely way this app fails review: the
 * story pipeline does real arithmetic over user data, and unusual
 * data is exactly what a reviewer tapping around will produce.
 *
 * A class component is required — hooks cannot implement
 * `componentDidCatch`, and this is one of the few places React still
 * has no functional equivalent.
 *
 * DATA SENSITIVITY: the message shown is the error's own text, which
 * comes from our code and never contains entry contents. Nothing is
 * transmitted anywhere — there is no crash-reporting SDK in this
 * build, so this boundary is the only crash handling that exists.
 */

interface Props {
  children: React.ReactNode;
  /** Shown above the error, e.g. "the story screen". */
  context?: string;
  /** Optional custom fallback. */
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // Deliberately logs only the message, never a component stack that
    // could embed rendered health data.
    console.warn(`[ErrorBoundary] Render failed: ${error.message}`);
  }

  /** Lets a parent clear the error, e.g. after navigating away. */
  reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    const where = this.props.context ?? 'this screen';

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            {`There was a problem displaying ${where}. Your logged data is safe — nothing has been changed or deleted.`}
          </Text>
          <Text style={styles.body}>
            Go back and try again. If it keeps happening, the other parts
            of the app will still work normally.
          </Text>
          <Text style={styles.detail}>{error.message}</Text>
        </ScrollView>
      </View>
    );
  }
}

// Plain StyleSheet rather than useTheme: a class component cannot call
// hooks, and a theme failure must not be able to break the very thing
// that renders when something has already failed.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4FB',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1B22',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4A4753',
  },
  detail: {
    fontSize: 12,
    lineHeight: 18,
    color: '#8A8694',
    marginTop: 8,
  },
});
