import Geolocation from 'react-native-geolocation-service';
import { CommonActions } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { AccountType } from '../../Authentication/AuthManager';
import FirebaseManager from '../../firebase/FirebaseManager';
import { ThemeColors, useAppTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';

const countries = [
    { flag: '🇸🇪', code: '+46' },
    { flag: '🇳🇴', code: '+47' },
    { flag: '🇩🇰', code: '+45' },
];

export default function RegisterPassScreen({ navigation }: any) {
    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(countries[0]);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [showAlert, setShowAlert] = useState(false);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const { registerUser, fetchCurrentUser } = useAuth();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Phone number formatting
    const handlePhoneChange = (text: string) => {
        let digits = text.replace(/\D/g, '');
        // Remove leading zero
        if (digits.startsWith('0')) digits = digits.slice(1);
        // Remove country code if present
        const countryCode = selectedCountry.code.replace('+', '');
        if (digits.startsWith(countryCode)) digits = digits.slice(countryCode.length);
        setPhoneNumber(`${selectedCountry.code}${digits}`);
    };

    const requestLocationPermission = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: 'Platsåtkomst behövs',
                    message: 'Vi behöver din plats för att slutföra registreringen.',
                    buttonPositive: 'OK',
                    buttonNegative: 'Avbryt',
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        // iOS: requestAuthorization behövs inte - konfigureras via Info.plist
        return true;
    }, []);

    const resolveCurrentLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
        if (userLocation) {
            return userLocation;
        }

        setLocationError(null);

        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            setLocationError('Platsåtkomst nekad. Vi använder Stockholm som standard.');
            return null;
        }

        return await new Promise(resolve => {
            Geolocation.getCurrentPosition(
                position => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                    setUserLocation(location);
                    resolve(location);
                },
                error => {
                    console.warn('Kunde inte hämta plats:', error);
                    setLocationError('Kunde inte hämta plats. Vi använder Stockholm som standard.');
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 10000,
                }
            );
        });
    }, [requestLocationPermission, userLocation]);

    React.useEffect(() => {
        resolveCurrentLocation();
    }, [resolveCurrentLocation]);

    const fallbackLocation = { latitude: 59.3293, longitude: 18.0686 };

    // Registration logic (passenger only)
    const handleRegistration = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!fullname) return showAlertMsg('Vänligen fyll i ditt fullständiga namn.');
        if (!normalizedEmail.includes('@')) return showAlertMsg('Vänligen fyll i en giltig e-postadress.');
        if (phoneNumber.length < 7) return showAlertMsg('Vänligen fyll i ett giltigt telefonnummer.');
        if (password.length < 6) return showAlertMsg('Lösenordet måste vara minst 6 tecken långt.');

        setIsLoading(true);

        try {
            let resolvedLocation = await resolveCurrentLocation();
            if (!resolvedLocation) {
                resolvedLocation = fallbackLocation;
            }

            const result = await registerUser?.(normalizedEmail, password, fullname, phoneNumber);

            if (!result?.ok) {
                showAlertMsg(result?.error ?? 'Ett fel uppstod vid registreringen.');
                return;
            }

            try {
                const firebaseAuth = FirebaseManager.getInstance().getAuth();
                if (firebaseAuth.currentUser) {
                    await firebaseAuth.currentUser.updateProfile({ displayName: fullname });
                }
            } catch (profileError) {
                console.warn('Kunde inte uppdatera profilnamn:', profileError);
            }

            await fetchCurrentUser();

            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'PassengerHome' }],
                })
            );

        } catch (error: any) {
            showAlertMsg(error?.message ?? 'Ett fel uppstod vid registreringen.');
        } finally {
            setIsLoading(false);
        }
    };

    const showAlertMsg = (msg: string) => {
        setAlertMessage(msg);
        setShowAlert(true);
    };

    // Show validation alert via useEffect
    React.useEffect(() => {
        if (showAlert) {
            Alert.alert('Meddelande', alertMessage, [
                { text: 'OK', onPress: () => setShowAlert(false) }
            ]);
        }
    }, [showAlert, alertMessage]);

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.header}>Skapa konto</Text>
                {locationError ? (
                    <Text style={styles.locationWarning}>{locationError}</Text>
                ) : null}

                {/* Namn */}
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Namn:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Fyll i ditt namn"
                        value={fullname}
                        onChangeText={setFullname}
                        autoCapitalize="words"
                        returnKeyType="next"
                        placeholderTextColor={colors.inputPlaceholder}
                    />
                </View>

                {/* E-post */}
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>E-postadress:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Fyll i ditt e-post"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        placeholderTextColor={colors.inputPlaceholder}
                    />
                </View>

                {/* Telefon + land */}
                <View style={styles.phoneRow}>
                    <TouchableOpacity
                        style={styles.countryBtn}
                        onPress={() => {
                            const nextIdx = (countries.findIndex(c => c.code === selectedCountry.code) + 1) % countries.length;
                            setSelectedCountry(countries[nextIdx]);
                            setPhoneNumber('');
                        }}
                    >
                        <Text style={styles.countryText}>{selectedCountry.flag} {selectedCountry.code}</Text>
                    </TouchableOpacity>
                    <TextInput
                        style={styles.phoneInput}
                        placeholder="701234568"
                        value={phoneNumber.replace(selectedCountry.code, '')}
                        onChangeText={handlePhoneChange}
                        keyboardType="phone-pad"
                        autoCorrect={false}
                        returnKeyType="next"
                        placeholderTextColor={colors.inputPlaceholder}
                    />
                </View>

                {/* Lösenord */}
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Lösenord:</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Fyll i ditt lösenord"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!isPasswordVisible}
                            autoCorrect={false}
                            returnKeyType="done"
                            placeholderTextColor={colors.inputPlaceholder}
                        />
                        <TouchableOpacity onPress={() => setIsPasswordVisible(v => !v)} style={styles.eyeBtn}>
                            <Text style={{ fontSize: 18 }}>{isPasswordVisible ? '🙈' : '👁️'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Villkor */}
                <View style={styles.termsRow}>
                    <Text style={styles.termsText}>Genom att skapa konto godkänner du våra </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        <TouchableOpacity onPress={() => Linking.openURL('https://www.spintaxi.se/anvandarvillkor-spintaxi/')}>
                            <Text style={styles.linkText}>resevillkor</Text>
                        </TouchableOpacity>
                        <Text style={styles.termsText}> och </Text>
                        <TouchableOpacity onPress={() => Linking.openURL('https://www.spintaxi.se/integritetspolicy/')}>
                            <Text style={styles.linkText}>integritetspolicy</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Registrera-knapp */}
                <TouchableOpacity
                    style={styles.registerBtn}
                    onPress={handleRegistration}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.registerBtnText}>Fortsätt ➔</Text>
                    )}
                </TouchableOpacity>

                {/* Logga in länk */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <Text style={[styles.termsText, { fontSize: 15, textAlign: 'center' }]}>
                        Har du redan ett konto?{' '}
                        <Text
                            style={styles.loginLink}
                            onPress={() => navigation.navigate('Login')}
                        >
                            Logga in
                        </Text>
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    header: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 16,
        marginTop: Platform.OS === 'android' ? 24 : 48,
        color: colors.textPrimary,
    },
    locationWarning: {
        color: colors.error,
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    fieldContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 6,
    },
    input: {
        backgroundColor: colors.inputBackground,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 50,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        color: colors.inputText,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    countryBtn: {
        paddingHorizontal: 10,
        height: 50,
        backgroundColor: colors.inputBackground,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.inputBorder,
    },
    countryText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.inputText,
    },
    phoneInput: {
        flex: 1,
        backgroundColor: colors.inputBackground,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 50,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        color: colors.inputText,
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    eyeBtn: {
        marginLeft: 8,
        padding: 8,
    },
    termsRow: {
        marginBottom: 16,
    },
    termsText: {
        fontSize: 13,
        color: colors.textMuted,
    },
    linkText: {
        color: colors.accent,
        fontWeight: 'bold',
        fontSize: 13,
        textDecorationLine: 'underline',
    },
    registerBtn: {
        backgroundColor: '#007AFF',
        height: 50,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    registerBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginLink: {
        color: colors.accent,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
});
