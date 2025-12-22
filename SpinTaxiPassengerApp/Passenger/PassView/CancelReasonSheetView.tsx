import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type CancelReasonSheetViewProps = {
  visible: boolean;
  onClose: () => void;
  onReasonSelected: (reason: string) => void;
  hasDriverArrived?: boolean;
  reasons: string[];
};

const CancelReasonSheetView: React.FC<CancelReasonSheetViewProps> = ({
  visible,
  onClose,
  onReasonSelected,
  hasDriverArrived,
  reasons,
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  // Reset selected reason when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedReason(null);
    }
  }, [visible]);

  const filteredReasons = hasDriverArrived
    ? reasons.filter(reason => reason !== 'Föraren tog för lång tid')
    : reasons;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Varför vill du avboka?</Text>
        {filteredReasons.map(reason => (
          <TouchableOpacity
            key={reason}
            style={[
              styles.reasonButton,
              selectedReason === reason && styles.reasonButtonSelected
            ]}
            onPress={() => setSelectedReason(reason)}
          >
            <Text style={[
              styles.reasonText,
              selectedReason === reason && styles.reasonTextSelected
            ]}>
              {reason}
            </Text>
            {selectedReason === reason && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Avbryt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.confirmButton,
              !selectedReason && styles.confirmButtonDisabled
            ]}
            onPress={() => {
              if (selectedReason) {
                onReasonSelected(selectedReason);
              }
            }}
            disabled={!selectedReason}
          >
            <Text style={styles.confirmText}>Bekräfta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111',
  },
  reasonButton: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reasonButtonSelected: {
    backgroundColor: '#FFF3E0',
  },
  reasonText: {
    fontSize: 15,
    color: '#212529',
  },
  reasonTextSelected: {
    color: '#FF6F00',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#FF6F00',
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E9ECEF',
    alignItems: 'center',
  },
  cancelText: {
    color: '#495057',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF6F00',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#CED4DA',
  },
  confirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CancelReasonSheetView;
