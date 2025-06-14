
// src/components/transactions/TransactionItem.tsx
"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Loader2, Smartphone, Zap, Gamepad2, DollarSign, Ticket, LucideIcon, LucideAlertCircle, CalendarDays, Info, ShoppingBag, Eye, CreditCard, Hash, RefreshCw, Code2, UserSquare2, Trash2, AlertTriangle, Copy, Server, Building, Bot, Briefcase, FileText } from "lucide-react";
import { purchaseDigiflazzProduct } from "@/ai/flows/purchase-digiflazz-product-flow";
import { purchaseTokoVoucherProduct } from "@/ai/flows/tokovoucher/purchaseTokoVoucherProduct-flow";
import { useToast } from "@/hooks/use-toast";
import { updateTransactionInDB, deleteTransactionFromDB } from "@/lib/transaction-utils";


export const productIconsMapping: { [key: string]: LucideIcon } = {
  Pulsa: Smartphone,
  "Token Listrik": Zap,
  "Game Topup": Gamepad2, 
  "Digital Service": ShoppingBag, 
  "FREE FIRE": Gamepad2,
  "MOBILE LEGENDS": Gamepad2,
  "GENSHIN IMPACT": Gamepad2,
  "HONKAI STAR RAIL": Gamepad2,
  "PLN": Zap,
  "E-Money": CreditCard, 
  "Default": ShoppingBag, 
};

export type TransactionStatus = "Sukses" | "Pending" | "Gagal"; 

// Base Transaction type used across the app
export interface TransactionCore {
  id: string; 
  productName: string;
  details: string; 
  costPrice: number;
  sellingPrice: number;
  status: TransactionStatus; 
  timestamp: string; 
  serialNumber?: string;
  failureReason?: string;
  buyerSkuCode: string; 
  originalCustomerNo: string; 
  productCategoryFromProvider: string; 
  productBrandFromProvider: string;   
  provider: 'digiflazz' | 'tokovoucher'; 
  source?: 'web' | 'telegram_bot';
  providerTransactionId?: string; // ID transaksi dari sisi provider (misal: trx_id TokoVoucher)
  transactionYear?: number;
  transactionMonth?: number; 
  transactionDayOfMonth?: number; 
  transactionDayOfWeek?: number; 
  transactionHour?: number; 
}

// Transaction type with resolved client-side fields like icon
export interface Transaction extends TransactionCore {
  iconName: string;
  categoryKey: string; 
  _id?: string; 
}

// Type for new transaction input before DB insertion 
export interface NewTransactionInput extends TransactionCore {
  // iconName and categoryKey are resolved server-side before insertion
}


const statusConfig: { [key in TransactionStatus]: { icon: LucideIcon, color: string, textColor: string, displayText: string } } = {
  Sukses: { icon: CheckCircle2, color: "bg-green-500 hover:bg-green-500", textColor: "text-green-700", displayText: "Success" },
  Pending: { icon: Loader2, color: "bg-yellow-500 hover:bg-yellow-500", textColor: "text-yellow-700", displayText: "Pending" },
  Gagal: { icon: XCircle, color: "bg-red-500 hover:bg-red-500", textColor: "text-red-700", displayText: "Failed" },
};

interface TransactionItemProps {
  transaction: Transaction;
  onTransactionUpdate: () => void; 
}

interface DetailRowProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  isMono?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ icon: Icon, label, value, valueClassName, isMono }) => (
  <div className="grid grid-cols-[max-content_1fr] items-start gap-x-3 py-1.5">
    <div className="flex items-center text-muted-foreground">
      <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
      <span className="font-medium text-xs sm:text-sm">{label}:</span>
    </div>
    <div className={`text-foreground break-all text-xs sm:text-sm ${valueClassName} ${isMono ? 'font-mono' : ''}`}>
      {value}
    </div>
  </div>
);

