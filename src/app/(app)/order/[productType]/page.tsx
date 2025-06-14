
// src/app/(app)/order/[productType]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OrderFormShell from "@/components/order/OrderFormShell";
import { Smartphone, Gamepad2, Send, DollarSign, Hash, Users, AlertTriangle, ShieldCheck, Loader2, KeyRound } from "lucide-react"; // Removed Zap
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext'; 
import { verifyPin } from '@/ai/flows/verify-pin-flow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Operator Data
interface OperatorInfo {
  name: string;
  prefixes: string[];
  amounts: string[];
}

const operatorData: OperatorInfo[] = [
  { name: "Telkomsel", prefixes: ["0811", "0812", "0813", "0821", "0822", "0823", "0852", "0853", "0851"], amounts: ["10000", "15000", "20000", "25000", "50000", "100000", "150000", "200000"] },
  { name: "Indosat", prefixes: ["0814", "0815", "0816", "0855", "0856", "0857", "0858"], amounts: ["10000", "15000", "20000", "25000", "50000", "100000"] },
  { name: "XL", prefixes: ["0859", "0877", "0878", "0817", "0818", "0819"], amounts: ["15000", "25000", "30000", "50000", "100000", "150000"] },
  { name: "Tri", prefixes: ["0898", "0899", "0895", "0896", "0897"], amounts: ["5000", "10000", "15000", "20000", "25000", "50000"] },
  { name: "Smartfren", prefixes: ["0889", "0881", "0882", "0883", "0886", "0887", "0888", "0884", "0885"], amounts: ["10000", "20000", "25000", "50000", "60000", "100000"] },
  { name: "Axis", prefixes: ["0832", "0833", "0838", "0831"], amounts: ["10000", "15000", "25000", "30000", "50000"] },
];

// Schemas
const pulsaSchema = z.object({
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\d+$/, "Must be only digits"),
  amount: z.string().min(1, "Please select an amount"),
});

// Token Listrik schema removed as it's now handled by a dedicated page

const gameTopupSchema = z.object({
  game: z.string().min(1, "Please select a game"),
  gameId: z.string().min(5, "Game ID must be at least 5 characters"),
  serverId: z.string().optional(),
  item: z.string().min(1, "Please select an item"),
});

type ProductType = 'pulsa' | 'game-topup'; // Removed 'token-listrik'

const productConfig = {
  pulsa: {
    title: "Buy Phone Credit (Pulsa)",
    description: "Enter phone number, select amount, and confirm with PIN.",
    icon: Smartphone,
    schema: pulsaSchema,
    fields: [
      { name: "phoneNumber", label: "Phone Number", placeholder: "081234567890", icon: Smartphone },
      { name: "amount", label: "Amount", type: "select", placeholder: "Select Amount", icon: DollarSign, options: [] },
    ],
  },
  // 'token-listrik' entry removed
  'game-topup': {
    title: "Game Top-up",
    description: "Select game, enter ID, choose item, and confirm with PIN.",
    icon: Gamepad2,
    schema: gameTopupSchema,
    fields: [
      { name: "game", label: "Game", type: "select", placeholder: "Select Game", icon: Gamepad2, options: ["Mobile Legends", "PUBG Mobile", "Free Fire", "Genshin Impact"] },
      { name: "gameId", label: "Game ID", placeholder: "Enter your Game ID", icon: Users },
      { name: "serverId", label: "Server/Zone ID (Optional)", placeholder: "Enter Server/Zone ID", icon: Users, optional: true },
      { name: "item", label: "Item/Diamond", type: "select", placeholder: "Select Item", icon: DollarSign, options: ["100 Diamonds", "500 Diamonds", "Weekly Pass", "Monthly Pass"] },
    ],
  },
};

// Define the type for form values based on product type
type PulsaFormValues = z.infer<typeof pulsaSchema>;
// type TokenListrikFormValues = z.infer<typeof tokenListrikSchema>; // Removed
type GameTopupFormValues = z.infer<typeof gameTopupSchema>;
type FormValues = PulsaFormValues | GameTopupFormValues; // Removed TokenListrikFormValues


