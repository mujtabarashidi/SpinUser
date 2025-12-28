import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, PanResponder, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export type CustomPriceViewProps = {
  visible: boolean;
  originalPrice: number;
  onClose: () => void;
  onSave: (value: number) => void;
};

export default function CustomPriceView({ visible, originalPrice, onClose, onSave }: CustomPriceViewProps) {
  const [value, setValue] = useState<string>('');
  const [focus, setFocus] = useState(false);
  const translateY = React.useRef(new Animated.Value(0)).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6,
      onPanResponderMove: Animated.event(
        [null, { dy: translateY }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const num = Number(value.replace(/[^0-9]/g, '')) || 0;
  const currency = useMemo(() => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }), []);

  // 10% rabatt redan applicerad
  const discountedPrice = Math.round(originalPrice * 0.90);
  const valid = num > 0 && num !== originalPrice && num >= discountedPrice;
  const isBelowMinimum = value !== '' && num < discountedPrice && num > 0;

  useEffect(() => {
    if (!visible) {
      setValue('');
      setFocus(false);
    } else {
      setValue(String(discountedPrice));
    }
  }, [visible, discountedPrice]);

  const bump = (percent: number) => {
    const base = num || discountedPrice;
    const next = Math.round(base * (1 + percent / 100));
    setValue(String(next));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Animated.View
          style={[styles.modalCard, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.sheetHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.sheetHandle} />
          </View>
          {/* Blå rabatt-banner */}
          <View style={styles.discountBanner}>
            <Icon name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.discountBannerText}>10% rabatt tillämpas</Text>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
            <Text style={[styles.modalTitle, { marginBottom: 6 }]}>Ange eget pris</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 12 }}>
              <Text style={styles.modalSub}>Taxa: {currency.format(discountedPrice)}</Text>
              <Text style={[styles.modalSub, { textDecorationLine: 'line-through', color: '#d1d5db' }]}>
                {currency.format(originalPrice)}
              </Text>
            </View>

            <View style={styles.priceInputRow}>
              <Icon name="card" size={20} color="#9ca3af" />
              <TextInput
                keyboardType="numeric"
                placeholder="Ange belopp eller öka med %"
                placeholderTextColor="#6b7280"
                value={value}
                onChangeText={setValue}
                onFocus={() => setFocus(true)}
                style={styles.priceInput}
              />
              {!!value && (
                <TouchableOpacity onPress={() => setValue('')}>
                  <Icon name="close-circle" size={18} color="#d1d5db" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.presetRow}>
              <PresetChip title="+5 %" onPress={() => bump(5)} />
              <PresetChip title="+10 %" onPress={() => bump(10)} />
              <PresetChip title="+20 %" onPress={() => bump(20)} />
            </View>

            {isBelowMinimum && (
              <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FEE2E2', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#DC2626' }}>
                <Text style={{ color: '#991B1B', fontSize: 13, fontWeight: '600' }}>
                  Priset kan inte vara mindre än {currency.format(discountedPrice)}
                </Text>
              </View>
            )}

            <View style={{ marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 10 }}>
              <Text style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>
                Bra pris för dig – rättvis ersättning för föraren.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
                <Text style={styles.modalBtnText}>Stäng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, valid ? styles.modalPrimary : styles.modalDisabled]}
                disabled={!valid}
                onPress={() => onSave(num)}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Bekräfta pris</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PresetChip({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.chip} activeOpacity={0.9}>
      <Text style={styles.chipText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '50%',
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  discountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  discountBannerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  modalSub: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  priceInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderWidth: 1,
    borderColor: '#007AFF'
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#000' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalBtn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6' },
  modalBtnText: { fontWeight: '700', color: '#111' },
  modalPrimary: { backgroundColor: '#0A84FF' },
  modalDisabled: { backgroundColor: '#94a3b8' },
});