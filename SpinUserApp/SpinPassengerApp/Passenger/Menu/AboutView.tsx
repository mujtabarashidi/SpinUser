import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, ScrollView, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type AboutViewProps = {
  navigation?: any;
};

export default function AboutView({ navigation }: AboutViewProps) {
  const openURL = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {navigation && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Om</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.description}>
          Spin – Hållbar taxi i Sverige. Vi gör resor tryggare, schysstare och grönare – med verifierade förare, elbilar och smart ruttoptimering. Ditt val gör skillnad.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Information</Text>
        
        <TouchableOpacity 
          style={styles.row}
          onPress={() => openURL('https://play.google.com/store/apps/details?id=com.spinpassengerapp&pcampaignid=web_share')}
        >
          <Icon name="star" size={20} color="#FFD700" style={styles.icon} />
          <Text style={styles.rowText}>Betyg och recensioner</Text>
          <Icon name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.row}
          onPress={() => openURL('https://www.facebook.com/spintaxi')}
        >
          <Icon name="thumbs-up" size={20} color="#1877F2" style={styles.icon} />
          <Text style={styles.rowText}>Följ oss på Facebook</Text>
          <Icon name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.row}
          onPress={() => openURL('https://www.spintaxi.se/omoss/')}
        >
          <Icon name="briefcase" size={20} color="#FF9500" style={styles.icon} />
          <Text style={styles.rowText}>Företagsresor</Text>
          <Icon name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.versionContainer}>
        <Text style={styles.version}>Version 1.1.1</Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  placeholder: {
    width: 40,
  },
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  icon: {
    marginRight: 14,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    color: '#111',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  version: {
    fontSize: 13,
    color: '#999',
  },
});
