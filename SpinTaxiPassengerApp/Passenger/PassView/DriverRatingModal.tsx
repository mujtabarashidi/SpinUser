import firestore from '@react-native-firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { validateRating } from '../../utils/RatingValidator';

type DriverRatingModalProps = {
  visible: boolean;
  trip: any;
  onClose: () => void;
  onSubmitted?: () => void;
};

const LOW_RATING_REASONS = [
  'Sen ankomst',
  'Otrygg körning',
  'Dåligt bemötande',
  'Smutsig bil',
  'Annat',
];

const STAR_VALUES = [1, 2, 3, 4, 5];

const DriverRatingModal: React.FC<DriverRatingModalProps> = ({
  visible,
  trip,
  onClose,
  onSubmitted,
}) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const driverName = useMemo(() => trip?.driverName || 'föraren', [trip?.driverName]);

  useEffect(() => {
    if (!visible) {
      setRating(0);
      setFeedback('');
      setSelectedReason(null);
      setError(null);
    }
  }, [visible]);

  const submitRating = async () => {
    if (!trip) {
      setError('Kunde inte hitta resan.');
      return;
    }
    const tripId = String(trip.id || trip.tripId || '').trim();
    const driverId = String(trip.driverUid || trip.driverId || '').trim();

    if (!tripId) {
      setError('Saknar rese-id.');
      return;
    }
    if (!driverId) {
      setError('Kunde inte hitta föraren.');
      return;
    }
    if (rating === 0) {
      setError('Välj ett betyg innan du skickar.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const db = firestore();

    try {
      await db.runTransaction(async tx => {
        const tripRef = db.collection('trips').doc(tripId);
        const tripSnap = await tx.get(tripRef);
        const tripData = tripSnap.data();
        if (!tripData) {
          throw new Error('Resan finns inte längre.');
        }

        const alreadyRated = typeof tripData.driverRating === 'number' && tripData.driverRating > 0;

        const updatePayload: Record<string, any> = {
          ratingStatus: 'rated',
        };

        if (!alreadyRated) {
          updatePayload.driverRating = rating;
          if (rating <= 3 && selectedReason) {
            updatePayload.driverIssue = selectedReason;
          } else if (tripData.driverIssue) {
            updatePayload.driverIssue = firestore.FieldValue.delete();
          }
        }

        const trimmedFeedback = feedback.trim();
        if (trimmedFeedback) {
          updatePayload.driverFeedback = trimmedFeedback;
        } else if (tripData.driverFeedback && !alreadyRated) {
          updatePayload.driverFeedback = firestore.FieldValue.delete();
        }

        if (Object.keys(updatePayload).length > 0) {
          tx.update(tripRef, updatePayload);
        }

        if (alreadyRated) {
          return false;
        }

        const driverRef = db.collection('drivers').doc(driverId);
        const driverSnap = await tx.get(driverRef);
        const ratingsData = driverSnap.data()?.ratings ?? {};

        const currentCount = Number(ratingsData.count) || 0;
        const currentTotal = typeof ratingsData.total === 'number'
          ? Number(ratingsData.total)
          : (Number(ratingsData.avg) || 0) * currentCount;

        const newCount = currentCount + 1;
        const newTotal = currentTotal + rating;
        let newAvg = newTotal / newCount;

        // Validate and clamp average rating to max 5 stars
        newAvg = validateRating(newAvg);

        tx.set(
          driverRef,
          {
            ratings: {
              count: newCount,
              total: newTotal,
              avg: Number(newAvg.toFixed(2)),
              lastUpdated: firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );

        return true;
      });

      setIsSubmitting(false);
      onSubmitted?.();
    } catch (err: any) {
      console.error('⚠️ Kunde inte spara förarbetyg:', err);
      setError(err?.message || 'Kunde inte spara betyget. Försök igen.');
      setIsSubmitting(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={28} color="#dc2626" />
          </TouchableOpacity>
          <Text style={styles.title}>Tack för att du reste med Spin!
            Hur var resan?</Text>
          <Text style={styles.subtitle}>
            Hjälp oss förbättra upplevelsen genom att betygsätta {driverName}.
          </Text>
          <View style={styles.starsRow}>
            {STAR_VALUES.map(value => (
              <TouchableOpacity
                key={value}
                onPress={() => setRating(value)}
                style={styles.starButton}
              >
                <Ionicons
                  name={rating >= value ? 'star' : 'star-outline'}
                  size={38}
                  color={rating >= value ? '#fbbf24' : '#94a3b8'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && rating <= 3 && (
            <View style={styles.reasonsSection}>
              <Text style={styles.reasonsTitle}>Vad kan bli bättre?</Text>
              <View style={styles.reasonsList}>
                {LOW_RATING_REASONS.map(reason => {
                  const isSelected = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={[styles.reasonChip, isSelected && styles.reasonChipSelected]}
                      onPress={() => setSelectedReason(isSelected ? null : reason)}
                    >
                      <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TextInput
            style={styles.input}
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Berätta gärna mer (valfritt)"
            multiline
            placeholderTextColor="#94a3b8"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
            onPress={submitRating}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Skicka</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
  },
  starButton: {
    marginHorizontal: 6,
  },
  reasonsSection: {
    marginBottom: 16,
  },
  reasonsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  reasonsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    backgroundColor: '#f8fafc',
    marginRight: 8,
    marginBottom: 8,
  },
  reasonChipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  reasonText: {
    fontSize: 13,
    color: '#334155',
  },
  reasonTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  input: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DriverRatingModal;
