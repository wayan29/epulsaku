// src/lib/db-price-settings-utils.ts
'use server';

import { getDb } from './mongodb';
import type { Filter, UpdateFilter, Document } from 'mongodb';
import { getUserByUsername, verifyUserPassword } from './user-utils';

// The productIdentifier key will be namespaced, e.g., "digiflazz::XYZ123" or "tokovoucher::ABC789"
export interface PriceSettings {
  [namespacedProductIdentifier: string]: number;
}

interface StoredPriceSettingsDoc {
  _id: string;
  settings: PriceSettings;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
}

const PRICE_SETTINGS_COLLECTION = 'app_configurations';
const PRICE_SETTINGS_DOC_ID = 'priceSettings_v1';

function getNamespacedProductIdentifier(provider: 'digiflazz' | 'tokovoucher', productCode: string): string {
  return `${provider}::${productCode}`;
}

export async function fetchPriceSettingsFromDB(): Promise<PriceSettings> {
  try {
    const db = await getDb();
    const configDoc = await db.collection<StoredPriceSettingsDoc>(PRICE_SETTINGS_COLLECTION).findOne({ _id: PRICE_SETTINGS_DOC_ID });
    return configDoc?.settings || {};
  } catch (error) {
    console.error("Error fetching price settings from DB:", error);
    return {};
  }
}

export async function storePriceSettingsInDB(
  settingsToSave: PriceSettings, // Expects already namespaced keys
  adminUsername: string,
  adminPasswordConfirmation: string
): Promise<{ success: boolean; message: string }> {
  try {
    const adminUser = await getUserByUsername(adminUsername);
    if (!adminUser || !adminUser.hashedPassword) {
      return { success: false, message: "Admin user not found or password not set." };
    }
    const isPasswordValid = await verifyUserPassword(adminPasswordConfirmation, adminUser.hashedPassword);
    if (!isPasswordValid) {
      return { success: false, message: "Incorrect admin password. Price settings not saved." };
    }

    const validSettings: PriceSettings = {};
    for (const key in settingsToSave) {
      if (Object.prototype.hasOwnProperty.call(settingsToSave, key)) {
        const price = settingsToSave[key];
        // Ensure it's a namespaced key and price is valid
        if (typeof price === 'number' && price > 0 && key.includes('::')) {
          validSettings[key] = price;
        }
      }
    }

    const db = await getDb();
    const updateDoc: UpdateFilter<StoredPriceSettingsDoc> = {
      $set: {
        settings: validSettings,
        lastUpdatedBy: adminUsername,
        lastUpdatedAt: new Date(),
      },
    };

    await db.collection<StoredPriceSettingsDoc>(PRICE_SETTINGS_COLLECTION).updateOne(
      { _id: PRICE_SETTINGS_DOC_ID } as Filter<StoredPriceSettingsDoc>,
      updateDoc,
      { upsert: true }
    );
    return { success: true, message: "Price settings saved successfully to database." };
  } catch (error) {
    console.error("Error saving price settings to DB:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to save price settings: ${message}` };
  }
}

export async function fetchSingleCustomPriceFromDB(productCode: string, provider: 'digiflazz' | 'tokovoucher'): Promise<number | null> {
  try {
    const allSettings = await fetchPriceSettingsFromDB();
    const namespacedKey = getNamespacedProductIdentifier(provider, productCode);
    if (allSettings && typeof allSettings[namespacedKey] === 'number' && allSettings[namespacedKey] > 0) {
      return allSettings[namespacedKey];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching single custom price for ${provider}::${productCode} from DB:`, error);
    return null;
  }
}
