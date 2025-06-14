// src/app/(app)/order/tokovoucher/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import OrderFormShell from "@/components/order/OrderFormShell";
import ProductCard from "@/components/products/ProductCard";
import { ShoppingCart, Loader2, AlertTriangle, KeyRound, Send, CheckCircle, Info, DollarSign, ListChecks, Tag, RefreshCw, Server, Code, ArrowLeft, TagIcon, LayoutGrid, Users, PackageSearch, Settings, PiggyBank } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { verifyPin } from '@/ai/flows/verify-pin-flow';
import { generateRefId } from '@/lib/client-utils';
import { addTransactionToDB } from '@/lib/transaction-utils';
import { trySendTelegramNotification, type TelegramNotificationDetails } from '@/lib/notification-utils';
import type { TransactionStatus, NewTransactionInput } from '@/components/transactions/TransactionItem';
import { getCustomSellingPrice } from '@/lib/price-settings-utils';
import { getAdminSettingsFromDB } from '@/lib/admin-settings-utils'; 

import { fetchTokoVoucherBalance, type FetchTokoVoucherBalanceOutput } from '@/ai/flows/tokovoucher/fetchTokoVoucherBalance-flow';
import { fetchTokoVoucherCategories, type TokoVoucherCategory } from '@/ai/flows/tokovoucher/fetchTokoVoucherCategories-flow';
import { fetchTokoVoucherOperators, type TokoVoucherOperator } from '@/ai/flows/tokovoucher/fetchTokoVoucherOperators-flow';
import { fetchTokoVoucherProductTypes, type TokoVoucherProductType } from '@/ai/flows/tokovoucher/fetchTokoVoucherProductTypes-flow';
import { fetchTokoVoucherProducts, type TokoVoucherProduct } from '@/ai/flows/tokovoucher/fetchTokoVoucherProducts-flow';
import { purchaseTokoVoucherProduct } from '@/ai/flows/tokovoucher/purchaseTokoVoucherProduct-flow';
import TokoVoucherDepositDialog from '@/components/dashboard/TokoVoucherDepositDialog';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OrderDetailsToConfirm {
  product: TokoVoucherProduct;
  customerNo: string;
  serverId?: string;
}

interface SubmittedOrderInfo {
  refId: string;
  productName: string;
  customerNoDisplay: string;
  costPrice: number;
  sellingPrice: number;
  profit?: number;
  status: TransactionStatus;
  message?: string | null;
  sn?: string | null;
  trxId?: string; 
}

