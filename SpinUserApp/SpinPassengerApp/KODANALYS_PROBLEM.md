# 🔴 KODANALYS - ALLA PROBLEM I SPINPASSENGERAPP

## KRITISKA PROBLEM

### 1. **GEOLOCATION IMPORT MISMATCH** ⚠️ FATAL
**Status:** Detta är varför appen kraschar!

**Problem:**
- `RegisterPassScreen.tsx` importerar från `@react-native-community/geolocation`
- Detta paket är INTE installerat i `package.json`
- `package.json` har `react-native-geolocation-service` istället

**Nuvarande (FELAKTIG):**
```tsx
// RegisterPassScreen.tsx - RAD 1
import Geolocation from '@react-native-community/geolocation';
```

**Installerad:**
```json
// package.json
"react-native-geolocation-service": "^5.3.1"
```

**Resultat:**
```
❌ UnableToResolveError: Unable to resolve module @react-native-community/geolocation
```

---

## LÖSNING 1: FIX IMPORT (REKOMMENDERAD)

Byt alla dessa filer från `@react-native-community/geolocation` till `react-native-geolocation-service`:

### Fil 1: RegisterPassScreen.tsx
```tsx
// FRÅN:
import Geolocation from '@react-native-community/geolocation';

// TILL:
import Geolocation from 'react-native-geolocation-service';
```

### Kod att ersätta:
```tsx
// RAD 1
OLD: import Geolocation from '@react-native-community/geolocation';
NEW: import Geolocation from 'react-native-geolocation-service';

// RAD 70-71 (requestLocationPermission)
OLD: Geolocation.requestAuthorization();  // Denna metod finns inte i geolocation-service
NEW: // Denna rad kan tas bort för Android, iOS behöver annan setup
```

---

## ANDRA PROBLEM HITTAT

### 2. **Importväg Error i RegisterPassScreen.tsx**

**Problem:** RAD 19
```tsx
import { ThemeColors, useAppTheme } from '../theme/ThemeProvider';
```

**Fel sökväg:** Borde vara:
```tsx
import { ThemeColors, useAppTheme } from '../../theme/ThemeProvider';
```

Förklaring: RegisterPassScreen ligger i `Passenger/SingUp/` (2 nivåer djupt), inte `Passenger/` (1 nivå).

---

### 3. **REQUEST AUTHORIZATION MISSING**

I `RegisterPassScreen.tsx` RAD 70:
```tsx
Geolocation.requestAuthorization();
```

**Problem:** `react-native-geolocation-service` har inte denna metod!

**Lösning:**
```tsx
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
    // iOS: Du behöver NSLocationWhenInUseUsageDescription i Info.plist
    return true;
}, []);
```

---

## SAMMANFATTNING - FIXA DET HÄR

| Problem | Fil | Linje | Åtgärd |
|---------|-----|-------|--------|
| **Fel import** | RegisterPassScreen.tsx | 1 | Byt `@react-native-community/geolocation` → `react-native-geolocation-service` |
| **Fel väg** | RegisterPassScreen.tsx | 19 | Byt `../theme` → `../../theme` |
| **Icke-existerande metod** | RegisterPassScreen.tsx | 70 | Ta bort `Geolocation.requestAuthorization()` (redan hanteras av PermissionsAndroid) |

---

## PÅVERKAN

✅ Efter dessa ändringar kommer:
1. Appen att bygga utan CMake-fel
2. Appen att starta utan runtime-fel
3. Geolocation att fungera korrekt
4. RegisterScreen att ladda korrekt

---

## NÄSTA STEG

1. Fixa dessa 3 problem
2. Kör: `npx react-native run-android`
3. Appen ska nu starta utan röda crash-screen
