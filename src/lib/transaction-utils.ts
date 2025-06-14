// src/lib/transaction-utils.ts
'use server';

import type { TransactionStatus, NewTransactionInput, TransactionCore } from "@/components/transactions/TransactionItem"; 
import { productIconsMapping } from "@/components/transactions/TransactionItem";
import { getDb } from './mongodb';
import { revalidatePath } from 'next/cache';
import { fetchSingleCustomPriceFromDB } from '@/lib/db-price-settings-utils'; 

const TRANSACTIONS_COLLECTION = "transactions_log";

const RELEVANT_PULSA_CATEGORIES_UPPER = ["PULSA", "PAKET DATA"];
const RELEVANT_PLN_CATEGORIES_UPPER = ["PLN", "TOKEN LISTRIK", "TOKEN"];
const RELEVANT_GAME_CATEGORIES_UPPER = ["GAME", "TOPUP", "VOUCHER GAME"];
const RELEVANT_EMONEY_CATEGORIES_UPPER = ["E-MONEY", "E-WALLET", "SALDO DIGITAL"];

export interface Transaction extends TransactionCore {
  iconName: string;
  categoryKey: string; 
  _id?: string; 
}

function determineTransactionCategoryDetails(
  productCategory: string,
  productBrand: string,
  provider?: 'digiflazz' | 'tokovoucher' 
): { categoryKey: string; iconName: string } {
  const categoryUpper = productCategory.toUpperCase();
  const brandUpper = productBrand.toUpperCase();

  if (RELEVANT_PULSA_CATEGORIES_UPPER.some(cat => categoryUpper.includes(cat) || brandUpper.includes(cat))) {
    return { categoryKey: "Pulsa", iconName: "Pulsa" };
  }
  if (brandUpper.includes("PLN") || RELEVANT_PLN_CATEGORIES_UPPER.some(cat => categoryUpper.includes(cat))) {
    return { categoryKey: "Token Listrik", iconName: "Token Listrik" };
  }
  if (brandUpper.includes("FREE FIRE")) return { categoryKey: "FREE FIRE", iconName: "FREE FIRE" };
  if (brandUpper.includes("MOBILE LEGENDS")) return { categoryKey: "MOBILE LEGENDS", iconName: "MOBILE LEGENDS" };
  if (brandUpper.includes("GENSHIN IMPACT")) return { categoryKey: "GENSHIN IMPACT", iconName: "GENSHIN IMPACT" };
  if (brandUpper.includes("HONKAI STAR RAIL")) return { categoryKey: "HONKAI STAR RAIL", iconName: "HONKAI STAR RAIL" };
  
  if (RELEVANT_GAME_CATEGORIES_UPPER.some(cat => categoryUpper.includes(cat) || brandUpper.includes(cat))) {
    return { categoryKey: "Game Topup", iconName: "Game Topup" };
  }
  if (RELEVANT_EMONEY_CATEGORIES_UPPER.some(cat => categoryUpper.includes(cat) || brandUpper.includes(cat))) {
    return { categoryKey: "E-Money", iconName: "E-Money" };
  }
  
  const fallbackKey = productCategory || "Digital Service";
  const iconMatch = Object.keys(productIconsMapping).find(k => fallbackKey.toUpperCase().includes(k.toUpperCase()));
  
  if (iconMatch) {
    return { categoryKey: iconMatch, iconName: iconMatch };
  }

  return { 
    categoryKey: "Default", 
    iconName: "Default"
  };
}

async function calculateSellingPrice (costPrice: number, productCode: string, provider: 'digiflazz' | 'tokovoucher'): Promise<number> {
  const customPrice = await fetchSingleCustomPriceFromDB(productCode, provider); 
  if (customPrice && customPrice > 0) {
    return customPrice;
  }
  if (costPrice < 20000) {
    return costPrice + 1000;
  } else if (costPrice >= 20000 && costPrice <= 50000) {
    return costPrice + 1500;
  } else {
    return costPrice + 2000;
  }
};

