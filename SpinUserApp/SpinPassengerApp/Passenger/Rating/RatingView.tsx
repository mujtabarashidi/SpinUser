import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface Trip {
    id: string;
    driverName?: string;
    driverUid?: string;
    pickupLocationAddress: string;
    dropoffLocationAddress: string;
    tripCost: number;
}

interface RatingViewProps {
    visible: boolean;
    trip: Trip | null;
    onClose?: () => void;
    onRatingSubmitted?: () => void;
}

export default function RatingView({ visible, trip, onClose, onRatingSubmitted }: RatingViewProps) {
    const isDarkMode = useColorScheme() === 'dark';
    const [rating, setRating] = useState(5);
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Logga när visibility ändras
    React.useEffect(() => {
        if (visible) {
            console.log('🎬 [RatingView] Modal showing for trip:', trip?.id);
        } else {
            console.log('🔌 [RatingView] Modal hidden');
        }
    }, [visible, trip?.id]);

    const handleSubmitRating = async () => {
        if (!trip || rating === 0) {
            Alert.alert('Fel', 'Du måste välja ett betyg');
            return;
        }

        try {
            setIsLoading(true);
            const db = firestore();
            const currentUser = auth().currentUser;

            if (!currentUser) {
                Alert.alert('Fel', 'Du måste vara inloggad');
                return;
            }

            console.log('⭐ [RatingView] Submitting passenger rating...');
            console.log('📊 Rating:', rating, 'Feedback:', feedback);
            console.log('🔑 Trip:', trip.id, 'Driver:', trip.driverUid);

            // Uppdatera trip med betyg och feedback
            const ratingData = {
                driverRating: rating,
                driverFeedback: feedback,
                driverRatingSubmittedAt: firestore.FieldValue.serverTimestamp(),
                status: 'completed',
                riderId: currentUser.uid,
            };

            await db.collection('trips').doc(trip.id).update(ratingData);
            console.log('✅ [RatingView] Trip updated with rating');

            // Uppdatera förarens aggregerade betyg
            if (trip.driverUid) {
                await updateDriverAggregates(trip.driverUid);
            }

            Alert.alert('Tack!', 'Din betygsättning har sparats');
            handleClose();
            onRatingSubmitted?.();

        } catch (error) {
            console.error('❌ [RatingView] Error submitting rating:', error);
            Alert.alert('Fel', 'Kunde inte spara betyget. Försök igen senare.');
        } finally {
            setIsLoading(false);
        }
    };

    const updateDriverAggregates = async (driverUid: string) => {
        try {
            const db = firestore();
            const tripsSnapshot = await db
                .collection('trips')
                .where('driverUid', '==', driverUid)
                .get();

            let totalRating = 0;
            let ratingCount = 0;

            tripsSnapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.driverRating && typeof data.driverRating === 'number') {
                    totalRating += data.driverRating;
                    ratingCount++;
                }
            });

            const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

            console.log(`📈 [RatingView] Driver ${driverUid}: Avg=${averageRating.toFixed(2)}, Count=${ratingCount}`);

            // Uppdatera förarens profil med aggregerade betyg
            await db.collection('drivers').doc(driverUid).update({
                averageRating: Math.round(averageRating * 10) / 10,
                totalRatings: ratingCount,
            });

            console.log('✅ [RatingView] Driver aggregates updated');
        } catch (error) {
            console.error('❌ [RatingView] Error updating driver aggregates:', error);
            // Inte kritiskt om detta misslyckas
        }
    };

    const handleClose = () => {
        setRating(5);
        setFeedback('');
        onClose?.();
    };

    if (!visible) return null;

    // Renderera modal även om trip är null (för animation)
    if (!trip) {
        return (
            <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
                <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0B0B0F' : '#F5F6FA' }]}>
                    <View style={[styles.header, { backgroundColor: isDarkMode ? '#1c1c1e' : '#fff' }]}>
                        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                            Laddar...
                        </Text>
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#007AFF" />
                    </View>
                </SafeAreaView>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0B0B0F' : '#F5F6FA' }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: isDarkMode ? '#1c1c1e' : '#fff', borderBottomColor: isDarkMode ? '#333' : '#e5e7eb' }]}>
                    <TouchableOpacity onPress={handleClose}>
                        <Icon name="close" size={28} color={isDarkMode ? '#fff' : '#000'} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                        Betygsätt resan
                    </Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Success Message */}
                    <View style={styles.successSection}>
                        <Icon name="checkmark-circle" size={48} color="#10b981" />
                        <Text style={[styles.successTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                            Resan är slutförd!
                        </Text>
                        <Text style={[styles.successSubtitle, { color: isDarkMode ? '#8e8e93' : '#666' }]}>
                            Tack för att du reste med Spin.
                        </Text>
                    </View>

                    {/* Rating Info */}
                    <View style={styles.ratingInfoSection}>
                        <Text style={[styles.ratingInfoText, { color: isDarkMode ? '#fff' : '#000' }]}>
                            Betygsätt din resa med {trip.driverName || 'föraren'}
                        </Text>
                    </View>

                    {/* Stars */}
                    <View style={styles.starsSection}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                                key={star}
                                onPress={() => setRating(star)}
                                activeOpacity={0.7}
                            >
                                <Icon
                                    name={rating >= star ? 'star' : 'star-outline'}
                                    size={50}
                                    color={rating >= star ? '#FFD700' : '#cccccc'}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Feedback TextField */}
                    <View style={styles.feedbackSection}>
                        <Text style={[styles.feedbackLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                            Lämna en kommentar (valfritt)
                        </Text>
                        <TextInput
                            style={[
                                styles.feedbackInput,
                                {
                                    backgroundColor: isDarkMode ? '#1c1c1e' : '#fff',
                                    color: isDarkMode ? '#fff' : '#000',
                                    borderColor: isDarkMode ? '#333' : '#e5e7eb',
                                },
                            ]}
                            placeholder="Din kommentar..."
                            placeholderTextColor={isDarkMode ? '#666' : '#999'}
                            value={feedback}
                            onChangeText={setFeedback}
                            multiline
                            numberOfLines={4}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Trip Summary */}
                    <View style={[styles.tripSummary, { backgroundColor: isDarkMode ? '#1c1c1e' : '#f8f9fa' }]}>
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: isDarkMode ? '#8e8e93' : '#666' }]}>
                                Från
                            </Text>
                            <Text style={[styles.summaryValue, { color: isDarkMode ? '#fff' : '#000' }]} numberOfLines={2}>
                                {trip.pickupLocationAddress}
                            </Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: isDarkMode ? '#8e8e93' : '#666' }]}>
                                Till
                            </Text>
                            <Text style={[styles.summaryValue, { color: isDarkMode ? '#fff' : '#000' }]} numberOfLines={2}>
                                {trip.dropoffLocationAddress}
                            </Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: isDarkMode ? '#8e8e93' : '#666' }]}>
                                Pris
                            </Text>
                            <Text style={[styles.summaryValue, { color: isDarkMode ? '#fff' : '#000', fontWeight: 'bold' }]}>
                                {trip.tripCost.toFixed(2)} SEK
                            </Text>
                        </View>
                    </View>

                    <View style={{ height: 20 }} />
                </ScrollView>

                {/* Submit Button */}
                <View style={[styles.footer, { borderTopColor: isDarkMode ? '#333' : '#e5e7eb' }]}>
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#007AFF" />
                    ) : (
                        <TouchableOpacity
                            style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
                            onPress={handleSubmitRating}
                            disabled={rating === 0 || isLoading}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.submitButtonText}>Skicka betyg</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
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
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 24,
    },
    successSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 12,
    },
    successSubtitle: {
        fontSize: 16,
        marginTop: 8,
    },
    ratingInfoSection: {
        marginBottom: 24,
    },
    ratingInfoText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    starsSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 32,
    },
    feedbackSection: {
        marginBottom: 24,
    },
    feedbackLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    feedbackInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        maxHeight: 120,
    },
    tripSummary: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    summaryRow: {
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '500',
        flex: 0.25,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
        flex: 0.75,
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    footer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    submitButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
