import { CommonActions } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemeColors, useAppTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';

export default function LoginPassScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [showAlert, setShowAlert] = useState(false);
    const { signIn, fetchCurrentUser } = useAuth();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Login logic
    const handleLogin = async () => {
        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail) {
            showAlertMsg('Vänligen fyll i din e-postadress.');
            return;
        }
        if (!normalizedEmail.includes('@')) {
            showAlertMsg('Vänligen fyll i en giltig e-postadress.');
            return;
        }
        if (password.length < 6) {
            showAlertMsg('Lösenordet måste vara minst 6 tecken långt.');
            return;
        }

        setIsLoading(true);

        try {
            const result = await signIn?.(normalizedEmail, password);

            if (!result?.ok) {
                setIsLoading(false);
                showAlertMsg(result?.error ?? 'Inloggningen misslyckades. Försök igen.');
                return;
            }

            // Fetch user data to ensure it's loaded
            await fetchCurrentUser();

            // Small delay to ensure auth state propagates through the system
            await new Promise(resolve => setTimeout(resolve, 300));

            // Navigation happens automatically via AppNavigator when auth state updates
            // But we reset just to be sure we're on the right screen
            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'PassengerHome' }],
                })
            );

        } catch (error: any) {
            setIsLoading(false);
            showAlertMsg(error?.message ?? 'Ett fel uppstod vid inloggningen.');
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
            Alert.alert('Information', alertMessage, [
                { text: 'OK', onPress: () => setShowAlert(false) }
            ]);
        }
    }, [showAlert, alertMessage]);

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Back button */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>

                <Text style={styles.header}>Logga in</Text>

                {/* E-postadress */}
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>E-postadress:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Din e-post"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
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
                            placeholder="Ditt lösenord"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!isPasswordVisible}
                            autoCorrect={false}
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
                            placeholderTextColor={colors.inputPlaceholder}
                        />
                        <TouchableOpacity onPress={() => setIsPasswordVisible(v => !v)} style={styles.eyeBtn}>
                            <Text style={{ fontSize: 18 }}>{isPasswordVisible ? '🙈' : '👁️'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Login button */}
                <TouchableOpacity
                    style={styles.loginBtn}
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.loginBtnText}>Logga in ➔</Text>
                    )}
                </TouchableOpacity>

                {/* Glömt lösenord */}
                <TouchableOpacity
                    style={styles.forgotPasswordBtn}
                    onPress={() => navigation.navigate('ForgotPassword')}
                >
                    <Text style={styles.forgotPasswordText}>Glömt lösenord?</Text>
                </TouchableOpacity>

                {/* Registrera länk */}
                <View style={{ alignItems: 'center', marginTop: 24 }}>
                    <Text style={[styles.termsText, { fontSize: 15, textAlign: 'center' }]}>
                        Har du inget konto?{' '}
                        <Text
                            style={styles.registerLink}
                            onPress={() => navigation.navigate('Register')}
                        >
                            Registrera dig
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
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        marginTop: Platform.OS === 'android' ? 8 : 32,
        marginBottom: 8,
    },
    backIcon: {
        fontSize: 28,
        color: colors.textPrimary,
    },
    header: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 24,
        color: colors.textPrimary,
    },
    fieldContainer: {
        marginBottom: 20,
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
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    eyeBtn: {
        marginLeft: 8,
        padding: 8,
    },
    loginBtn: {
        backgroundColor: '#1E90FF',
        height: 50,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        shadowColor: '#1E90FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    loginBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    forgotPasswordBtn: {
        alignItems: 'center',
        marginTop: 16,
    },
    forgotPasswordText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    termsText: {
        fontSize: 13,
        color: colors.textMuted,
    },
    registerLink: {
        color: colors.accent,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
});
