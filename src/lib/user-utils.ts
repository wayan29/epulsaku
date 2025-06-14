// src/lib/user-utils.ts
'use server';

import { getDb } from './mongodb';
import bcrypt from 'bcryptjs';
import type { User as AuthContextUser } from '@/contexts/AuthContext';
import { headers } from 'next/headers';
import crypto from 'crypto'; // For generating session tokens
import type { ObjectId } from 'mongodb'; // Import ObjectId type

const USERS_COLLECTION = 'users';
const LOGIN_ACTIVITY_COLLECTION = 'login_activity';
const SESSIONS_COLLECTION = 'sessions'; // New collection for sessions
const SALT_ROUNDS = 10;
const SESSION_TOKEN_DEFAULT_EXPIRY_DAYS = 1; // Default to 1 day for non-remembered sessions
const SESSION_TOKEN_REMEMBER_ME_EXPIRY_DAYS = 365; // 365 days for remembered sessions

export interface StoredUser {
  _id?: string;
  username: string;
  email?: string;
  hashedPassword?: string;
  hashedPin?: string;
}

export interface LoginActivity {
  _id?: string; // MongoDB ObjectId as a string
  userId: string;
  username: string;
  loginTimestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface Session {
  _id?: string;
  userId: string;
  tokenHash: string; // Store hash of the token
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
}

async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, SALT_ROUNDS);
}

export async function checkIfUsersExist(): Promise<boolean> {
  try {
    const db = await getDb();
    const count = await db.collection<StoredUser>(USERS_COLLECTION).countDocuments();
    return count > 0;
  } catch (error) {
    console.error("Error checking if users exist:", error);
    return true;
  }
}

export async function createUser(
  username: string,
  email: string,
  passwordPlain: string,
  pinPlain: string
): Promise<{ success: boolean; message: string; user?: AuthContextUser, token?: string }> { // Added token to return type
  try {
    const db = await getDb();
    const existingUser = await db.collection<StoredUser>(USERS_COLLECTION).findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return { success: false, message: "Username already exists." };
    }

    const hashedPassword = await bcrypt.hash(passwordPlain, SALT_ROUNDS);
    const hashedPin = await bcrypt.hash(pinPlain, SALT_ROUNDS);

    const newUser: Omit<StoredUser, '_id'> = {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      hashedPassword: hashedPassword,
      hashedPin: hashedPin,
    };

    const result = await db.collection<StoredUser>(USERS_COLLECTION).insertOne(newUser as StoredUser);

    if (result.insertedId) {
      // Create session upon successful user creation (default short expiry for initial signup)
      const userAgent = headers().get('user-agent') || 'Unknown UA';
      const ipAddress = headers().get('x-forwarded-for')?.split(',')[0].trim() || headers().get('x-real-ip') || headers().get('cf-connecting-ip') || 'Unknown IP';
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionTokenHash = await hashToken(sessionToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SESSION_TOKEN_DEFAULT_EXPIRY_DAYS);

      await db.collection<Omit<Session, '_id'>>(SESSIONS_COLLECTION).insertOne({
        userId: result.insertedId.toString(),
        tokenHash: sessionTokenHash,
        userAgent,
        ipAddress,
        createdAt: new Date(),
        expiresAt,
      });

      return {
        success: true,
        message: "User created successfully. You are now logged in.",
        user: { id: result.insertedId.toString(), username: username },
        token: sessionToken, // Return the original token to client
      };
    } else {
      return { success: false, message: "Failed to create user in database." };
    }
  } catch (error) {
    console.error("Error creating user:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred during user creation.";
    return { success: false, message };
  }
}

export async function getUserByUsername(username: string): Promise<StoredUser | null> {
  try {
    const db = await getDb();
    const user = await db.collection<StoredUser>(USERS_COLLECTION).findOne({ username: username.toLowerCase() });
    return user;
  } catch (error) {
    console.error("Error fetching user by username:", error);
    return null;
  }
}

export async function verifyUserPassword(passwordPlain: string, hashedPasswordFromDb: string): Promise<boolean> {
  try {
    return await bcrypt.compare(passwordPlain, hashedPasswordFromDb);
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

export async function verifyUserPin(pinPlain: string, hashedPinFromDb: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pinPlain, hashedPinFromDb);
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return false;
  }
}

