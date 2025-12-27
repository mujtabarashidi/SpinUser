import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export interface PassengerTripDetailProps {
    visible: boolean;
    onClose: () => void;
    trip: {
        id: string;
        pickupLocationAddress: string;
        dropoffLocationAddress: string;
        tripCost: number;
        completedAt: any;
        actualDistanceInKm?: number;
        distanceTodropoffLocation?: number;
        actualTravelTimeInSeconds?: number;
        travelTimeTodropoffLocation?: number;
        driverName?: string;
        driverPhoneNumber?: string;
        paymentMethod?: string;
        selectedRideType?: string;
        status?: string;
        carDetails?: { brand?: string; model?: string; registration?: string; color?: string };
        createdAt?: any;
        startedAt?: any;
        canceledAt?: any;
        driverRating?: number;
        driverComment?: string;
    } | null;
}

export default function PassengerTripDetailView({ visible, onClose, trip }: PassengerTripDetailProps) {
    // Theme colors (light theme used in passenger section)
    const colors = {
        background: '#fff',
        surface: '#f8fafc',
        surfaceAlt: '#f1f5f9',
        textPrimary: '#111827',
        textMuted: '#6b7280',
        textSecondary: '#4b5563',
        border: '#e5e7eb',
        accent: '#0A84FF',
        success: '#10b981',
    };

    function formatDate(ts: any) {
        if (!ts) return 'Okänt datum';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString('sv-SE');
    }

    const formatNumber = (value: any, decimals = 2): string => {
        const n = Number(value);
        if (Number.isFinite(n)) return n.toFixed(decimals);
        const s = String(value ?? '').trim();
        return s || '-';
    };

    const formatDistance = (raw: any): string => {
        if (typeof raw === 'number') {
            const decimals = raw >= 10 ? 1 : 2;
            return raw.toFixed(decimals);
        }
        return '-';
    };

    const distance = useMemo(() => {
        if (!trip) return '-';
        if (typeof trip.actualDistanceInKm === 'number' && trip.actualDistanceInKm > 0) {
            return formatDistance(trip.actualDistanceInKm);
        }
        if (typeof trip.distanceTodropoffLocation === 'number' && trip.distanceTodropoffLocation > 0) {
            // distanceTodropoffLocation är meter – konvertera till km
            return formatDistance(trip.distanceTodropoffLocation / 1000);
        }
        return '-';
    }, [trip]);

    const travelTime = useMemo(() => {
        if (!trip) return '-';
        if (typeof trip.actualTravelTimeInSeconds === 'number' && trip.actualTravelTimeInSeconds > 0) {
            return formatNumber(Math.round(trip.actualTravelTimeInSeconds / 60), 0);
        }
        if (typeof trip.travelTimeTodropoffLocation === 'number' && trip.travelTimeTodropoffLocation > 0) {
            return formatNumber(trip.travelTimeTodropoffLocation, 0);
        }
        return '-';
    }, [trip]);

    const fare = useMemo(() => (trip ? formatNumber(trip.tripCost) : '0'), [trip]);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Resedetaljer</Text>
                    <View style={{ width: 24 }} />
                </View>

                {trip ? (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Summary Card */}
                        <View style={[styles.summaryCard, { backgroundColor: colors.surfaceAlt }]}>
                            <View style={styles.summaryRow}>
                                <View>
                                    <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Distans</Text>
                                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{distance} km</Text>
                                </View>
                                <View>
                                    <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Tid</Text>
                                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{travelTime} min</Text>
                                </View>
                                <View>
                                    <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Pris</Text>
                                    <Text style={[styles.summaryValue, { color: colors.accent, fontWeight: 'bold' }]}>{fare} kr</Text>
                                </View>
                            </View>
                        </View>

                        {/* Trip Details */}
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Resedetaljer</Text>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceAlt }]}>
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Resa-ID</Text>
                                <Text style={[styles.value, { color: colors.textPrimary }]}>{trip.id}</Text>
                            </View>
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Status</Text>
                                <Text style={[styles.value, { color: colors.success }]}>Slutförd</Text>
                            </View>
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Datum</Text>
                                <Text style={[styles.value, { color: colors.textPrimary }]}>{formatDate(trip.completedAt)}</Text>
                            </View>
                        </View>

                        {/* Location Details */}
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Plats</Text>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceAlt }]}>
                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={20} color={colors.accent} />
                                <View style={styles.locationText}>
                                    <Text style={[styles.locationLabel, { color: colors.textMuted }]}>Från</Text>
                                    <Text style={[styles.locationValue, { color: colors.textPrimary }]}>{trip.pickupLocationAddress || '-'}</Text>
                                </View>
                            </View>
                            <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 12 }]} />
                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={20} color={colors.accent} />
                                <View style={styles.locationText}>
                                    <Text style={[styles.locationLabel, { color: colors.textMuted }]}>Till</Text>
                                    <Text style={[styles.locationValue, { color: colors.textPrimary }]}>{trip.dropoffLocationAddress || '-'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Driver Info */}
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Förare</Text>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceAlt }]}>
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Namn</Text>
                                <Text style={[styles.value, { color: colors.textPrimary }]}>{trip.driverName || '-'}</Text>
                            </View>
                            {trip.driverPhoneNumber && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <View style={styles.row}>
                                        <Text style={[styles.label, { color: colors.textMuted }]}>Telefon</Text>
                                        <Text style={[styles.value, { color: colors.textPrimary }]}>{trip.driverPhoneNumber}</Text>
                                    </View>
                                </>
                            )}
                            {trip.carDetails && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <View style={styles.row}>
                                        <Text style={[styles.label, { color: colors.textMuted }]}>Bil</Text>
                                        <Text style={[styles.value, { color: colors.textPrimary }]}>
                                            {`${trip.carDetails.brand || ''} ${trip.carDetails.model || ''}`.trim() || '-'}
                                        </Text>
                                    </View>
                                    {trip.carDetails.registration && (
                                        <>
                                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                            <View style={styles.row}>
                                                <Text style={[styles.label, { color: colors.textMuted }]}>Reg.nr</Text>
                                                <Text style={[styles.value, { color: colors.textPrimary }]}>{trip.carDetails.registration}</Text>
                                            </View>
                                        </>
                                    )}
                                    {trip.carDetails.color && (
                                        <>
                                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                            <View style={styles.row}>
                                                <Text style={[styles.label, { color: colors.textMuted }]}>Färg</Text>
                                                <Text style={[styles.value, { color: colors.textPrimary }]}>{trip.carDetails.color}</Text>
                                            </View>
                                        </>
                                    )}
                                </>
                            )}
                        </View>

                        {/* Payment Details */}
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Betalning</Text>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceAlt }]}>
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Totalt</Text>
                                <Text style={[styles.value, { color: colors.textPrimary, fontWeight: 'bold' }]}>{fare} kr</Text>
                            </View>
                            {trip.paymentMethod && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <View style={styles.row}>
                                        <Text style={[styles.label, { color: colors.textMuted }]}>Metod</Text>
                                        <Text style={[styles.value, { color: colors.textPrimary }]}>{trip.paymentMethod}</Text>
                                    </View>
                                </>
                            )}
                            {trip.selectedRideType && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <View style={styles.row}>
                                        <Text style={[styles.label, { color: colors.textMuted }]}>Typ</Text>
                                        <Text style={[styles.value, { color: colors.textPrimary }]}>{trip.selectedRideType}</Text>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* Driver Rating */}
                        {trip.driverRating && (
                            <>
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Förarens betyg</Text>
                                <View style={[styles.ratingCard, { backgroundColor: colors.surfaceAlt }]}>
                                    <View style={styles.starsRow}>
                                        {[...Array(5)].map((_, i) => (
                                            <Ionicons
                                                key={i}
                                                name={i < (trip.driverRating ?? 0) ? 'star' : 'star-outline'}
                                                size={20}
                                                color={colors.accent}
                                            />
                                        ))}
                                    </View>
                                    {trip.driverComment && (
                                        <Text style={[styles.ratingComment, { color: colors.textSecondary, marginTop: 8 }]}>
                                            "{trip.driverComment}"
                                        </Text>
                                    )}
                                </View>
                            </>
                        )}

                        <View style={{ height: 24 }} />
                    </ScrollView>
                ) : (
                    <View style={styles.center}>
                        <Text style={{ color: colors.textMuted }}>Ingen resa vald</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },

    // Summary Card
    summaryCard: {
        margin: 16,
        padding: 16,
        borderRadius: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '600',
    },

    // Info Card
    infoCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    label: {
        fontSize: 14,
    },
    value: {
        fontSize: 14,
        fontWeight: '500',
        maxWidth: '60%',
        textAlign: 'right',
    },
    divider: {
        height: 1,
        marginVertical: 8,
    },

    // Location
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    locationText: {
        flex: 1,
        marginLeft: 12,
    },
    locationLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    locationValue: {
        fontSize: 14,
        fontWeight: '500',
    },

    // Section Title
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginHorizontal: 16,
        marginTop: 20,
        marginBottom: 10,
    },

    // Rating Card
    ratingCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 4,
    },
    ratingComment: {
        fontSize: 13,
        fontStyle: 'italic',
        lineHeight: 18,
    },

    // Center
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});