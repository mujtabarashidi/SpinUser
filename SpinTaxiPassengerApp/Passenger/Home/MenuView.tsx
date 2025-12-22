import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface MenuViewProps {
  onHomePress?: () => void;
  onTripsPress?: () => void;
  onProfilePress?: () => void;
}

interface NavButtonProps {
  icon: string;
  title: string;
  onPress?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, title, onPress }) => (
  <TouchableOpacity style={styles.navButton} onPress={onPress}>
    <Icon name={icon} size={24} color="#000" />
    <Text style={styles.navButtonText}>{title}</Text>
  </TouchableOpacity>
);

export default function MenuView({ onHomePress, onTripsPress, onProfilePress }: MenuViewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.menuContainer}>
        <NavButton 
          icon="home-outline" 
          title="Hem" 
          onPress={onHomePress}
        />
        <NavButton 
          icon="list-outline" 
          title="Resor" 
          onPress={onTripsPress}
        />
        <NavButton 
          icon="person-outline" 
          title="Profil" 
          onPress={onProfilePress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
  },
  menuContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    flex: 1,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 4,
  },
});