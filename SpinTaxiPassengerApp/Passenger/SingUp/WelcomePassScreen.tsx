

//  WelcomePassScreen.tsx

// Passenger welcome view when user is not logged in


import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: { navigation: any }) {
    // Use passenger logo from Passenger/Userasset
    const logoSource = require('../Userasset/spin-logo.png');

    return (
        <View style={styles.background}>
            <View style={styles.container}>
                <Image
                    source={logoSource}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>
                    Spin – Din lokala taxiapp, {'\n'}snabbt och smidigt dit du vill!
                </Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                    style={styles.loginButton}
                    onPress={() => navigation.navigate('Login')}
                >
                    <Text style={styles.loginText}>Logga in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.registerButton}
                    onPress={() => navigation.navigate('Register')}
                >
                    <Text style={styles.registerText}>Registrera dig</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#414345'
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 32,
        paddingHorizontal: 24,

    },
    logo: {
        width: 120,
        height: 120,
        marginBottom: 20,
        marginTop: 90,
        borderRadius: 60,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 40,
        textShadowColor: 'rgba(0,0,0,0.4)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    loginButton: {
        backgroundColor: '#007bff',
        borderRadius: 25,
        paddingVertical: 14,
        marginBottom: 16,
        width: '85%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    loginText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
    registerButton: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderRadius: 25,
        paddingVertical: 14,
        width: '85%',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 1,
    },
    registerText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