export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser } = useAuth(); 
  const productType = params.productType as ProductType;

  const config = productConfig[productType];

  const form = useForm<FormValues>({ 
    resolver: zodResolver(config?.schema || z.object({})),
    defaultValues: config?.fields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {}),
  });

  const [detectedOperator, setDetectedOperator] = useState<OperatorInfo | null>(null);
  const initialAmountOptions = productType === 'pulsa' ? [] : config?.fields.find(f => f.name === 'amount')?.options || [];
  const [currentAmountOptions, setCurrentAmountOptions] = useState<string[]>(initialAmountOptions);
  const [showUnsupportedOperatorMessage, setShowUnsupportedOperatorMessage] = useState(false);

  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [orderDetailsToConfirm, setOrderDetailsToConfirm] = useState<FormValues | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPinInput, setShowPinInput] = useState(false); 
  const [isSubmittingWithPin, setIsSubmittingWithPin] = useState(false);

  const watchedPhoneNumber = form.watch('phoneNumber' as keyof FormValues); 

  useEffect(() => {
    if (productType === 'pulsa' && 'phoneNumber' in form.getValues()) {
      let rawPhoneNumberValue = form.getValues('phoneNumber' as keyof PulsaFormValues); 
      let normalizedPhoneNumber = rawPhoneNumberValue;

      if (typeof rawPhoneNumberValue === 'string') {
        let digitsOnly = rawPhoneNumberValue.replace(/\D/g, '');
        if (digitsOnly.startsWith('62')) {
            normalizedPhoneNumber = '0' + digitsOnly.substring(2);
        } else {
            normalizedPhoneNumber = digitsOnly; 
        }
        
        if (normalizedPhoneNumber !== rawPhoneNumberValue) {
          form.setValue('phoneNumber' as keyof PulsaFormValues, normalizedPhoneNumber, { shouldValidate: true, shouldDirty: true });
          return;
        }
      }
      
      let foundOperator: OperatorInfo | null = null;
      let isPotentiallyValid = false;

      if (normalizedPhoneNumber && normalizedPhoneNumber.length >= 3) {
        isPotentiallyValid = true;
        for (const op of operatorData) {
          if (op.prefixes.some(prefix => normalizedPhoneNumber.startsWith(prefix))) {
            foundOperator = op;
            break;
          }
        }
      }

      if (foundOperator) {
        setDetectedOperator(foundOperator);
        setCurrentAmountOptions(foundOperator.amounts);
        setShowUnsupportedOperatorMessage(false);
        const currentAmount = form.getValues('amount' as keyof PulsaFormValues);
        if (currentAmount && !foundOperator.amounts.includes(currentAmount)) {
          form.setValue('amount' as keyof PulsaFormValues, '', { shouldValidate: true });
        }
      } else {
        setDetectedOperator(null);
        setCurrentAmountOptions([]);
        if (normalizedPhoneNumber && normalizedPhoneNumber.length >= 4 && isPotentiallyValid) {
             setShowUnsupportedOperatorMessage(true);
        } else {
             setShowUnsupportedOperatorMessage(false);
        }
        if (form.getValues('amount' as keyof PulsaFormValues)) {
            form.setValue('amount' as keyof PulsaFormValues, '', { shouldValidate: true });
        }
      }
    } else if (config && productType !== 'pulsa') { // Ensure this doesn't run for pulsa if config exists but it's not pulsa
      const staticOptions = config.fields.find(f => f.name === 'amount')?.options || [];
      setCurrentAmountOptions(staticOptions);
      setDetectedOperator(null);
      setShowUnsupportedOperatorMessage(false);
    }
  }, [watchedPhoneNumber, productType, form, config]);


  if (!config) {
    return (
        <div className="text-center py-10">
            <h1 className="text-2xl font-bold mb-4">Invalid Product Type</h1>
            <p className="text-muted-foreground mb-6">The product type you are looking for does not exist or is handled by a dedicated page.</p>
            <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
        </div>
    );
  }
  
  function onSubmit(values: FormValues) {
    if (productType === 'pulsa') {
        if (!detectedOperator || currentAmountOptions.length === 0) {
            toast({
                title: "Order Error",
                description: "Please enter a valid phone number for a supported operator and select an amount.",
                variant: "destructive",
            });
            return;
        }
    }
    setOrderDetailsToConfirm(values); 
    setShowPinInput(true); 
    setIsConfirmingOrder(true); 
    setPinInput("");
    setPinError("");
  }

  function processOrder(values: FormValues) {
    let orderIdentifier = "";
    if ('phoneNumber' in values) orderIdentifier = (values as PulsaFormValues).phoneNumber;
    // else if ('meterNumber' in values) orderIdentifier = (values as TokenListrikFormValues).meterNumber; // Removed
    else if ('gameId' in values) orderIdentifier = (values as GameTopupFormValues).gameId;
    
    console.log("Order Submitted:", values, "Operator (if any):", detectedOperator?.name);
    toast({
      title: "Order Placed!",
      description: `${config.title} order for ${orderIdentifier} has been submitted.`,
      variant: "default",
    });
    form.reset();
    if (productType === 'pulsa') {
        setDetectedOperator(null);
        setCurrentAmountOptions([]);
        setShowUnsupportedOperatorMessage(false);
    }
    setIsConfirmingOrder(false);
    setShowPinInput(false);
    setIsSubmittingWithPin(false);
    router.push("/transactions"); 
  }

  const handlePinConfirm = async () => {
    if (!orderDetailsToConfirm) return;
    if (!authUser) {
      setPinError("User not authenticated. Please log in again.");
      setIsSubmittingWithPin(false);
      return;
    }

    setIsSubmittingWithPin(true);
    setPinError("");

    try {
      const response = await verifyPin({ username: authUser.username, pin: pinInput });
      if (response.isValid) {
        processOrder(orderDetailsToConfirm);
      } else {
        setPinError(response.message || "Invalid PIN. Please try again.");
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      setPinError("An error occurred during PIN verification. Please try again.");
    } finally {
      setIsSubmittingWithPin(false);
    }
  };
  
  const getAmountSelectPlaceholder = () => {
    if (productType !== 'pulsa') return config.fields.find(f => f.name === 'amount')?.placeholder || "Select Amount";
    
    if (detectedOperator && currentAmountOptions.length > 0) return "Select Amount";
    
    const currentPhoneNumber = form.getValues('phoneNumber' as keyof PulsaFormValues);
    if (!currentPhoneNumber || currentPhoneNumber.length < 3) return "Enter phone number";
    if (showUnsupportedOperatorMessage) return "Unsupported operator";
    if (currentAmountOptions.length === 0 && currentPhoneNumber.length >=3) return "No amounts available"; 
    return "Select Amount";
  }

  const renderOrderDetailsForConfirmation = () => {
    if (!orderDetailsToConfirm) return null;

    if (productType === 'pulsa' && 'phoneNumber' in orderDetailsToConfirm) {
      const details = orderDetailsToConfirm as PulsaFormValues;
      return (
        <>
          <div><strong>Phone Number:</strong> {details.phoneNumber}</div>
          {detectedOperator && <div><strong>Operator:</strong> {detectedOperator.name}</div>}
          <div><strong>Amount:</strong> Rp {parseInt(details.amount).toLocaleString()}</div>
        </>
      );
    }
    // Removed TokenListrik confirmation details
    if (productType === 'game-topup' && 'gameId' in orderDetailsToConfirm) {
      const details = orderDetailsToConfirm as GameTopupFormValues;
      return (
        <>
          <div><strong>Game:</strong> {details.game}</div>
          <div><strong>Game ID:</strong> {details.gameId}</div>
          {details.serverId && <div><strong>Server/Zone ID:</strong> {details.serverId}</div>}
          <div><strong>Item:</strong> {details.item}</div>
        </>
      );
    }
    return <p>Review your order details.</p>;
  };


  return (
    <>
      <OrderFormShell title={config.title} description={config.description} icon={config.icon}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {config.fields.map((fieldInfo) => {
              const isPulsaType = productType === 'pulsa';
              const isAmountField = fieldInfo.name === 'amount';

              if (isPulsaType && isAmountField && (!detectedOperator || currentAmountOptions.length === 0)) {
                return null; 
              }
              
              const optionsToUse = (isPulsaType && isAmountField) ? currentAmountOptions : fieldInfo.options;
              const isDisabled = (isPulsaType && isAmountField && (!detectedOperator || currentAmountOptions.length === 0)) ? true : (fieldInfo.type === 'select' && (!optionsToUse || optionsToUse.length === 0));
              
              return (
                <div key={fieldInfo.name}>
                  <FormField
                    control={form.control}
                    name={fieldInfo.name as keyof FormValues} 
                    render={({ field }) => (
                      <FormItem>
                        <Label className="flex items-center">
                          {fieldInfo.icon && <fieldInfo.icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                          {fieldInfo.label}
                          {fieldInfo.optional && <span className="text-xs text-muted-foreground ml-1">(Optional)</span>}
                        </Label>
                        <FormControl>
                          {fieldInfo.type === 'select' ? (
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value as string} 
                              value={field.value as string} 
                              disabled={isDisabled}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={isPulsaType && isAmountField ? getAmountSelectPlaceholder() : fieldInfo.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {optionsToUse?.map(option => (
                                  <SelectItem key={option} value={option}>
                                    {option.includes("Diamonds") || option.includes("Pass") || option.match(/^\d+$/) ? 
                                    (option.match(/^\d+$/) ? `Rp ${parseInt(option).toLocaleString()}` : option) 
                                    : option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input 
                              placeholder={fieldInfo.placeholder} 
                              {...field} 
                              value={field.value as string || ""} 
                              type={(fieldInfo.name === 'phoneNumber' || fieldInfo.name === 'meterNumber') ? 'tel' : 'text'}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fieldInfo.name === 'phoneNumber' && productType === 'pulsa' && (
                    <div className="mt-1.5 text-xs">
                      {detectedOperator && (
                        <p className="text-green-600">
                          Operator: <span className="font-semibold">{detectedOperator.name}</span>
                        </p>
                      )}
                      {showUnsupportedOperatorMessage && !detectedOperator && form.getValues('phoneNumber' as keyof PulsaFormValues)?.length >= 4 && (
                        <p className="text-destructive flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Unsupported or invalid operator.
                        </p>
                      )}
                      {(!detectedOperator || currentAmountOptions.length === 0) && form.getValues('phoneNumber' as keyof PulsaFormValues)?.length >= 4 && (
                        <p className="text-muted-foreground">
                          {showUnsupportedOperatorMessage ? "" : "Enter a valid number to see amounts."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <Send className="mr-2 h-4 w-4" /> Submit Order
            </Button>
          </form>
        </Form>
      </OrderFormShell>

      <AlertDialog open={isConfirmingOrder} onOpenChange={(open) => {
          if (!open) { 
              setIsConfirmingOrder(false);
              setShowPinInput(false); 
              setPinInput("");
              setPinError("");
          } else {
              setIsConfirmingOrder(open);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Confirm Your Order
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-sm text-foreground">
                Please review your order details and enter PIN to confirm:
            </AlertDialogDescription>
             <div className="pt-2 space-y-1 text-sm text-foreground">
                {renderOrderDetailsForConfirmation()}
            </div>
          </AlertDialogHeader>
          
          <div className="space-y-2 py-4 bg-muted/70 rounded-lg p-4 my-4">
              <Label htmlFor="pinInputConfirmProductType" className="flex items-center justify-center text-sm font-medium text-foreground/80">
                <KeyRound className="mr-2 h-4 w-4" />
                Transaction PIN
              </Label>
            <Input
                id="pinInputConfirmProductType"
                type="password"
                value={pinInput}
                onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, ''); 
                    if (val.length <= 6) {
                        setPinInput(val);
                    }
                }}
                placeholder="● ● ● ● ● ●"
                maxLength={6}
                className="text-center tracking-[0.5em] text-xl bg-background border-primary/50 focus:border-primary"
            />
            {pinError && <p className="text-sm text-destructive text-center pt-2">{pinError}</p>}
          </div>

          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel onClick={() => {
                setIsConfirmingOrder(false);
                setShowPinInput(false);
                setPinInput("");
                setPinError("");
            }} disabled={isSubmittingWithPin}>Cancel</AlertDialogCancel>
            <Button onClick={handlePinConfirm} disabled={isSubmittingWithPin || pinInput.length !== 6} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmittingWithPin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Pay
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
    

