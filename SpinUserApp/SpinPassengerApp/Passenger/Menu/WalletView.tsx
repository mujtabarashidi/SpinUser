import auth from '@react-native-firebase/auth';
import { useStripe } from '@stripe/stripe-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PaymentManager from '../../services/PaymentManager';
import { PaymentMethodType, PaymentOption } from '../../types/PaymentOption';
import { PaymentButton } from '../Components/PaymentButton';
import { PaymentSelectionModal } from '../Components/PaymentSelectionModal';
import PaymentViewModel from '../Payment/PaymentViewModel';

interface WalletViewProps {
    onClose?: () => void;
}

export default function WalletView({ onClose }: WalletViewProps) {
    const isDarkMode = useColorScheme() === 'dark';
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
    const [selectedPayment, setSelectedPayment] = useState<PaymentOption | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingCard, setIsAddingCard] = useState(false);

    useEffect(() => {
        loadWalletData();
    }, []);

    const loadWalletData = async () => {
        try {
            setIsLoading(true);
            console.log('📋 [WalletView] Hämtar betalningsmetoder...');
            const paymentManager = PaymentManager.getInstance();
            const options = await paymentManager.getAvailablePaymentOptions();

            console.log('✅ [WalletView] Hämtade betalningsmetoder:', options.length);
            console.log('📝 [WalletView] Betalningsmetoder:', JSON.stringify(options, null, 2));

            setPaymentOptions(options);
            if (options.length > 0) {
                setSelectedPayment(options[0]);
            }
        } catch (error) {
            console.error('❌ [WalletView] Error loading wallet data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPaymentMethod = () => {
        Alert.alert(
            'Lägg till betalningsmetod',
            'Välj typ av betalningsmetod',
            [
                { text: 'Kort', onPress: () => handleAddCard() },
                { text: 'Digital plånbok', onPress: () => handleAddDigitalWallet() },
                { text: 'Avbryt', style: 'cancel' }
            ]
        );
    };

    const handleAddCard = async () => {
        try {
            setIsAddingCard(true);

            // Hämta Firebase user
            const user = auth().currentUser;
            if (!user) {
                Alert.alert('Fel', 'Du måste vara inloggad för att lägga till kort');
                return;
            }

            console.log('🔐 Användare:', user.uid, user.email);

            // Skapa eller hämta Stripe customer
            console.log('📡 Skapar Stripe customer...');
            const stripeCustomerId = await PaymentViewModel.createOrGetCustomer(
                user.uid,
                user.email || ''
            );

            console.log('✅ Stripe Customer ID:', stripeCustomerId);

            if (!stripeCustomerId) {
                throw new Error('Kunde inte skapa Stripe-kund. Kontrollera din internetanslutning och backend-URL.');
            }

            // Skapa SetupIntent för att spara kort utan att debitera
            console.log('📡 Skapar SetupIntent...');
            const setupIntent = await PaymentViewModel.createSetupIntent(stripeCustomerId);

            console.log('✅ SetupIntent skapad:', setupIntent);

            if (!setupIntent) {
                throw new Error('Kunde inte skapa Setup Intent');
            }

            // Initiera PaymentSheet med SetupIntent
            console.log('📱 Initierar PaymentSheet...');
            const { error: initError } = await initPaymentSheet({
                setupIntentClientSecret: setupIntent.clientSecret,
                customerId: stripeCustomerId,
                customerEphemeralKeySecret: setupIntent.ephemeralKey,
                merchantDisplayName: 'Spin Taxi',
                allowsDelayedPaymentMethods: true,
            });

            if (initError) {
                console.error('❌ Init error:', initError);
                throw new Error(initError.message);
            }

            // Visa PaymentSheet
            console.log('📱 Visar PaymentSheet...');
            const { error: presentError } = await presentPaymentSheet();

            if (presentError) {
                if (presentError.code !== 'Canceled') {
                    console.error('❌ Present error:', presentError);
                    throw new Error(presentError.message);
                }
                console.log('ℹ️ Användaren avbröt');
                return; // Användaren avbröt
            }

            // Framgång! Ladda om betalningsmetoder
            console.log('✅ Kort tillagt!');
            Alert.alert('Succé!', 'Kortet har lagts till');
            await loadWalletData();

        } catch (error: any) {
            console.error('❌ Error adding card:', error);
            Alert.alert(
                'Fel vid tillägg av kort',
                error.message || 'Kunde inte lägga till kort. Försök igen senare.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsAddingCard(false);
        }
    };

    const handleAddDigitalWallet = () => {
        setShowPaymentModal(true);
    };

    const handleRemovePaymentMethod = (option: PaymentOption) => {
        Alert.alert(
            'Ta bort betalningsmetod',
            `Vill du ta bort ${option.displayName}?`,
            [
                {
                    text: 'Ta bort',
                    style: 'destructive',
                    onPress: () => {
                        setPaymentOptions(prev => prev.filter(p => p.id !== option.id));
                        if (selectedPayment?.id === option.id) {
                            setSelectedPayment(paymentOptions[0] || null);
                        }
                    }
                },
                { text: 'Avbryt', style: 'cancel' }
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.loadingContainer, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
                <Text style={[styles.loadingText, { color: isDarkMode ? '#fff' : '#000' }]}>
                    Laddar plånbok...
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0B0B0F' : '#F5F6FA' }]}>
            <StatusBar
                translucent={false}
                backgroundColor={isDarkMode ? '#0B0B0F' : '#F5F6FA'}
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            />
            <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 24 }}
                contentInsetAdjustmentBehavior="never"
            >
                {/* Header */}
                <View style={[styles.header, { backgroundColor: isDarkMode ? '#1c1c1e' : '#f8f9fa' }]}>
                    <View style={styles.headerTop}>
                        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                            Min Plånbok
                        </Text>
                    </View>
                    <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#8e8e93' : '#666' }]}>
                        Hantera dina betalningsmetoder
                    </Text>
                </View>

                {/* Betalningsmetoder */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                            Betalningsmetoder
                        </Text>
                    </View>

                    {paymentOptions.length === 0 ? (
                        <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#1c1c1e' : '#f8f9fa' }]}>
                            <Icon name="card-outline" size={48} color="#8e8e93" />
                            <Text style={[styles.emptyText, { color: isDarkMode ? '#8e8e93' : '#666' }]}>
                                Inga betalningsmetoder tillagda
                            </Text>
                            <TouchableOpacity
                                style={[styles.addButton, isAddingCard && styles.addButtonDisabled]}
                                onPress={handleAddPaymentMethod}
                                disabled={isAddingCard}
                            >
                                {isAddingCard ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.addButtonText}>Lägg till betalningsmetod</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {paymentOptions.map((option) => (
                                <View key={option.id} style={[styles.paymentMethodCard, { backgroundColor: isDarkMode ? '#1c1c1e' : '#fff' }]}>
                                    <PaymentButton
                                        paymentOption={option}
                                        onPress={() => setSelectedPayment(option)}
                                        style={StyleSheet.flatten([
                                            styles.paymentMethod,
                                            selectedPayment?.id === option.id && styles.selectedPaymentMethod
                                        ])}
                                        size="large"
                                    />

                                </View>
                            ))}
                            <TouchableOpacity 
                                style={[styles.addCardButton, isAddingCard && styles.addButtonDisabled]}
                                onPress={handleAddPaymentMethod} 
                                disabled={isAddingCard}
                            >
                                {isAddingCard ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Icon name="add-circle-outline" size={20} color="#fff" />
                                        <Text style={styles.addCardButtonText}>Lägg till kort</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Transaktionshistorik */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                        Senaste transaktioner
                    </Text>

                    <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#1c1c1e' : '#f8f9fa' }]}>
                        <Icon name="receipt-outline" size={48} color="#8e8e93" />
                        <Text style={[styles.emptyText, { color: isDarkMode ? '#8e8e93' : '#666' }]}>
                            Inga transaktioner än
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Payment Selection Modal */}
            <PaymentSelectionModal
                visible={showPaymentModal}
                paymentOptions={paymentOptions.filter(opt =>
                    opt.type === PaymentMethodType.GOOGLE_PAY
                )}
                selectedPayment={selectedPayment}
                onSelect={(option) => {
                    setSelectedPayment(option);
                    setShowPaymentModal(false);
                }}
                onClose={() => setShowPaymentModal(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 12,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
    },
    header: {
        padding: 20,
        paddingTop: 24,
        paddingBottom: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginHorizontal: 0,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
        marginLeft: -8,
    },
    headerSpacer: {
        width: 40,
    },
    balanceCard: {
        marginHorizontal: 12,
        marginTop: 8,
        marginBottom: 12,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E6E8EF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    balanceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    balanceTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    balanceAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    topUpButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#0A84FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 6,
    },
    topUpText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 8,
    },
    section: {
        marginHorizontal: 12,
        marginTop: 0,
        marginBottom: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 6,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    emptyState: {
        padding: 40,
        borderRadius: 16,
        alignItems: 'center',
        minHeight: 140,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 12,
        marginBottom: 20,
    },
    addButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonDisabled: {
        opacity: 0.6,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    addCardButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 12,
        marginBottom: 16,
    },
    addCardButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 8,
    },
    paymentMethodCard: {
        marginBottom: 12,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        position: 'relative',
        overflow: 'hidden',
    },
    paymentMethod: {
        margin: 0,
        borderRadius: 12,
    },
    selectedPaymentMethod: {
        borderColor: '#007AFF',
        borderWidth: 2,
        backgroundColor: 'rgba(10,132,255,0.08)',
    },
    cardDetails: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    cardBrand: {
        fontSize: 14,
        marginBottom: 2,
    },
    cardHolder: {
        fontSize: 14,
    },
    removeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 10,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 8,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    transactionIcon: {
        marginRight: 12,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionDescription: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 2,
    },
    transactionDate: {
        fontSize: 14,
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: '600',
    },
});