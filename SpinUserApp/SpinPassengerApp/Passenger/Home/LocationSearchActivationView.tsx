import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MenuView from './MenuView';

interface LocationSearchActivationViewProps {
  onPress?: () => void;
  onSchedulePress?: () => void; // NEW: För förbokningsknappen
  scheduledDate?: Date; // NEW: Visar valt datum
  onHomePress?: () => void;
  onTripsPress?: () => void;
  onProfilePress?: () => void;
}

export default function LocationSearchActivationView({
  onPress,
  onSchedulePress,
  scheduledDate,
  onHomePress,
  onTripsPress,
  onProfilePress
}: LocationSearchActivationViewProps) {

  // Format scheduled date for display
  const formattedScheduleDate = useMemo(() => {
    if (!scheduledDate) {
      const defaultDate = new Date(Date.now() + 30 * 60 * 1000);
      return defaultDate.toLocaleString('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return scheduledDate.toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [scheduledDate]);

  return (
    <View style={styles.container}>
      <View style={styles.spacer} />

      {/* Vanlig sök-knapp med förbokningsknapp inuti */}
      <TouchableOpacity style={styles.searchButton} onPress={onPress}>
        <View style={styles.content}>
          <Icon name="search" size={20} color="#000" style={styles.icon} />
          <Text style={styles.searchText}>Vart ska du åka?</Text>

          {/* Förbokningsknapp inuti sökningen */}
          <TouchableOpacity
            style={styles.scheduleButtonInside}
            onPress={(e) => {
              e.stopPropagation();
              onSchedulePress?.();
            }}
          >
            <Icon name="calendar-outline" size={20} color="#000" style={styles.calendarIcon} />
            <Text style={styles.scheduleTextInside}>Senare</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <View style={styles.menuSpacing} />

      <MenuView
        onHomePress={onHomePress}
        onTripsPress={onTripsPress}
        onProfilePress={onProfilePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    flex: 1,
    justifyContent: 'flex-end',
  },
  spacer: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  icon: {
    marginRight: 12,
  },
  searchText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  scheduleButtonInside: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  calendarIcon: {
    marginRight: 4,
  },
  scheduleTextInside: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  menuSpacing: {
    height: 24,
  },
});