export async function addTransactionToDB(newTransactionInput: NewTransactionInput): Promise<{ success: boolean, transactionId?: string, message?: string }> {
  try {
    const db = await getDb();
    const { categoryKey, iconName } = determineTransactionCategoryDetails(
      newTransactionInput.productCategoryFromProvider,
      newTransactionInput.productBrandFromProvider,
      newTransactionInput.provider
    );
    
    const sellingPrice = await calculateSellingPrice(
        newTransactionInput.costPrice, 
        newTransactionInput.buyerSkuCode, // This is the product code (SKU for digiflazz, code for tokovoucher)
        newTransactionInput.provider
    );
    
    const transactionDate = new Date(newTransactionInput.timestamp);
    const transactionYear = transactionDate.getFullYear();
    const transactionMonth = transactionDate.getMonth() + 1; 
    const transactionDayOfMonth = transactionDate.getDate();
    const transactionDayOfWeek = transactionDate.getDay(); 
    const transactionHour = transactionDate.getHours();

    const docToInsert: TransactionCore & { categoryKey: string; productIcon: string } = {
      ...newTransactionInput,
      sellingPrice: sellingPrice,
      source: newTransactionInput.source || 'web', 
      categoryKey: categoryKey,
      productIcon: iconName, 
      providerTransactionId: newTransactionInput.providerTransactionId,
      transactionYear,
      transactionMonth,
      transactionDayOfMonth,
      transactionDayOfWeek,
      transactionHour,
    };

    const result = await db.collection(TRANSACTIONS_COLLECTION).insertOne(docToInsert);

    if (result.insertedId) {
      revalidatePath('/transactions'); 
      revalidatePath('/profit-report'); 
      return { success: true, transactionId: newTransactionInput.id };
    } else {
      return { success: false, message: "Failed to insert transaction into database." };
    }
  } catch (error) {
    console.error("Error adding transaction to DB:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown DB error." };
  }
}

export async function getTransactionsFromDB(): Promise<Transaction[]> {
  try {
    const db = await getDb();
    const transactionsFromDB = await db.collection(TRANSACTIONS_COLLECTION)
      .find({})
      .sort({ timestamp: -1 })
      .toArray();

    const processedTransactions: Transaction[] = [];
    for (const doc of transactionsFromDB) {
        const { categoryKey, iconName } = determineTransactionCategoryDetails(
            doc.productCategoryFromProvider || doc.categoryKey || "", 
            doc.productBrandFromProvider || doc.productName || "",
            doc.provider
        );
      
        const costPrice = typeof doc.costPrice === 'number' ? doc.costPrice : 0;
        let sellingPrice = typeof doc.sellingPrice === 'number' && doc.sellingPrice > 0 
                            ? doc.sellingPrice 
                            : await calculateSellingPrice(costPrice, doc.buyerSkuCode, doc.provider);
        
        if (sellingPrice === 0 && costPrice > 0) { // Recalculate if selling price is 0 but cost is not
            sellingPrice = await calculateSellingPrice(costPrice, doc.buyerSkuCode, doc.provider);
        }

        processedTransactions.push({
            ...doc,
            _id: doc._id ? doc._id.toString() : undefined, 
            id: doc.id, 
            costPrice: costPrice,
            sellingPrice: sellingPrice,
            categoryKey: categoryKey, 
            iconName: doc.productIcon || iconName, 
            timestamp: doc.timestamp,
            providerTransactionId: doc.providerTransactionId,
            transactionYear: doc.transactionYear,
            transactionMonth: doc.transactionMonth,
            transactionDayOfMonth: doc.transactionDayOfMonth,
            transactionDayOfWeek: doc.transactionDayOfWeek,
            transactionHour: doc.transactionHour,
            provider: doc.provider || 'digiflazz', 
            source: doc.source || 'web',
        } as Transaction);
    }
    return processedTransactions.filter(tx => typeof tx.costPrice === 'number' && typeof tx.sellingPrice === 'number');

  } catch (error) {
    console.error("Error fetching transactions from DB:", error);
    return [];
  }
}

export async function getTransactionByIdFromDB(transactionId: string): Promise<Transaction | null> {
  try {
    const db = await getDb();
    const doc = await db.collection(TRANSACTIONS_COLLECTION).findOne({ id: transactionId });

    if (doc) {
       const { categoryKey, iconName } = determineTransactionCategoryDetails(
        doc.productCategoryFromProvider || doc.categoryKey || "",
        doc.productBrandFromProvider || doc.productName || "",
        doc.provider
      );
      const costPrice = typeof doc.costPrice === 'number' ? doc.costPrice : 0;
      let sellingPrice = typeof doc.sellingPrice === 'number' && doc.sellingPrice > 0 
                           ? doc.sellingPrice 
                           : await calculateSellingPrice(costPrice, doc.buyerSkuCode, doc.provider);
        
      if (sellingPrice === 0 && costPrice > 0) {
            sellingPrice = await calculateSellingPrice(costPrice, doc.buyerSkuCode, doc.provider);
      }

      return {
        ...doc,
        _id: doc._id ? doc._id.toString() : undefined,
        id: doc.id,
        costPrice: costPrice,
        sellingPrice: sellingPrice,
        categoryKey: categoryKey,
        iconName: doc.productIcon || iconName, 
        timestamp: doc.timestamp,
        providerTransactionId: doc.providerTransactionId,
        transactionYear: doc.transactionYear,
        transactionMonth: doc.transactionMonth,
        transactionDayOfMonth: doc.transactionDayOfMonth,
        transactionDayOfWeek: doc.transactionDayOfWeek,
        transactionHour: doc.transactionHour,
        provider: doc.provider || 'digiflazz',
        source: doc.source || 'web',
      } as Transaction; 
    }
    return null;
  } catch (error) {
    console.error(`Error fetching transaction by ID ${transactionId} from DB:`, error);
    return null;
  }
}

