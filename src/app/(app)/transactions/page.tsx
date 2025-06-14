
// src/app/(app)/transactions/page.tsx
"use client"; 

import TransactionItem, { Transaction, productIconsMapping, TransactionStatus } from "@/components/transactions/TransactionItem";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RefreshCw, Loader2, CalendarIcon, ListFilter, FilterX, Building } from "lucide-react"; 
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay, isValid } from "date-fns";
import { getTransactionsFromDB, updateTransactionInDB } from "@/lib/transaction-utils"; // Updated to use DB functions
import { purchaseDigiflazzProduct } from "@/ai/flows/purchase-digiflazz-product-flow";
import { useToast } from "@/hooks/use-toast";

const ALL_CATEGORIES = "all_categories";
const ALL_STATUSES = "all_statuses";
const ALL_PROVIDERS = "all_providers";

type ProviderFilter = "all_providers" | "digiflazz" | "tokovoucher";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
  const [selectedStatus, setSelectedStatus] = useState<string>(ALL_STATUSES);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedProvider, setSelectedProvider] = useState<ProviderFilter>(ALL_PROVIDERS);

  const intervalRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const availableCategories = useMemo(() => {
    return [ALL_CATEGORIES, ...Object.keys(productIconsMapping).filter(k => k !== "Default")];
  }, []);

  const availableStatuses: { value: TransactionStatus | typeof ALL_STATUSES, label: string }[] = [
    { value: ALL_STATUSES, label: "All Statuses" },
    { value: "Sukses", label: "Success" },
    { value: "Pending", label: "Pending" },
    { value: "Gagal", label: "Failed" },
  ];

  const availableProviders: { value: ProviderFilter, label: string }[] = [
    { value: ALL_PROVIDERS, label: "All Providers" },
    { value: "digiflazz", label: "Digiflazz" },
    { value: "tokovoucher", label: "TokoVoucher" },
  ];

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
        const dbTxs = await getTransactionsFromDB();
        setTransactions(dbTxs);
    } catch (error) {
        console.error("Error loading transactions from DB:", error);
        toast({ title: "Error", description: "Could not load transactions.", variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);


  useEffect(() => {
    const currentIntervals = intervalRefs.current;

    currentIntervals.forEach((intervalId, txId) => {
      const transaction = transactions.find(t => t.id === txId);
      if (!transaction || transaction.status !== "Pending") {
        clearInterval(intervalId);
        currentIntervals.delete(txId);
      }
    });

    transactions.forEach(tx => {
      if (tx.status === "Pending" && !currentIntervals.has(tx.id)) {
        console.log(`Setting up auto-check for pending transaction ID: ${tx.id}`);
        const intervalId = setInterval(async () => {
          try {
            console.log(`Auto-checking status for pending transaction ID: ${tx.id}`);
            let providerResult;
            if (tx.provider === 'tokovoucher') {
                providerResult = await purchaseTokoVoucherProduct({
                    productCode: tx.buyerSkuCode,
                    customerNo: tx.originalCustomerNo,
                    refId: tx.id,
                });
            } else {
                providerResult = await purchaseDigiflazzProduct({
                    buyerSkuCode: tx.buyerSkuCode,
                    customerNo: tx.originalCustomerNo,
                    refId: tx.id,
                });
            }
            

            const newStatus = providerResult.status as TransactionStatus | undefined;
            
            const currentDbTxs = await getTransactionsFromDB();
            const currentTxState = currentDbTxs.find(t => t.id === tx.id);

            if (!currentTxState || currentTxState.status !== "Pending") {
              console.log(`Auto-check for ${tx.id}: Transaction no longer pending in DB. Skipping update.`);
              clearInterval(intervalId);
              currentIntervals.delete(tx.id);
              return;
            }

            if (newStatus && newStatus !== "Pending") {
              await updateTransactionInDB({ 
                id: tx.id,
                status: newStatus,
                serialNumber: providerResult.sn || undefined,
                failureReason: newStatus === "Gagal" ? (providerResult.message || (tx.provider === 'tokovoucher' && providerResult.sn)) : undefined,
                timestamp: (tx.status === "Pending" && (newStatus === "Sukses" || newStatus === "Gagal"))
                            ? new Date().toISOString()
                            : tx.timestamp,
              });
              toast({
                title: "Auto Status Update",
                description: `Transaction ${tx.productName} (ID: ...${tx.id.slice(-6)}) changed to ${newStatus}. ${providerResult.message || ""}`,
              });
              loadTransactions(); 
            } else if (newStatus === "Pending") {
              console.log(`Transaction ${tx.id} is still Pending. ${tx.provider} message: ${providerResult.message || "No change"}`);
            } else if (!providerResult.isSuccess && providerResult.message) {
               console.warn(`Auto status check for ${tx.id} - ${tx.provider} info: ${providerResult.message}`);
            }

          } catch (error) {
            console.error(`Error auto-checking status for transaction ID ${tx.id}:`, error);
          }
        }, 60000); 
        currentIntervals.set(tx.id, intervalId);
      }
    });

    return () => {
      console.log("Cleaning up transaction status check intervals.");
      currentIntervals.forEach(intervalId => clearInterval(intervalId));
      currentIntervals.clear();
    };
  }, [transactions, loadTransactions, toast]);


  const displayTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const categoryMatch = selectedCategory === ALL_CATEGORIES || tx.categoryKey === selectedCategory;
      const statusMatch = selectedStatus === ALL_STATUSES || tx.status === selectedStatus;
      const providerMatch = selectedProvider === ALL_PROVIDERS || tx.provider === selectedProvider;
      
      let dateMatch = true;
      if (dateRange?.from) { 
        const txDate = new Date(tx.timestamp);
        if (isValid(txDate)) {
          const effectiveToDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date()); 
          const effectiveFromDate = startOfDay(dateRange.from);
          dateMatch = isWithinInterval(txDate, { start: effectiveFromDate, end: effectiveToDate });
        } else {
          dateMatch = false; 
        }
      }
      return categoryMatch && statusMatch && dateMatch && providerMatch;
    });
  }, [transactions, selectedCategory, selectedStatus, dateRange, selectedProvider]);

  const handleRefresh = () => {
    loadTransactions();
  }

  const resetFilters = () => {
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedStatus(ALL_STATUSES);
    setDateRange(undefined);
    setSelectedProvider(ALL_PROVIDERS);
  };

  const hasActiveFilters = selectedCategory !== ALL_CATEGORIES || selectedStatus !== ALL_STATUSES || dateRange !== undefined || selectedProvider !== ALL_PROVIDERS;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline">Transaction History</h1>
        <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-headline">
            <ListFilter className="h-5 w-5 text-primary"/>
            Filter Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-0 md:grid md:grid-cols-1 lg:grid-cols-5 md:gap-4 items-end">
          <div>
            <Label htmlFor="category-filter" className="text-sm font-medium">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category-filter">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === ALL_CATEGORIES ? "All Categories" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status-filter" className="text-sm font-medium">Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                {availableStatuses.map(stat => (
                  <SelectItem key={stat.value} value={stat.value}>
                    {stat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="provider-filter" className="text-sm font-medium">Provider</Label>
            <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as ProviderFilter)}>
              <SelectTrigger id="provider-filter">
                 <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select Provider" />
                 </div>
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map(prov => (
                  <SelectItem key={prov.value} value={prov.value}>
                    {prov.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
             <Label htmlFor="date-filter-popover" className="text-sm font-medium">Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-filter-popover"
                  variant={"outline"}
                  className={`w-full justify-start text-left font-normal ${!dateRange?.from && "text-muted-foreground"}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <Button onClick={resetFilters} variant="ghost" className="w-full lg:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={!hasActiveFilters && !isLoading}>
            <FilterX className="mr-2 h-4 w-4" />
            Reset Filters
          </Button>
        </CardContent>
      </Card>

      {isLoading && transactions.length === 0 ? ( 
        <div className="text-center py-10 text-muted-foreground">
          <Loader2 className="mx-auto h-10 w-10 animate-spin mb-4" />
          <p>Loading transactions...</p>
        </div>
      ) : !isLoading && displayTransactions.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-lg text-muted-foreground">
            {hasActiveFilters ? "No transactions match your filters." : "You have no transactions yet."}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {hasActiveFilters ? "Try adjusting your filters or reset them." : "Try making a purchase to see it here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayTransactions.map((transaction) => (
            <TransactionItem 
              key={transaction.id} 
              transaction={transaction} 
              onTransactionUpdate={loadTransactions} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

