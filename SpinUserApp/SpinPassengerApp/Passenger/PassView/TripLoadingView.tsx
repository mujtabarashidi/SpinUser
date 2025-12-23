import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { HomeContext } from '../context/HomeContext';

type TripRequestStatus =
  | 'idle'
  | 'creating'
  | 'searching'
  | 'driverAssigned'
  | 'noDrivers'
  | 'cancelled'
  | 'error'
  | string;

interface TripLoadingViewProps {
  visible: boolean;
  onCancel: () => void;
  isLoading?: boolean;
  status?: TripRequestStatus;
}

export default function TripLoadingView({ visible, onCancel, isLoading, status }: TripLoadingViewProps) {
  const homeContext = useContext(HomeContext);

  const handleDragStateChange = (event: PanGestureHandlerGestureEvent | any) => {
    const { translationY, state } = event.nativeEvent || {};
    if (state === State.END) {
      if (translationY < -25) {
        setShowCancelButton(true);
      } else if (translationY > 25) {
        setShowCancelButton(false);
      }
    }
  };

  // Animation states
  const [dotStep, setDotStep] = useState(0);
  const [showCancelButton, setShowCancelButton] = useState(false);
  const pulseAnimation = new Animated.Value(1);
  const rippleAnimation = new Animated.Value(0);
  const dragAnimation = new Animated.Value(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Dot animation timer
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setDotStep((prev) => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, [visible]);

  // Pulse animation
  useEffect(() => {
    if (!visible) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.08,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1.0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    const rippleLoop = Animated.loop(
      Animated.timing(rippleAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    rippleLoop.start();
    const progressLoop = Animated.loop(
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    progressAnim.setValue(0);
    progressLoop.start();

    return () => {
      pulseLoop.stop();
      rippleLoop.stop();
      progressAnim.stopAnimation();
    };
  }, [visible]);

  const effectiveStatus: TripRequestStatus = status === 'requested'
    ? 'searching'
    : status === 'accepted'
      ? 'driverAssigned'
      : status || (isLoading ? 'creating' : 'searching');
  const showDots = effectiveStatus === 'creating' || effectiveStatus === 'searching';
  const dotsText = showDots ? '.'.repeat(dotStep) : '';

  const statusText = (() => {
    switch (effectiveStatus) {
      case 'creating':
        return 'Skickar din förfrågan';
      case 'searching':
        return 'Söker efter en ledig förare';
      case 'driverAssigned':
        return 'Förare har accepterat din resa'
      case 'noDrivers':
        return 'Inga förare tillgängliga just nu';
      case 'cancelled':
        return 'Resan avbröts';
      case 'error':
        return 'Kunde inte boka resan';
      default:
        return 'Skickar din förfrågan';
    }
  })();

  const statusShort = (() => {
    switch (effectiveStatus) {
      case 'creating':
        return 'Skickar…';
      case 'searching':
        return 'Söker förare';
      case 'driverAssigned':
        return 'Förare hittad';
      case 'noDrivers':
        return 'Inga förare';
      case 'cancelled':
        return 'Avbruten';
      case 'error':
        return 'Fel';
      default:
        return 'Skickar…';
    }
  })();

  const handleDragGesture = (event: PanGestureHandlerGestureEvent) => {
    const { translationY } = event.nativeEvent;

    if (event.nativeEvent.state === State.END) {
      if (translationY < -25) {
        setShowCancelButton(true);
      } else if (translationY > 25) {
        setShowCancelButton(false);
      }
    }
  };

  const handleCancelTrip = () => {
    Alert.alert(
      'Avbryt sökning?',
      'Är du säker på att du vill avbryta sökningen efter förare?',
      [
        {
          text: 'Nej',
          style: 'cancel',
        },
        {
          text: 'Ja',
          style: 'destructive',
          onPress: () => {
            // Cancel trip logic here
            console.log('🚫 Cancelling trip search...');
            onCancel();
          },
        },
      ]
    );
  };

  if (!visible) {
    console.log('⚠️ [TripLoadingView] Not visible - returning null');
    return null;
  }

  console.log('✅ [TripLoadingView] Rendering with status:', effectiveStatus, 'isLoading:', isLoading);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
      {/* Drag Indicator */}
      <PanGestureHandler onGestureEvent={handleDragGesture} onHandlerStateChange={handleDragStateChange}>
        <View style={styles.dragContainer}>
          <View style={styles.dragIndicator} />
          <Icon
            name={showCancelButton ? 'chevron-down' : 'chevron-up'}
            size={14}
            color="#8E8E93"
            style={[styles.dragIcon, {
              transform: [{ translateY: showCancelButton ? 14 : -14 }]
            }]}
          />
        </View>
      </PanGestureHandler>

      {/* Content */}
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.titleText}>Tack för att du väljer Spin!</Text>
            <View style={styles.statusChip}>
              <View style={styles.statusDot} />
              <Text style={styles.statusChipText}>{statusShort}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleCancelTrip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancelTextInline}>Avbryt</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitleText}>{statusText}{dotsText}</Text>

        <View style={styles.divider} />

        {/* Loading Animation */}
        <View style={styles.animationContainer}>
          {/* Outer ripple circle */}
          <Animated.View
            style={[
              styles.rippleCircle,
              {
                transform: [
                  {
                    scale: rippleAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.4],
                    }),
                  },
                ],
                opacity: rippleAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
              },
            ]}
          />

          {/* Main circle */}
          <View style={styles.mainCircle}>
            <Animated.View
              style={[
                styles.carIconContainer,
                {
                  transform: [{ scale: pulseAnimation }],
                },
              ]}
            >
              <Icon name="car-sport-outline" size={36} color="#000" />
            </Animated.View>
          </View>

          {/* Loading spinner */}
          <View style={styles.spinnerContainer}>
            <Animated.View
              style={[
                styles.spinner,
                {
                  transform: [
                    {
                      rotate: rippleAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.spinnerDot} />
              <View style={[styles.spinnerDot, { transform: [{ rotate: '90deg' }] }]} />
              <View style={[styles.spinnerDot, { transform: [{ rotate: '180deg' }] }]} />
              <View style={[styles.spinnerDot, { transform: [{ rotate: '270deg' }] }]} />
            </Animated.View>
          </View>
        </View>

        {/* Cancel Button */}
        {showCancelButton && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelTrip}>
            <Icon name="close-circle" size={20} color="#FF3B30" />
            <Text style={styles.cancelButtonText}>Avbryt sökning</Text>
          </TouchableOpacity>
        )}

        {/* Indeterminate progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressBar, {
              transform: [{ translateX: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 220] }) }]
            }]}
          />
        </View>
        <Text style={styles.hintText}>Det här tar oftast 10–30 sekunder.</Text>
      </View>
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  dragContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#C7C7CC',
    borderRadius: 2.5,
  },
  dragIcon: {
    position: 'absolute',
    marginTop: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    display: 'none',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  headerLeft: { flexShrink: 1 },
  statusChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginTop: 6, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
  statusChipText: { fontSize: 12, fontWeight: '700', color: '#0f766e' },
  cancelTextInline: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: 8,
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginVertical: 12,
  },
  rippleCircle: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  mainCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 8,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerContainer: {
    position: 'absolute',
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  spinnerDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#34C759',
    borderRadius: 2,
    top: 0,
    left: 48,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', overflow: 'hidden', marginTop: 8 },
  progressBar: { width: 100, height: 4, borderRadius: 2, backgroundColor: '#10B981' },
  hintText: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 6 },
});
