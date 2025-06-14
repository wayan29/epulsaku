
// src/app/(app)/profit-report/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { DollarSign, TrendingUp, TrendingDown, Loader2, AlertTriangle, CalendarIcon as CalendarIconLucide, FilterX, Settings } from "lucide-react"; // Added Settings icon
import { getTransactionsFromDB, type Transaction } from "@/lib/transaction-utils";
import { DateRange } from "react-day-picker";
import { 
  format, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  isValid, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
} from "date-fns";
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link'; // Added Link for navigation

export default function ProfitReportPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeFilterLabel, setActiveFilterLabel] = useState<string>("Overall");
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
        setIsLoading(true);
        setError(null);
        try {
          const dbTxs = await getTransactionsFromDB();
          setTransactions(dbTxs);
        } catch (e) {
          console.error("Error loading transactions for profit report:", e);
          setError("Failed to load transaction data from database.");
          toast({ title: "Error", description: "Could not load transaction data.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
    }
    loadData();
  }, [toast]);

  const filteredSuccessfulTransactions = useMemo(() => {
    let successfulTxs = transactions.filter(tx => tx.status === "Sukses");

    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      
      if (!isValid(fromDate) || !isValid(toDate)) {
        return successfulTxs; 
      }

      successfulTxs = successfulTxs.filter(tx => {
        const txDate = new Date(tx.timestamp);
        return isValid(txDate) && isWithinInterval(txDate, { start: fromDate, end: toDate });
      });
    }
    return successfulTxs;
  }, [transactions, dateRange]);

  const reportData = useMemo(() => {
    const totalRevenue = filteredSuccessfulTransactions.reduce((sum, tx) => sum + tx.sellingPrice, 0);
    const totalCost = filteredSuccessfulTransactions.reduce((sum, tx) => sum + tx.costPrice, 0);
    const totalProfit = totalRevenue - totalCost;
    
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      numberOfSuccessfulTransactions: filteredSuccessfulTransactions.length,
    };
  }, [filteredSuccessfulTransactions]);

  const setDateFilter = (range: DateRange | undefined, label: string) => {
    setDateRange(range);
    setActiveFilterLabel(label);
  };

  const clearFilters = () => {
    setDateFilter(undefined, "Overall");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
        <p className="text-lg">Calculating profit report...</p>
      </div>
    );
  }

  if (error) {
     return (
      <Card className="text-center py-10 shadow border-destructive bg-destructive/10">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center justify-center gap-2">
            <AlertTriangle className="h-6 w-6" /> Error Loading Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive/90">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const today = new Date();

  return (
    <div className="space-y-8">
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold font-headline">Profit Report ({activeFilterLabel})</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/price-settings">
            <Settings className="mr-2 h-4 w-4" />
            Go to Price Settings
          </Link>
        </Button>
      </section>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-headline">Filter Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="date-filter-popover" className="text-sm font-medium">Custom Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-filter-popover"
                    variant={"outline"}
                    className={`w-full justify-start text-left font-normal mt-1 ${!dateRange?.from && "text-muted-foreground"}`}
                  >
                    <CalendarIconLucide className="mr-2 h-4 w-4" />
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
                    onSelect={(newRange) => setDateFilter(newRange, newRange?.from && newRange?.to ? `${format(newRange.from, "dd/MM/yy")} - ${format(newRange.to, "dd/MM/yy")}` : newRange?.from ? format(newRange.from, "dd/MM/yy") : "Custom Range")}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:col-span-2 gap-2 pt-2 sm:pt-0">
              <Button variant="outline" onClick={() => setDateFilter({ from: startOfDay(today), to: endOfDay(today) }, "Today")} className="w-full">Today</Button>
              <Button variant="outline" onClick={() => setDateFilter({ from: startOfWeek(today), to: endOfWeek(today) }, "This Week")} className="w-full">This Week</Button>
              <Button variant="outline" onClick={() => setDateFilter({ from: startOfMonth(today), to: endOfMonth(today) }, "This Month")} className="w-full">This Month</Button>
              <Button variant="outline" onClick={() => setDateFilter({ from: startOfYear(today), to: endOfYear(today) }, "This Year")} className="w-full">This Year</Button>
            </div>
          </div>
          { (dateRange) && (
            <Button onClick={clearFilters} variant="ghost" className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive">
              <FilterX className="mr-2 h-4 w-4" />
              Clear Date Filter (Show Overall)
            </Button>
          )}
        </CardContent>
      </Card>

      <CardDescription>
        This report shows profit from <span className="font-semibold text-primary">{reportData.numberOfSuccessfulTransactions}</span> successful transactions (including Digiflazz & TokoVoucher) for the selected period. 
        Selling prices are based on your Price Settings or default markups.
      </CardDescription>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Rp {reportData.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              From {reportData.numberOfSuccessfulTransactions} successful transactions
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost of Goods</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">Rp {reportData.totalCost.toLocaleString()}</div>
             <p className="text-xs text-muted-foreground">
              Modal from providers for successful transactions
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-md border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Total Profit</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${reportData.totalProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              Rp {reportData.totalProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on {reportData.numberOfSuccessfulTransactions} successful transactions
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mt-8 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Report Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            - This report includes successful transactions from all configured providers (e.g., Digiflazz, TokoVoucher).
          </p>
          <p>
            - Profit is calculated as (Selling Price - Cost Price) for each <span className="font-semibold text-green-600">successful</span> transaction within the selected period.
          </p>
          <p>
            - Selling prices are determined by your settings on the "Price Settings" page. The UI for price settings currently focuses on Digiflazz products. For products without a custom price (including TokoVoucher products if custom prices are not set via database directly), a default markup is used.
          </p>
           <p>
            - If you've recently updated price settings, this report reflects profits based on the current settings applied to historical cost prices for transactions within the filtered period.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

