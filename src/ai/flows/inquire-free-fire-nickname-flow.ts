
'use server';
/**
 * @fileOverview A Genkit flow for inquiring Free Fire nickname using Codashop API.
 *
 * - inquireFreeFireNickname - A function that calls the Free Fire nickname inquiry flow.
 * - InquireFreeFireNicknameInput - The input type for the function.
 * - InquireFreeFireNicknameOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InquireFreeFireNicknameInputSchema = z.object({
  userId: z.string().min(5, "User ID must be at least 5 characters").describe('The Free Fire User ID.'),
  // zoneId: z.string().optional().describe('The Free Fire Zone ID, if applicable.'), // Add if needed
});
export type InquireFreeFireNicknameInput = z.infer<typeof InquireFreeFireNicknameInputSchema>;

const InquireFreeFireNicknameOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the nickname inquiry was successful.'),
  nickname: z.string().optional().describe('The Free Fire nickname if found.'),
  message: z.string().optional().describe('An optional message, e.g., error message or status message.'),
  rawResponse: z.any().optional().describe('The raw response data from Codashop for debugging.'),
});
export type InquireFreeFireNicknameOutput = z.infer<typeof InquireFreeFireNicknameOutputSchema>;

export async function inquireFreeFireNickname(input: InquireFreeFireNicknameInput): Promise<InquireFreeFireNicknameOutput> {
  return inquireFreeFireNicknameFlow(input);
}

const inquireFreeFireNicknameFlow = ai.defineFlow(
  {
    name: 'inquireFreeFireNicknameFlow',
    inputSchema: InquireFreeFireNicknameInputSchema,
    outputSchema: InquireFreeFireNicknameOutputSchema,
  },
  async (input) => {
    const codashopApiUrl = 'https://order-sg.codashop.com/initPayment.action';

    // Generate a simple nonce (date + random part) similar to PHP example
    const datePart = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const randomPart = Math.floor(Math.random() * 1000);
    const nonce = `${datePart.replace(/-/g, '/')}-${randomPart}`; // e.g., 2023/10/27-123

    const postData = {
      'voucherPricePoint.id': 8120, // Default FreeFire ID from PHP example
      'voucherPricePoint.price': 50000.0, // Default price
      'voucherPricePoint.variablePrice': 0,
      'n': nonce, // Use generated nonce
      'email': '',
      'userVariablePrice': 0,
      'order.data.profile': 'eyJuYW1lIjoiICIsImRhdGVvZmJpcnRoIjoiIiwiaWRfbm8iOiIifQ==', // Base64: {"name":" ","dateofbirth":"","id_no":""}
      'user.userId': input.userId,
      'user.zoneId': '', // Typically empty for Free Fire on Codashop
      'msisdn': '',
      'voucherTypeName': 'FREEFIRE',
      'shopLang': 'id_ID',
      'voucherTypeId': 17, // From PHP example
      'gvtId': 33,       // From PHP example
      'checkoutId': '',
      'affiliateTrackingId': '',
      'impactClickId': '',
      'anonymousId': ''
    };

    try {
      const response = await fetch(codashopApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.codashop.com', // Mimic browser request
          'Referer': 'https://www.codashop.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36', // Common User-Agent
        },
        body: JSON.stringify(postData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Codashop API HTTP error response (FF Nickname):', responseData);
        const errorMessage = responseData?.errorMsg || responseData?.message || `Codashop API request failed: ${response.status} ${response.statusText}`;
        return {
          isSuccess: false,
          message: `Error: ${errorMessage}`,
          rawResponse: responseData,
        };
      }

      // Handle specific Codashop error codes like "Too many attempts"
      if (responseData.RESULT_CODE === '10001' || responseData.resultCode === '10001') {
        return {
          isSuccess: false,
          message: 'Too many attempts to check nickname. Please wait a moment and try again.',
          rawResponse: responseData,
        };
      }
      
      if (responseData.success && !responseData.errorMsg) {
        let extractedNickname: string | undefined = undefined;

        // 1. Try 'result' field (decode JSON, then resultData.roles[0].role or resultData.username)
        if (responseData.result && typeof responseData.result === 'string') {
          try {
            const decodedResultString = decodeURIComponent(responseData.result);
            const resultData = JSON.parse(decodedResultString);
            if (resultData.roles && resultData.roles[0] && resultData.roles[0].role) {
              extractedNickname = decodeURIComponent(resultData.roles[0].role as string);
            } else if (resultData.username) { 
              extractedNickname = decodeURIComponent(resultData.username as string);
            }
          } catch (e) {
            console.warn("Could not parse nickname from 'result' field:", e);
          }
        }

        // 2. If not found in 'result', try 'confirmationFields.roles[0].role'
        if (!extractedNickname && responseData.confirmationFields?.roles?.[0]?.role) {
          extractedNickname = decodeURIComponent(responseData.confirmationFields.roles[0].role as string);
        }

        // 3. If still not found, try 'confirmationFields.username' (general fallback)
        if (!extractedNickname && responseData.confirmationFields?.username) {
          extractedNickname = decodeURIComponent(responseData.confirmationFields.username as string);
        }

        if (extractedNickname) {
          return {
            isSuccess: true,
            nickname: extractedNickname,
            message: 'Nickname inquiry successful.',
            rawResponse: responseData,
          };
        } else {
          // API call was successful by Codashop's terms, but no nickname found in expected fields
          return {
            isSuccess: true, 
            nickname: undefined, 
            message: 'User ID found, but nickname is not available in the response or is in an unexpected format.',
            rawResponse: responseData,
          };
        }
      } else {
        // success is false or errorMsg is present
        console.error('Codashop API returned an error (FF Nickname):', responseData);
        return {
          isSuccess: false,
          message: `Inquiry failed: ${responseData.errorMsg || responseData.message || 'Invalid User ID or unknown Codashop error.'}`,
          rawResponse: responseData,
        };
      }
    } catch (error) {
      console.error('Error during Free Fire nickname inquiry:', error);
      let errorMessage = 'An unknown error occurred during nickname inquiry.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        isSuccess: false,
        message: `Client-side error: ${errorMessage}`,
      };
    }
  }
);