export default function TransactionItem({ transaction, onTransactionUpdate }: TransactionItemProps) {
  const { id, productName, details, sellingPrice, status, timestamp, serialNumber, failureReason, buyerSkuCode, originalCustomerNo, iconName, provider, costPrice, productBrandFromProvider, source, providerTransactionId } = transaction;
  const { toast } = useToast();
  const router = useRouter(); 
  
  const ProductIconComponent = productIconsMapping[iconName] || productIconsMapping["Default"];

  const currentStatusConfig = statusConfig[status] || statusConfig["Gagal"]; 
  const SIcon = currentStatusConfig.icon;

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const handleViewReceipt = () => {
    if (status === "Sukses") {
      router.push(`/receipt/${id}`);
    } else {
      toast({
        title: "Receipt Not Available",
        description: "A receipt can only be viewed for successful transactions.",
        variant: "default"
      });
    }
  };
  
  const handleCheckStatus = async () => {
    if (!buyerSkuCode || !originalCustomerNo || !id) {
      toast({
        title: "Error Checking Status",
        description: "Missing transaction data (SKU, Customer No, or Ref ID).",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingStatus(true);
    try {
      let providerResult;
      if (provider === 'tokovoucher') {
        providerResult = await purchaseTokoVoucherProduct({
          productCode: buyerSkuCode,
          customerNo: originalCustomerNo,
          refId: id,
        });
      } else { 
        providerResult = await purchaseDigiflazzProduct({
          buyerSkuCode: buyerSkuCode,
          customerNo: originalCustomerNo,
          refId: id, 
        });
      }
      
      const newStatus = providerResult.status as TransactionStatus | undefined;

      if (newStatus && newStatus !== status) {
        const updateResult = await updateTransactionInDB({ 
          id: id,
          status: newStatus,
          serialNumber: providerResult.sn || undefined,
          failureReason: newStatus === "Gagal" ? (providerResult.message || (provider === 'tokovoucher' && providerResult.sn)) : undefined,
          providerTransactionId: provider === 'tokovoucher' ? (providerResult as any).trxId || undefined : undefined,
        });

        if (updateResult.success) {
            toast({
              title: "Status Updated",
              description: `Transaction status changed to ${newStatus}. ${providerResult.message || ""}`,
            });
            onTransactionUpdate(); 
        } else {
            toast({
                title: "DB Update Failed",
                description: updateResult.message || "Could not update transaction in database.",
                variant: "destructive",
            });
        }
      } else if (newStatus === status) {
        toast({
          title: "Status Unchanged",
          description: `Transaction is still ${newStatus}. ${providerResult.message || ""}`,
        });
      } else if (!providerResult.isSuccess && providerResult.message) { 
         toast({
          title: "Status Check Info",
          description: providerResult.message || "Could not determine status change.",
          variant: "default",
        });
      } else {
         toast({
          title: "Status Check Note",
          description: `No change in status. Current status: ${status}. ${providerResult.message || ""}`,
        });
      }
    } catch (error) {
      console.error("Error checking transaction status:", error);
      toast({
        title: "Error Checking Status",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingStatus(false);
      setIsDetailsDialogOpen(false); 
    }
  };

  const handleDeleteTransaction = async () => {
    const deleteResult = await deleteTransactionFromDB(id); 
    if (deleteResult.success) {
        toast({
          title: "Transaction Deleted",
          description: `Transaction ID ${id} has been removed from history.`,
        });
        onTransactionUpdate();
    } else {
        toast({
          title: "Deletion Failed",
          description: deleteResult.message || `Could not delete transaction ID ${id}.`,
          variant: "destructive",
        });
    }
    setIsConfirmingDelete(false);
    setIsDetailsDialogOpen(false);
  };

  const handleCopySn = () => {
    if (serialNumber) {
      navigator.clipboard.writeText(serialNumber)
        .then(() => {
          toast({ title: "SN Copied!", description: "Serial number copied to clipboard." });
        })
        .catch(err => {
          console.error("Failed to copy SN:", err);
          toast({ title: "Copy Failed", description: "Could not copy serial number.", variant: "destructive" });
        });
    }
  };

  const providerDisplayName = provider === 'tokovoucher' ? 'TokoVoucher' : 'Digiflazz';
  const providerColorClass = provider === 'tokovoucher' ? 'border-blue-500/50 text-blue-700 bg-blue-50' : 'border-purple-500/50 text-purple-700 bg-purple-50';


  return (
    <>
      <AlertDialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <AlertDialogTrigger asChild>
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ProductIconComponent className="h-7 w-7 text-primary" />
                  <CardTitle className="text-lg font-semibold font-headline">{productName}</CardTitle>
                </div>
                <Badge variant={status === 'Sukses' ? 'default' : status === 'Gagal' ? 'destructive' : 'secondary'} 
                      className={`${status === 'Sukses' ? 'bg-green-100 text-green-800 border-green-300' : status === 'Gagal' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-yellow-100 text-yellow-800 border-yellow-300'}`}>
                  <SIcon className={`mr-1 h-3 w-3 ${status === 'Pending' ? 'animate-spin' : ''}`} />
                  {currentStatusConfig.displayText}
                </Badge>
              </div>
              <CardDescription className="text-xs flex items-center gap-2">
                 <Badge variant="outline" className={`text-xs capitalize ${providerColorClass}`}>{providerDisplayName}</Badge>
                 <span>{productBrandFromProvider || 'N/A'}</span>
                 {source === 'telegram_bot' && (
                    <Badge variant="outline" className="text-xs border-sky-500/50 text-sky-700 bg-sky-50">
                        <Bot className="h-3 w-3 mr-1" /> via Telegram
                    </Badge>
                 )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center">
                  <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-muted-foreground">ID:</span>
                  <span className="ml-2 font-mono text-xs">{id}</span>
              </div>
              <div className="flex items-center">
                  <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-muted-foreground">Details:</span>
                  <span className="ml-2 font-medium truncate">{details}</span>
              </div>
              <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-muted-foreground">Harga Jual:</span>
                  <span className="ml-2 font-medium">Rp {sellingPrice.toLocaleString()}</span>
              </div>
              <CardDescription className="text-xs pt-1">
                {new Date(timestamp).toLocaleString()}
              </CardDescription>
            </CardContent>
          </Card>
        </AlertDialogTrigger>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 font-headline text-xl">
              <ProductIconComponent className="h-7 w-7 text-primary" />
              Transaction Details
            </AlertDialogTitle>
          </AlertDialogHeader>
          
          <ScrollArea className="max-h-[60vh] -mx-3 px-3">
            <div className="space-y-3 py-2 pr-2">

              <DetailRow icon={CalendarDays} label="Date" value={new Date(timestamp).toLocaleString()} />
              <DetailRow icon={SIcon} label="Status" value={currentStatusConfig.displayText} valueClassName={`${currentStatusConfig.textColor} font-semibold`} />

              <Separator className="my-3"/>
              
              <DetailRow icon={Briefcase} label="Product" value={productName} />
              <DetailRow icon={Info} label="Details" value={details} />
              <DetailRow icon={Building} label="Provider" value={providerDisplayName} valueClassName={`capitalize font-semibold ${provider === 'tokovoucher' ? 'text-blue-600' : 'text-purple-600'}`}/>
              {source === 'telegram_bot' && (
                <DetailRow icon={Bot} label="Source" value="Telegram Bot" valueClassName="text-sky-700 font-semibold"/>
              )}
              
              <Separator className="my-3"/>

              <DetailRow icon={Hash} label="Ref ID" value={id} isMono />
              {providerTransactionId && (
                <DetailRow icon={Server} label="Provider Trx ID" value={providerTransactionId} isMono />
              )}
              <DetailRow icon={Code2} label="SKU Code" value={buyerSkuCode} isMono />
              <DetailRow icon={UserSquare2} label="Original Customer No" value={originalCustomerNo} isMono />
              
              <Separator className="my-3"/>

              <DetailRow icon={DollarSign} label="Selling Price" value={`Rp ${sellingPrice.toLocaleString()}`} valueClassName="font-semibold text-primary" />
              {status === "Sukses" && (
                  <>
                  <DetailRow icon={DollarSign} label="Cost Price" value={`Rp ${costPrice.toLocaleString()}`} />
                  <DetailRow 
                    icon={DollarSign} 
                    label="Profit" 
                    value={`Rp ${(sellingPrice - costPrice).toLocaleString()}`} 
                    valueClassName={`font-semibold ${ (sellingPrice - costPrice) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  />
                  </>
              )}
              
              {status === "Sukses" && serialNumber && (
                <>
                <Separator className="my-3"/>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center text-muted-foreground">
                    <Ticket className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="font-medium text-xs sm:text-sm">Serial Number (SN):</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-muted rounded-md border">
                    <span className="font-mono text-primary text-sm sm:text-base break-all">{serialNumber}</span>
                    <Button variant="ghost" size="icon" onClick={handleCopySn} className="h-7 w-7 ml-2 text-muted-foreground hover:text-primary">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                </>
              )}
              {status === "Gagal" && failureReason && (
                <>
                <Separator className="my-3"/>
                <DetailRow icon={LucideAlertCircle} label="Failure Reason" value={failureReason} valueClassName="text-red-600" />
                </>
              )}
              {status === "Pending" && (
                 <>
                <Separator className="my-3"/>
                <div className="flex items-center pt-1 text-yellow-700 bg-yellow-50 p-2 rounded-md border border-yellow-200">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                  <p className="text-xs sm:text-sm">This transaction is currently being processed.</p>
                </div>
                </>
              )}
            </div>
          </ScrollArea>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            {status === "Sukses" && (
              <Button variant="outline" onClick={handleViewReceipt} className="w-full sm:w-auto">
                <FileText className="mr-2 h-4 w-4" /> View Receipt
              </Button>
            )}
            {status === "Pending" && (
              <Button variant="default" onClick={handleCheckStatus} disabled={isCheckingStatus} className="w-full sm:w-auto">
                {isCheckingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Check Status
              </Button>
            )}
            <Button variant="destructive" onClick={() => setIsConfirmingDelete(true)} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
            <AlertDialogCancel className="w-full sm:w-auto mt-0">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction (ID: ...{id.slice(-8)})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDeleteTransaction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
