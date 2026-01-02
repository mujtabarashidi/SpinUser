import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthViewModel } from '../../Authentication/AuthManager';
import SavedPlacesService, { SavedPlace } from '../../services/SavedPlacesService';
import { GeocodingService } from '../../utils/GeocodingService';

interface SavedPlacesScreenProps {
  navigation: any;
}

export default function SavedPlacesScreen({ navigation }: SavedPlacesScreenProps) {
  const { currentUser } = useAuthViewModel();
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: 'favorite' as 'home' | 'work' | 'favorite',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSavedPlaces();
  }, [currentUser?.uid]);

  const loadSavedPlaces = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      const places = await SavedPlacesService.getSavedPlaces(currentUser.uid);
      setSavedPlaces(places);
    } catch (error) {
      console.error('Error loading saved places:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = (type?: 'home' | 'work' | 'favorite') => {
    setEditingPlace(null);
    setFormData({
      name: type === 'home' ? 'Home' : type === 'work' ? 'Work' : '',
      address: '',
      type: type || 'favorite',
    });
    setModalVisible(true);
  };

  const openEditModal = (place: SavedPlace) => {
    setEditingPlace(place);
    setFormData({
      name: place.name,
      address: place.address,
      type: place.type,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!currentUser?.uid || !formData.name.trim() || !formData.address.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      // Geocode the address to get coordinates
      const results = await GeocodingService.searchLocations(formData.address);
      if (!results || results.length === 0) {
        Alert.alert('Error', 'Could not find coordinates for this address');
        setSaving(false);
        return;
      }

      const coordinate = {
        latitude: results[0].coordinates.latitude,
        longitude: results[0].coordinates.longitude,
      };

      if (editingPlace) {
        // Update existing place
        await SavedPlacesService.updatePlace(currentUser.uid, editingPlace.id, {
          name: formData.name.trim(),
          address: formData.address.trim(),
          type: formData.type,
          coordinate,
        });
      } else {
        // Add new place
        await SavedPlacesService.savePlace(currentUser.uid, {
          name: formData.name.trim(),
          address: formData.address.trim(),
          type: formData.type,
          coordinate,
        });
      }

      setModalVisible(false);
      loadSavedPlaces();
    } catch (error) {
      console.error('Error saving place:', error);
      Alert.alert('Error', 'Failed to save place');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (place: SavedPlace) => {
    Alert.alert(
      'Delete Place',
      `Are you sure you want to delete "${place.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser?.uid) return;
            await SavedPlacesService.deletePlace(currentUser.uid, place.id);
            loadSavedPlaces();
          },
        },
      ]
    );
  };

  const getIconName = (type: string) => {
    switch (type) {
      case 'home':
        return 'home';
      case 'work':
        return 'briefcase';
      case 'favorite':
        return 'star';
      default:
        return 'location';
    }
  };

  const homePlace = savedPlaces.find(p => p.type === 'home');
  const workPlace = savedPlaces.find(p => p.type === 'work');
  const favoritePlaces = savedPlaces.filter(p => p.type === 'favorite');

  const renderPlace = ({ item }: { item: SavedPlace }) => (
    <View style={styles.placeCard}>
      <View style={styles.placeIcon}>
        <Icon name={getIconName(item.type)} size={24} color="#3b82f6" />
      </View>
      <View style={styles.placeInfo}>
        <Text style={styles.placeName}>{item.name}</Text>
        <Text style={styles.placeAddress}>{item.address}</Text>
      </View>
      <View style={styles.placeActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <Icon name="pencil" size={20} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
        >
          <Icon name="trash" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Places</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.quickAddSection}>
        <Text style={styles.sectionTitle}>Quick Add</Text>
        <View style={styles.quickAddButtons}>
          {!homePlace && (
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => openAddModal('home')}
            >
              <Icon name="home" size={24} color="#3b82f6" />
              <Text style={styles.quickAddText}>Add Home</Text>
            </TouchableOpacity>
          )}
          {!workPlace && (
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => openAddModal('work')}
            >
              <Icon name="briefcase" size={24} color="#3b82f6" />
              <Text style={styles.quickAddText}>Add Work</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={savedPlaces}
        keyExtractor={item => item.id}
        renderItem={renderPlace}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="location-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No saved places yet</Text>
            <Text style={styles.emptySubtext}>
              Add your favorite locations for quick access
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => openAddModal('favorite')}
      >
        <Icon name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPlace ? 'Edit Place' : 'Add Place'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeButtons}>
                  {(['home', 'work', 'favorite'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formData.type === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, type })}
                    >
                      <Icon
                        name={getIconName(type)}
                        size={20}
                        color={formData.type === type ? '#fff' : '#6b7280'}
                      />
                      <Text
                        style={[
                          styles.typeButtonText,
                          formData.type === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={name => setFormData({ ...formData, name })}
                  placeholder="e.g., Home, Office, Mom's House"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.address}
                  onChangeText={address => setFormData({ ...formData, address })}
                  placeholder="Enter full address"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingPlace ? 'Update Place' : 'Save Place'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  quickAddSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  quickAddButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAddButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  placeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 14,
    color: '#6b7280',
  },
  placeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