export async function updateTransactionInDB(updatedTxData: Partial<TransactionCore> & { id: string }): Promise<{ success: boolean, message?: string }> {
  try {
    const db = await getDb();
    const { id, ...dataToUpdate } = updatedTxData;

    const existingTransactionDoc = await db.collection<TransactionCore>(TRANSACTIONS_COLLECTION).findOne({ id: id });
    if (!existingTransactionDoc) {
        return { success: false, message: `Transaction with id ${id} not found for update.` };
    }
    const oldStatus = existingTransactionDoc.status;

    if (oldStatus === "Pending" && dataToUpdate.status && (dataToUpdate.status === "Sukses" || dataToUpdate.status === "Gagal")) {
        const now = new Date();
        dataToUpdate.timestamp = now.toISOString();
        (dataToUpdate as TransactionCore).transactionYear = now.getFullYear();
        (dataToUpdate as TransactionCore).transactionMonth = now.getMonth() + 1;
        (dataToUpdate as TransactionCore).transactionDayOfMonth = now.getDate();
        (dataToUpdate as TransactionCore).transactionDayOfWeek = now.getDay();
        (dataToUpdate as TransactionCore).transactionHour = now.getHours();
    }

    // Calculate sellingPrice if costPrice or buyerSkuCode is being updated, or if it was 0
    const currentCostPrice = dataToUpdate.costPrice !== undefined ? dataToUpdate.costPrice : existingTransactionDoc.costPrice;
    const currentBuyerSkuCode = dataToUpdate.buyerSkuCode !== undefined ? dataToUpdate.buyerSkuCode : existingTransactionDoc.buyerSkuCode;
    const currentProvider = dataToUpdate.provider !== undefined ? dataToUpdate.provider : existingTransactionDoc.provider;

    if (currentCostPrice !== undefined && currentBuyerSkuCode !== undefined && currentProvider !== undefined) {
      if (dataToUpdate.costPrice !== undefined || dataToUpdate.buyerSkuCode !== undefined || !existingTransactionDoc.sellingPrice || existingTransactionDoc.sellingPrice <= 0) {
        (dataToUpdate as any).sellingPrice = await calculateSellingPrice(currentCostPrice, currentBuyerSkuCode, currentProvider);
      }
    }


    if (dataToUpdate.productCategoryFromProvider !== undefined || dataToUpdate.productBrandFromProvider !== undefined) {
        const cat = dataToUpdate.productCategoryFromProvider || existingTransactionDoc.productCategoryFromProvider;
        const brand = dataToUpdate.productBrandFromProvider || existingTransactionDoc.productBrandFromProvider;
        const { categoryKey, iconName } = determineTransactionCategoryDetails(cat, brand, dataToUpdate.provider || existingTransactionDoc.provider);
        (dataToUpdate as any).categoryKey = categoryKey; 
        (dataToUpdate as any).productIcon = iconName; 
    }
    
    if (dataToUpdate.providerTransactionId !== undefined) {
      (dataToUpdate as any).providerTransactionId = dataToUpdate.providerTransactionId;
    }

    const result = await db.collection(TRANSACTIONS_COLLECTION).updateOne(
      { id: id }, 
      { $set: dataToUpdate }
    );

    if (result.modifiedCount > 0 || result.matchedCount > 0) { 
      revalidatePath('/transactions'); 
      revalidatePath('/profit-report');
      return { success: true };
    } else {
      return { success: false, message: `Transaction with id ${id} not found or no changes made.` };
    }
  } catch (error) {
    console.error(`Error updating transaction ${updatedTxData.id} in DB:`, error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown DB error during update." };
  }
}

export async function deleteTransactionFromDB(transactionId: string): Promise<{ success: boolean, message?: string }> {
  try {
    const db = await getDb();
    const result = await db.collection(TRANSACTIONS_COLLECTION).deleteOne({ id: transactionId }); 

    if (result.deletedCount > 0) {
      revalidatePath('/transactions'); 
      revalidatePath('/profit-report');
      return { success: true };
    } else {
      return { success: false, message: `Transaction with id ${transactionId} not found for deletion.` };
    }
  } catch (error) {
    console.error(`Error deleting transaction ${transactionId} from DB:`, error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown DB error during deletion." };
  }
}
