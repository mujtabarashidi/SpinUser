/**
 * EmailService.ts
 * 
 * Service för att skicka e-post via Firebase Firestore
 * Använder Firebase Extension för att skicka e-post
 */

import firestore from '@react-native-firebase/firestore';
import { buildTripHtmlReceipt, generateReceiptPdfBase64, ReceiptData } from '../utils/pdfReceipt';

export interface TripEmailData {
    tripId: string;
    passengerUid: string;
    passengerName?: string;
    passengerEmail?: string;
    /** Total pris inkl. moms (används före 'price') */
    priceIncl?: number;
    /** Legacy fält – existerar i vissa anrop */
    price?: number;
    /** Sammanfogad eller förenklad pickup-information */
    pickupLocation?: string;
    /** Sammanfogad eller förenklad dropoff-information */
    dropOffLocation?: string;
    /** Separata fält (ny) */
    pickupName?: string;
    pickupAddress?: string;
    dropoffName?: string;
    dropoffAddress?: string;
    paymentMethod?: string;
    vatRate?: number; // t.ex. 0.06
    tripDate?: Date;
    driverName?: string;
}

class EmailService {
    /**
     * Skicka välkomstmail till passagerare
     */
    static async sendWelcomeEmail(
        email: string,
        name: string,
        locale: string = 'sv-SE'
    ): Promise<void> {
        try {
            const subject = locale.startsWith('sv')
                ? 'Välkommen till Spin 🟡'
                : 'Welcome to Spin 🟡';

            const body = locale.startsWith('sv')
                ? `Hej ${name},

Ditt konto är nu skapat! Du kan boka resor, spara betalmetoder och följa din förare i realtid.

Tips:
• Lägg till favoritadresser (Hem/Jobb).

Tack för att du väljer SpinTaxi!

Vänliga hälsningar,
SpinTaxi Teamet`
                : `Hi ${name},

Your account is ready! You can book rides, save payment methods and track your driver in real time.

Tips:
• Add favorite addresses (Home/Work).

Thanks for choosing SpinTaxi!

Thanks for choosing SpinTaxi!

Best regards,
The SpinTaxi Team`;

            await firestore().collection('emails').add({
                to: [email],
                message: {
                    subject,
                    text: body,
                    from: 'support@spintaxi.se',
                },
                locale,
                accountType: 'passenger',
                emailType: 'welcome_passenger',
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            console.log('✅ Välkomstmail skapat för:', email);
        } catch (error) {
            console.error('❌ Fel vid skapande av välkomstmail:', error);
        }
    }

    /**
     * Skicka godkännandemail till förare när deras konto har godkänts
     */
    static async sendDriverApprovalEmail(
        email: string,
        name: string,
        locale: string = 'sv-SE'
    ): Promise<void> {
        try {
            const subject = locale.startsWith('sv')
                ? 'Grattis! Ditt förarkonto är nu godkänt 🎉'
                : 'Congratulations! Your driver account is approved 🎉';

            const body = locale.startsWith('sv')
                ? `Hej ${name},

Ditt förarkonto hos SpinTaxi är nu godkänt! 🎉

Du kan nu:
✓ Gå online och ta emot körningar
✓ Tjäna pengar på dina egna villkor
                accountType: 'passenger',
                emailType: 'welcome_passenger',

Nästa steg:
1. Öppna SpinTaxi Förare-appen
2. Tryck på "Gå Online" för att börja ta emot körningar
3. Följ säkerhetsriktlinjerna och ge bästa möjliga service

Välkommen till SpinTaxi-teamet!

Behöver du hjälp? Kontakta oss via support@spintaxi.se eller besök Hjälp & Support i appen.

Vänliga hälsningar,
SpinTaxi Teamet`
                : `Hi ${name},

Your SpinTaxi driver account has been approved! 🎉

You can now:
✓ Go online and accept rides
✓ Earn money on your own terms
✓ Access all driver features in the app

Next steps:
1. Open the SpinTaxi Driver app
2. Tap "Go Online" to start accepting rides
3. Follow safety guidelines and provide the best service

Welcome to the SpinTaxi team!

Need help? Contact us at support@spintaxi.se or visit Help & Support in the app.

Best regards,
The SpinTaxi Team`;

            await firestore().collection('emails').add({
                to: [email],
                message: {
                    subject,
                    text: body,
                    from: 'support@spintaxi.se',
                },
                locale,
                accountType: 'driver',
                emailType: 'driver_approval',
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            console.log('✅ Godkännandemail skapat för förare:', email);
        } catch (error) {
            console.error('❌ Fel vid skapande av godkännandemail:', error);
            throw error;
        }
    }

    /**
     * Skicka e-post till passagerare när resan är slutförd
     */
    static async sendTripCompletedEmail(data: TripEmailData): Promise<void> {
        try {
            const { passengerUid, tripId } = data;

            console.log('📧 [EmailService] Starting sendTripCompletedEmail for trip:', tripId, 'passenger:', passengerUid);

            // Hämta passagerarens information om den inte redan finns
            let { passengerEmail, passengerName } = data;

            if (!passengerEmail || !passengerName) {
                console.log('📧 [EmailService] Fetching user data from Firestore...');
                const userDoc = await firestore().collection('users').doc(passengerUid).get();
                const userData = userDoc.data();

                if (!userData) {
                    console.warn('⚠️ [EmailService] Kunde inte hitta användardata för:', passengerUid);
                    return;
                }

                passengerEmail = userData.email;
                passengerName = userData.fullname || userData.displayName || 'Passagerare';
                console.log('📧 [EmailService] User data fetched:', passengerEmail, passengerName);
            }

            if (!passengerEmail) {
                console.warn('⚠️ [EmailService] Ingen e-postadress för användare:', passengerUid);
                return;
            }

            console.log('📤 [EmailService] Förbereder e-post till:', passengerEmail, `(${passengerName})`);

            // Formatera datum
            const tripDate = data.tripDate || new Date();
            const formattedDate = tripDate.toLocaleString('sv-SE', {
                dateStyle: 'medium',
                timeStyle: 'short',
            });

            // Skapa e-postinnehåll
            const subject = 'Tack för att du reste med Spin! 🟡';

            let emailBody = `Hej ${passengerName},

Din resa är nu slutförd!

Tid: ${formattedDate}`;

            if (data.pickupLocation && data.dropOffLocation) {
                emailBody += `
Från: ${data.pickupLocation}
Till: ${data.dropOffLocation}`;
            }

            const totalPrice = (typeof data.priceIncl === 'number') ? data.priceIncl : (typeof data.price === 'number' ? data.price : undefined);
            if (totalPrice && totalPrice > 0) {
                emailBody += `
Pris: ${totalPrice} kr (inkl. moms)`;
                if (typeof data.vatRate === 'number') {
                    emailBody += `
Moms (${(data.vatRate * 100).toFixed(0)}%): ${(totalPrice * data.vatRate).toFixed(2)} kr`;
                }
            }
            if (data.paymentMethod) {
                emailBody += `
Betalmetod: ${data.paymentMethod}`;
            }

            emailBody += `

Vi hoppas du är nöjd och ser fram emot att köra dig igen!

Vänliga hälsningar,
Spin-teamet`;

            // Skapa e-postdokument i Firestore (text only, for compatibility)
            // VIKTIGT: Använd .add() istället för .set() för att Firebase Extension ska fungera
            console.log('📧 [EmailService] Writing email document to Firestore...');
            const emailRef = await firestore().collection('emails').add({
                to: [passengerEmail],
                message: {
                    subject,
                    text: emailBody,
                    from: 'support@spintaxi.se',
                },
                tripId,
                passengerUid,
                // Android compatibility: Använd Date istället för serverTimestamp vid behov
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            console.log('✅ [EmailService] E-postdokument skapat för resa:', tripId, 'Email doc ID:', emailRef.id);

            // Verifiera att dokumentet skapades (Android debugging)
            const verifyDoc = await emailRef.get();
            if (verifyDoc.exists()) {
                console.log('✅ [EmailService] Email dokument verifierat i Firestore');
            } else {
                console.warn('⚠️ [EmailService] Email dokument kunde inte verifieras efter skapande');
            }
        } catch (error: any) {
            console.error('❌ [EmailService] Fel vid skapande av e-post för slutförd resa:', error);
            console.error('❌ [EmailService] Error details:', {
                code: error?.code,
                message: error?.message,
                stack: error?.stack
            });
            // Re-throw för att anroparen ska kunna hantera
            throw error;
        }
    }

    /**
     * Skicka kvitto-mail med HTML och valfri PDF-bilaga (genererad i appen)
     */
    static async sendTripCompletedEmailWithReceipt(
        data: TripEmailData & { items?: Array<{ label: string; amount: number }>; vatPercentage?: number; totalAmount?: number; attachPdf?: boolean }
    ): Promise<void> {
        const { passengerUid, tripId } = data;
        try {
            // Resolve user email/name if missing
            let passengerEmail = data.passengerEmail;
            let passengerName = data.passengerName;
            if (!passengerEmail || !passengerName) {
                const snap = await firestore().collection('users').doc(passengerUid).get();
                const u = snap.data();
                passengerEmail = passengerEmail || u?.email;
                passengerName = passengerName || u?.fullname || u?.displayName || 'Passagerare';
            }
            if (!passengerEmail) {
                console.warn('⚠️ Ingen e-postadress – avbryter rik kvitto-mail:', passengerUid);
                return;
            }

            const date = data.tripDate || new Date();
            const totalAmount = typeof data.totalAmount === 'number' && data.totalAmount > 0
                ? data.totalAmount
                : (typeof data.priceIncl === 'number' ? data.priceIncl : (typeof data.price === 'number' ? data.price : 0));
            const vatPctFromRate = typeof data.vatRate === 'number' ? (data.vatRate * 100) : undefined;

            // Build HTML body
            // Bygg mer detaljerade pickup/dropoff strängar om separata fält finns
            const pickupComposite = data.pickupLocation || [data.pickupName, data.pickupAddress].filter(Boolean).join(' • ');
            const dropoffComposite = data.dropOffLocation || data.dropoffAddress || [data.dropoffName, data.dropoffAddress].filter(Boolean).join(' • ');

            const receipt: ReceiptData = {
                tripId,
                date,
                passengerName,
                passengerEmail,
                driverName: data.driverName,
                pickupLocation: pickupComposite,
                dropOffLocation: dropoffComposite,
                vatPercentage: vatPctFromRate ?? (data.vatPercentage ?? 6),
                items: data.items,
                totalAmount,
                paymentMethod: data.paymentMethod,
            } as ReceiptData;
            const html = buildTripHtmlReceipt(receipt);
            const textFallback = `Hej ${passengerName || 'Passagerare'},\n\nDin resa är nu slutförd.\n\nResa ID: ${tripId}\nDatum: ${date.toLocaleString('sv-SE')}\n${pickupComposite ? `Från: ${pickupComposite}\n` : ''}${dropoffComposite ? `Till: ${dropoffComposite}\n` : ''}Totalt: ${totalAmount} kr${data.paymentMethod ? `\nBetalmetod: ${data.paymentMethod}` : ''}\n\nTack för att du reser med SpinTaxi!`;

            const message: any = {
                subject: 'Ditt kvitto – Tack för att du reste med SpinTaxi',
                text: textFallback,
                html,
                from: 'support@spintaxi.se',
            };

            // Optional PDF attachment
            if (data.attachPdf) {
                try {
                    const pdf = await generateReceiptPdfBase64(receipt);
                    message.attachments = [
                        {
                            filename: pdf.filename,
                            contentType: pdf.contentType,
                            data: pdf.base64Data,
                        }
                    ];
                } catch (e) {
                    console.warn('⚠️ Kunde inte generera PDF-kvitto, skickar utan bilaga:', (e as Error)?.message);
                }
            }

            await firestore().collection('emails').add({
                to: [passengerEmail],
                message,
                tripId,
                passengerUid,
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            console.log('✅ Rich receipt email queued for trip:', tripId);
        } catch (error) {
            console.error('❌ Fel vid skapande av rich kvitto-mail:', error);
        }
    }
}

export default EmailService;
