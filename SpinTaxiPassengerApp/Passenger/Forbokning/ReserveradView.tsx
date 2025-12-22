/**
 * ReserveradView.tsx
 * 
 * Converted from Swift (ReserveradView.swift)
 * Displays passenger's prebookings/scheduled rides with cancellation support
 * 
 * Features:
 * - Real-time list of scheduled trips
 * - Status badges (Förbokad, Bekräftad, Avbokad, etc.)
 * - Long-press to cancel booking
 * - Driver info display when assigned
 * - Swedish date formatting
 * - Dark mode support
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReserveradVM, { Booking } from './ReserveradViewModel';

// Optional prop to inject navigation callback
interface ReserveradViewProps {
  onBack?: () => void;
  onBookingCountChange?: (count: number) => void;
}

// --- Helpers -------------------------------------------------------------
function toDate(d: Booking['date']): Date {
  if (d instanceof Date) return d;
  if (typeof d === 'number') return new Date(d);
  return new Date(d);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function stableId(b: Booking): string {
  if (b.id && b.id.length > 0) return b.id;
  const date = toDate(b.date);
  const ts = isNaN(date.getTime())
    ? hashString(`${b.pickupLocation}${b.dropOffLocation}${b.rideType}`)
    : date.getTime();
  return `${b.pickupLocation}|${b.dropOffLocation}|${b.rideType}|${ts}`;
}

function formatSvDate(d: Date): string {
  try {
    return d.toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' });
  } catch (_) {
    return d.toISOString();
  }
}

function formatDateOnly(d: Date): string {
  try {
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) {
    return d.toDateString();
  }
}
function formatTimeOnly(d: Date): string {
  try {
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Get status display info
 * Matches Swift: statusColor, statusText logic
 */
function statusMeta(status: string) {
  const s = status.toLowerCase();

  // Confirmed/Completed (green)
  if (s === 'accepted' || s === 'confirmed' || s === 'completed') {
    return {
      text: s === 'completed' ? 'Avslutad' : 'Bekräftad',
      fg: '#1f8b24',
      bg: 'rgba(31,139,36,0.15)'
    };
  }

  // Pending/Scheduled (orange)
  if (s === 'scheduled' || s === 'pending' || s === 'dispatching') {
    let text = 'Avvaktar förare';
    if (s === 'scheduled') text = 'Förbokad';
    if (s === 'dispatching') text = 'Söker förare';
    return { text, fg: '#c57c00', bg: 'rgba(197,124,0,0.15)' };
  }

  // Cancelled/No drivers (red)
  if (s === 'cancelled' || s === 'canceled' || s === 'nodriversfound') {
    const text = s === 'nodriversfound' ? 'Ingen förare' : 'Avbokad';
    return { text, fg: '#c0392b', bg: 'rgba(192,57,43,0.15)' };
  }

  // Default (gray)
  return {
    text: status.charAt(0).toUpperCase() + status.slice(1),
    fg: '#6b7280',
    bg: 'rgba(107,114,128,0.15)'
  };
}

function StatusCapsule({ status }: { status: string }) {
  const { text, fg, bg } = statusMeta(status);
  return (
    <View style={[styles.capsule, { backgroundColor: bg }]}>
      <View style={[styles.capsuleDot, { backgroundColor: fg }]} />
      <Text style={[styles.capsuleText, { color: fg }]}>{text}</Text>
    </View>
  );
}

