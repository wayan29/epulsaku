// src/ai/flows/verify-pin-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow for verifying a user's PIN against MongoDB.
 *
 * - verifyPin - A function that calls the PIN verification flow.
 * - VerifyPinInput - The input type for the verifyPin function.
 * - VerifyPinOutput - The return type for the verifyPin function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getUserByUsername, verifyUserPin } from '@/lib/user-utils';

const VerifyPinInputSchema = z.object({
  username: z.string().describe('The username of the user whose PIN is being verified.'),
  pin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/, "PIN must be only digits").describe('The 6-digit PIN to verify.'),
});
export type VerifyPinInput = z.infer<typeof VerifyPinInputSchema>;

const VerifyPinOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the provided PIN is valid for the user.'),
  message: z.string().optional().describe('An optional message, e.g., error message.'),
});
export type VerifyPinOutput = z.infer<typeof VerifyPinOutputSchema>;

export async function verifyPin(input: VerifyPinInput): Promise<VerifyPinOutput> {
  return verifyPinFlow(input);
}

const verifyPinFlow = ai.defineFlow(
  {
    name: 'verifyPinFlow',
    inputSchema: VerifyPinInputSchema,
    outputSchema: VerifyPinOutputSchema,
  },
  async (input) => {
    const user = await getUserByUsername(input.username);

    if (!user) {
      return { isValid: false, message: 'User not found.' };
    }

    if (!user.hashedPin) {
      return { isValid: false, message: 'User does not have a PIN configured.' };
    }

    const isPinValid = await verifyUserPin(input.pin, user.hashedPin);

    if (isPinValid) {
      return { isValid: true, message: 'PIN verified successfully.' };
    } else {
      return { isValid: false, message: 'Invalid PIN.' };
    }
  }
);
