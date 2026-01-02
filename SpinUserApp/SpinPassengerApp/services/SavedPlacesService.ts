import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

export interface SavedPlace {
  id: string;
  name: string;
  address: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  type: 'home' | 'work' | 'favorite';
  createdAt: Date;
  updatedAt: Date;
}

const SAVED_PLACES_KEY = '@saved_places';

class SavedPlacesService {
  /**
   * Get all saved places for current user
   * All places stored locally
   */
  async getSavedPlaces(userId: string): Promise<SavedPlace[]> {
    try {
      return await this.getLocalPlaces(userId);
    } catch (error) {
      console.error('Error getting saved places:', error);
      return [];
    }
  }

  /**
   * Get places from local storage only
   */
  private async getLocalPlaces(userId: string): Promise<SavedPlace[]> {
    try {
      const localData = await AsyncStorage.getItem(`${SAVED_PLACES_KEY}_${userId}`);
      if (localData) {
        const places = JSON.parse(localData);
        return places.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));
      }
      return [];
    } catch (error) {
      console.error('Error getting local places:', error);
      return [];
    }
  }

  /**
   * Save a place for current user
   * All places saved locally only
   */
  async savePlace(userId: string, place: Omit<SavedPlace, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedPlace | null> {
    try {
      const now = new Date();
      const placeData = {
        ...place,
        createdAt: now,
        updatedAt: now,
      };

      const savedPlace: SavedPlace = {
        id: `${place.type}_${Date.now()}`,
        ...placeData,
      };

      const places = await this.getLocalPlaces(userId);
      
      // For home and work, remove existing before adding new
      if (place.type === 'home' || place.type === 'work') {
        const filtered = places.filter(p => p.type !== place.type);
        filtered.push(savedPlace);
        await AsyncStorage.setItem(`${SAVED_PLACES_KEY}_${userId}`, JSON.stringify(filtered));
      } else {
        // For favorites, just add to the list
        places.push(savedPlace);
        await AsyncStorage.setItem(`${SAVED_PLACES_KEY}_${userId}`, JSON.stringify(places));
      }

      return savedPlace;
    } catch (error) {
      console.error('Error saving place:', error);
      return null;
    }
  }

  /**
   * Update a saved place
   */
  async updatePlace(userId: string, placeId: string, updates: Partial<Omit<SavedPlace, 'id' | 'createdAt'>>): Promise<boolean> {
    try {
      const now = new Date();
      const places = await this.getLocalPlaces(userId);
      const index = places.findIndex(p => p.id === placeId);
      
      if (index !== -1) {
        places[index] = { ...places[index], ...updates, updatedAt: now };
        await AsyncStorage.setItem(`${SAVED_PLACES_KEY}_${userId}`, JSON.stringify(places));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating place:', error);
      return false;
    }
  }

  /**
   * Delete a saved place
   */
  async deletePlace(userId: string, placeId: string): Promise<boolean> {
    try {
      const places = await this.getLocalPlaces(userId);
      const filtered = places.filter(p => p.id !== placeId);
      await AsyncStorage.setItem(`${SAVED_PLACES_KEY}_${userId}`, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting place:', error);
      return false;
    }
  }

  /**
   * Get a specific place by type (home or work)
   * Always retrieves from local storage for home and work
   */
  async getPlaceByType(userId: string, type: 'home' | 'work'): Promise<SavedPlace | null> {
    try {
      const places = await this.getLocalPlaces(userId);
      return places.find(p => p.type === type) || null;
    } catch (error) {
      console.error('Error getting place by type:', error);
      return null;
    }
  }

  /**
   * Get favorite places
   */
  async getFavoritePlaces(userId: string): Promise<SavedPlace[]> {
    try {
      const places = await this.getLocalPlaces(userId);
      return places.filter(p => p.type === 'favorite')
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Error getting favorite places:', error);
      return [];
    }
  }
}

export default new SavedPlacesService();
