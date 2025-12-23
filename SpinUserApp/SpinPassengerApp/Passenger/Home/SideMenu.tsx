import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import FirebaseManager from '../../firebase/FirebaseManager';
import { checkForUpdate } from '../../services/UpdateService';
import { useAuth } from '../context/AuthContext';
import AboutView from '../Menu/AboutView';
import PassengerTripHistoryView from '../Menu/PassengerTripHistoryView';
import SettingsView from '../Menu/SettingsView';
import SupportView from '../Menu/SupportView';
import WalletView from '../Menu/WalletView';

type User = {
  uid: string;
  fullname: string;
  email: string;
  accountType: string;
};

interface SideMenuProps {
  user: User;
  onClose?: () => void;
  bookingCount?: number; // NEW: Badge count for reservations
  onShowBookings?: () => void; // NEW: Callback to show bookings in parent
}

interface MenuItem {
  id: string;
  title: string;
  iconName: string;
  icon?: string;
  onPress: () => void;
  screen?: string;
  badge?: string;
  isActive?: boolean;
}

export default function SideMenu({ user, onClose, bookingCount = 0, onShowBookings }: SideMenuProps) {
  const [spinPoints, setSpinPoints] = useState(0);
  const [showLevelOverlay, setShowLevelOverlay] = useState(false);
  const [showAboutOverlay, setShowAboutOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showTrips, setShowTrips] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | undefined>(undefined);

  const auth = useAuth();

  const [menuWidth, setMenuWidth] = useState(
    Math.min(Math.round(Dimensions.get('window').width * 0.78), 380)
  );

  useEffect(() => {
    const onChange = ({ window }: { window: { width: number; height: number } }) => {
      setMenuWidth(Math.min(Math.round(window.width * 0.72), 380));
    };
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => {
      // @ts-ignore: support RN < 0.65 where remove() exists
      subscription?.remove?.();
    };
  }, []);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -menuWidth,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (onClose) onClose();
    });
  };

  useEffect(() => {
    // Fetch user points from Firestore
    const fetchUserPoints = async () => {
      try {
        const firebaseManager = FirebaseManager.getInstance();
        const firestore = firebaseManager.getFirestore();
        const userDoc = await firestore.collection('users').doc(user.uid).get();

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setSpinPoints(userData?.spinPoints || 0);
        }
      } catch (error) {
        console.log('Error fetching user points:', error);
      }
    };

    fetchUserPoints();

    // Animate entrance from left
    slideAnim.setValue(-menuWidth);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [slideAnim, menuWidth]);

  // Check for updates once when menu mounts
  useEffect(() => {
    (async () => {
      try {
        const res = await checkForUpdate();
        setHasUpdateAvailable(!!res.hasUpdate);
        setLatestVersion(res.latestVersion ?? null);
        if (res.storeUrl) setStoreUrl(res.storeUrl);
      } catch { }
    })();
  }, []);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'God morgon';
    if (hour >= 11 && hour < 17) return 'God dag';
    if (hour >= 17 && hour < 23) return 'God kväll';
    return 'Hej';
  };

  const getLevelName = (points: number): string => {
    if (points < 200) return 'Utforskare';
    if (points < 400) return 'Vanlig resenär';
    if (points < 700) return 'Favoritkund';
    return 'VIP';
  };

  const getCurrentLevel = () => Math.floor(spinPoints / 100);
  const getPointsToNextLevel = () => {
    const currentLevel = getCurrentLevel();
    const nextLevelThreshold = (currentLevel + 1) * 100;
    return nextLevelThreshold - spinPoints;
  };

  const menuItems: MenuItem[] = [
    {
      id: 'wallet',
      title: 'Plånbok',
      iconName: 'card-outline',
      onPress: () => {
        setShowWallet(true);
      },
    },
    {
      id: 'reserved',
      title: 'Reserverad',
      iconName: 'calendar-outline',
      onPress: () => {
        onShowBookings?.(); // Notify parent to show bookings
        onClose?.(); // Close the menu
      },
      badge: bookingCount && bookingCount > 0 ? bookingCount.toString() : undefined, // Show badge if bookings exist
    },
    {
      id: 'trips',
      title: 'Resor',
      iconName: 'list-outline',
      onPress: () => {
        setShowTrips(true);
      },
    },
    {
      id: 'settings',
      title: 'Inställning',
      iconName: 'settings-outline',
      onPress: () => {
        setShowSettings(true);
      },
    },
    {
      id: 'support',
      title: 'Support',
      iconName: 'mail-outline',
      onPress: () => {
        setShowSupport(true);
      },
    },
    {
      id: 'about',
      title: 'Om oss',
      iconName: 'information-circle-outline',
      onPress: () => {
        setShowAboutOverlay(true);
      },
    },
  ];

  const handleUpdatePress = () => {
    const androidUrl = storeUrl || 'https://play.google.com/store/apps/details?id=com.spintaxidriverapp';
    Linking.openURL(androidUrl).catch(() => {
      Alert.alert('Fel', 'Kunde inte öppna Google Play');
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: '#ffffff',
          borderTopRightRadius: 22,
          borderBottomRightRadius: 22,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: '#e5e5ea',
          width: menuWidth,
          transform: [{ translateX: slideAnim }],
        }
      ]}
    >
      {showLevelOverlay && (
        <Pressable style={styles.backdrop} onPress={() => setShowLevelOverlay(false)} />
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, {
              backgroundColor: '#ffffff',
              shadowColor: '#000000',
              shadowOpacity: 0.2,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }]}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.userInfo}>
            <Text
              style={[styles.greeting, { color: '#000000' }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {getGreeting()}, {user.fullname}
            </Text>

            <TouchableOpacity
              style={styles.pointsContainer}
              onPress={() => setShowLevelOverlay(!showLevelOverlay)}
            >
              {showLevelOverlay ? (
                <Pressable
                  onPress={() => setShowLevelOverlay(false)}
                  style={[styles.levelOverlay, { backgroundColor: '#ffffff' }]}
                >
                  <View style={styles.levelHeader}>
                    <Icon name="flash" size={16} color="#FF9500" />
                    <Text style={[styles.levelText, { color: '#000000' }]}>
                      Level {getCurrentLevel()}
                    </Text>
                    <Text style={styles.pointsText}>• {spinPoints} poäng</Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: '#e5e5ea' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${((spinPoints % 100) / 100) * 100}%`,
                            backgroundColor: '#007AFF'
                          }
                        ]}
                      />
                    </View>
                  </View>

                  <Text style={[styles.pointsToNext, { color: '#8e8e93' }]}>
                    {getPointsToNextLevel()} poäng kvar till nivå {getCurrentLevel() + 1}
                  </Text>

                  <Text style={[styles.levelName, { color: '#8e8e93' }]}>
                    🎖️ {getLevelName(spinPoints)}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.simplePoints}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="flash" size={14} color="#FFD60A" />
                    <Text style={[styles.simplePointsText, { color: '#8e8e93' }]}>
                      Level: {getCurrentLevel()} • {spinPoints} poäng
                    </Text>
                  </View>
                  <Icon name="chevron-down" size={14} color="#8e8e93" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: '#c6c6c8' }]} />
        </View>

        {/* Menu Items */}
        <View style={styles.menuItems}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                {
                  backgroundColor: item.badge === 'Ny!' ? 'rgba(0,122,255,0.05)' : '#ffffff',
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: '#e5e5ea',
                }
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemContent}>
                <Icon
                  name={item.iconName}
                  size={22}
                  color={item.badge === 'Ny!' ? '#007AFF' : '#000000'}
                  style={styles.menuIcon}
                />
                {item.isActive && (
                  <Icon
                    name="checkmark-circle"
                    size={16}
                    color="#34C759"
                    style={styles.activeIndicator}
                  />
                )}
                <Text style={[styles.menuTitle, { color: '#000000' }]}>
                  {item.title}
                </Text>
                {item.badge && (
                  <View style={[styles.badge, { backgroundColor: '#007AFF' }]}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
              </View>
              <Icon name="chevron-forward" size={18} color="#c6c6c8" />
            </TouchableOpacity>
          ))}

          {/* Update-banner (only when a newer version exists) */}
          {hasUpdateAvailable && (
            <View style={[styles.updateBanner, { backgroundColor: '#f2f2f7' }]}>
              <View style={styles.updateContent}>
                <Icon name="arrow-down-circle" size={24} color="#007AFF" />
                <View style={styles.updateInfo}>
                  <Text style={[styles.updateTitle, { color: '#000000' }]}>
                    Ny uppdatering finns
                  </Text>
                  <Text style={styles.updateVersion}>Version {latestVersion ?? ''}</Text>
                </View>
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={handleUpdatePress}
                >
                  <Text style={styles.updateButtonText}>Uppdatera</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <TouchableOpacity
          style={styles.footer}
          onPress={() => setShowAboutOverlay(true)}
        >
          <Text style={styles.footerText}>Made in Stockholm</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* About Overlay Modal */}
      <Modal
        visible={showAboutOverlay}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAboutOverlay(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowAboutOverlay(false)}
        >
          <View style={[styles.aboutOverlay, { backgroundColor: '#ffffff' }]}>
            <AboutView />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12 }}>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Icon name="close" size={20} />
            </TouchableOpacity>
          </View>
          <SettingsView user={auth.currentUser ?? user} />
        </View>
      </Modal>

      {/* Support Modal */}
      <Modal visible={showSupport} animationType="slide" onRequestClose={() => setShowSupport(false)}>
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12 }}>
            <TouchableOpacity onPress={() => setShowSupport(false)}>
              <Icon name="close" size={20} />
            </TouchableOpacity>
          </View>
          <SupportView />
        </View>
      </Modal>

      {/* Trips Modal */}
      <Modal visible={showTrips} animationType="slide" onRequestClose={() => setShowTrips(false)}>
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12 }}>
            <TouchableOpacity onPress={() => setShowTrips(false)}>
              <Icon name="close" size={20} />
            </TouchableOpacity>
          </View>
          <PassengerTripHistoryView />
        </View>
      </Modal>

      {/* Wallet Modal */}
      <Modal visible={showWallet} animationType="slide" onRequestClose={() => setShowWallet(false)}>
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowWallet(false)}>
              <Icon name="close" size={20} color="#000" />
            </TouchableOpacity>
          </View>
          <WalletView />
        </View>
      </Modal>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: '100%',
    alignSelf: 'flex-start',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: 'rgba(0,122,255,0.3)',
    padding: 8,
  },

  logoSubText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  userInfo: {
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 10,
    includeFontPadding: false,
    textAlign: 'left',
    letterSpacing: 0.2,
  },
  pointsContainer: {
    marginTop: 6,
    marginBottom: 6,
    backgroundColor: 'transparent',
    borderRadius: 12,
    alignItems: 'stretch',
  },
  levelOverlay: {
    zIndex: 2,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
    color: '#FFD700',
  },
  pointsText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  pointsToNext: {
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'center',
    opacity: 0.8,
  },
  levelName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  simplePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
  },
  simplePointsText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginVertical: 12,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginLeft: 16,
    marginRight: 16,
    opacity: 1,
  },
  menuItems: {
    paddingTop: 8,
    paddingLeft: 8,
    paddingRight: 12,
    paddingBottom: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    minHeight: 48,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIconContainerSimple: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  badgeIcon: {
    position: 'absolute',
    right: -2,
    bottom: -2,
  },
  menuIcon: {
    marginRight: 12,
    width: 24,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeIndicator: {
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  updateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF40',
    backgroundColor: 'rgba(0,122,255,0.05)',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  updateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  updateTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  updateVersion: {
    fontSize: 12,
    color: '#8e8e93',
  },
  updateButton: {
    backgroundColor: '#007AFF26',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  updateButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 11,
    color: '#8e8e93',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  aboutOverlay: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    marginBottom: 100,
  },
  aboutText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
});

