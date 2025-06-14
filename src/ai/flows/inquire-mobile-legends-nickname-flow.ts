
'use server';
/**
 * @fileOverview A Genkit flow for inquiring Mobile Legends nickname using Codashop API.
 *
 * - inquireMobileLegendsNickname - A function that calls the Mobile Legends nickname inquiry flow.
 * - InquireMobileLegendsNicknameInput - The input type for the function.
 * - InquireMobileLegendsNicknameOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InquireMobileLegendsNicknameInputSchema = z.object({
  userId: z.string().min(5, "User ID must be at least 5 characters").describe('The Mobile Legends User ID.'),
  zoneId: z.string().min(1, "Zone ID is required").describe('The Mobile Legends Zone ID.'),
});
export type InquireMobileLegendsNicknameInput = z.infer<typeof InquireMobileLegendsNicknameInputSchema>;

const InquireMobileLegendsNicknameOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the nickname inquiry was successful.'),
  nickname: z.string().optional().describe('The Mobile Legends nickname if found.'),
  message: z.string().optional().describe('An optional message, e.g., error message or status message.'),
  rawResponse: z.any().optional().describe('The raw response data from Codashop for debugging.'),
});
export type InquireMobileLegendsNicknameOutput = z.infer<typeof InquireMobileLegendsNicknameOutputSchema>;

export async function inquireMobileLegendsNickname(input: InquireMobileLegendsNicknameInput): Promise<InquireMobileLegendsNicknameOutput> {
  return inquireMobileLegendsNicknameFlow(input);
}

const inquireMobileLegendsNicknameFlow = ai.defineFlow(
  {
    name: 'inquireMobileLegendsNicknameFlow',
    inputSchema: InquireMobileLegendsNicknameInputSchema,
    outputSchema: InquireMobileLegendsNicknameOutputSchema,
  },
  async (input) => {
    const codashopApiUrl = 'https://order-sg.codashop.com/initPayment.action';

    // Generate a simple nonce (date + random part)
    const datePart = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const randomPart = Math.floor(Math.random() * 1000);
    const nonce = `${datePart.replace(/-/g, '/')}-${randomPart}`; // e.g., 2023/10/27-123

    const postData = {
      'voucherPricePoint.id': 1471, // From PHP example for MLBB
      'voucherPricePoint.price': 84360.0, // From PHP example
      'voucherPricePoint.variablePrice': 0,
      'n': nonce,
      'email': '',
      'userVariablePrice': 0,
      'order.data.profile': 'eyJuYW1lIjoiICIsImRhdGVvZmJpcnRoIjoiIiwiaWRfbm8iOiIifQ==', // Base64: {"name":" ","dateofbirth":"","id_no":""}
      'user.userId': input.userId,
      'user.zoneId': input.zoneId,
      'msisdn': '',
      'voucherTypeName': 'MOBILE_LEGENDS',
      'shopLang': 'id_ID',
      'voucherTypeId': 5, // From PHP example
      'gvtId': 19,       // From PHP example
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
          'Origin': 'https://www.codashop.com',
          'Referer': 'https://www.codashop.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        },
        body: JSON.stringify(postData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Codashop API HTTP error response (ML Nickname):', responseData);
        const errorMessage = responseData?.errorMsg || responseData?.message || `Codashop API request failed: ${response.status} ${response.statusText}`;
        return {
          isSuccess: false,
          message: `Error: ${errorMessage}`,
          rawResponse: responseData,
        };
      }

      if (responseData.RESULT_CODE === '10001' || responseData.resultCode === '10001') {
        return {
          isSuccess: false,
          message: 'Too many attempts to check nickname. Please wait a moment and try again.',
          rawResponse: responseData,
        };
      }
      
      if (responseData.success && !responseData.errorMsg) {
        let extractedNickname: string | undefined = undefined;

        // Priority 1: confirmationFields.username (often the primary source)
        if (responseData.confirmationFields?.username) {
            extractedNickname = decodeURIComponent(responseData.confirmationFields.username as string);
        }
        
        // Priority 2: Try 'result' field (decode JSON, then resultData.username or resultData.roles[0].role)
        if (!extractedNickname && responseData.result && typeof responseData.result === 'string') {
          try {
            const decodedResultString = decodeURIComponent(responseData.result);
            const resultData = JSON.parse(decodedResultString);
             if (resultData.username) { 
              extractedNickname = decodeURIComponent(resultData.username as string);
            } else if (resultData.roles && resultData.roles[0] && resultData.roles[0].role) {
              extractedNickname = decodeURIComponent(resultData.roles[0].role as string);
            }
          } catch (e) {
            console.warn("Could not parse nickname from 'result' field for ML:", e);
          }
        }

        if (extractedNickname) {
          return {
            isSuccess: true,
            nickname: extractedNickname,
            message: 'Nickname inquiry successful.',
            rawResponse: responseData,
          };
        } else {
          return {
            isSuccess: true, 
            nickname: undefined, 
            message: 'User ID/Zone ID found, but nickname is not available in the response or is in an unexpected format.',
            rawResponse: responseData,
          };
        }
      } else {
        console.error('Codashop API returned an error (ML Nickname):', responseData);
        return {
          isSuccess: false,
          message: `Inquiry failed: ${responseData.errorMsg || responseData.message || 'Invalid User ID/Zone ID or unknown Codashop error.'}`,
          rawResponse: responseData,
        };
      }
    } catch (error) {
      console.error('Error during Mobile Legends nickname inquiry:', error);
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
