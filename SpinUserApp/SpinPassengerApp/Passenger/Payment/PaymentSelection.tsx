/**
 * PaymentSelection.tsx
 * 
 * UI för att välja betalmetod (sparade kort, nytt kort, Google Pay, kontant)
 */

import auth from '@react-native-firebase/auth';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PaymentViewModel, { SavedCard } from './PaymentViewModel';
import usePaymentSheet from './usePaymentSheet';

export type PaymentMethod = 'card' | 'google_pay' | 'cash';

interface PaymentSelectionProps {
    amount: number; // Belopp i SEK
    tripId?: string;
    onPaymentMethodSelected: (
        method: PaymentMethod,
        paymentMethodId?: string,
        paymentIntentId?: string
    ) => void;
    onClose: () => void;
}

const PaymentSelection: React.FC<PaymentSelectionProps> = ({
    amount,
    tripId,
    onPaymentMethodSelected,
    onClose,
}) => {
    const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

    const { initializePaymentSheet, openPaymentSheet, loading: sheetLoading } = usePaymentSheet();

    useEffect(() => {
        loadPaymentMethods();
    }, []);

    const loadPaymentMethods = async () => {
        setLoading(true);
        try {
            const user = auth().currentUser;
            if (!user || !user.email) {
                console.error('❌ Ingen inloggad användare');
                setLoading(false);
                return;
            }

            // Hämta eller skapa Stripe-kund
            const stripeCustomerId = await PaymentViewModel.createOrGetCustomer(
                user.uid,
                user.email
            );

            if (!stripeCustomerId) {
                console.error('❌ Kunde inte hämta Stripe-kund');
                setLoading(false);
                return;
            }

            setCustomerId(stripeCustomerId);

            // Hämta sparade kort
            const cards = await PaymentViewModel.listSavedCards(stripeCustomerId);
            setSavedCards(cards);
        } catch (error) {
            console.error('❌ Fel vid laddning av betalmetoder:', error);
            Alert.alert('Fel', 'Kunde inte ladda betalmetoder');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Hantera val av sparat kort
     */
    const handleSavedCardSelection = async (card: SavedCard) => {
        if (!customerId) return;

        // Endast markera vald betalmetod – ingen debitering här.
        // Själva debiteringen ska ske när användaren trycker på "Boka".
        setSelectedCardId(card.id);
        onPaymentMethodSelected('card', card.id);
    };

    /**
     * Lägg till nytt kort via PaymentSheet
     */
    const handleAddNewCard = async () => {
        if (!customerId) {
            Alert.alert('Fel', 'Ingen kund hittades');
            return;
        }

        try {
            // Skapa SetupIntent för att spara kort
            const setupIntent = await PaymentViewModel.createSetupIntent(customerId);

            if (!setupIntent) {
                Alert.alert('Fel', 'Kunde inte skapa SetupIntent');
                return;
            }

            // Initiera PaymentSheet med SetupIntent
            const initialized = await initializePaymentSheet(
                setupIntent.clientSecret,
                customerId,
                setupIntent.ephemeralKey
            );

            if (!initialized) {
                Alert.alert('Fel', 'Kunde inte initiera PaymentSheet');
                return;
            }

            // Visa PaymentSheet
            const { success, error } = await openPaymentSheet();

            if (success) {
                Alert.alert('Klart!', 'Kort sparat', [
                    {
                        text: 'OK',
                        onPress: () => loadPaymentMethods(), // Ladda om kort
                    },
                ]);
            } else if (error) {
                console.error('❌ PaymentSheet fel:', error);
            }
        } catch (error: any) {
            console.error('❌ Fel vid tillägg av kort:', error);
            Alert.alert('Fel', error.message || 'Kunde inte lägga till kort');
        }
    };

    /**
     * Betala med nytt kort (Google Pay ingår automatiskt)
     */
    const handlePayWithNewCard = async () => {
        // Ingen betalning här – välj endast "kort" som metod.
        // Kortuppgifter samlas in och debitering sker i samband med Boka.
        if (!customerId) {
            Alert.alert('Fel', 'Ingen kund hittades');
            return;
        }
        onPaymentMethodSelected('card');
    };

    /**
     * Betala kontant
     */
    const handleCashPayment = () => {
        onPaymentMethodSelected('cash');
    };

    const getCardIcon = (brand: string) => {
        switch (brand.toLowerCase()) {
            case 'visa':
                return 'card';
            case 'mastercard':
                return 'card';
            case 'amex':
                return 'card';
            default:
                return 'card-outline';
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Välj betalmetod</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={28} color="#333" />
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={styles.loadingText}>Laddar betalmetoder...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Välj betalmetod</Text>
                <TouchableOpacity onPress={onClose}>
                    <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
            </View>

            {/* Amount */}
            <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Belopp att betala</Text>
                <Text style={styles.amountValue}>{amount} kr</Text>
            </View>

            <ScrollView style={styles.scrollView}>
                {/* Sparade kort */}
                {savedCards.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Sparade kort</Text>
                        {savedCards.map((card) => (
                            <TouchableOpacity
                                key={card.id}
                                style={[
                                    styles.paymentOption,
                                    selectedCardId === card.id && styles.paymentOptionSelected,
                                ]}
                                onPress={() => handleSavedCardSelection(card)}
                                disabled={selectedCardId === card.id}
                            >
                                <Ionicons
                                    name={getCardIcon(card.brand) as any}
                                    size={24}
                                    color="#4CAF50"
                                />
                                <View style={styles.cardInfo}>
                                    <Text style={styles.cardBrand}>
                                        {card.brand.toUpperCase()}
                                    </Text>
                                    <Text style={styles.cardNumber}>•••• {card.last4}</Text>
                                    <Text style={styles.cardExpiry}>
                                        Utgår {card.expMonth}/{card.expYear}
                                    </Text>
                                </View>
                                {selectedCardId === card.id ? (
                                    <ActivityIndicator size="small" color="#4CAF50" />
                                ) : (
                                    <Ionicons name="chevron-forward" size={24} color="#999" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Lägg till nytt kort */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.paymentOption, styles.addCardOption]}
                        onPress={handleAddNewCard}
                        disabled={sheetLoading}
                    >
                        <Ionicons name="add-circle" size={24} color="#4CAF50" />
                        <Text style={styles.addCardText}>Lägg till nytt kort</Text>
                        {sheetLoading ? (
                            <ActivityIndicator size="small" color="#4CAF50" />
                        ) : (
                            <Ionicons name="chevron-forward" size={24} color="#999" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Betala med nytt kort / Google Pay */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.paymentOption, styles.newCardOption]}
                        onPress={handlePayWithNewCard}
                        disabled={sheetLoading}
                    >
                        <View style={styles.iconGroup}>
                            <Ionicons name="card" size={24} color="#2196F3" />
                            {Platform.OS === 'android' && (
                                <Ionicons
                                    name="logo-google"
                                    size={20}
                                    color="#4285F4"
                                    style={styles.googleIcon}
                                />
                            )}
                        </View>
                        <View style={styles.cardInfo}>
                            <Text style={styles.paymentOptionText}>
                                {Platform.OS === 'android'
                                    ? 'Välj kort eller Google Pay (debiteras vid bokning)'
                                    : 'Välj kort (debiteras vid bokning)'}
                            </Text>
                            <Text style={styles.paymentOptionSubtext}>
                                Kortuppgifter samlas in vid bokning
                            </Text>
                        </View>
                        {sheetLoading ? (
                            <ActivityIndicator size="small" color="#2196F3" />
                        ) : (
                            <Ionicons name="chevron-forward" size={24} color="#999" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Kontant */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.paymentOption, styles.cashOption]}
                        onPress={handleCashPayment}
                    >
                        <Ionicons name="cash" size={24} color="#FF9800" />
                        <View style={styles.cardInfo}>
                            <Text style={styles.paymentOptionText}>Betala kontant</Text>
                            <Text style={styles.paymentOptionSubtext}>
                                Betala föraren direkt
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#999" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    amountContainer: {
        padding: 20,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
    },
    amountLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    amountValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        marginTop: 20,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginBottom: 10,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    paymentOptionSelected: {
        backgroundColor: '#e8f5e9',
        borderColor: '#4CAF50',
    },
    addCardOption: {
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#4CAF50',
        backgroundColor: '#fff',
    },
    newCardOption: {
        borderColor: '#2196F3',
        backgroundColor: '#e3f2fd',
    },
    cashOption: {
        borderColor: '#FF9800',
        backgroundColor: '#fff3e0',
    },
    cardInfo: {
        flex: 1,
        marginLeft: 12,
    },
    cardBrand: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    cardNumber: {
        fontSize: 16,
        color: '#666',
        marginBottom: 2,
    },
    cardExpiry: {
        fontSize: 12,
        color: '#999',
    },
    paymentOptionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    paymentOptionSubtext: {
        fontSize: 13,
        color: '#666',
    },
    addCardText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#4CAF50',
        marginLeft: 12,
    },
    iconGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    googleIcon: {
        marginLeft: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
});

export default PaymentSelection;
