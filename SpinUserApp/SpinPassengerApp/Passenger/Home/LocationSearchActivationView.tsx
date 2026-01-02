import React, { useMemo, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MenuView from './MenuView';
import { HomeContext } from '../context/HomeContext';
import { useAuthViewModel } from '../../Authentication/AuthManager';
import SavedPlacesService, { SavedPlace } from '../../services/SavedPlacesService';
import RecentSearchesService, { RecentSearch } from '../../services/RecentSearchesService';

interface LocationSearchActivationViewProps {
  onPress?: () => void;
  onSchedulePress?: () => void;
  scheduledDate?: Date;
  onHomePress?: () => void;
  onTripsPress?: () => void;
  onProfilePress?: () => void;
  onRidePress?: () => void;
  onRentPress?: () => void;
  onSavedPlacesPress?: () => void;
}

export default function LocationSearchActivationView({
  onPress,
  onSchedulePress,
  scheduledDate,
  onHomePress,
  onTripsPress,
  onProfilePress,
  onRidePress,
  onRentPress,
  onSavedPlacesPress
}: LocationSearchActivationViewProps) {
  const { currentUser } = useAuthViewModel();
  const homeContext = useContext(HomeContext);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  
  // Get user name from Firebase user object
  const displayName = currentUser?.fullname || currentUser?.email?.split('@')[0] || 'Guest';
  
  // Get current location from HomeContext
  const userLocation = homeContext?.currentLocation || 'My Location';

  // Load saved places and recent searches
  useEffect(() => {
    if (currentUser?.uid) {
      loadSavedPlaces();
      loadRecentSearches();
    }
  }, [currentUser?.uid]);

  const loadSavedPlaces = async () => {
    if (currentUser?.uid) {
      const places = await SavedPlacesService.getSavedPlaces(currentUser.uid);
      setSavedPlaces(places);
    }
  };

  const loadRecentSearches = async () => {
    if (currentUser?.uid) {
      const searches = await RecentSearchesService.getRecentSearches(currentUser.uid);
      setRecentSearches(searches);
    }
  };

  const homePlace = savedPlaces.find(p => p.type === 'home');
  const workPlace = savedPlaces.find(p => p.type === 'work');
  const favoritePlaces = savedPlaces.filter(p => p.type === 'favorite');

  const handleRecentSearchPress = (search: RecentSearch) => {
    // Set destination from recent search
    if (homeContext?.setQueryFragment) {
      homeContext.setQueryFragment(search.address);
    }
    if (homeContext?.setDestinationCoordinate) {
      homeContext.setDestinationCoordinate(search.coordinate);
    }
    if (homeContext?.setSelectedSpinLocation) {
      homeContext.setSelectedSpinLocation({
        coordinate: search.coordinate,
        title: search.address,
      });
    }
    // Don't call onPress - this would open LocationSearchView
    // Instead, let the parent component detect the destination is set and show RideRequestView
  };

  const handleAddHome = () => {
    if (homeContext?.setSelectedPlaceType) {
      homeContext.setSelectedPlaceType('home');
    }
    onPress?.();
  };

  const handleAddWork = () => {
    if (homeContext?.setSelectedPlaceType) {
      homeContext.setSelectedPlaceType('work');
    }
    onPress?.();
  };

  const handleSavedPlacePress = (place: SavedPlace) => {
    // Set destination from saved place
    if (homeContext?.setQueryFragment) {
      homeContext.setQueryFragment(place.address);
    }
    if (homeContext?.setDestinationCoordinate) {
      homeContext.setDestinationCoordinate(place.coordinate);
    }
    if (homeContext?.setSelectedSpinLocation) {
      homeContext.setSelectedSpinLocation({
        coordinate: place.coordinate,
        title: place.address,
      });
    }
    // Don't call onPress - let parent detect destination is set and show RideRequestView
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={true} scrollEnabled={true}>
      {/* User Welcome Section */}
      <View style={styles.userSection}>
        <View style={styles.greetingCenter}>
          <Text style={styles.greetingText}>Hi</Text>
          <Text style={styles.userName}>{displayName} 👋</Text>
        </View>
      </View>

      {/* Main Card */}
      <View style={styles.mainCard}>
        <View style={styles.cardContent}>
          {/* Search Input Box */}
          <View style={styles.searchSection}>
            <TouchableOpacity 
              style={styles.searchInputContainer} 
              onPress={onPress}
              activeOpacity={0.8}
            >
              <View style={styles.searchIconContainer}>
                <Icon name="search" size={20} color="#6b7280" />
              </View>
              
              <View style={styles.searchTextContainer}>
                <Text style={styles.searchInputTitle}>Search location</Text>
                <Text style={styles.searchInputSubtitle}>Enter destination address</Text>
              </View>
              
              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onSchedulePress?.();
                }}
                activeOpacity={0.7}
              >
                <Icon name="time-outline" size={16} color="#6b7280" />
              </TouchableOpacity>
            </TouchableOpacity>
            
            {/* Recent Searches or Suggestions */}
            <View style={styles.searchSuggestions}>
              {/* Saved Places Header */}
              <Text style={styles.sectionHeader}>Saved Places</Text>
              
              {/* Saved Places First - Home and Work side by side */}
              <View style={styles.homeWorkContainer}>
                {homePlace ? (
                  <TouchableOpacity style={[styles.suggestionItem, styles.halfWidth]} onPress={() => handleSavedPlacePress(homePlace)}>
                    <View style={styles.suggestionIcon}>
                      <Icon name="home" size={16} color="#6b7280" />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionText} numberOfLines={1}>{homePlace.name}</Text>
                      <Text style={styles.suggestionSubtext} numberOfLines={1}>{homePlace.address}</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.addPlaceItem, styles.halfWidth]} onPress={handleAddHome}>
                    <View style={styles.suggestionIcon}>
                      <Icon name="home-outline" size={16} color="#3b82f6" />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.addPlaceText} numberOfLines={1}>Home</Text>
                      <Text style={styles.suggestionSubtext} numberOfLines={1}>Set your home address</Text>
                    </View>
                  </TouchableOpacity>
                )}
                
                {workPlace ? (
                  <TouchableOpacity style={[styles.suggestionItem, styles.halfWidth]} onPress={() => handleSavedPlacePress(workPlace)}>
                    <View style={styles.suggestionIcon}>
                      <Icon name="briefcase" size={16} color="#6b7280" />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionText} numberOfLines={1}>{workPlace.name}</Text>
                      <Text style={styles.suggestionSubtext} numberOfLines={1}>{workPlace.address}</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.addPlaceItem, styles.halfWidth]} onPress={handleAddWork}>
                    <View style={styles.suggestionIcon}>
                      <Icon name="briefcase-outline" size={16} color="#3b82f6" />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.addPlaceText} numberOfLines={1}>Work</Text>
                      <Text style={styles.suggestionSubtext} numberOfLines={1}>Set your work address</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Recent Searches Header */}
              {recentSearches.length > 0 && (
                <Text style={styles.sectionHeader}>Recent Searches</Text>
              )}
              
              {/* Recent Searches */}
              {recentSearches.slice(0, 3).map((search) => (
                <TouchableOpacity key={search.id} style={styles.recentSearchItem} onPress={() => handleRecentSearchPress(search)}>
                  <View style={styles.suggestionIcon}>
                    <Icon name="time" size={16} color="#6b7280" />
                  </View>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={styles.suggestionText} numberOfLines={1}>{search.address}</Text>
                    <Text style={styles.suggestionSubtext}>Recent search</Text>
                  </View>
                </TouchableOpacity>
              ))}
              
              {/* Favorite Places */}
              {favoritePlaces.length > 0 ? (
                favoritePlaces.slice(0, 1).map((place) => (
                  <TouchableOpacity key={place.id} style={styles.suggestionItem} onPress={() => handleSavedPlacePress(place)}>
                    <View style={styles.suggestionIcon}>
                      <Icon name="star" size={16} color="#6b7280" />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionText}>{place.name}</Text>
                      <Text style={styles.suggestionSubtext}>{place.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : recentSearches.length === 0 && (
                <TouchableOpacity style={styles.addPlaceItem} onPress={onSavedPlacesPress}>
                  <View style={styles.suggestionIcon}>
                    <Icon name="star-outline" size={16} color="#3b82f6" />
                  </View>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={styles.addPlaceText}>Add Favorite Place</Text>
                    <Text style={styles.suggestionSubtext}>Save your favorite locations</Text>
                  </View>
                  <Icon name="add-circle-outline" size={20} color="#3b82f6" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton} onPress={onRidePress || onPress}>
            <View style={[styles.quickActionIcon, styles.rideIcon]}>
              <Icon name="car" size={28} color="#fff" />
            </View>
            <Text style={styles.quickActionLabel}>Ride</Text>
          </TouchableOpacity>

       

          <TouchableOpacity style={styles.quickActionButton} onPress={onSchedulePress}>
            <View style={[styles.quickActionIcon, styles.scheduleIcon]}>
              <Icon name="calendar" size={28} color="#fff" />
            </View>
            <Text style={styles.quickActionLabel}>Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionButton} onPress={onTripsPress}>
            <View style={[styles.quickActionIcon, styles.tripsIcon]}>
              <Icon name="map" size={28} color="#fff" />
            </View>
            <Text style={styles.quickActionLabel}>Trips</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Promo Banner */}
      <View style={styles.promoBanner}>
        <View style={styles.promoContent}>
          <View>
            <Text style={styles.promoTitle}>Get 10% off</Text>
            <Text style={styles.promoSubtitle}>Are you
ready for a ride?</Text>
          </View>
          <TouchableOpacity style={styles.promoButton} onPress={onRidePress || onPress}>
            <Text style={styles.promoButtonText}>Take a Ride</Text>
            <Icon name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.promoDecoration}>
          <Icon name="sparkles" size={24} color="#fbbf24" />
        </View>
      </View>

      {/* Bottom menu */}
      <MenuView
        onHomePress={onHomePress}
        onTripsPress={onTripsPress}
        onProfilePress={onProfilePress}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  greetingCenter: {
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  userImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  currentLocationLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '400',
    marginBottom: 1,
  },
  currentLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: -20,
  },
  searchSection: {
    marginTop: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIconContainer: {
    marginRight: 12,
  },
  searchTextContainer: {
    flex: 1,
  },
  searchInputTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 2,
  },
  searchInputSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    display: 'none',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  scheduleButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  searchSuggestions: {
    marginTop: 16,
    gap: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 4,
  },
  homeWorkContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  halfWidth: {
    flex: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  addPlaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#dbeafe',
    borderStyle: 'dashed',
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  addPlaceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  suggestionSubtext: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  rideIcon: {
    backgroundColor: '#10b981',
  },
  rentIcon: {
    backgroundColor: '#8b5cf6',
  },
  scheduleIcon: {
    backgroundColor: '#f59e0b',
  },
  tripsIcon: {
    backgroundColor: '#ef4444',
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  promoBanner: {
    backgroundColor: '#1e40af',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  promoContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 12,
    color: '#dbeafe',
    fontWeight: '400',
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  promoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  promoDecoration: {
    marginLeft: 12,
  },
});