// src/app/(app)/account/change-password/page.tsx
import ChangePasswordForm from "@/components/account/ChangePasswordForm";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  return (
    <>
      <CardHeader className="p-0 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <CardTitle className="text-xl sm:text-2xl font-headline">Change Password</CardTitle>
        </div>
        <CardDescription>Update your account password. Choose a strong, unique password.</CardDescription>
      </CardHeader>
      <ChangePasswordForm />
    </>
  );
}
