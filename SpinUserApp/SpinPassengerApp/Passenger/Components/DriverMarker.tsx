import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    size?: number; // overall diameter of the marker
    color?: string; // primary accent color
    bearing?: number; // degrees, 0 = north
    highlight?: boolean; // emphasize (assigned driver)
};

export default function DriverMarker({ size = 40, color = '#0A84FF', bearing = 0, highlight = false }: Props) {
    const innerSize = Math.round(size * 0.68);
    const borderColor = color;
    const carSize = Math.max(14, Math.round(innerSize * 0.55));
    const rotate = `${Math.round(bearing || 0)}deg`;

    const containerStyle = useMemo(() => ([
        styles.container,
        {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: 'rgba(10,132,255,0.10)', // soft glow fill
            borderColor: `${borderColor}40`,
            borderWidth: 2,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
        },
    ]), [size, borderColor]);

    const innerStyle = useMemo(() => ([
        styles.inner,
        {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            borderColor,
            borderWidth: highlight ? 3 : 2,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
            backgroundColor: '#fff',
        },
    ]), [innerSize, borderColor, highlight]);

    return (
        <View style={containerStyle}>
            <View style={innerStyle}>
                <View style={[styles.carWrap, { transform: [{ rotate }] }]}>
                    <Icon name="car-sport" size={carSize} color={borderColor} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    inner: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    carWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
