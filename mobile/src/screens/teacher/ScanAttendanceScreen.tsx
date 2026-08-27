import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, Vibration, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../api/client';
import {
  getTeacherSelfServeConfig,
  scanTeacherAttendance,
  type ScanCoords,
  type ScanResult,
} from '../../api/teacherAttendance';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { ATTENDANCE_STATUS_META } from '../../constants';
import type { TeacherDashboardStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<TeacherDashboardStackParamList, 'ScanAttendance'>;

type Phase = 'loading' | 'scanning' | 'submitting' | 'done' | 'error';

const TONE_COLORS = {
  success: { bg: colors.successTint, fg: colors.success },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  warning: { bg: colors.warningTint, fg: colors.warning },
  info: { bg: colors.infoTint, fg: colors.info },
} as const;

class LocationError extends Error {}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new LocationError(message)), ms)),
  ]);
}

async function acquireCoords(): Promise<ScanCoords> {
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new LocationError('Turn on location services on this phone, then try again.');
  }
  const pos = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    12000,
    'Couldn’t get your location. Move near a window or step outside, then try again.',
  );
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? undefined,
    mocked: pos.mocked ?? undefined,
  };
}

export function ScanAttendanceScreen({ navigation }: Props): React.JSX.Element {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  const [phase, setPhase] = useState<Phase>('loading');
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  // Load whether the geofence is on — decides if we also need location.
  useEffect(() => {
    let cancelled = false;
    getTeacherSelfServeConfig()
      .then((cfg) => {
        if (cancelled) return;
        setGeofenceEnabled(cfg.geofence.enabled);
        setPhase('scanning');
      })
      .catch(() => {
        // Fall back to "no geofence" — the server still enforces it and will
        // return a clear message if a fix is actually required.
        if (!cancelled) setPhase('scanning');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ask for the permissions we'll need, once, up front.
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      void requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    if (
      geofenceEnabled &&
      locationPermission &&
      !locationPermission.granted &&
      locationPermission.canAskAgain
    ) {
      void requestLocationPermission();
    }
  }, [geofenceEnabled, locationPermission, requestLocationPermission]);

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setPhase('submitting');
      setError(null);

      let coords: ScanCoords | undefined;
      if (geofenceEnabled) {
        try {
          coords = await acquireCoords();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not read your location.');
          setPhase('error');
          return;
        }
      }

      try {
        const res = await scanTeacherAttendance(data, coords);
        Vibration.vibrate(40);
        setResult(res);
        setPhase('done');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not check you in. Try again.');
        setPhase('error');
      }
    },
    [geofenceEnabled],
  );

  const scanAgain = () => {
    lockRef.current = false;
    setError(null);
    setResult(null);
    setPhase('scanning');
  };

  // --- loading config ---------------------------------------------------
  if (phase === 'loading' || !cameraPermission) {
    return (
      <Screen scroll={false}>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // --- permission gates ----------------------------------------------
  if (!cameraPermission.granted) {
    return (
      <PermissionGate
        icon="camera-outline"
        title="Camera access needed"
        body="EDVANCE uses the camera to scan the check-in QR shown on the staff display. Nothing is recorded from the camera."
        canAskAgain={cameraPermission.canAskAgain}
        onRequest={() => void requestCameraPermission()}
        onBack={() => navigation.goBack()}
      />
    );
  }

  if (geofenceEnabled && locationPermission && !locationPermission.granted) {
    return (
      <PermissionGate
        icon="location-outline"
        title="Location access needed"
        body="Your school requires you to be on campus to check in, so the app needs your location while you scan."
        canAskAgain={locationPermission.canAskAgain}
        onRequest={() => void requestLocationPermission()}
        onBack={() => navigation.goBack()}
      />
    );
  }

  // --- result --------------------------------------------------------
  if (phase === 'done' && result) {
    const meta = ATTENDANCE_STATUS_META[result.status];
    const tone = TONE_COLORS[meta.tone];
    return (
      <Screen>
        <Card style={styles.resultCard}>
          <View style={[styles.resultIcon, { backgroundColor: tone.bg }]}>
            <Ionicons name="checkmark" size={36} color={tone.fg} />
          </View>
          <Text style={styles.resultTitle}>You&rsquo;re marked {meta.label.toLowerCase()}</Text>
          <Text style={styles.resultSub}>
            {result.alreadyMarked
              ? `You were already checked in today${
                  result.markedAt ? ` at ${formatTime(result.markedAt)}` : ''
                }.`
              : `Checked in at ${formatTime(result.markedAt)}.`}
          </Text>
          <Button label="Done" onPress={() => navigation.goBack()} />
        </Card>
      </Screen>
    );
  }

  if (phase === 'error') {
    return (
      <Screen>
        <Card style={styles.resultCard}>
          <View style={[styles.resultIcon, { backgroundColor: colors.dangerTint }]}>
            <Ionicons name="alert" size={36} color={colors.danger} />
          </View>
          <Text style={styles.resultTitle}>Couldn&rsquo;t check you in</Text>
          <Text style={styles.resultSub}>{error}</Text>
          <Button label="Scan again" onPress={scanAgain} />
          <Button label="Close" variant="secondary" onPress={() => navigation.goBack()} />
        </Card>
      </Screen>
    );
  }

  // --- live camera (scanning / submitting) --------------------------
  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={phase === 'scanning' ? handleBarcode : undefined}
      />
      <View style={styles.overlay}>
        <View style={styles.reticle} />
        <Text style={styles.hint}>
          {phase === 'submitting'
            ? geofenceEnabled
              ? 'Checking your location…'
              : 'Checking you in…'
            : 'Point at the QR on the staff display'}
        </Text>
        {phase === 'submitting' && (
          <ActivityIndicator color={colors.primaryContrast} style={styles.spinner} />
        )}
      </View>
    </View>
  );
}

function PermissionGate({
  icon,
  title,
  body,
  canAskAgain,
  onRequest,
  onBack,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  canAskAgain: boolean;
  onRequest: () => void;
  onBack: () => void;
}): React.JSX.Element {
  return (
    <Screen>
      <Card style={styles.gateCard}>
        <Ionicons name={icon} size={40} color={colors.primary} />
        <Text style={styles.gateTitle}>{title}</Text>
        <Text style={styles.gateBody}>{body}</Text>
        {canAskAgain ? (
          <Button label="Allow" onPress={onRequest} />
        ) : (
          <Button label="Open settings" onPress={() => void Linking.openSettings()} />
        )}
        <Button label="Go back" variant="secondary" onPress={onBack} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  gateCard: { gap: spacing.md, alignItems: 'center' },
  gateTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.text, textAlign: 'center' },
  gateBody: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  resultCard: { gap: spacing.md, alignItems: 'center' },
  resultIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text, textAlign: 'center' },
  resultSub: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  cameraWrap: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  reticle: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: colors.primaryContrast,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  hint: {
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
    color: colors.primaryContrast,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  spinner: { marginTop: spacing.xs },
});
