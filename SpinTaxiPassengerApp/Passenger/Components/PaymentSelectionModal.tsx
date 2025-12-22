import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { PaymentOption } from '../../types/PaymentOption';
import { PaymentButton } from './PaymentButton';

interface PaymentSelectionModalProps {
    visible: boolean;
    paymentOptions: PaymentOption[];
    selectedPayment: PaymentOption | null;
    onSelect: (option: PaymentOption) => void;
    onClose: () => void;
}

export const PaymentSelectionModal: React.FC<PaymentSelectionModalProps> = ({
    visible,
    paymentOptions,
    selectedPayment,
    onSelect,
    onClose
}) => {
    const handleOptionSelect = (option: PaymentOption) => {
        onSelect(option);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
            transparent
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={styles.grabber} />
                        <Text style={styles.title}>Välj betalningssätt</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                        >
                            <Icon name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.optionsContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {paymentOptions.map((option) => (
                            <View key={option.id} style={styles.optionWrapper}>
                                <PaymentButton
                                    paymentOption={option}
                                    onPress={handleOptionSelect}
                                    style={StyleSheet.flatten([
                                        styles.paymentOption,
                                        selectedPayment?.id === option.id && styles.selectedOption
                                    ])}
                                    size="large"
                                />
                                {selectedPayment?.id === option.id && (
                                    <Icon
                                        name="checkmark-circle"
                                        size={24}
                                        color="#007AFF"
                                        style={styles.checkmark}
                                    />
                                )}
                            </View>
                        ))}
                    </ScrollView>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Dina betalningsuppgifter hanteras säkert och krypterat.
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        minHeight: 400,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 20,
        alignItems: 'center',
        position: 'relative',
    },
    grabber: {
        width: 36,
        height: 4,
        backgroundColor: '#919194ff',
        borderRadius: 2,
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000',
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        top: 20,
        padding: 8,
    },
    optionsContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    optionWrapper: {
        position: 'relative',
        marginBottom: 12,
    },
    paymentOption: {
        width: '100%',
        justifyContent: 'flex-start',
    },
    selectedOption: {
        borderColor: '#007AFF',
        borderWidth: 2,
        backgroundColor: 'rgba(0,122,255,0.05)',
    },
    checkmark: {
        position: 'absolute',
        right: 16,
        top: '50%',
        marginTop: -12,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
    },
    footerText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default PaymentSelectionModal;