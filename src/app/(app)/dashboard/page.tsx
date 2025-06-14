
// src/app/(app)/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import ProductCard from "@/components/products/ProductCard";
import {
  Wallet,
  Loader2,
  AlertTriangle,
  LayoutGrid,
  Smartphone,
  Zap,
  PiggyBank,
  Gamepad2,
  Settings,
} from "lucide-react";
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

import { fetchDigiflazzBalance } from '@/ai/flows/fetch-digiflazz-balance-flow';
import { fetchDigiflazzProducts, type DigiflazzProduct } from '@/ai/flows/fetch-digiflazz-products-flow';
import DigiflazzDepositDialog from '@/components/dashboard/DepositDialog'; 

import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils';


export default function DashboardPage() {
  const { toast } = useToast();
  const [digiflazzBalance, setDigiflazzBalance] = useState<number | null>(null);
  const [isLoadingDigiflazzBalance, setIsLoadingDigiflazzBalance] = useState(true);
  const [digiflazzBalanceError, setDigiflazzBalanceError] = useState<string | null>(null);

  const [digiflazzApiProducts, setDigiflazzApiProducts] = useState<DigiflazzProduct[]>([]);
  const [isLoadingApiProducts, setIsLoadingApiProducts] = useState(true);
  const [apiProductsError, setApiProductsError] = useState<string | null>(null);

  const [isDigiflazzDepositDialogOpen, setIsDigiflazzDepositDialogOpen] = useState(false);

  const digiflazzCredentialsMissingError = "Digiflazz username or API key is not configured in Admin Settings.";

  const loadDigiflazzBalance = async () => {
    setIsLoadingDigiflazzBalance(true);
    setDigiflazzBalanceError(null);
    try {
      const balanceData = await fetchDigiflazzBalance();
      setDigiflazzBalance(balanceData.balance);
    } catch (error) {
      console.error("Failed to load Digiflazz balance:", error);
      let errorMessage = "Failed to load Digiflazz balance.";
      if (error instanceof Error) errorMessage = error.message;
      setDigiflazzBalanceError(errorMessage);
      if (errorMessage === digiflazzCredentialsMissingError) {
        toast({ title: "Digiflazz Config Needed", description: "Digiflazz credentials are not set. Please configure them in Admin Settings.", variant: "destructive", duration: 7000 });
      } else {
        toast({ title: "Error Loading Digiflazz Balance", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setIsLoadingDigiflazzBalance(false);
    }
  };

  useEffect(() => {
    async function checkConfigsAndLoadData() {
      const adminSettings = await getAdminSettingsFromDB();
      if (adminSettings.digiflazzUsername && adminSettings.digiflazzApiKey) {
        loadDigiflazzBalance();
        loadApiProducts(); 
      } else {
        setIsLoadingDigiflazzBalance(false);
        setDigiflazzBalanceError(digiflazzCredentialsMissingError);
        setIsLoadingApiProducts(false);
        setApiProductsError(digiflazzCredentialsMissingError);
      }
    }
    checkConfigsAndLoadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadApiProducts() {
      setIsLoadingApiProducts(true);
      setApiProductsError(null);
      try {
        const productsData = await fetchDigiflazzProducts({ forceRefresh: false });
        setDigiflazzApiProducts(productsData);
      } catch (error) {
        console.error("Failed to load Digiflazz API products for categories:", error);
        let errorMessage = "Failed to load product categories from API.";
        if (error instanceof Error) {
            errorMessage = error.message;
             if (errorMessage === digiflazzCredentialsMissingError) {
                 errorMessage = "Digiflazz credentials not set. Cannot fetch products.";
             }
        }
        setApiProductsError(errorMessage);
        toast({ title: "Error Loading Categories", description: errorMessage, variant: "destructive" });
      } finally {
        setIsLoadingApiProducts(false);
      }
    }

  const digiflazzCategories = useMemo(() => {
    if (isLoadingApiProducts || apiProductsError || digiflazzApiProducts.length === 0) return [];
    const activeProducts = digiflazzApiProducts.filter(p => p.buyer_product_status && p.seller_product_status);
    if (activeProducts.length === 0 && digiflazzApiProducts.length > 0) {}
    if (digiflazzApiProducts.length === 0) return [];

    const processedCategoriesMap = new Map<string, { title: string, description: string, icon: LucideIcon, href: string, colorClass: string }>();
    digiflazzApiProducts.forEach(product => {
      let categoryKey = product.category;
      let displayTitle = product.category;
      let hrefLink = `/order/digital-services?category=${encodeURIComponent(product.category)}`;
      let icon: LucideIcon = LayoutGrid;
      let color = "text-purple-600";
      let description = `Beli ${displayTitle.toLowerCase()} untuk berbagai kebutuhan Anda.`;
      const categoryUpper = product.category.toUpperCase();
      const brandUpper = product.brand.toUpperCase();

      if (categoryUpper.includes("PULSA") || brandUpper.includes("PULSA") || categoryUpper.includes("PAKET DATA") || brandUpper.includes("DATA")) {
        categoryKey = "Pulsa"; displayTitle = "Pulsa & Data (Digiflazz)"; hrefLink = "/order/pulsa"; icon = Smartphone; color = "text-blue-600"; description = `Beli pulsa & paket data via Digiflazz.`;
      } else if ((categoryUpper.includes("TOKEN LISTRIK") || categoryUpper.includes("PLN")) && brandUpper.includes("PLN")) {
        categoryKey = "Token Listrik"; displayTitle = "Token Listrik PLN (Digiflazz)"; hrefLink = "/order/token-listrik"; icon = Zap; color = "text-yellow-500"; description = `Beli token listrik PLN prabayar via Digiflazz.`;
      } else if (categoryUpper.includes("GAME") || brandUpper.includes("GAME") || categoryUpper.includes("TOPUP") || brandUpper.includes("VOUCHER GAME")) {
        categoryKey = "Games"; displayTitle = "Top Up Games (Digiflazz)"; hrefLink = `/order/digital-services?category=Games`; icon = Gamepad2; color = "text-red-500"; description = `Top up berbagai macam game via Digiflazz.`;
      } else if (categoryUpper === "E-MONEY" || categoryUpper.includes("E-WALLET") || categoryUpper.includes("SALDO DIGITAL")) {
        categoryKey = "E-Money"; displayTitle = "E-Money & E-Wallet (Digiflazz)"; hrefLink = `/order/digital-services?category=E-Money`; icon = Wallet; color = "text-green-600"; description = `Isi ulang e-money & e-wallet via Digiflazz.`;
      }
      if (!processedCategoriesMap.has(categoryKey)) {
        processedCategoriesMap.set(categoryKey, { title: displayTitle, description: description, icon: icon, href: hrefLink, colorClass: color });
      }
    });
    const allCategoriesArray = Array.from(processedCategoriesMap.values());
    const priorityOrder = ["Pulsa & Data (Digiflazz)", "Token Listrik PLN (Digiflazz)", "Top Up Games (Digiflazz)"];
    const prioritizedCategories = [];
    const otherCategories = [];
    for (const category of allCategoriesArray) {
      if (priorityOrder.includes(category.title)) prioritizedCategories.push(category);
      else otherCategories.push(category);
    }
    prioritizedCategories.sort((a, b) => priorityOrder.indexOf(a.title) - priorityOrder.indexOf(b.title));
    otherCategories.sort((a, b) => a.title.localeCompare(b.title));
    return [...prioritizedCategories, ...otherCategories];
  }, [digiflazzApiProducts, isLoadingApiProducts, apiProductsError]);

  return (
    <>
      <div className="space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <Card className="shadow-lg border-purple-500/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold font-headline">Digiflazz Balance</CardTitle>
              <Wallet className="h-6 w-6 text-purple-500" />
            </CardHeader>
            <CardContent>
              {isLoadingDigiflazzBalance && (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> <span>Loading balance...</span>
                </div>
              )}
              {digiflazzBalanceError && !isLoadingDigiflazzBalance && (
                <div className="text-destructive space-y-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5" /> <span>Error: {digiflazzBalanceError}</span>
                  </div>
                  {digiflazzBalanceError === digiflazzCredentialsMissingError && (
                    <Button asChild variant="destructive" size="sm" className="mt-2">
                      <Link href="/admin-settings"> <Settings className="mr-2 h-4 w-4" /> Go to Admin Settings </Link>
                    </Button>
                  )}
                </div>
              )}
              {digiflazzBalance !== null && !isLoadingDigiflazzBalance && !digiflazzBalanceError && (
                <p className="text-2xl font-bold text-purple-600"> Rp {digiflazzBalance.toLocaleString()} </p>
              )}
              {digiflazzBalance === null && !isLoadingDigiflazzBalance && !digiflazzBalanceError && (
                 <p className="text-muted-foreground">Digiflazz balance data not available.</p>
              )}
              <Button variant="outline" size="sm" className="mt-3 border-purple-500 text-purple-600 hover:bg-purple-500/10" onClick={() => setIsDigiflazzDepositDialogOpen(true)} disabled={isLoadingDigiflazzBalance || !!digiflazzBalanceError}>
                <PiggyBank className="mr-2 h-4 w-4" /> Request Deposit (Digiflazz)
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-headline">Digiflazz Services</h1>
          <p className="text-md sm:text-lg text-muted-foreground"> Top up pulsa, token listrik, game, e-money, dan lainnya via Digiflazz. </p>
        </section>

        <section>
          <h2 className="text-xl sm:text-2xl font-semibold mb-6 font-headline">Explore Digiflazz Products</h2>
          {isLoadingApiProducts && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mr-3" /> <span>Loading product categories...</span>
            </div>
          )}
          {apiProductsError && !isLoadingApiProducts && (
            <div className="flex flex-col items-center justify-center py-6 text-destructive bg-destructive/10 p-4 rounded-md">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Digiflazz Categories</p>
              <p className="text-sm text-center">{apiProductsError}</p>
              {apiProductsError.includes("Digiflazz credentials not set") && (
                  <Button asChild variant="destructive" size="sm" className="mt-3">
                  <Link href="/admin-settings"> <Settings className="mr-2 h-4 w-4" /> Go to Admin Settings </Link>
                  </Button>
              )}
            </div>
          )}
          {!isLoadingApiProducts && !apiProductsError && digiflazzCategories.length === 0 && digiflazzApiProducts.length > 0 && (
             <p className="text-center text-muted-foreground py-6">No categories could be derived from active Digiflazz products.</p>
          )}
           {!isLoadingApiProducts && !apiProductsError && digiflazzCategories.length === 0 && digiflazzApiProducts.length === 0 && !apiProductsError && (
             <p className="text-center text-muted-foreground py-6">No products found from Digiflazz to determine categories.</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {!isLoadingApiProducts && !apiProductsError && digiflazzCategories.length > 0 &&
                  digiflazzCategories.map((category) => (
                  <ProductCard key={category.title} title={category.title} description={category.description} icon={category.icon} href={category.href} colorClass={category.colorClass} />
                  ))
              }
          </div>
        </section>
      </div>
      <DigiflazzDepositDialog open={isDigiflazzDepositDialogOpen} onOpenChange={setIsDigiflazzDepositDialogOpen} onDepositSuccess={() => { loadDigiflazzBalance(); }} />
    </>
  );
}
