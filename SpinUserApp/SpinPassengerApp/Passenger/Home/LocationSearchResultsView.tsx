import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Coordinate, GeocodingService, LocationResult } from '../../utils/GeocodingService';

export type LocationSearchConfig = 'pickup' | 'ride';

interface LocationSearchResultsViewProps {
  config: LocationSearchConfig;
  searchQuery: string;
  onSelectLocation: (address: string, coordinate: Coordinate) => void;
}

export default function LocationSearchResultsView({
  config,
  searchQuery,
  onSelectLocation
}: LocationSearchResultsViewProps) {
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchWithDebounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await GeocodingService.searchLocations(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchWithDebounce);
  }, [searchQuery]);

  const handleLocationSelect = (result: LocationResult) => {
    onSelectLocation(result.formatted_address, result.coordinates);
  };

  const getIconForConfig = (config: LocationSearchConfig) => {
    return config === 'pickup' ? 'location' : 'navigate';
  };

  const getColorForConfig = (config: LocationSearchConfig) => {
    return config === 'pickup' ? '#4CAF50' : '#2196F3';
  };

  const renderLocationItem = ({ item }: { item: LocationResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleLocationSelect(item)}
    >
      <View style={[styles.iconContainer, { backgroundColor: getColorForConfig(config) }]}>
        <Icon
          name={getIconForConfig(config)}
          size={16}
          color="white"
        />
      </View>
      <View style={styles.textContainer}>
        {item.title ? (
          <>
            <Text style={styles.titleText} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.subtitleText} numberOfLines={1}>
              {item.subtitle || item.formatted_address}
            </Text>
          </>
        ) : (
          <Text style={styles.addressText} numberOfLines={2}>
            {item.formatted_address}
          </Text>
        )}
      </View>
      <Icon name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#666" />
        <Text style={styles.loadingText}>Söker platser...</Text>
      </View>
    );
  }

  if (searchResults.length === 0 && searchQuery.length >= 2) {
    return (
      <View style={styles.noResultsContainer}>
        <Icon name="location-outline" size={24} color="#999" />
        <Text style={styles.noResultsText}>Inga platser hittades</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={searchResults}
        renderItem={renderLocationItem}
        keyExtractor={(item, index) => `${item.coordinates.latitude}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 16,
    color: '#111',
    fontWeight: '600',
  },
  subtitleText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  addressText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
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
});