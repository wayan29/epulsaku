// src/lib/admin-settings-utils.ts
'use server'; 

import { getDb } from './mongodb';
import type { Filter, UpdateFilter, Document } from 'mongodb';
import { getUserByUsername, verifyUserPassword } from './user-utils'; // For password verification

const ADMIN_SETTINGS_COLLECTION = 'admin_settings';
const ADMIN_SETTINGS_DOC_ID = 'global_app_settings'; // Unique ID for the single settings document

export interface AdminSettings {
  digiflazzUsername?: string;
  digiflazzApiKey?: string;
  digiflazzWebhookSecret?: string;
  allowedDigiflazzIPs?: string;
  allowedTokoVoucherIPs?: string;
  tokovoucherMemberCode?: string;
  tokovoucherSignature?: string;
  tokovoucherKey?: string;
  telegramBotToken?: string; // Added
  telegramChatId?: string; // Added
  _id?: string; 
}

// Server Action to fetch admin settings
export async function getAdminSettingsFromDB(): Promise<AdminSettings> {
  try {
    const db = await getDb();
    const settings = await db.collection<AdminSettings>(ADMIN_SETTINGS_COLLECTION).findOne({ _id: ADMIN_SETTINGS_DOC_ID });
    if (settings) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = settings; 
      return rest;
    }
    return {}; 
  } catch (error) {
    console.error("Error fetching admin settings from DB:", error);
    return {}; 
  }
}

export interface SaveAdminSettingsData {
    settings: Omit<AdminSettings, '_id'>;
    adminPasswordConfirmation: string;
    adminUsername: string;
}

// Server Action to save settings from the Admin Settings page
export async function saveAdminSettingsToDB(data: SaveAdminSettingsData): Promise<{ success: boolean; message: string }> {
  try {
    const { settings, adminPasswordConfirmation, adminUsername } = data;

    // 1. Verify admin password
    const adminUser = await getUserByUsername(adminUsername);
    if (!adminUser || !adminUser.hashedPassword) {
      return { success: false, message: "Admin user not found or password not set." };
    }
    const isPasswordValid = await verifyUserPassword(adminPasswordConfirmation, adminUser.hashedPassword);
    if (!isPasswordValid) {
      return { success: false, message: "Incorrect admin password. Settings not saved." };
    }

    // 2. Save settings to DB
    const db = await getDb();
    const updateDoc: UpdateFilter<AdminSettings> = {
      $set: settings,
    };
    
    await db.collection<AdminSettings>(ADMIN_SETTINGS_COLLECTION).updateOne(
      { _id: ADMIN_SETTINGS_DOC_ID } as Filter<AdminSettings>, 
      updateDoc as Document, 
      { upsert: true } 
    );
    return { success: true, message: "Admin settings saved successfully to database." };
  } catch (error) {
    console.error("Error saving admin settings to DB:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to save settings: ${message}` };
  }
}
