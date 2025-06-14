// src/lib/notification-utils.ts
'use server';

import { getAdminSettingsFromDB } from './admin-settings-utils';
import { sendTelegramMessage } from '@/ai/flows/send-telegram-message-flow';

export interface TelegramNotificationDetails {
  refId: string;
  productName: string;
  customerNoDisplay: string;
  status: string;
  provider: 'Digiflazz' | 'TokoVoucher' | string;
  costPrice?: number;
  sellingPrice?: number;
  profit?: number;
  sn?: string | null;
  failureReason?: string | null;
  timestamp: Date;
  additionalInfo?: string;
  trxId?: string;
}

// This is a local helper function, not exported.
function escapeTelegramReservedChars(text: string | number | null | undefined): string {
  if (text === null || typeof text === 'undefined') return '';
  const str = String(text);
  return str.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// This is a local helper function, not exported.
function formatTelegramNotificationMessage(details: TelegramNotificationDetails): string {
  let message = `*🔔 Transaksi ePulsaku ${details.additionalInfo ? `(${escapeTelegramReservedChars(details.additionalInfo)})` : ''}*\n\n`;
  message += `*Provider:* ${escapeTelegramReservedChars(details.provider)}\n`;
  message += `*ID Ref:* \`${escapeTelegramReservedChars(details.refId)}\`\n`;
  if (details.trxId) {
    message += `*ID Trx Provider:* \`${escapeTelegramReservedChars(details.trxId)}\`\n`;
  }
  message += `*Produk:* ${escapeTelegramReservedChars(details.productName)}\n`;
  message += `*Tujuan:* ${escapeTelegramReservedChars(details.customerNoDisplay)}\n`;
  message += `*Status:* *${escapeTelegramReservedChars(details.status)}*\n`;

  if (details.status.toLowerCase().includes('sukses')) {
    message += `*SN/Token:* \`${details.sn ? escapeTelegramReservedChars(details.sn) : 'N/A'}\`\n`;
    if (typeof details.sellingPrice === 'number') {
      message += `*Harga Jual:* Rp ${escapeTelegramReservedChars(details.sellingPrice.toLocaleString('id-ID'))}\n`;
    }
    if (typeof details.costPrice === 'number') {
      message += `*Harga Modal:* Rp ${escapeTelegramReservedChars(details.costPrice.toLocaleString('id-ID'))}\n`;
    }
    if (typeof details.profit === 'number' && details.profit !== 0) {
      message += `*Profit:* Rp ${escapeTelegramReservedChars(details.profit.toLocaleString('id-ID'))}\n`;
    }
  } else if (details.status.toLowerCase().includes('gagal') && details.failureReason) {
    message += `*Alasan Gagal:* ${escapeTelegramReservedChars(details.failureReason)}\n`;
  } else if (details.status.toLowerCase().includes('pending')) {
    message += `_Transaksi sedang diproses\\.\\.\\._\n`;
  }

  message += `\n_${escapeTelegramReservedChars(new Date(details.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))}_`;
  return message;
}

export async function trySendTelegramNotification(details: TelegramNotificationDetails) {
  try {
    const adminSettings = await getAdminSettingsFromDB();
    const botToken = adminSettings.telegramBotToken;
    const chatIdsString = adminSettings.telegramChatId;

    if (botToken && chatIdsString) {
      const chatIds = chatIdsString.split(',').map(id => id.trim()).filter(id => id);
      if (chatIds.length === 0) {
        console.warn('Telegram Chat IDs are configured but resulted in an empty list. Skipping notification for Ref ID:', details.refId);
        return;
      }

      const messageContent = formatTelegramNotificationMessage(details); // Uses the local helper

      for (const chatId of chatIds) {
        const result = await sendTelegramMessage({ botToken, chatId, message: messageContent });
        if (result.success) {
          console.log(`Telegram notification sent to Chat ID ${chatId} for Ref ID: ${details.refId}`);
        } else {
          console.warn(`Failed to send Telegram notification to Chat ID ${chatId} for Ref ID ${details.refId}: ${result.message}`);
        }
      }
    } else {
      // console.warn('Telegram Bot Token or Chat ID(s) not configured. Skipping notification for Ref ID:', details.refId);
    }
  } catch (error) {
    console.error('Error in trySendTelegramNotification for Ref ID:', details.refId, error);
  }
}
