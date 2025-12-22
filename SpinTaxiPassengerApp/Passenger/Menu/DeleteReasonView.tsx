import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useAuthViewModel } from '../../Authentication/AuthManager';
import FirebaseManager from '../../firebase/FirebaseManager';

export default function DeleteReasonView() {
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const auth = useAuthViewModel();

  const handleConfirmDeletion = async () => {
    if (!auth.currentUser) {
      Alert.alert('Fel', 'Du måste vara inloggad för att radera ditt konto.');
      return;
    }

    Alert.alert(
      'Bekräfta radering',
      'Är du säker på att du vill radera ditt konto? Du har 90 dagar på dig att ångra dig genom att logga in igen.',
      [
        {
          text: 'Avbryt',
          style: 'cancel'
        },
        {
          text: 'Radera',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              
              // Get Firebase Auth user (not our custom User type)
              const firebaseManager = FirebaseManager.getInstance();
              const firebaseAuth = firebaseManager.getAuth();
              const firebaseUser = firebaseAuth.currentUser;
              
              if (!firebaseUser) {
                Alert.alert('Fel', 'Du måste vara inloggad för att radera ditt konto.');
                setIsDeleting(false);
                return;
              }

              console.log('🔑 User ID:', firebaseUser.uid);
              console.log('🔑 User email:', firebaseUser.email);

              // Force token refresh to ensure authentication is valid
              const token = await firebaseUser.getIdToken(true);
              console.log('✅ Got fresh token:', token ? 'Yes' : 'No');
              
              // Small delay to ensure token is propagated
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Anropa Cloud Function för kontoborttagning
              const functions = firebaseManager.getFunctions();
              const requestAccountDeletion = functions.httpsCallable('requestAccountDeletion');
              
              console.log('📞 Calling requestAccountDeletion...');
              const result = await requestAccountDeletion({
                reason: reason.trim() || 'Ingen anledning angiven'
              });

              console.log('✅ Account deletion result:', result.data);

              // Logga ut användaren
              await auth.signOut();

              Alert.alert(
                'Konto markerat för radering',
                result.data.message || 'Ditt konto har markerats för radering. Du har 90 dagar på dig att ångra dig genom att logga in igen.',
                [{ text: 'OK' }]
              );

            } catch (error: any) {
              console.error('❌ Error deleting account:', error);
              console.error('❌ Error code:', error.code);
              console.error('❌ Error message:', error.message);
              Alert.alert(
                'Fel',
                error.message || 'Kunde inte radera kontot. Försök igen senare.'
              );
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Radera konto</Text>
      
      <Text style={styles.description}>
        Vi är ledsna att se dig gå. Ditt konto kommer att markeras för radering
        och raderas permanent efter 90 dagar om du inte loggar in igen.
      </Text>

      <Text style={styles.label}>Varför vill du radera ditt konto? (valfritt)</Text>
      <TextInput
        style={styles.input}
        placeholder="Skriv din anledning här..."
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!isDeleting}
      />

      <Text style={styles.warningText}>
        ⚠️ Efter 90 dagar kommer följande att raderas permanent:{'\n'}
        • Din profilinformation{'\n'}
        • Din resehistorik{'\n'}
        • Alla sparade betalningsmetoder{'\n'}
        • Alla dina preferenser
      </Text>

      <TouchableOpacity
        style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
        onPress={handleConfirmDeletion}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.deleteButtonText}>Radera mitt konto</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.infoText}>
        💡 Du kan ångra dig när som helst inom 90 dagar genom att helt enkelt
        logga in igen. Ditt konto kommer då återställas automatiskt.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111827',
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 24,
    backgroundColor: '#f9fafb',
  },
  warningText: {
    fontSize: 14,
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    lineHeight: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 14,
    color: '#059669',
    backgroundColor: '#ecfdf5',
    padding: 16,
    borderRadius: 12,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
});
