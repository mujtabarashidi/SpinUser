import React from 'react';
import {
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { PaymentMethodType, PaymentOption } from '../../types/PaymentOption';

interface PaymentButtonProps {
    paymentOption: PaymentOption;
    onPress: (option: PaymentOption) => void;
    style?: ViewStyle;
    textStyle?: TextStyle;
    disabled?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({
    paymentOption,
    onPress,
    style,
    textStyle,
    disabled = false,
    size = 'medium'
}) => {
    const buttonStyle = [
        styles.button,
        styles[`button_${size}`],
        paymentOption.type === PaymentMethodType.GOOGLE_PAY
            ? styles.digitalPayButton
            : styles.standardButton,
        disabled && styles.buttonDisabled,
        style
    ];

    const textStyleCombined = [
        styles.buttonText,
        styles[`text_${size}`],
        paymentOption.type === PaymentMethodType.GOOGLE_PAY
            ? styles.digitalPayText
            : styles.standardText,
        disabled && styles.textDisabled,
        textStyle
    ];

    const getIconColor = () => {
        if (disabled) return '#999';
        if (paymentOption.type === PaymentMethodType.GOOGLE_PAY) return '#4285F4';
        return '#666';
    };

    const getIconName = () => {
        switch (paymentOption.type) {
            case PaymentMethodType.GOOGLE_PAY:
                return 'google';
            case PaymentMethodType.CASH:
                return 'money-bill-wave';
            case PaymentMethodType.CARD:
                return 'credit-card';
            case PaymentMethodType.COMPANY:
                return 'briefcase';
            case PaymentMethodType.NEW_CARD:
                return 'plus-circle';
            default:
                return 'credit-card';
        }
    };

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={() => !disabled && onPress(paymentOption)}
            disabled={disabled}
            activeOpacity={0.8}
        >
            <View style={styles.buttonContent}>
                <Icon
                    name={getIconName()}
                    size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
                    color={getIconColor()}
                    style={styles.icon}
                />
                <Text style={textStyleCombined}>
                    {paymentOption.displayName}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

// Kompaktkomponent för betalningsrad (som i RideRequestView)
interface PaymentRowProps {
    selectedPayment: PaymentOption | null | undefined;
    onPaymentPress: () => void;
    onNotePress?: () => void;
    note?: string;
    style?: ViewStyle;
}

export const PaymentRow: React.FC<PaymentRowProps> = ({
    selectedPayment,
    onPaymentPress,
    onNotePress,
    note,
    style
}) => {
    // Säkerhetscheck om selectedPayment är undefined
    if (!selectedPayment) {
        return null; // Returnera ingenting tills betalningsalternativ laddats
    }

    return (
        <View style={[styles.paymentRow, style]}>
            <TouchableOpacity
                style={styles.paymentButton}
                onPress={onPaymentPress}
                activeOpacity={0.8}
            >
                <Icon
                    name={selectedPayment.type === PaymentMethodType.GOOGLE_PAY ? 'google' :
                        selectedPayment.type === PaymentMethodType.CASH ? 'money-bill-wave' :
                            selectedPayment.type === PaymentMethodType.COMPANY ? 'briefcase' : 'credit-card'}
                    size={16}
                    color="#FFF"
                />
                <Text style={styles.paymentText}>
                    {selectedPayment.displayName}
                </Text>
                <Icon name="chevron-down" size={12} color="#FFF" style={{ marginLeft: 6, opacity: 0.9 }} />
            </TouchableOpacity>

            {onNotePress && (
                <TouchableOpacity
                    style={styles.noteButton}
                    onPress={onNotePress}
                    activeOpacity={0.8}
                >
                    <Icon name="edit" size={16} color="#8E8E93" />
                    <Text style={styles.noteButtonText} numberOfLines={1}>
                        {note || 'Kommentar till förare'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    button_small: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    button_medium: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    button_large: {
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    digitalPayButton: {
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#333',
    },
    standardButton: {
        backgroundColor: '#F2F2F7',
        borderWidth: 1,
        borderColor: '#E5E5EA',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        marginRight: 8,
    },
    buttonText: {
        fontWeight: '600',
    },
    text_small: {
        fontSize: 14,
    },
    text_medium: {
        fontSize: 16,
    },
    text_large: {
        fontSize: 18,
    },
    digitalPayText: {
        color: '#FFF',
    },
    standardText: {
        color: '#000',
    },
    textDisabled: {
        color: '#999',
    },

    // PaymentRow styles
    paymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 26,
        padding: 8,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    paymentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 22,
        marginRight: 10,
    },
    paymentText: {
        color: '#FFF',
        fontWeight: '600',
        marginLeft: 6,
    },
    noteButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 22,
    },
    noteButtonText: {
        color: '#8E8E93',
        marginLeft: 4,
        fontSize: 14,
    },
});

export default PaymentButton;