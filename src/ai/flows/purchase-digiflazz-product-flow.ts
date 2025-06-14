
'use server';
/**
 * @fileOverview A Genkit flow for purchasing a product from Digiflazz.
 *
 * - purchaseDigiflazzProduct - A function that calls the Digiflazz transaction flow.
 * - PurchaseDigiflazzProductInput - The input type for the function.
 * - PurchaseDigiflazzProductOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import crypto from 'crypto';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils'; // Import new settings utility

const PurchaseDigiflazzProductInputSchema = z.object({
  buyerSkuCode: z.string().describe('The buyer_sku_code of the product from Digiflazz.'),
  customerNo: z.string().describe('The customer number (e.g., phone number, meter ID, game ID).'),
  refId: z.string().describe('A unique reference ID for this transaction generated by the client application.'),
});
export type PurchaseDigiflazzProductInput = z.infer<typeof PurchaseDigiflazzProductInputSchema>;

const PurchaseDigiflazzProductOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the transaction initiation was broadly successful (API call okay).'),
  status: z.enum(["Sukses", "Pending", "Gagal"]).optional().describe('The transaction status from Digiflazz.'),
  message: z.string().optional().describe('Message from Digiflazz or an error message.'),
  sn: z.string().optional().nullable().describe('Serial number if the transaction is successful and provides one.'),
  price: z.number().optional().nullable().describe('The price of the product that was attempted to be purchased.'),
  rc: z.string().optional().nullable().describe('Response code from Digiflazz.'),
  productName: z.string().optional().nullable().describe('Name of the product purchased (passed through for logging).'),
  customerNo: z.string().optional().describe('Customer number for logging.'),
  refId: z.string().optional().describe('Reference ID for logging.'),
  rawResponse: z.any().optional().describe('The raw response data from Digiflazz for debugging.'),
});
export type PurchaseDigiflazzProductOutput = z.infer<typeof PurchaseDigiflazzProductOutputSchema>;

export async function purchaseDigiflazzProduct(input: PurchaseDigiflazzProductInput): Promise<PurchaseDigiflazzProductOutput> {
  return purchaseDigiflazzProductFlow(input);
}

const purchaseDigiflazzProductFlow = ai.defineFlow(
  {
    name: 'purchaseDigiflazzProductFlow',
    inputSchema: PurchaseDigiflazzProductInputSchema,
    outputSchema: PurchaseDigiflazzProductOutputSchema,
  },
  async (input) => {
    const adminSettings = await getAdminSettingsFromDB();
    const username = adminSettings.digiflazzUsername;
    const apiKey = adminSettings.digiflazzApiKey;
    const digiflazzApiUrl = 'https://api.digiflazz.com/v1/transaction';

    if (!username || !apiKey) {
      return {
        isSuccess: false,
        message: 'Error: Digiflazz username or API key is not configured in Admin Settings.',
        status: "Gagal",
        refId: input.refId,
        customerNo: input.customerNo,
      };
    }

    // Signature for /v1/transaction is md5(username + apiKey + ref_id)
    const signaturePayload = `${username}${apiKey}${input.refId}`;
    const sign = crypto.createHash('md5').update(signaturePayload).digest('hex');

    const requestBody = {
      username: username,
      buyer_sku_code: input.buyerSkuCode,
      customer_no: input.customerNo,
      ref_id: input.refId,
      sign: sign,
      testing: false, // IMPORTANT: Set to false for production transactions
    };

    try {
      const response = await fetch(digiflazzApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();
      const digiData = responseData.data; 

      if (!response.ok) {
        console.error('Digiflazz API HTTP error response (transaction):', responseData);
        const errorMessage = digiData?.message || responseData?.message || `Digiflazz API request failed: ${response.status} ${response.statusText}`;
        return {
          isSuccess: false,
          message: `Error: ${errorMessage}`,
          status: "Gagal",
          rc: digiData?.rc || responseData?.rc,
          rawResponse: responseData,
          refId: input.refId,
          customerNo: input.customerNo,
        };
      }
      
      if (digiData) {
        return {
          isSuccess: true, 
          status: digiData.status, 
          message: digiData.message,
          sn: digiData.sn || null,
          price: digiData.price || null,
          rc: digiData.rc,
          productName: digiData.buyer_sku_code, 
          customerNo: digiData.customer_no,
          refId: digiData.ref_id,
          rawResponse: responseData,
        };
      } else {
        console.error('Unexpected Digiflazz API success response structure (transaction):', responseData);
        return {
          isSuccess: false,
          message: 'Unexpected response structure from Digiflazz API.',
          status: "Gagal",
          rawResponse: responseData,
          refId: input.refId,
          customerNo: input.customerNo,
        };
      }
    } catch (error) {
      console.error('Error during Digiflazz transaction request:', error);
      let errorMessage = 'An unknown error occurred during the transaction request.';
      if (error instanceof Error) {
        if (error.message === 'Digiflazz username or API key is not configured in Admin Settings.') {
             return { isSuccess: false, status: "Gagal", message: error.message, refId: input.refId, customerNo: input.customerNo };
        }
        errorMessage = error.message;
      }
      return {
        isSuccess: false,
        message: `Client-side error: ${errorMessage}`,
        status: "Gagal",
        refId: input.refId,
        customerNo: input.customerNo,
      };
    }
  }
);