export default function TokoVoucherOrderPage() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [isTokoVoucherConfigured, setIsTokoVoucherConfigured] = useState(false);
  const tokovoucherCredentialsMissingError = "TokoVoucher Member Code or Signature/Key is not configured in Admin Settings.";
  
  const [tokovoucherBalance, setTokoVoucherBalance] = useState<number | null>(null);
  const [tokovoucherMemberName, setTokoVoucherMemberName] = useState<string | null>(null);
  const [isLoadingTokoVoucherBalance, setIsLoadingTokoVoucherBalance] = useState(true);
  const [tokovoucherBalanceError, setTokoVoucherBalanceError] = useState<string | null>(null);
  const [isTokoVoucherDepositDialogOpen, setIsTokoVoucherDepositDialogOpen] = useState(false);


  const [categories, setCategories] = useState<TokoVoucherCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const [operators, setOperators] = useState<TokoVoucherOperator[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | undefined>();
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);

  const [productTypes, setProductTypes] = useState<TokoVoucherProductType[]>([]);
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<number | undefined>();
  const [isLoadingProductTypes, setIsLoadingProductTypes] = useState(false);

  const [products, setProducts] = useState<TokoVoucherProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<TokoVoucherProduct | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  const [customerNo, setCustomerNo] = useState('');
  const [serverId, setServerId] = useState('');

  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [orderDetailsToConfirm, setOrderDetailsToConfirm] = useState<OrderDetailsToConfirm | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isSubmittingWithPin, setIsSubmittingWithPin] = useState(false);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<SubmittedOrderInfo | null>(null);

  const [mainError, setMainError] = useState<string | null>(null);

  const resetSelections = (level: 'category' | 'operator' | 'productType' | 'product' = 'category') => {
    if (level === 'category') {
      setSelectedCategoryId(undefined);
      setOperators([]);
    }
    if (level === 'category' || level === 'operator') {
      setSelectedOperatorId(undefined);
      setProductTypes([]);
    }
    if (level === 'category' || level === 'operator' || level === 'productType') {
      setSelectedProductTypeId(undefined);
      setProducts([]);
    }
    setSelectedProduct(null);
    setCustomerNo('');
    setServerId('');
    setLastSubmittedOrder(null);
    setMainError(null);
  };

  const loadTokoVoucherBalance = async () => {
    setIsLoadingTokoVoucherBalance(true);
    setTokoVoucherBalanceError(null);
    try {
      const balanceData = await fetchTokoVoucherBalance();
      if (balanceData.isSuccess) {
        setTokoVoucherBalance(balanceData.saldo ?? null);
        setTokoVoucherMemberName(balanceData.nama ?? null);
      } else {
        setTokoVoucherBalanceError(balanceData.message || "Failed to fetch TokoVoucher balance.");
        if (balanceData.message && balanceData.message.includes("not configured")) {
             toast({ title: "TokoVoucher Config Needed", description: balanceData.message, variant: "destructive", duration: 7000 });
        } else {
            toast({ title: "Error Loading TokoVoucher Balance", description: balanceData.message || "Unknown error.", variant: "destructive" });
        }
      }
    } catch (error) {
      console.error("Failed to load TokoVoucher balance:", error);
      let errorMessage = "Failed to load TokoVoucher balance.";
      if (error instanceof Error) errorMessage = error.message;
      setTokoVoucherBalanceError(errorMessage);
      toast({ title: "Error TokoVoucher Balance", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoadingTokoVoucherBalance(false);
    }
  };


  useEffect(() => {
    async function loadInitialData() {
      setIsLoadingCategories(true); 
      const adminSettings = await getAdminSettingsFromDB();
      if (adminSettings.tokovoucherMemberCode && adminSettings.tokovoucherSignature && adminSettings.tokovoucherKey) {
        setIsTokoVoucherConfigured(true);
        loadTokoVoucherBalance();
        
        setMainError(null);
        const result = await fetchTokoVoucherCategories();
        if (result.isSuccess && result.data) {
          setCategories(result.data);
        } else {
          setMainError(result.message || "Failed to load categories from TokoVoucher.");
          toast({ title: "Error", description: result.message || "Could not load TokoVoucher categories.", variant: "destructive" });
        }
      } else {
        setIsTokoVoucherConfigured(false);
        setMainError(tokovoucherCredentialsMissingError);
        setTokoVoucherBalanceError(tokovoucherCredentialsMissingError);
        setIsLoadingTokoVoucherBalance(false);
      }
      setIsLoadingCategories(false);
    }
    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);


  useEffect(() => {
    if (!selectedCategoryId) {
      setOperators([]);
      setSelectedOperatorId(undefined);
      setProductTypes([]);
      setSelectedProductTypeId(undefined);
      setProducts([]);
      setSelectedProduct(null);
      return;
    }
    async function loadOperators() {
      setIsLoadingOperators(true);
      setMainError(null);
      const result = await fetchTokoVoucherOperators({ categoryId: selectedCategoryId! });
      if (result.isSuccess && result.data) {
        setOperators(result.data);
      } else {
        setOperators([]);
        setMainError(result.message || `Failed to load operators for category ${selectedCategoryId}.`);
        toast({ title: "Error", description: result.message || "Could not load TokoVoucher operators.", variant: "destructive" });
      }
      setIsLoadingOperators(false);
      setSelectedOperatorId(undefined);
      setProductTypes([]);
      setSelectedProductTypeId(undefined);
      setProducts([]);
      setSelectedProduct(null);
    }
    loadOperators();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, toast]);

  useEffect(() => {
    if (!selectedOperatorId) {
      setProductTypes([]);
      setSelectedProductTypeId(undefined);
      setProducts([]);
      setSelectedProduct(null);
      return;
    }
    async function loadProductTypes() {
      setIsLoadingProductTypes(true);
      setMainError(null);
      const result = await fetchTokoVoucherProductTypes({ operatorId: selectedOperatorId! });
      if (result.isSuccess && result.data) {
        setProductTypes(result.data);
      } else {
        setProductTypes([]);
        setMainError(result.message || `Failed to load product types for operator ${selectedOperatorId}.`);
        toast({ title: "Error", description: result.message || "Could not load TokoVoucher product types.", variant: "destructive" });
      }
      setIsLoadingProductTypes(false);
      setSelectedProductTypeId(undefined);
      setProducts([]);
      setSelectedProduct(null);
    }
    loadProductTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOperatorId, toast]);

  useEffect(() => {
    if (!selectedProductTypeId) {
      setProducts([]);
      setSelectedProduct(null);
      return;
    }
    async function loadProducts() {
      setIsLoadingProducts(true);
      setMainError(null);
      const result = await fetchTokoVoucherProducts({ productTypeId: selectedProductTypeId! });
      if (result.isSuccess && result.data) {
        setProducts(result.data.sort((a,b) => a.price - b.price));
      } else {
        setProducts([]);
        setMainError(result.message || `Failed to load products for type ${selectedProductTypeId}.`);
        toast({ title: "Error", description: result.message || "Could not load TokoVoucher products.", variant: "destructive" });
      }
      setIsLoadingProducts(false);
      setSelectedProduct(null);
    }
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductTypeId, toast]);

  const handleProductSelect = (product: TokoVoucherProduct) => {
    if (product.status !== 1) {
      toast({ title: "Product Not Available", description: `${product.nama_produk} is currently not available.`, variant: "default" });
      return;
    }
    setSelectedProduct(product);
    setCustomerNo('');
    setServerId('');
    setLastSubmittedOrder(null);
    setTimeout(() => {
        document.getElementById('tokovoucher-order-confirmation-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleInitiateOrder = () => {
    if (!selectedProduct) return;
    if (selectedProduct.status !== 1) {
        toast({ title: "Cannot Order", description: "This product is currently not available.", variant: "destructive" });
        return;
    }
    if (!customerNo.trim()) {
      toast({ title: "Validation Error", description: "Please enter the customer/destination number/ID.", variant: "destructive" });
      return;
    }
    setOrderDetailsToConfirm({ product: selectedProduct, customerNo, serverId: serverId.trim() || undefined });
    setIsConfirmingOrder(true);
    setPinInput("");
    setPinError("");
  };

  const handlePinConfirm = async () => {
    if (!orderDetailsToConfirm || !authUser) {
      setPinError("Order details or user session is missing. Please try again.");
      setIsSubmittingWithPin(false);
      return;
    }
    const { product, customerNo: custNoForApi, serverId: serverIdForApi } = orderDetailsToConfirm;
    if (product.status !== 1) {
      setPinError("This product is currently not available for purchase.");
      setIsSubmittingWithPin(false);
      return;
    }

    setIsSubmittingWithPin(true);
    setPinError("");

    const refId = `TV-${generateRefId()}`;
    const transactionDetailsForDisplay = serverIdForApi ? `${custNoForApi} (Server: ${serverIdForApi})` : custNoForApi;

    try {
      const pinResponse = await verifyPin({ username: authUser.username, pin: pinInput });
      if (!pinResponse.isValid) {
        setPinError(pinResponse.message || "Invalid PIN.");
        setIsSubmittingWithPin(false);
        return;
      }

      const purchaseResponse = await purchaseTokoVoucherProduct({
        refId,
        productCode: product.code,
        customerNo: custNoForApi,
        serverId: serverIdForApi,
      });
      
      const statusForDb: TransactionStatus = purchaseResponse.status === 'sukses' ? 'Sukses' : purchaseResponse.status === 'pending' ? 'Pending' : 'Gagal';
      const clientSideSellingPriceEstimate = getCustomSellingPrice(product.code, 'tokovoucher') || (product.price < 20000 ? product.price + 1000 : product.price <= 50000 ? product.price + 1500 : product.price + 2000);

      const newTxInput: NewTransactionInput = {
        id: refId,
        productName: product.nama_produk,
        details: transactionDetailsForDisplay,
        costPrice: product.price,
        sellingPrice: clientSideSellingPriceEstimate, 
        status: statusForDb,
        timestamp: new Date().toISOString(),
        serialNumber: purchaseResponse.status === 'sukses' ? (purchaseResponse.sn || undefined) : undefined,
        failureReason: purchaseResponse.status === 'gagal' ? (purchaseResponse.sn || purchaseResponse.message) : purchaseResponse.status === 'error' ? purchaseResponse.message : undefined,
        buyerSkuCode: product.code,
        originalCustomerNo: serverIdForApi ? `${custNoForApi}|${serverIdForApi}` : custNoForApi, 
        productCategoryFromProvider: product.category_name || categories.find(c=>c.id === parseInt(product.category_id || "",10))?.nama || "Unknown",
        productBrandFromProvider: product.op_name || operators.find(o=>o.id === parseInt(product.op_id || "",10))?.nama || "Unknown",
        provider: 'tokovoucher',
        providerTransactionId: purchaseResponse.trxId || undefined, 
      };
      
      await addTransactionToDB(newTxInput);

      let profitForSummary: number | undefined = undefined;
      if (statusForDb === "Sukses") {
          profitForSummary = clientSideSellingPriceEstimate - product.price;
      }

      const notificationDetails: TelegramNotificationDetails = {
        refId: refId,
        productName: product.nama_produk,
        customerNoDisplay: transactionDetailsForDisplay,
        status: statusForDb,
        provider: 'TokoVoucher',
        costPrice: product.price,
        sellingPrice: clientSideSellingPriceEstimate,
        profit: profitForSummary,
        sn: purchaseResponse.sn || null,
        failureReason: purchaseResponse.status === 'gagal' ? (purchaseResponse.sn || purchaseResponse.message) : purchaseResponse.status === 'error' ? purchaseResponse.message : null,
        timestamp: new Date(),
        trxId: purchaseResponse.trxId || undefined,
      };
      trySendTelegramNotification(notificationDetails);
      
      if (purchaseResponse.isSuccess) {
        toast({
          title: `Order ${purchaseResponse.status}`,
          description: purchaseResponse.message || `Order for ${product.nama_produk} is ${purchaseResponse.status?.toLowerCase()}. Trx ID: ${purchaseResponse.trxId || 'N/A'}`,
          duration: 7000,
        });
      } else {
         toast({
          title: `Order ${purchaseResponse.status || "Failed"}`,
          description: purchaseResponse.message || "Failed to process your order with TokoVoucher.",
          variant: "destructive",
        });
      }

      setLastSubmittedOrder({
        refId: refId,
        productName: product.nama_produk,
        customerNoDisplay: transactionDetailsForDisplay,
        costPrice: product.price,
        sellingPrice: clientSideSellingPriceEstimate,
        profit: profitForSummary,
        status: statusForDb,
        message: purchaseResponse.message,
        sn: purchaseResponse.sn,
        trxId: purchaseResponse.trxId,
      });

      resetSelections();
      setIsConfirmingOrder(false);
      setOrderDetailsToConfirm(null);
      setPinInput("");
      setPinError("");
      loadTokoVoucherBalance(); 

    } catch (error) {
      console.error("PIN verification or order submission error:", error);
      const message = error instanceof Error ? error.message : "An error occurred.";
      setPinError(`Order error: ${message}`);
      toast({ title: "Order Failed", description: message, variant: "destructive" });
      const notificationDetails: TelegramNotificationDetails = {
        refId: refId,
        productName: product.nama_produk,
        customerNoDisplay: transactionDetailsForDisplay,
        status: "Gagal",
        provider: 'TokoVoucher',
        costPrice: product.price,
        sellingPrice: 0,
        failureReason: message,
        timestamp: new Date(),
      };
      trySendTelegramNotification(notificationDetails);
    } finally {
      setIsSubmittingWithPin(false);
    }
  };
  
  const selectedCategoryName = useMemo(() => categories.find(c => c.id === selectedCategoryId)?.nama, [categories, selectedCategoryId]);
  const selectedOperatorName = useMemo(() => operators.find(o => o.id === selectedOperatorId)?.nama, [operators, selectedOperatorId]);
  const selectedProductTypeName = useMemo(() => productTypes.find(pt => pt.id === selectedProductTypeId)?.nama, [productTypes, selectedProductTypeId]);

  const getStepTitle = () => {
    if (!selectedCategoryId) return "1. Select Category";
    if (!selectedOperatorId) return `2. Select Operator for ${selectedCategoryName}`;
    if (!selectedProductTypeId) return `3. Select Product Type for ${selectedOperatorName}`;
    return `4. Select Product (${selectedProductTypeName})`;
  };

  const CurrentStepIcon = !selectedCategoryId ? LayoutGrid : !selectedOperatorId ? Users : !selectedProductTypeId ? PackageSearch : ShoppingCart;


  if (!isTokoVoucherConfigured && mainError === tokovoucherCredentialsMissingError) {
     return (
      <OrderFormShell title="TokoVoucher Services" description="Manage TokoVoucher products." icon={ShoppingCart}>
        <Card className="text-center py-10 shadow border-destructive bg-destructive/10 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center justify-center gap-2">
                  <AlertTriangle className="h-6 w-6" /> TokoVoucher Not Configured
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive/90">{mainError}</p>
              <Button asChild className="mt-4">
                <Link href="/admin-settings">
                  <Settings className="mr-2 h-4 w-4" /> Go to Admin Settings
                </Link>
              </Button>
            </CardContent>
          </Card>
      </OrderFormShell>
    );
  }


  if (isLoadingCategories || (isTokoVoucherConfigured && categories.length === 0 && !mainError)) {
    return (
      <OrderFormShell title="TokoVoucher Services" description="Select product and complete your order." icon={ShoppingCart}>
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg">Loading TokoVoucher data...</p>
        </div>
      </OrderFormShell>
    );
  }
  
  if (mainError && categories.length === 0 && !isLoadingCategories && isTokoVoucherConfigured) {
     return (
      <OrderFormShell title="TokoVoucher Services" description="Error loading data." icon={ShoppingCart}>
        <Card className="text-center py-10 shadow border-destructive bg-destructive/10  max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center justify-center gap-2">
                  <AlertTriangle className="h-6 w-6" /> Error Loading TokoVoucher Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive/90">{mainError}</p>
              <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">Try Reload Page</Button>
            </CardContent>
          </Card>
      </OrderFormShell>
    );
  }

  return (
    <>
    <Card className="mb-6 shadow-lg border-blue-500/50 max-w-2xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold font-headline">TokoVoucher Balance</CardTitle>
            <DollarSign className="h-6 w-6 text-blue-500" />
        </CardHeader>
        <CardContent>
            {isLoadingTokoVoucherBalance && (
            <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> <span>Loading balance...</span>
            </div>
            )}
            {tokovoucherBalanceError && !isLoadingTokoVoucherBalance && (
            <div className="text-destructive space-y-2">
                <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" /> <span>Error: {tokovoucherBalanceError}</span>
                </div>
                {tokovoucherBalanceError === tokovoucherCredentialsMissingError && (
                <Button asChild variant="destructive" size="sm" className="mt-2">
                    <Link href="/admin-settings"> <Settings className="mr-2 h-4 w-4" /> Go to Admin Settings </Link>
                </Button>
                )}
            </div>
            )}
            {tokovoucherBalance !== null && !isLoadingTokoVoucherBalance && !tokovoucherBalanceError && (
            <>
                <p className="text-2xl font-bold text-blue-600"> Rp {tokovoucherBalance.toLocaleString()} </p>
                {tokovoucherMemberName && <p className="text-xs text-muted-foreground">Member: {tokovoucherMemberName}</p>}
            </>
            )}
            {tokovoucherBalance === null && !isLoadingTokoVoucherBalance && !tokovoucherBalanceError && (
                <p className="text-muted-foreground">TokoVoucher balance data not available.</p>
            )}
            <Button variant="outline" size="sm" className="mt-3 border-blue-500 text-blue-600 hover:bg-blue-500/10" onClick={() => setIsTokoVoucherDepositDialogOpen(true)} disabled={isLoadingTokoVoucherBalance || !!tokovoucherBalanceError}>
            <PiggyBank className="mr-2 h-4 w-4" /> Request Deposit
            </Button>
        </CardContent>
    </Card>


    {!lastSubmittedOrder ? (
      <OrderFormShell 
        title="TokoVoucher Services" 
        description={selectedCategoryId ? `Follow steps for: ${selectedCategoryName}` : "Start by selecting a category below."} 
        icon={ShoppingCart}
      >
        <div className="space-y-6">
          {!selectedCategoryId && (
            <div className="space-y-2">
              <Label className="font-semibold text-md flex items-center gap-2"><CurrentStepIcon className="h-5 w-5 text-primary"/> {getStepTitle()}</Label>
              {isLoadingCategories && <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading categories...</div>}
              {!isLoadingCategories && categories.length === 0 && <p className="text-muted-foreground">No categories found.</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {categories.map(cat => (
                  <ProductCard
                    key={cat.id}
                    title={cat.nama}
                    description={`Explore ${cat.nama} products`}
                    imageUrl={cat.image || undefined}
                    icon={cat.image ? undefined : LayoutGrid}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    colorClass="text-sky-500" 
                  />
                ))}
              </div>
            </div>
          )}

          {selectedCategoryId && !selectedOperatorId && (
            <>
              <div className="flex justify-between items-center mb-4 p-3 bg-primary/10 rounded-md border border-primary/30">
                <p className="text-md font-semibold text-primary">
                  Category: {selectedCategoryName}
                </p>
                <Button variant="outline" size="sm" onClick={() => resetSelections('category')}>
                  <ArrowLeft className="mr-1.5 h-4 w-4"/> Change Category
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-md flex items-center gap-2"><CurrentStepIcon className="h-5 w-5 text-primary"/> {getStepTitle()}</Label>
                {isLoadingOperators && <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading operators...</div>}
                {!isLoadingOperators && operators.length === 0 && <p className="text-muted-foreground">No operators found for {selectedCategoryName}.</p>}
                 {mainError && !isLoadingOperators && operators.length === 0 && <p className="text-destructive">{mainError}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {operators.map(op => (
                    <ProductCard
                      key={op.id}
                      title={op.nama}
                      description={op.keterangan || `Products from ${op.nama}`}
                      imageUrl={op.image || undefined}
                      icon={op.image ? undefined : Users}
                      onClick={() => setSelectedOperatorId(op.id)}
                      colorClass="text-green-500" 
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          
          {selectedCategoryId && selectedOperatorId && !selectedProductTypeId && (
            <>
                <div className="mb-4 p-3 bg-primary/10 rounded-md border border-primary/30 space-y-2">
                    <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-primary">Category: {selectedCategoryName}</p>
                        <Button variant="ghost" size="sm" onClick={() => resetSelections('category')} className="text-xs h-6 px-1.5">
                            <ArrowLeft className="mr-1 h-3 w-3"/> Ganti
                        </Button>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-primary">Operator: {selectedOperatorName}</p>
                        <Button variant="ghost" size="sm" onClick={() => resetSelections('operator')} className="text-xs h-6 px-1.5">
                            <ArrowLeft className="mr-1 h-3 w-3"/> Ganti
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="font-semibold text-md flex items-center gap-2"><CurrentStepIcon className="h-5 w-5 text-primary"/> {getStepTitle()}</Label>
                    {isLoadingProductTypes && <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading product types...</div>}
                    {!isLoadingProductTypes && productTypes.length === 0 && <p className="text-muted-foreground">No product types found for {selectedOperatorName}.</p>}
                    {mainError && !isLoadingProductTypes && productTypes.length === 0 && <p className="text-destructive">{mainError}</p>}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {productTypes.map(pt => (
                        <ProductCard
                        key={pt.id}
                        title={pt.nama}
                        description={`Select ${pt.nama}`}
                        imageUrl={pt.image || undefined}
                        icon={pt.image ? undefined : TagIcon}
                        onClick={() => setSelectedProductTypeId(pt.id)}
                        colorClass="text-purple-500" 
                        />
                    ))}
                    </div>
                </div>
            </>
          )}

          {selectedCategoryId && selectedOperatorId && selectedProductTypeId && (
            <>
              <div className="mb-4 p-3 bg-primary/10 rounded-md border border-primary/30 space-y-2">
                <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-primary">Category: {selectedCategoryName}</p>
                    <Button variant="ghost" size="sm" onClick={() => resetSelections('category')} className="text-xs h-6 px-1.5">
                        <ArrowLeft className="mr-1 h-3 w-3"/> Ganti
                    </Button>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-primary">Operator: {selectedOperatorName}</p>
                    <Button variant="ghost" size="sm" onClick={() => resetSelections('operator')} className="text-xs h-6 px-1.5">
                        <ArrowLeft className="mr-1 h-3 w-3"/> Ganti
                    </Button>
                </div>
                 <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-primary">Product Type: {selectedProductTypeName}</p>
                    <Button variant="ghost" size="sm" onClick={() => resetSelections('productType')} className="text-xs h-6 px-1.5">
                        <ArrowLeft className="mr-1 h-3 w-3"/> Ganti
                    </Button>
                </div>
              </div>
              <div className="space-y-2">
                  <Label className="font-semibold text-md flex items-center gap-2"><CurrentStepIcon className="h-5 w-5 text-primary"/> {getStepTitle()}</Label>
                  {isLoadingProducts && <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading products...</div>}
                  {!isLoadingProducts && products.length === 0 && <p className="text-muted-foreground">No products found for this type.</p>}
                  {mainError && !isLoadingProducts && products.length === 0 && <p className="text-destructive">{mainError}</p>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[calc(100vh-500px)] md:max-h-[350px] overflow-y-auto p-2 rounded-md border bg-muted/20">
                  {products.map(product => (
                    <Card
                      key={product.code}
                      onClick={() => handleProductSelect(product)}
                      className={`flex flex-col justify-between transition-shadow duration-200
                                  ${product.status !== 1 ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}
                                  ${selectedProduct?.code === product.code && product.status === 1 ? 'ring-2 ring-primary border-primary shadow-lg' : 'border-border shadow-md'}`}
                    >
                      <div>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-md font-semibold leading-tight">{product.nama_produk}</CardTitle>
                            {selectedProduct?.code === product.code && product.status === 1 && <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />}
                          </div>
                          <CardDescription className="text-xs truncate">
                              {product.op_name && `Op: ${product.op_name}`}
                              {product.op_name && (product.category_name || product.jenis_name) && " | "}
                              {product.jenis_name && `Jenis: ${product.jenis_name}`}
                              {product.jenis_name && product.category_name && " | "}
                              {product.category_name && `Cat: ${product.category_name}`}
                              {!product.op_name && !product.category_name && !product.jenis_name && product.code && `Kode: ${product.code}`}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1.5 pt-0 pb-3">
                          <p className={`text-lg font-bold ${product.status === 1 ? 'text-primary' : 'text-muted-foreground'}`}>Rp {product.price.toLocaleString()}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={product.status === 1 ? "default" : "destructive"} className={`text-xs ${product.status === 1 ? 'bg-green-100 text-green-800 border-green-300' : ''}`}>{product.status === 1 ? "Available" : "Unavailable"}</Badge>
                            <Badge variant="outline" className="text-xs">Code: {product.code}</Badge>
                          </div>
                          {product.keterangan && <p className="text-xs text-muted-foreground italic pt-1 truncate" title={product.keterangan}>Hint: {product.keterangan}</p>}
                        </CardContent>
                      </div>
                    </Card>
                  ))}
                  </div>
              </div>
            </>
          )}

          {selectedProduct && (
            <Card className="mt-6 shadow-lg border-2 border-primary" id="tokovoucher-order-confirmation-section">
              <CardHeader className="bg-primary/10">
                <CardTitle className="text-lg text-primary">Order: {selectedProduct.nama_produk}</CardTitle>
                <CardDescription className="text-primary/80">
                  Harga Modal: Rp {selectedProduct.price.toLocaleString()} | Kode: {selectedProduct.code}
                   {selectedProduct.status !== 1 && <span className="font-semibold text-destructive block">(Product Not Available)</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="tokovoucher-customer-no" className="font-semibold">Nomor Tujuan / User ID</Label>
                  <Input id="tokovoucher-customer-no" value={customerNo} onChange={(e) => setCustomerNo(e.target.value)} placeholder="e.g., 08123xxx / GameUserID" className="mt-1" disabled={selectedProduct.status !== 1 || isSubmittingWithPin} />
                  {selectedProduct.keterangan && !selectedProduct.keterangan.toLowerCase().includes("masukkan") && <p className="text-xs text-muted-foreground mt-1 italic">Hint: {selectedProduct.keterangan}</p>}
                </div>
                <div>
                  <Label htmlFor="tokovoucher-server-id" className="font-semibold">Server ID (Opsional)</Label>
                  <Input id="tokovoucher-server-id" value={serverId} onChange={(e) => setServerId(e.target.value)} placeholder="e.g., 1234 (jika diperlukan)" className="mt-1" disabled={selectedProduct.status !== 1 || isSubmittingWithPin} />
                </div>
                <Button
                  onClick={handleInitiateOrder}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-md py-3"
                  disabled={!selectedProduct || selectedProduct.status !== 1 || !customerNo.trim() || isSubmittingWithPin}
                >
                  {isSubmittingWithPin ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                  Lanjutkan Pembayaran
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </OrderFormShell>
    ) : (
       <Card className="mt-8 shadow-xl border-2 border-primary max-w-2xl mx-auto">
        <CardHeader className="bg-primary/10">
          <div className="flex items-center gap-3">
            {lastSubmittedOrder.status === "Sukses" ? <CheckCircle className="h-8 w-8 text-green-500" /> : lastSubmittedOrder.status === "Pending" ? <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" /> : <AlertTriangle className="h-8 w-8 text-red-500" />}
            <CardTitle className="text-xl text-primary">
              {lastSubmittedOrder.status === "Sukses" ? "Transaction Successful" : lastSubmittedOrder.status === "Pending" ? "Transaction Pending" : "Transaction Failed"} (TokoVoucher)
            </CardTitle>
          </div>
          <CardDescription className="text-primary/80">Ref ID: {lastSubmittedOrder.refId} {lastSubmittedOrder.trxId && `| Trx ID: ${lastSubmittedOrder.trxId}`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          <p><strong>Product:</strong> {lastSubmittedOrder.productName}</p>
          <p><strong>Details:</strong> {lastSubmittedOrder.customerNoDisplay}</p>
          <p><strong>Harga Jual (Estimasi):</strong> Rp {lastSubmittedOrder.sellingPrice.toLocaleString()}</p>
           {lastSubmittedOrder.status === "Sukses" && typeof lastSubmittedOrder.profit === 'number' && (
            <div className="flex items-center text-sm">
                <DollarSign className="h-4 w-4 mr-1 text-green-600"/>
                <span className="text-green-700 font-semibold">Profit (Estimasi): Rp {lastSubmittedOrder.profit.toLocaleString()}</span>
            </div>
          )}
          <div><strong>Status:</strong> <Badge variant={lastSubmittedOrder.status === 'Sukses' ? 'default' : lastSubmittedOrder.status === 'Gagal' ? 'destructive' : 'secondary'} className={`${lastSubmittedOrder.status === 'Sukses' ? 'bg-green-100 text-green-800 border-green-300' : lastSubmittedOrder.status === 'Gagal' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-yellow-100 text-yellow-800 border-yellow-300'}`}>{lastSubmittedOrder.status}</Badge></div>
          {lastSubmittedOrder.message && <p className="text-sm text-muted-foreground"><strong>Message:</strong> {lastSubmittedOrder.message}</p>}
          {lastSubmittedOrder.sn && <p><strong>SN/Token:</strong> <span className="font-mono text-primary">{lastSubmittedOrder.sn}</span></p>}
          <p className="text-xs text-muted-foreground italic">Catatan: Harga Jual dan Profit yang ditampilkan adalah estimasi. Nilai final tercatat di Riwayat Transaksi.</p>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={() => router.push('/transactions')} className="w-full sm:w-auto">
              <ListChecks className="mr-2 h-4 w-4" /> View Transaction History
            </Button>
            <Button onClick={() => { resetSelections(); setLastSubmittedOrder(null); }} variant="outline" className="w-full sm:w-auto">
              <Tag className="mr-2 h-4 w-4" /> Place New Order
            </Button>
          </div>
        </CardContent>
      </Card>
    )}

    {isConfirmingOrder && orderDetailsToConfirm && (
      <AlertDialog open={isConfirmingOrder} onOpenChange={(open) => { if (!open && !isSubmittingWithPin) setIsConfirmingOrder(false); else if (open) setIsConfirmingOrder(true); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              Confirm Your TokoVoucher Order
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-sm text-foreground">
              Review your order and enter PIN to confirm:
            </AlertDialogDescription>
            <div className="pt-2 space-y-1 text-sm text-foreground">
              <div><strong>Product:</strong> {orderDetailsToConfirm.product.nama_produk}</div>
              <div><strong>Kode Produk:</strong> {orderDetailsToConfirm.product.code}</div>
              <div><strong>Harga Modal:</strong> Rp {orderDetailsToConfirm.product.price.toLocaleString()}</div>
              <div><strong>Nomor Tujuan:</strong> {orderDetailsToConfirm.customerNo}</div>
              {orderDetailsToConfirm.serverId && <div><strong>Server ID:</strong> {orderDetailsToConfirm.serverId}</div>}
            </div>
          </AlertDialogHeader>
          <div className="space-y-2 py-4 bg-muted/70 rounded-lg p-4 my-4">
            <Label htmlFor="tokovoucherPinInput" className="flex items-center justify-center text-sm font-medium text-foreground/80">
              <KeyRound className="mr-2 h-4 w-4" /> Transaction PIN
            </Label>
            <Input
              id="tokovoucherPinInput" type="password" value={pinInput}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 6) { setPinInput(val); if (pinError) setPinError("");}}}
              placeholder="● ● ● ● ● ●" maxLength={6}
              className="text-center tracking-[0.5em] text-xl bg-background border-primary/50 focus:border-primary"
            />
            {pinError && <p className="text-sm text-destructive text-center pt-2">{pinError}</p>}
          </div>
          <AlertDialogFooter className="pt-2">
              <AlertDialogCancel onClick={() => { setIsConfirmingOrder(false); setPinInput(""); setPinError(""); }} disabled={isSubmittingWithPin}>Cancel</AlertDialogCancel>
              <Button onClick={handlePinConfirm} disabled={isSubmittingWithPin || pinInput.length !== 6} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmittingWithPin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Pay
              </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )}
     <TokoVoucherDepositDialog open={isTokoVoucherDepositDialogOpen} onOpenChange={setIsTokoVoucherDepositDialogOpen} onDepositSuccess={() => { loadTokoVoucherBalance(); }} />
    </>
  );
}
