import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { pullAndMergeAllFromCloud } from '../services/syncOrchestrator';
import { useAuthStore } from '../store/authStore';
import { GOOGLE_WEB_CLIENT_ID } from '../services/firebaseConfig';
import { useTheme } from '../hooks/useTheme';

// Required once per app so the browser-based OAuth flow can close
// itself and hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

type Mode = 'signIn' | 'signUp';

/**
 * Sign-in screen for the optional "Back up & Sync" feature. Reached
 * only by choice from Profile — the rest of the app works fully
 * offline whether or not anyone ever opens this screen.
 */
export default function AuthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [syncing, setSyncing] = useState(false);

  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const signUpWithEmail = useAuthStore((state) => state.signUpWithEmail);
  const signInWithGoogleIdToken = useAuthStore((state) => state.signInWithGoogleIdToken);
  const isBusy = useAuthStore((state) => state.isBusy);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [request, response, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  headerTitle: {
    ...theme.typography.title,
  },
  card: {
    gap: theme.spacing.md,
  },
  intro: {
    ...theme.typography.bodySecondary,
  },
  field: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontFamily: theme.fonts.semibold,
  },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    minHeight: 48,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  switchModeText: {
    ...theme.typography.bodySecondary,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  privacyNote: {
    ...theme.typography.caption,
    textAlign: 'center',
  },
}),
    [theme],
  );

  const handleSuccess = async () => {
    setSyncing(true);
    await pullAndMergeAllFromCloud();
    setSyncing(false);
    router.back();
  };

  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      void (async () => {
        const ok = await signInWithGoogleIdToken(response.params.id_token);
        if (ok) await handleSuccess();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const canSubmit = email.trim() !== '' && password.length >= 6;

  const handleEmailSubmit = async () => {
    if (!canSubmit) return;
    const action = mode === 'signIn' ? signInWithEmail : signUpWithEmail;
    const ok = await action(email.trim(), password);
    if (ok) await handleSuccess();
  };

  const busy = isBusy || syncing;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Back up & Sync</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.intro}>
          {mode === 'signIn'
            ? 'Sign in to back up your data and access it on another device.'
            : 'Create an account to back up your data across devices.'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              clearError();
            }}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.inkMuted}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel="Email"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            value={password}
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            passwordRules="minlength: 8;"
            onChangeText={(text) => {
              setPassword(text);
              clearError();
            }}
            placeholder="At least 6 characters"
            placeholderTextColor={theme.colors.inkMuted}
            style={styles.input}
            secureTextEntry
            accessibilityLabel="Password"
          />
        </View>

        {error && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}

        <Button
          label={mode === 'signIn' ? 'Sign in' : 'Create account'}
          onPress={handleEmailSubmit}
          disabled={!canSubmit}
          loading={busy}
        />

        <Pressable
          onPress={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            clearError();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.switchModeText}>
            {mode === 'signIn'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Button
          label="Continue with Google"
          variant="secondary"
          onPress={() => promptGoogleSignIn()}
          disabled={!request || busy}
        />
      </Card>

      <Text style={styles.privacyNote}>
        Your symptom data stays on this device either way — signing in only
        adds an encrypted backup you can restore from.
      </Text>
    </Screen>
  );
}
