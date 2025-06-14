// src/app/(app)/account/change-pin/page.tsx
import ChangePinForm from "@/components/account/ChangePinForm";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound } from "lucide-react";

export default function ChangePinPage() {
  return (
    <>
      <CardHeader className="p-0 mb-6">
         <div className="flex items-center gap-3 mb-2">
          <KeyRound className="h-8 w-8 text-primary" />
          <CardTitle className="text-xl sm:text-2xl font-headline">Change Transaction PIN</CardTitle>
        </div>
        <CardDescription>Update your 6-digit transaction PIN. You'll need to confirm with your account password.</CardDescription>
      </CardHeader>
      <ChangePinForm />
    </>
  );
}
