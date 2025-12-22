import { fromByteArray as base64FromBytes } from 'base64-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ReceiptItem {
    label: string;
    amount: number; // in SEK
}

export interface ReceiptData {
    tripId: string;
    date: Date;
    passengerName?: string;
    passengerEmail?: string;
    driverName?: string;
    pickupLocation?: string;
    dropOffLocation?: string;
    vatPercentage?: number; // e.g. 6
    items?: ReceiptItem[]; // base fare etc
    totalAmount: number; // in SEK
    paymentMethod?: string; // t.ex. 'Kort', 'ApplePay'
}

export interface GeneratedPdfReceipt {
    filename: string;
    contentType: 'application/pdf';
    base64Data: string;
}

/**
 * Generate a compact PDF receipt (A4) similar to LitePDFReceipt on iOS
 */
export async function generateReceiptPdfBase64(data: ReceiptData): Promise<GeneratedPdfReceipt> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
    const { width } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const title = 'SpinTaxi – Kvitto';
    const subTitle = data.passengerName ? `Till: ${data.passengerName}` : 'Kundkvitto';
    const dateStr = data.date.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
    const vatPct = Number.isFinite(data.vatPercentage as number) ? (data.vatPercentage as number) : 6;

    let y = 800;
    const margin = 40;

    // Header
    drawText(page, title, fontBold, 18, margin, y, rgb(0.1, 0.1, 0.1));
    y -= 22;
    drawText(page, subTitle, font, 12, margin, y, rgb(0.2, 0.2, 0.2));
    y -= 18;
    drawText(page, `Datum: ${dateStr}`, font, 11, margin, y, rgb(0.2, 0.2, 0.2));
    y -= 16;
    drawText(page, `Resa ID: ${data.tripId}`, font, 11, margin, y, rgb(0.2, 0.2, 0.2));
    y -= 16;
    if (data.driverName) {
        drawText(page, `Förare: ${data.driverName}`, font, 11, margin, y, rgb(0.2, 0.2, 0.2));
        y -= 16;
    }
    if (data.pickupLocation || data.dropOffLocation) {
        if (data.pickupLocation) {
            drawText(page, `Från: ${data.pickupLocation}`, font, 11, margin, y, rgb(0.2, 0.2, 0.2));
            y -= 16;
        }
        if (data.dropOffLocation) {
            drawText(page, `Till: ${data.dropOffLocation}`, font, 11, margin, y, rgb(0.2, 0.2, 0.2));
            y -= 16;
        }
    }
    if (data.paymentMethod) {
        drawText(page, `Betalmetod: ${data.paymentMethod}`, font, 11, margin, y, rgb(0.2, 0.2, 0.2));
        y -= 16;
    }

    // Divider
    y -= 6;
    drawLine(page, margin, y, width - margin, y, rgb(0.8, 0.8, 0.8));
    y -= 16;

    // Items
    const items = Array.isArray(data.items) ? data.items : [];
    items.forEach((it) => {
        drawText(page, it.label, font, 12, margin, y, rgb(0, 0, 0));
        drawTextRight(page, formatAmount(it.amount), font, 12, width - margin, y, rgb(0, 0, 0));
        y -= 18;
    });

    // VAT and totals
    const vatAmount = round2(data.totalAmount * (vatPct / 100));
    const exVat = round2(data.totalAmount - vatAmount);

    y -= 6;
    drawText(page, `Moms (${vatPct}%)`, font, 12, margin, y, rgb(0, 0, 0));
    drawTextRight(page, formatAmount(vatAmount), font, 12, width - margin, y, rgb(0, 0, 0));
    y -= 18;
    drawText(page, `Belopp exkl. moms`, font, 12, margin, y, rgb(0, 0, 0));
    drawTextRight(page, formatAmount(exVat), font, 12, width - margin, y, rgb(0, 0, 0));
    y -= 22;

    // Total bold
    drawLine(page, margin, y, width - margin, y, rgb(0.2, 0.2, 0.2));
    y -= 18;
    drawText(page, 'Totalt att betala', fontBold, 13, margin, y, rgb(0, 0, 0));
    drawTextRight(page, formatAmount(data.totalAmount), fontBold, 13, width - margin, y, rgb(0, 0, 0));
    y -= 28;

    // Footer
    drawText(page, 'Tack för att du reser med SpinTaxi!', font, 10, margin, y, rgb(0.25, 0.25, 0.25));

    const pdfBytes = await pdfDoc.save();
    const base64 = base64FromBytes(pdfBytes);
    const filename = `kvitto_${data.tripId}.pdf`;
    return { filename, contentType: 'application/pdf', base64Data: base64 };
}

function drawText(page: any, text: string, font: any, size: number, x: number, y: number, color: any) {
    page.drawText(text, { x, y, size, font, color });
}

function drawTextRight(page: any, text: string, font: any, size: number, xRight: number, y: number, color: any) {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xRight - width, y, size, font, color });
}

function drawLine(page: any, x1: number, y1: number, x2: number, y2: number, color: any) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color });
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function formatAmount(n: number): string { return `${round2(n).toFixed(2)} kr`; }

export function buildTripHtmlReceipt(data: ReceiptData): string {
    const dateStr = data.date.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
    const vatPct = Number.isFinite(data.vatPercentage as number) ? (data.vatPercentage as number) : 6;
    const vatAmount = round2(data.totalAmount * (vatPct / 100));
    const exVat = round2(data.totalAmount - vatAmount);
    const items = (data.items || [])
        .map((it) => `<tr><td style="padding:6px 0;">${escapeHtml(it.label)}</td><td style="padding:6px 0; text-align:right;">${formatAmount(it.amount)}</td></tr>`)
        .join('');

    return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222;">
    <h2>SpinTaxi – Kvitto</h2>
    <p>Hej ${escapeHtml(data.passengerName || 'Passagerare')},</p>
    <p>Din resa är nu slutförd.</p>
    <p>
      <strong>Datum:</strong> ${dateStr}<br/>
      <strong>Resa ID:</strong> ${escapeHtml(data.tripId)}<br/>
      ${data.driverName ? `<strong>Förare:</strong> ${escapeHtml(data.driverName)}<br/>` : ''}
      ${data.pickupLocation ? `<strong>Från:</strong> ${escapeHtml(data.pickupLocation)}<br/>` : ''}
      ${data.dropOffLocation ? `<strong>Till:</strong> ${escapeHtml(data.dropOffLocation)}<br/>` : ''}
            ${data.paymentMethod ? `<strong>Betalmetod:</strong> ${escapeHtml(data.paymentMethod)}<br/>` : ''}
    </p>
    <table style="width:100%; border-collapse: collapse;">
      ${items}
      <tr><td style="padding-top:10px; border-top:1px solid #ddd;">Moms (${vatPct}%)</td><td style="padding-top:10px; border-top:1px solid #ddd; text-align:right;">${formatAmount(vatAmount)}</td></tr>
      <tr><td>Belopp exkl. moms</td><td style="text-align:right;">${formatAmount(exVat)}</td></tr>
      <tr><td style="padding-top:10px; border-top:2px solid #222;"><strong>Totalt</strong></td><td style="padding-top:10px; border-top:2px solid #222; text-align:right;"><strong>${formatAmount(data.totalAmount)}</strong></td></tr>
    </table>
    <p style="color:#666;">Tack för att du reser med SpinTaxi!</p>
  </div>`;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"]'/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c] as string));
}
