import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAppTheme } from '../theme/ThemeProvider';

interface DriverProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  trip: any; // Trip object with driver details
}

export default function DriverProfileSheet({ visible, onClose, trip }: DriverProfileSheetProps) {
  const { colors } = useAppTheme();
  const [ridesCount, setRidesCount] = useState(0);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && trip?.driverUid) {
      fetchDriverStats();
    }
  }, [visible, trip?.driverUid]);

  const fetchDriverStats = async () => {
    try {
      setLoading(true);
      const driverDoc = await firestore()
        .collection('drivers')
        .doc(trip.driverUid)
        .get();

      if (driverDoc.exists()) {
        const data = driverDoc.data();
        setRidesCount(data?.spinPoints || 0);
        // You can add rating calculation here if you have ratings collection
        // For now, we'll leave it as null
      }
    } catch (error) {
      console.error('Error fetching driver stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const getColorFromName = (colorName: string): string => {
    const normalized = colorName.trim().toLowerCase();
    const colorMap: { [key: string]: string } = {
      'vit': '#FFFFFF',
      'white': '#FFFFFF',
      'svart': '#000000',
      'black': '#000000',
      'blå': '#3B82F6',
      'bla': '#3B82F6',
      'blue': '#3B82F6',
      'röd': '#EF4444',
      'rod': '#EF4444',
      'red': '#EF4444',
      'grön': '#10B981',
      'gron': '#10B981',
      'green': '#10B981',
      'gul': '#F59E0B',
      'yellow': '#F59E0B',
      'orange': '#F97316',
      'lila': '#A855F7',
      'purple': '#A855F7',
      'grå': '#6B7280',
      'gra': '#6B7280',
      'gray': '#6B7280',
      'grey': '#6B7280',
      'silver': '#9CA3AF',
      'brun': '#92400E',
      'brown': '#92400E',
    };
    return colorMap[normalized] || '#9CA3AF';
  };

  if (!trip) return null;

  const carDetails = trip.carDetails || {};
  const driverName = trip.driverName || 'Förare';
  const driverImageUrl = trip.driverImageUrl || '';
  const registration = (carDetails.registration || '').toString().toUpperCase();
  const brand = carDetails.brand || '';
  const model = carDetails.model || '';
  const color = carDetails.color || '';
  const rideType = trip.selectedRideType || trip.rideType || '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Förare</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            {/* Driver Avatar & Name */}
            <View style={styles.driverInfo}>
              {driverImageUrl ? (
                <Image
                  source={{ uri: driverImageUrl }}
                  style={[styles.avatar, { borderColor: colors.accent }]}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: `${colors.accent}20` }]}>
                  <Text style={[styles.avatarInitials, { color: colors.accent }]}>
                    {getInitials(driverName)}
                  </Text>
                </View>
              )}

              <View style={styles.driverDetails}>
                <Text style={[styles.driverName, { color: colors.textPrimary }]}>
                  {driverName}
                </Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={16} color="#F59E0B" />
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <Text style={[styles.ratingText, { color: colors.textMuted }]}>
                      {ratingAvg !== null
                        ? `${ratingAvg.toFixed(1)} • ${ridesCount} resor`
                        : `– • ${ridesCount} resor`}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Car Details Card */}
            <View style={[styles.carCard, { backgroundColor: colors.surfaceAlt }]}>
              {/* License Plate & Ride Type */}
              <View style={styles.topRow}>
                <LicensePlateView registration={registration} />
                {rideType && (
                  <View style={[styles.rideTypeChip, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.rideTypeText, { color: colors.textPrimary }]}>
                      {rideType}
                    </Text>
                  </View>
                )}
              </View>

              {/* Brand, Model & Color */}
              <View style={styles.carInfoRow}>
                <View style={styles.carMainInfo}>
                  <Text style={[styles.carBrandModel, { color: colors.textPrimary }]}>
                    {brand} {model}
                  </Text>
                  <View style={styles.colorRow}>
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: getColorFromName(color) },
                        color.toLowerCase().includes('vit') || color.toLowerCase().includes('white')
                          ? { borderWidth: 1, borderColor: colors.border }
                          : {},
                      ]}
                    />
                    <Text style={[styles.colorText, { color: colors.textMuted }]}>
                      {color}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// License Plate Component (Swedish EU-style)
function LicensePlateView({ registration }: { registration: string }) {
  const cleaned = registration.replace(/[^A-Z0-9]/g, '');
  const displayText = cleaned.length === 6
    ? `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`
    : cleaned || 'ABC123';

  return (
    <View style={plateStyles.container}>
      <View style={plateStyles.euStrip}>
        <View style={plateStyles.starsContainer}>
          {[...Array(12)].map((_, i) => {
            const angle = (i / 12) * 2 * Math.PI;
            const radius = 8;
            const x = 15 + Math.cos(angle) * radius;
            const y = 15 + Math.sin(angle) * radius;
            return (
              <View
                key={i}
                style={[
                  plateStyles.star,
                  {
                    left: x - 2,
                    top: y - 2,
                  },
                ]}
              />
            );
          })}
        </View>
        <Text style={plateStyles.countryCode}>S</Text>
      </View>
      <View style={plateStyles.plateNumber}>
        <Text style={plateStyles.plateText}>{displayText}</Text>
      </View>
    </View>
  );
}

const plateStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FDE047',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000',
    height: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  euStrip: {
    width: 28,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  starsContainer: {
    position: 'absolute',
    width: 30,
    height: 30,
    top: 4,
  },
  star: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#FDE047',
    transform: [{ rotate: '45deg' }],
  },
  countryCode: {
    position: 'absolute',
    bottom: 2,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFF',
  },
  plateNumber: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  plateText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#000',
    letterSpacing: 1,
  },
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    padding: 20,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  driverDetails: {
    marginLeft: 16,
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 14,
  },
  carCard: {
    borderRadius: 12,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rideTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  carInfoRow: {
    marginTop: 8,
  },
  carMainInfo: {
    gap: 8,
  },
  carBrandModel: {
    fontSize: 18,
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  colorText: {
    fontSize: 14,
  },
});