// --- Main Component ------------------------------------------------------
export default function ReserveradView({ onBack, onBookingCountChange }: ReserveradViewProps) {
  const isDark = useColorScheme() === 'dark';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [vm] = useState(() => new ReserveradVM());

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const unsub = vm.subscribe(
      (list) => {
        if (mounted) {
          setBookings(list);
          setLoading(false);
          // Notifiera om antalet bokningar uppdaterades
          onBookingCountChange?.(list.length);
        }
      },
      (error) => {
        if (mounted) {
          console.error('ReserveradView error:', error);
          setBookings([]);
          setLoading(false);
          onBookingCountChange?.(0);
        }
      }
    );

    return () => {
      mounted = false;
      unsub();
      vm.dispose();
    };
  }, [vm]);

  /**
   * Show banner if any booking has status "scheduled"
   * Matches Swift: showScheduledBanner computed property
   */
  const showScheduledBanner = useMemo(
    () => bookings.some(b => (b.status || '').toLowerCase() === 'scheduled'),
    [bookings]
  );

  /**
   * Handle booking cancellation
   * Matches Swift: cancelBooking(booking:)
   */
  const handleCancelBooking = (booking: Booking) => {
    Alert.alert(
      'Avboka resa?',
      `Är du säker på att du vill avboka resan från ${booking.pickupLocation} till ${booking.dropOffLocation}?`,
      [
        { text: 'Behåll', style: 'cancel' },
        {
          text: 'Avboka',
          style: 'destructive',
          onPress: async () => {
            const success = await vm.cancelBooking(booking);
            if (success) {
              // Success message (optional)
              Alert.alert('Avbokad', 'Din resa har avbokats.');
            } else {
              // Error message
              Alert.alert('Fel', 'Kunde inte avboka resan. Försök igen.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? '#0b0b0b' : '#ffffff' }]}>
      <View style={styles.container}>
        {/* Header (compact with back + count badge) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            disabled={!onBack}
            style={styles.backCircle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={isDark ? '#ffffff' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.titleCompact, { color: isDark ? '#ffffff' : '#111827' }]}>Reserverad</Text>
          <View style={styles.countBadgeWrap}>
            <View style={[styles.countBadgeCircle, { backgroundColor: withOpacity('#0a84ff', 0.15) }]}>
              <Text style={styles.countBadgeText}>{bookings.length}</Text>
            </View>
          </View>
        </View>

        {/* Scheduled banner (dynamic like SwiftUI) */}
        {(() => {
          const b = bookings.find(x => {
            const s = (x.status || '').toLowerCase();
            return ['scheduled', 'pending', 'dispatching', 'confirm', 'confirmed', 'accepted'].includes(s);
          });
          if (!b) return null;
          const s = (b.status || '').toLowerCase();
          const waiting = ['scheduled', 'pending', 'dispatching'].includes(s);
          const confirmed = ['confirm', 'confirmed', 'accepted'].includes(s);
          const bg = waiting ? withOpacity('#c57c00', 0.12) : withOpacity('#1f8b24', 0.12);
          const ring = waiting ? withOpacity('#c57c00', 0.2) : withOpacity('#1f8b24', 0.2);
          const icon = waiting ? 'time' : 'checkmark-circle';
          const iconColor = waiting ? '#c57c00' : '#1f8b24';
          const title = waiting ? 'Väntar på förarens svar' : 'Din resa är bekräftad';
          const subtitle = confirmed && b.driverName ? `av ${b.driverName}` : undefined;
          return (
            <View style={[styles.banner, { backgroundColor: bg }]}>
              {confirmed && b.driverImageUrl ? (
                <Image source={{ uri: b.driverImageUrl }} style={styles.bannerAvatar} />
              ) : (
                <View style={[styles.bannerIconCircle, { backgroundColor: ring }]}>
                  <Ionicons name={icon as any} size={20} color={iconColor} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerText, { color: iconColor }]}>{title}</Text>
                {subtitle ? (
                  <Text style={styles.bannerSubtext}>{subtitle}</Text>
                ) : null}
              </View>
            </View>
          );
        })()}

        {/* Loading state */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#0a84ff'} />
            <Text style={[styles.loadingText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Laddar dina resor...
            </Text>
          </View>
        ) : bookings.length === 0 ? (
          // Empty state - matches Swift emptyView
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={isDark ? '#4b5563' : '#d1d5db'} />
            <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Ingen reserverad resa än.
            </Text>
            <Text style={[styles.emptySubtext, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
              Dina förbokade resor visas här.
            </Text>
          </View>
        ) : (
          // Booking list
          <FlatList
            data={bookings}
            keyExtractor={(item) => stableId(item)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={() => handleCancelBooking(item)}
              >
                <BookingCard
                  booking={item}
                  isDark={isDark}
                  onCancel={() => handleCancelBooking(item)}
                />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// --- Subviews ------------------------------------------------------------

/**
 * Icon row for booking details
 * Matches Swift: HStack with Image and Text pattern
 */
function IconRow({
  icon,
  tint,
  text,
  isDark
}: {
  icon: string;
  tint: string;
  text: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.iconRow}>
      <View style={[styles.iconCircle, { backgroundColor: withOpacity(tint, 0.15) }]}>
        <Ionicons name={icon as any} size={16} color={tint} />
      </View>
      <Text style={[styles.iconRowText, { color: isDark ? '#e5e7eb' : '#111827' }]}>{text}</Text>
    </View>
  );
}

/**
 * Booking card component
 * Matches Swift: VStack with booking details
 */
function BookingCard({ booking, isDark, onCancel }: { booking: Booking; isDark: boolean; onCancel?: () => void }) {
  const date = toDate(booking.date as any);
  const { text, fg, bg } = statusMeta(booking.status);

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: isDark ? '#161a21' : '#f7f8fa',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      }
    ]}>
      {/* Top section - Status + date/time (SwiftUI mirror) */}
      <View style={styles.topRow}>
        <StatusCapsule status={booking.status} />
        <View style={styles.topRight}>
          <Text style={[styles.dateOnly, { color: isDark ? '#e5e7eb' : '#111827' }]}>
            {formatDateOnly(date)}
          </Text>
          <View style={styles.timeRow}>
            <Ionicons name="time" size={16} color="#1f8b24" />
            <Text style={[styles.timeOnly, { color: isDark ? '#e5e7eb' : '#111827' }]}>
              {formatTimeOnly(date)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.sectionDivider} />

      {/* Booking details */}
      <IconRow
        icon="location"
        tint="#2563eb"
        text={`Från: ${booking.pickupLocation}`}
        isDark={isDark}
      />
      <IconRow
        icon="navigate"
        tint="#ef4444"
        text={`Till: ${booking.dropOffLocation}`}
        isDark={isDark}
      />
      <IconRow
        icon="car"
        tint="#6b7280"
        text={`Bilstyp: ${booking.rideType}`}
        isDark={isDark}
      />
      <IconRow
        icon="calendar"
        tint="#10b981"
        text={`Datum: ${formatDateOnly(date)}`}
        isDark={isDark}
      />

      {/* Driver info (if assigned) - matches Swift conditional views */}
      {booking.driverName ? (
        <View style={styles.driverRow}>
          {booking.driverImageUrl ? (
            <Image
              source={{ uri: booking.driverImageUrl }}
              style={styles.driverImage}
            />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: withOpacity('#10b981', 0.15) }]}>
              <Ionicons name="person" size={16} color="#10b981" />
            </View>
          )}
          <Text style={[styles.iconRowText, { color: isDark ? '#e5e7eb' : '#111827' }]}>
            Förare: {booking.driverName}
          </Text>
        </View>
      ) : null}

      {/* Driver phone - only show if driver is actually assigned (status is not scheduled) */}
      {booking.driverPhoneNumber && booking.status?.toLowerCase() !== 'scheduled' ? (
        <TouchableOpacity
          onPress={() => {
            const phone = booking.driverPhoneNumber;
            if (phone) {
              const url = `tel:${phone}`;
              // You can add navigation here if needed
              console.log('Call driver:', phone);
            }
          }}
        >
          <IconRow
            icon="call"
            tint="#06b6d4"
            text={`Tel: ${booking.driverPhoneNumber}`}
            isDark={isDark}
          />
        </TouchableOpacity>
      ) : null}

      {booking.driverVehicle ? (
        <IconRow
          icon="speedometer"
          tint="#14b8a6"
          text={`Fordon: ${booking.driverVehicle}`}
          isDark={isDark}
        />
      ) : null}

      {/* Trip cost (if available) */}
      {booking.tripCost !== undefined && booking.tripCost > 0 ? (
        <IconRow
          icon="cash"
          tint="#f59e0b"
          text={`Pris: ${booking.tripCost} kr`}
          isDark={isDark}
        />
      ) : null}

      {/* Status badge */}
      <View style={styles.statusRow}>
        <Text style={[styles.statusLabel, { color: isDark ? '#e5e7eb' : '#111827' }]}>
          Status:
        </Text>
        <StatusCapsule status={booking.status} />
        <View style={{ flex: 1 }} />
      </View>

      {/* Discreet cancel button */}
      {onCancel && (
        <TouchableOpacity
          style={[styles.discreetCancelButton, { opacity: 0.6 }]}
          onPress={onCancel}
        >
          <Ionicons name="close-outline" size={14} color="#94a3b8" />
          <Text style={styles.discreetCancelText}>Avboka resa</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function withOpacity(hex: string, opacity: number): string {
  // Accepts #rrggbb or rgb/rgba; for hex we compute rgba
  if (hex.startsWith('#')) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return hex; // assume already rgba()
}

// --- Styles --------------------------------------------------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    // Shadow styling
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    // Elevation (Android)
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 13,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  driverImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#0a84ff',
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconRowText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    flexWrap: 'wrap',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusCapsule: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  discreetCancelButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  discreetCancelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  // Header compact elements
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,114,128,0.10)',
  },
  titleCompact: { fontSize: 22, fontWeight: '700' },
  countBadgeWrap: { alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 },
  countBadgeCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { fontSize: 16, fontWeight: 'bold', color: '#0a84ff' },

  // Status capsule + top row
  capsule: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  capsuleDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  capsuleText: { fontSize: 14, fontWeight: '600' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'column', alignItems: 'flex-end' },
  dateOnly: { fontSize: 13, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  timeOnly: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  sectionDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },

  // Banner avatar/icon extras
  bannerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 2, borderColor: '#1f8b24' },
  bannerIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  bannerSubtext: { fontSize: 12, color: '#6b7280', marginLeft: 8, marginTop: 2 },
});
