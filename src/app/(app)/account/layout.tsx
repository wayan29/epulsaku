// src/app/(app)/account/layout.tsx
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center py-8">
      <Card className="w-full max-w-lg shadow-xl">
        <CardContent className="p-6 sm:p-8">
         {children}
        </CardContent>
      </Card>
    </div>
  );
}