export async function authenticateUser(
  usernameInput: string,
  passwordInput: string,
  rememberMe?: boolean // Added rememberMe parameter
): Promise<{ success: boolean; message: string; user?: AuthContextUser, token?: string }> {
  const userFromDb = await getUserByUsername(usernameInput);

  if (!userFromDb || !userFromDb._id) {
    return { success: false, message: "Invalid username or password." };
  }

  if (!userFromDb.hashedPassword) {
    return { success: false, message: "User account is not configured for password login." };
  }

  const isPasswordValid = await verifyUserPassword(passwordInput, userFromDb.hashedPassword);

  if (isPasswordValid) {
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || 'Unknown UA';
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0].trim() || headersList.get('x-real-ip') || headersList.get('cf-connecting-ip') || 'Unknown IP';

    // Log login activity
    try {
      const loginActivityEntry: Omit<LoginActivity, '_id'> = {
        userId: userFromDb._id!.toString(),
        username: userFromDb.username,
        loginTimestamp: new Date(),
        userAgent: userAgent,
        ipAddress: ipAddress,
      };
      const db = await getDb();
      await db.collection<Omit<LoginActivity, '_id'>>(LOGIN_ACTIVITY_COLLECTION).insertOne(loginActivityEntry);
    } catch (activityError) {
      console.error("Failed to log login activity:", activityError);
    }

    // Create and store new session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = await hashToken(sessionToken);
    const expiresAt = new Date();
    if (rememberMe) {
      expiresAt.setDate(expiresAt.getDate() + SESSION_TOKEN_REMEMBER_ME_EXPIRY_DAYS); // e.g., 365 days
    } else {
      expiresAt.setDate(expiresAt.getDate() + SESSION_TOKEN_DEFAULT_EXPIRY_DAYS); // e.g., 1 day
    }


    try {
        const db = await getDb();
        await db.collection<Omit<Session, '_id'>>(SESSIONS_COLLECTION).insertOne({
            userId: userFromDb._id.toString(),
            tokenHash: sessionTokenHash,
            userAgent,
            ipAddress,
            createdAt: new Date(),
            expiresAt,
        });
    } catch (sessionError) {
        console.error("Failed to create session:", sessionError);
        return { success: false, message: "Failed to create session. Please try again." };
    }

    return {
      success: true,
      message: "Login successful.",
      user: { id: userFromDb._id.toString(), username: userFromDb.username },
      token: sessionToken, // Return the original token
    };
  } else {
    return { success: false, message: "Invalid username or password." };
  }
}

export async function getLoginHistory(username: string): Promise<LoginActivity[]> {
  try {
    const db = await getDb();
    const activities = await db.collection<LoginActivity>(LOGIN_ACTIVITY_COLLECTION)
      .find({ username: username.toLowerCase() })
      .sort({ loginTimestamp: -1 })
      .limit(10) // Limit to last 10 entries for example
      .toArray();
    // Map _id to string and ensure all fields are correctly typed
    return activities.map(activity => ({
        ...activity,
        _id: activity._id ? activity._id.toString() : undefined, // Convert ObjectId to string if it exists
    }));
  } catch (error) {
    console.error("Error fetching login history:", error);
    return [];
  }
}

export async function changePassword(
  username: string,
  oldPasswordPlain: string,
  newPasswordPlain: string
): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    const user = await getUserByUsername(username);

    if (!user || !user.hashedPassword || !user._id) {
      return { success: false, message: "User not found or password not set." };
    }

    const isOldPasswordValid = await verifyUserPassword(oldPasswordPlain, user.hashedPassword);
    if (!isOldPasswordValid) {
      return { success: false, message: "Incorrect old password." };
    }

    const newHashedPassword = await bcrypt.hash(newPasswordPlain, SALT_ROUNDS);
    const result = await db.collection<StoredUser>(USERS_COLLECTION).updateOne(
      { username: username.toLowerCase() },
      { $set: { hashedPassword: newHashedPassword } }
    );

    if (result.modifiedCount > 0) {
      // Invalidate all existing sessions for this user
      await db.collection(SESSIONS_COLLECTION).deleteMany({ userId: user._id.toString() });
      return { success: true, message: "Password changed successfully. All other sessions have been logged out." };
    } else {
      return { success: false, message: "Failed to update password in database." };
    }
  } catch (error) {
    console.error("Error changing password:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
}

export async function changePin(
  username: string,
  currentPasswordPlain: string,
  newPinPlain: string
): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    const user = await getUserByUsername(username);

    if (!user || !user.hashedPassword) {
      return { success: false, message: "User not found or password not set for authorization." };
    }

    const isPasswordValid = await verifyUserPassword(currentPasswordPlain, user.hashedPassword);
    if (!isPasswordValid) {
      return { success: false, message: "Incorrect account password. PIN change not authorized." };
    }

    const newHashedPin = await bcrypt.hash(newPinPlain, SALT_ROUNDS);
    const result = await db.collection<StoredUser>(USERS_COLLECTION).updateOne(
      { username: username.toLowerCase() },
      { $set: { hashedPin: newHashedPin } }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: "PIN changed successfully." };
    } else {
      return { success: false, message: "Failed to update PIN in database." };
    }
  } catch (error) {
    console.error("Error changing PIN:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
}

export async function deleteSessionByToken(token: string): Promise<void> {
  if (!token) return;
  try {
    const db = await getDb();
    const tokenHash = await hashToken(token); // Hash the token provided by client for lookup
    await db.collection(SESSIONS_COLLECTION).deleteOne({ tokenHash: tokenHash });
    console.log("Session deleted from DB for token (hash):", tokenHash.substring(0,10) + "...");
  } catch (error) {
    console.error("Error deleting session by token:", error);
  }
}

export async function deleteLoginActivityEntry(activityId: string | null): Promise<{ success: boolean, message?: string }> {
  if (!activityId) {
    return { success: false, message: "Activity ID is required for deletion." };
  }
  try {
    const db = await getDb();
    // Attempt to convert string ID to ObjectId for MongoDB
    let objectIdToDelete;
    try {
      objectIdToDelete = new (await import('mongodb')).ObjectId(activityId);
    } catch (e) {
      return { success: false, message: "Invalid Activity ID format." };
    }

    const result = await db.collection(LOGIN_ACTIVITY_COLLECTION).deleteOne({ _id: objectIdToDelete });
    if (result.deletedCount > 0) {
      return { success: true, message: "Login activity record deleted." };
    } else {
      return { success: false, message: "No login activity record found with that ID or it was already deleted." };
    }
  } catch (error) {
    console.error("Error deleting login activity entry:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred." };
  }
}
