import auth from '@react-native-firebase/auth';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TripHistoryViewModel from '../../Driver/Manager/TripHistoryViewModel';
import PassengerTripDetailView from './PassengerTripDetailView';

// --- Types ---
interface TripDoc {
  id: string;
  riderId: string;
  driverId?: string;
  pickupLocationAddress: string;
  dropoffLocationAddress: string;
  tripCost: number; // SEK
  completedAt: any; // Firestore Timestamp or ISO string
  actualDistanceInKm?: number; // optional actuals
  distanceTodropoffLocation?: number; // fallback
  actualTravelTimeInSeconds?: number; // optional actuals
  travelTimeTodropoffLocation?: number; // fallback (minutes)

  // extra optional metadata for detail view
  driverName?: string;
  driverPhoneNumber?: string;
  paymentMethod?: string;
  selectedRideType?: string;
  status?: string;
  carDetails?: { brand?: string; model?: string; registration?: string; color?: string };
  createdAt?: any;
  startedAt?: any;
  canceledAt?: any;
}

const PAGE_SIZE = 10;

export default function PassengerTripHistoryView() {
  const uid = auth().currentUser?.uid;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trips, setTrips] = useState<TripDoc[]>([]);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripDoc | null>(null);
  const vm = useMemo(() => new TripHistoryViewModel(), []);

  // Formatters (Swedish locale)
  const formatCurrency = useMemo(
    () => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );
  const formatDateTime = useCallback((d: Date) => {
    try {
      const date = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
      const time = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' }).format(d);
      return `${date} ${time}`;
    } catch {
      return 'Okänd tid';
    }
  }, []);

  const toJSDate = (val: any): Date | null => {
    try {
      // Firestore Timestamp
      if (val?.toDate) {
        const d = val.toDate();
        return isNaN(d.getTime()) ? null : d;
      }
      // Firestore server timestamp fields might be { seconds, nanoseconds }
      if (val && typeof val.seconds === 'number') {
        const d = new Date(val.seconds * 1000);
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof val === 'number') {
        // could be millis or seconds; if seconds, turn into millis when in 10-digit range
        const ms = val < 2_000_000_000 ? val * 1000 : val;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    } catch {
      return null;
    }
  };

  const computeDistanceKm = (t: TripDoc) => {
    const km = t.actualDistanceInKm ?? t.distanceTodropoffLocation ?? 0;
    return Number.isFinite(km) ? km : 0;
  };
  const computeTimeMin = (t: TripDoc) => {
    if (typeof t.actualTravelTimeInSeconds === 'number') return Math.round(t.actualTravelTimeInSeconds / 60);
    if (typeof t.travelTimeTodropoffLocation === 'number') return Math.round(t.travelTimeTodropoffLocation);
    return 0;
  };

  const fetchInitial = useCallback(async () => {
    if (!uid) return;
    setIsLoading(true);
    try {
      vm.lastDocument = null; // reset pagination
      const docs = (await vm.fetchPassengerTripHistory(uid)) as TripDoc[];
      setTrips(docs);
      setCanLoadMore(docs.length === PAGE_SIZE);
    } catch (e) {
      console.warn('Failed to load trips', e);
      setTrips([]);
      setCanLoadMore(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [uid, vm]);

  const fetchMore = useCallback(async () => {
    if (!uid) return;
    try {
      const docs = (await vm.fetchMoreTripHistory(uid, false)) as TripDoc[];
      setTrips((prev) => [...prev, ...docs]);
      setCanLoadMore(docs.length === PAGE_SIZE);
    } catch (e) {
      console.warn('Failed to load more trips', e);
    }
  }, [uid, vm]);

  useEffect(() => {
    if (trips.length === 0) fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchInitial();
  }, [fetchInitial]);

  const onPressTrip = (t: TripDoc) => {
    setSelectedTrip(t);
    setDetailVisible(true);
  };

  const renderItem = ({ item }: { item: TripDoc }) => {
    const km = computeDistanceKm(item);
    const mins = computeTimeMin(item);
    const d = toJSDate(item.completedAt);
    const when = d ? formatDateTime(d) : '—';
    const idShort = item.id?.slice(-6) || item.id;
    return (
      <TouchableOpacity style={styles.row} onPress={() => onPressTrip(item)} activeOpacity={0.85}>
        <View style={styles.rowTop}>
          <Text style={styles.metaText}>{`${km.toFixed(2)} km / ${mins} min`}</Text>
          <View style={styles.rightCol}>
            <View style={styles.badge}><Text style={styles.badgeText}>Slutförd</Text></View>
            <Text style={styles.tripIdText}>ID: {idShort}</Text>
            <Text style={styles.priceText}>{formatCurrency.format(item.tripCost)}</Text>
          </View>
        </View>

        <View style={styles.whenRow}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
          <Text style={styles.timeText}>{when}</Text>
        </View>

        <Text style={styles.addrText}>{`Från: ${item.pickupLocationAddress}`}</Text>
        <Text style={styles.addrText}>{`Till: ${item.dropoffLocationAddress}`}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mina resor</Text>
        <TouchableOpacity onPress={onRefresh} accessibilityLabel="Uppdatera">
          <Ionicons name="reload" size={20} color="#111" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Hämtar resor…</Text>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="time-outline" size={48} color="#9ca3af" />
          <Text style={styles.emptyTitle}>Du har inga avslutade resor ännu.</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={trips}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            contentContainerStyle={styles.listContent}
          />

          {canLoadMore && (
            <TouchableOpacity style={styles.moreBtn} onPress={fetchMore} activeOpacity={0.85}>
              <Text style={styles.moreBtnText}>Visa fler resor</Text>
            </TouchableOpacity>
          )}

          {/* Detail modal */}
          <PassengerTripDetailView
            visible={detailVisible}
            onClose={() => setDetailVisible(false)}
            trip={selectedTrip}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111' },

  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 8, color: '#6b7280' },
  emptyTitle: { marginTop: 8, color: '#6b7280', fontWeight: '600' },

  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rightCol: { alignItems: 'flex-end' },
  metaText: { fontSize: 13, fontWeight: '700', color: '#111' },
  priceText: { fontSize: 16, fontWeight: '800', color: '#111' },
  tripIdText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  timeText: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addrText: { fontSize: 14, color: '#111', marginTop: 2 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  badge: { alignSelf: 'flex-end', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 2 },
  badgeText: { fontSize: 11, color: '#2e7d32', fontWeight: '700' },

  moreBtn: {
    margin: 16,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0A84FF',
  },
  moreBtnText: { color: '#fff', fontWeight: '700' },
});