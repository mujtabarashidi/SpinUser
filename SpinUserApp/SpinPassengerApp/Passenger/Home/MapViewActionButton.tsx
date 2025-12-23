import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type MapViewActionButtonProps = {
  mapState: string;
  setMapState: (state: string) => void;
  showSideMenu: boolean;
  setShowSideMenu: (show: boolean) => void;
  onBackToHome?: () => void;
};

export default function MapViewActionButton({ mapState, setMapState, showSideMenu, setShowSideMenu, onBackToHome }: MapViewActionButtonProps) {

  const handlePress = () => {
    if (mapState === 'HomeView') {
      setShowSideMenu(!showSideMenu);
    } else {
      // When leaving a non-Home state, prefer caller-provided cleanup to avoid sheet reopening
      if (onBackToHome) {
        onBackToHome();
      } else {
        setMapState('HomeView');
      }
    }
  };

  const getIconName = () => {
    if (showSideMenu) return 'close';
    if (mapState !== 'HomeView') return 'arrow-back';
    return 'menu';
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
    >
      <View style={styles.iconContainer}>
        <Icon
          name={getIconName()}
          size={24}
          color="#000000"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 20,
    top: 60,
    zIndex: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
