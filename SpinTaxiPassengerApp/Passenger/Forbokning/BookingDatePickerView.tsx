
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
// NOTE: This component expects @react-native-community/datetimepicker to be installed in your project.
// Install if needed:
//   npm i @react-native-community/datetimepicker
//   npx pod-install
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';

export type BookingDatePickerViewProps = {
  selectedDate: Date;
  onConfirm: (date: Date) => void;
  onClose?: () => void; // optional, if you want to dismiss a modal/screen
};

const termsMessage = (
  'När du förboka en resa med Spin:\n' +
  '• Ange upphämtningsplats, destination, tid och biltyp – du får en prisuppskattning.\n' +
  '• En viss väntetid ingår. Efter den tiden kan en minutavgift tillkomma enligt prisinformationen.\n' +
  '• Gratis avbokning upp till 1 timme före resan. Senare avbokning kan medföra avgift.\n' +
  '• Bokningen bekräftas när du får reseuppgifter och pris. Om ingen förare är tillgänglig meddelas du i slutet av upphämtningsfönstret.\n' +
  '• Spin kan inte garantera att en förare accepterar din resa.'
);

export default function BookingDatePickerView({ selectedDate, onConfirm, onClose }: BookingDatePickerViewProps) {
  // Minimum valbar tidpunkt: nu + 30 minuter
  const minimumSelectableDate = useMemo(() => new Date(Date.now() + 30 * 60 * 1000), []);
  // Maximum valbar tidpunkt: nu + 30 dagar
  const maximumSelectableDate = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), []);

  const [date, setDate] = useState<Date>(() => {
    const d = new Date(selectedDate);
    if (d.getTime() < minimumSelectableDate.getTime()) return minimumSelectableDate;
    if (d.getTime() > maximumSelectableDate.getTime()) return maximumSelectableDate;
    return d;
  });
  const [showTermsSheet, setShowTermsSheet] = useState(false);

  useEffect(() => {
    // Om props uppdateras, applicera minimiregeln igen
    const min = new Date(Date.now() + 30 * 60 * 1000);
    const incoming = new Date(selectedDate);
    if (incoming.getTime() < min.getTime()) {
      setDate(min);
    } else {
      const max = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (incoming.getTime() > max.getTime()) setDate(max); else setDate(incoming);
    }
  }, [selectedDate]);

  const onChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    // Enforce minimum och maximum även på Android där minimumDate inte alltid respekteras
    const min = new Date(Date.now() + 30 * 60 * 1000);
    const max = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (selected.getTime() < min.getTime()) {
      setDate(min);
    } else if (selected.getTime() > max.getTime()) {
      setDate(max);
    } else {
      setDate(selected);
    }
  };

  const handleOpenTerms = () => {
    Alert.alert(
      'Spin – Förbokningsvillkor',
      termsMessage,
      [
        { text: 'Läs mer', onPress: () => setShowTermsSheet(true) },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  const handleConfirm = () => {
    const min = new Date(Date.now() + 30 * 60 * 1000);
    const max = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    let finalDate = date;
    if (finalDate.getTime() < min.getTime()) finalDate = min;
    if (finalDate.getTime() > max.getTime()) finalDate = max;
    onConfirm(finalDate);
    if (onClose) onClose();
  };

  const formattedHint = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('sv-SE', {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }, [date]);

  const SCREEN_W = Dimensions.get('window').width;
  const { height: SCREEN_H } = useWindowDimensions();
  const isSmallScreen = SCREEN_H < 700; // phones like iPhone SE / small Androids
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollInner, isSmallScreen && { padding: 12, paddingBottom: 16 }]}>
        <Text style={[styles.title, isSmallScreen && { fontSize: 22, marginVertical: 10 }]}>Välj datum och Tid</Text>

        <Text style={[styles.subTitleBold, isSmallScreen && { fontSize: 13, marginBottom: 2 }]}>Förboka din resa upp till 30 dagar i förväg</Text>
        <Text style={styles.subTitlePadded}>Planera din resa.</Text>

        <View style={styles.divider} />

        <TouchableOpacity onPress={handleOpenTerms} style={styles.termsButton}>
          <Text style={styles.termsButtonText}>Förbokningsvillkor</Text>
        </TouchableOpacity>

        <View style={[styles.pickerContainer, isSmallScreen && { paddingVertical: 6 }]}>
          <Text style={styles.pickerLabel}>Välj datum & tid</Text>
          {Platform.OS === 'android' ? (
            <>
              <TouchableOpacity
                style={[styles.androidPickerButton, isSmallScreen && { height: 44 }]}
                onPress={() => {
                  const min = minimumSelectableDate;
                  const max = maximumSelectableDate;
                  const current = date < min ? min : (date > max ? max : date);

                  // Step 1: pick DATE
                  DateTimePickerAndroid.open({
                    value: current,
                    mode: 'date',
                    minimumDate: min,
                    maximumDate: max,
                    onChange: (_e, pickedDate) => {
                      if (!pickedDate) return;
                      let newDate = pickedDate;
                      if (newDate.getTime() < min.getTime()) newDate = min;
                      if (newDate.getTime() > max.getTime()) newDate = max;

                      // Step 2: pick TIME
                      DateTimePickerAndroid.open({
                        value: newDate,
                        mode: 'time',
                        is24Hour: true,
                        onChange: (_e2, pickedTime) => {
                          if (!pickedTime) return;
                          const finalDate = new Date(
                            newDate.getFullYear(),
                            newDate.getMonth(),
                            newDate.getDate(),
                            pickedTime.getHours(),
                            pickedTime.getMinutes(),
                            0,
                            0
                          );
                          const min2 = new Date(Date.now() + 30 * 60 * 1000);
                          const max2 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                          let clamped = finalDate;
                          if (clamped.getTime() < min2.getTime()) clamped = min2;
                          if (clamped.getTime() > max2.getTime()) clamped = max2;
                          setDate(clamped);
                        },
                      });
                    },
                  });
                }}
              >
                <Text style={styles.androidPickerButtonText}>{formattedHint}</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Android – buttons for date/time picker
            <View style={{ minHeight: 180 }}>
              <DateTimePicker
                value={date}
                mode="datetime"
                display={isSmallScreen ? 'compact' : 'inline'}
                minimumDate={minimumSelectableDate}
                maximumDate={maximumSelectableDate}
                onChange={onChange}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>

        <TouchableOpacity onPress={handleConfirm} style={[
          styles.confirmButton,
          { width: SCREEN_W - 32, alignSelf: 'center' },
          isSmallScreen && { height: 46, marginTop: 12 }
        ]}>
          <Text style={styles.confirmButtonText}>Bekräfta</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Fullständiga villkor som sheet/modal */}
      <Modal visible={showTermsSheet} transparent animationType="slide" onRequestClose={() => setShowTermsSheet(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Spin – Fullständiga förbokningsvillkor</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Text style={styles.modalBody}>{termsMessage}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowTermsSheet(false)}>
              <Text style={styles.closeButtonText}>Stäng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
  },
  subTitleBold: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 0,
  },
  subTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  subTitlePadded: {
    fontSize: 14,
    marginBottom: 8,
    paddingTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e6e6e6',
    marginVertical: 16,
  },
  termsButton: {
    paddingVertical: 8,
  },
  termsButtonText: {
    fontSize: 14,
    color: '#0a84ff',
    fontWeight: '600',
  },
  pickerContainer: {
    paddingVertical: 12,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#6b7280',
  },
  androidPickerButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  androidPickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    color: '#444',
  },
  closeButton: {
    marginTop: 16,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
