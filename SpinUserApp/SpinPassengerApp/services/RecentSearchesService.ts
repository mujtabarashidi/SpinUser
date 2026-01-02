import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecentSearch {
  id: string;
  address: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  timestamp: Date;
}

const RECENT_SEARCHES_KEY = '@recent_searches';
const MAX_RECENT_SEARCHES = 5;

class RecentSearchesService {
  /**
   * Save a recent search
   */
  async saveSearch(userId: string, address: string, coordinate: { latitude: number; longitude: number }): Promise<void> {
    try {
      const searches = await this.getRecentSearches(userId);
      
      // Remove duplicate if exists
      const filtered = searches.filter(s => s.address !== address);
      
      // Add new search at the beginning
      const newSearch: RecentSearch = {
        id: `${Date.now()}-${Math.random()}`,
        address,
        coordinate,
        timestamp: new Date(),
      };
      
      filtered.unshift(newSearch);
      
      // Keep only the latest searches
      const limited = filtered.slice(0, MAX_RECENT_SEARCHES);
      
      await AsyncStorage.setItem(`${RECENT_SEARCHES_KEY}_${userId}`, JSON.stringify(limited));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  }

  /**
   * Get recent searches for user
   */
  async getRecentSearches(userId: string): Promise<RecentSearch[]> {
    try {
      const data = await AsyncStorage.getItem(`${RECENT_SEARCHES_KEY}_${userId}`);
      if (data) {
        const searches = JSON.parse(data);
        // Convert timestamp strings back to Date objects
        return searches.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp),
        }));
      }
      return [];
    } catch (error) {
      console.error('Error getting recent searches:', error);
      return [];
    }
  }

  /**
   * Clear all recent searches for user
   */
  async clearRecentSearches(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${RECENT_SEARCHES_KEY}_${userId}`);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  }

  /**
   * Delete a specific recent search
   */
  async deleteSearch(userId: string, searchId: string): Promise<void> {
    try {
      const searches = await this.getRecentSearches(userId);
      const filtered = searches.filter(s => s.id !== searchId);
      await AsyncStorage.setItem(`${RECENT_SEARCHES_KEY}_${userId}`, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting recent search:', error);
    }
  }
}

export default new RecentSearchesService();
