// Use the same geolocation module as our tracking hook for consistency
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { PassengerLocationService } from '../../services/LocationService';
import { Coordinate, GeocodingService } from '../../utils/GeocodingService';
import { RouteService } from '../../utils/RouteService';
import { HomeContext } from '../context/HomeContext';

interface LocationSearchViewProps {
  onClose: () => void;
}

interface SearchResult {
  description: string;
  title: string;
  subtitle: string;
  coordinates: Coordinate;
}

export default function LocationSearchView({ onClose }: LocationSearchViewProps) {
  const homeContext = useContext(HomeContext);
  const {
    pickupQueryFragment,
    setPickupQueryFragment,
    queryFragment,
    setQueryFragment,
    pickupCoordinate,
    setPickupCoordinate,
    destinationCoordinate,
    setDestinationCoordinate,
    setSelectedSpinLocation,
    currentLocation,
    setCurrentLocation,
    userLocation,
    setUserLocation,
    routePoints,
    setRoutePoints,
    isRouteLoading,
    setIsRouteLoading
  } = homeContext;

  const [pickupIsFocused, setPickupIsFocused] = useState(false);
  const [destinationIsFocused, setDestinationIsFocused] = useState(true);
  // Handle back/cancel: clear destination-related state so RideRequestView won’t open
  const handleBack = () => {
    // Clear anything that could cause RideRequestView to open
    setQueryFragment('');
    setDestinationCoordinate(null);
    setSelectedSpinLocation?.(null);
    setRoutePoints([]);
    setDestinationIsFocused(false);
    setPickupIsFocused(false);
    Keyboard.dismiss();

    // Give React a moment to propagate cleared state before parent considers showing RideRequestView
    setTimeout(() => {
      onClose();
    }, 300);
  };
  const [activeField, setActiveField] = useState<'pickup' | 'destination'>('destination');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const pickupRef = useRef<TextInput>(null);
  const destinationRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize location when component mounts
  useEffect(() => {
    fetchUserLocation();
  }, []);

  // We now get exact formatted addresses from GeocodingService (Google preferred).
  const toExactAddress = (input?: string | null): string => (input || '').trim();

  // Shorten very long addresses for input display (keep primary label + city)
  const formatAddress = (raw: string): string => {
    if (!raw) return '';
    // If reverse geocoding only returned coordinates, show a friendly label.
    if (/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(raw)) {
      return 'Min plats';
    }
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return raw;
    let first = parts[0];
    const countryBlacklist = ['Sverige', 'Sweden'];
    const cityCandidates = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping'];
    const city = parts.find(p => cityCandidates.includes(p) && !countryBlacklist.includes(p));
    // If the first segment is only a number (e.g., "16" or a numeric decimal), prefer the next meaningful part
    if (/^\d{1,3}(\.\d+)?$/.test(first) && parts.length > 1) {
      first = parts[1];
    }
    let result = first;
    if (city && city !== first) result += `, ${city}`;
    if (result.length > 40) result = result.slice(0, 37).trimEnd() + '…';
    return result;
  };

  // Search for locations when query changes (with debouncing)
  useEffect(() => {
    const activeQuery = activeField === 'pickup' ? pickupQueryFragment : queryFragment;

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only search if there's an active field with sufficient query length
    if ((pickupIsFocused || destinationIsFocused) && activeQuery.length >= 2) {
      console.log('🔍 Searching for:', activeQuery, 'Focus:', activeField);
      // Debounce the search by 300ms
      searchTimeoutRef.current = setTimeout(() => {
        searchLocations(activeQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [pickupQueryFragment, queryFragment, pickupIsFocused, destinationIsFocused, activeField]);

  const fetchUserLocation = async () => {
    // If HomeContext already has a location (from usePassengerLocationTracking), reuse it
    if (userLocation) {
      try {
        const address = await GeocodingService.reverseGeocode(userLocation);
        const exact = toExactAddress(address || '');
        const display = exact ? formatAddress(exact) : 'Min plats';

        setPickupQueryFragment(display);
        setCurrentLocation(display);
        setPickupCoordinate(userLocation);
        return; // Done
      } catch (error) {
        console.error('Failed to reverse geocode location:', error);
        // Use placeholder instead of coordinates
        setPickupQueryFragment('Min plats');
        setCurrentLocation('Min plats');
        setPickupCoordinate(userLocation);
        return;
      }
    }

    const location = await PassengerLocationService.getCurrentPosition();

    if (!location) {
      console.log('Location error: Failed to get position');
      setPickupQueryFragment('Min plats');
      setCurrentLocation('Min plats');
      return;
    }

    if (setUserLocation) {
      setUserLocation({
        latitude: location.latitude,
        longitude: location.longitude
      });
    }

    // Reverse geocode to get address
    try {
      const address = await GeocodingService.reverseGeocode({
        latitude: location.latitude,
        longitude: location.longitude
      });
      const exact = toExactAddress(address || '');
      const display = exact ? formatAddress(exact) : 'Min plats';
      setPickupQueryFragment(display);
      setCurrentLocation(display);
      setPickupCoordinate({
        latitude: location.latitude,
        longitude: location.longitude
      });
    } catch (error) {
      console.error('Failed to reverse geocode location:', error);
      // Use placeholder instead of coordinates
      setPickupQueryFragment('Min plats');
      setCurrentLocation('Min plats');
      setPickupCoordinate({
        latitude: location.latitude,
        longitude: location.longitude
      });
    }
  };

  const searchLocations = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 Searching for:', query);
      const results = await GeocodingService.searchLocations(query);
      console.log('📍 Search results received:', results.length, 'results');

      if (results && Array.isArray(results)) {
        setSearchResults(results.map(result => {
          const exact = toExactAddress(result.formatted_address);
          const segments = (exact || result.formatted_address).split(',').map(part => part.trim()).filter(Boolean);
          const title = segments.shift() || exact || result.formatted_address;
          const subtitle = segments.join(', ');
          return {
            description: exact || result.formatted_address,
            title,
            subtitle,
            coordinates: result.coordinates,
          } as SearchResult;
        }));
      } else {
        console.warn('Invalid results format:', results);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoute = async (from: Coordinate, to: Coordinate) => {
    setIsRouteLoading(true);
    try {
      console.log('🗺️ Fetching route from', from, 'to', to);
      const route = await RouteService.getRoute(from, to);
      console.log('✅ Route received with', route.length, 'points');
      setRoutePoints(route);
    } catch (error) {
      console.error('❌ Route fetch error:', error);
      setRoutePoints([]);
    } finally {
      setIsRouteLoading(false);
    }
  };

  const handleLocationSelect = async (result: SearchResult) => {
    if (activeField === 'pickup') {
      const exact = toExactAddress(result.description) || result.description;
      setPickupQueryFragment(formatAddress(exact));
      setPickupCoordinate(result.coordinates);
      setCurrentLocation(formatAddress(exact));

      // If we have destination already, fetch the route
      if (destinationCoordinate) {
        await fetchRoute(result.coordinates, destinationCoordinate);
      }

      // Switch to destination field
      setPickupIsFocused(false);
      setDestinationIsFocused(true);
      setActiveField('destination');
      destinationRef.current?.focus();

    } else {
      const exact = toExactAddress(result.description) || result.description;
      setQueryFragment(exact);
      setDestinationCoordinate(result.coordinates);
      setSelectedSpinLocation?.({
        coordinate: result.coordinates,
        title: exact,
      });

      console.log('🎯 Destination selected:', exact);
      console.log('📍 Destination coordinates:', result.coordinates);

      // If we have both pickup and destination, fetch the route
      let ensuredPickup = pickupCoordinate as Coordinate | null;
      if (!ensuredPickup) {
        // Try to geocode typed pickup text if exists
        const pickupText = (pickupQueryFragment || '').trim();
        if (pickupText.length >= 2) {
          try {
            const geo = await GeocodingService.geocodeAddressString(pickupText);
            if (geo) {
              setPickupCoordinate(geo);
              ensuredPickup = geo;
              console.log('📍 Derived pickup from text via geocode:', geo);
            }
          } catch { }
        }
      }
      if (!ensuredPickup && userLocation) {
        // Fallback: use user current location
        setPickupCoordinate(userLocation);
        ensuredPickup = userLocation;
        console.log('📍 Fallback pickup = userLocation');
      }

      if (ensuredPickup) {
        console.log('🗺️ Both coordinates available, fetching route...');
        await fetchRoute(ensuredPickup, result.coordinates);
      } else {
        console.log('⚠️ Pickup coordinate still missing; RideRequestView will open but route may compute later');
      }

      // Close search view after destination is selected
      Keyboard.dismiss();
      console.log('🚪 Closing LocationSearchView to trigger RideRequestView');
      // Close immediately so HomeScreen can open RideRequestView without waiting
      try { onClose(); } catch { }
    }
    setSearchResults([]);
  };

  const clearPickup = () => {
    setPickupQueryFragment('');
    setPickupCoordinate(null);
    setSearchResults([]);
    // Clear route when pickup is cleared
    setRoutePoints([]);
  };

  const clearDestination = () => {
    setQueryFragment('');
    setDestinationCoordinate(null);
    setSelectedSpinLocation?.(null);
    setSearchResults([]);
    // Clear route when destination is cleared
    setRoutePoints([]);
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleLocationSelect(item)}
    >
      <View style={[styles.iconContainer, {
        backgroundColor: pickupIsFocused ? '#4CAF50' : '#2196F3'
      }]}>
        <Icon
          name={pickupIsFocused ? 'location' : 'navigate'}
          size={16}
          color="white"
        />
      </View>
      <View style={styles.resultTexts}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {!!item.subtitle && (
          <Text style={styles.resultSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        )}
        {!item.subtitle && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>
      <Icon name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Välj plats</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search fields */}
      <View style={styles.searchContainer}>
        <View style={styles.iconsColumn}>
          <Icon name="location" size={16} color="#4CAF50" style={styles.locationIcon} />
          <View style={styles.connectionLine} />
          <Icon name="navigate" size={16} color="#2196F3" style={styles.destinationIcon} />
        </View>

        <View style={styles.inputsColumn}>
          {/* Pickup field */}
          <View style={[
            styles.inputContainer,
            pickupIsFocused && styles.inputContainerFocused
          ]}>
            <TextInput
              ref={pickupRef}
              style={styles.textInput}
              placeholder="Upphämtnings plats"
              placeholderTextColor="#999"
              value={pickupQueryFragment}
              onChangeText={setPickupQueryFragment}
              onFocus={() => {
                setPickupIsFocused(true);
                setDestinationIsFocused(false);
                setActiveField('pickup');
              }}
              onBlur={() => setPickupIsFocused(false)}
            />
            {pickupQueryFragment.length > 0 && (
              <TouchableOpacity onPress={clearPickup} style={styles.clearButton}>
                <Icon name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Destination field */}
          <View style={[
            styles.inputContainer,
            destinationIsFocused && styles.inputContainerFocused
          ]}>
            <TextInput
              ref={destinationRef}
              style={styles.textInput}
              placeholder="Vart ska du?"
              placeholderTextColor="#999"
              value={queryFragment}
              onChangeText={setQueryFragment}
              onFocus={() => {
                console.log('🎯 Destination field focused');
                setDestinationIsFocused(true);
                setPickupIsFocused(false);
                setActiveField('destination');
                // If there's already text, trigger search immediately
                if (queryFragment.length >= 2) {
                  searchLocations(queryFragment);
                }
              }}
              onBlur={() => {
                console.log('🎯 Destination field blurred');
                setDestinationIsFocused(false);
              }}
              autoFocus={true}
            />
            {queryFragment.length > 0 && (
              <TouchableOpacity onPress={clearDestination} style={styles.clearButton}>
                <Icon name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Search Results */}
      <View style={styles.resultsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.loadingText}>Söker platser...</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item, index) => `${item.coordinates.latitude}-${index}`}
            showsVerticalScrollIndicator={false}
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
          />
        ) : (pickupIsFocused && pickupQueryFragment.length >= 2) || (destinationIsFocused && queryFragment.length >= 2) ? (
          <View style={styles.noResultsContainer}>
            <Icon name="location-outline" size={24} color="#999" />
            <Text style={styles.noResultsText}>Inga platser hittades</Text>
            <Text style={styles.noResultsSubText}>
              Prova att ändra din sökning eller kontrollera stavningen
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  iconsColumn: {
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 12,
  },
  locationIcon: {
    marginBottom: 4,
  },
  connectionLine: {
    width: 2,
    height: 60,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  destinationIcon: {
    marginTop: 4,
  },
  inputsColumn: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputContainerFocused: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  clearButton: {
    marginLeft: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultTexts: {
    flex: 1,
    marginRight: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  resultSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: '#555',
    lineHeight: 18,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    marginTop: 8,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  noResultsSubText: {
    marginTop: 4,
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
});
