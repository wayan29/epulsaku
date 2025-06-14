// src/components/auth/LoginForm.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { UserCircle2, Lock, Zap, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticateUser } from "@/lib/user-utils";
import { useState } from "react";

const formSchema = z.object({
  username: z.string().min(1, "Username cannot be empty"),
  password: z.string().min(1, "Password cannot be empty"),
  rememberMe: z.boolean().default(false).optional(), // Added rememberMe
});

export default function LoginForm() {
  const { login: authLogin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: true, // Default "Remember Me" to true for convenience
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // Pass rememberMe value to authenticateUser
      const result = await authenticateUser(values.username, values.password, values.rememberMe);
      if (result.success && result.user && result.token) {
        authLogin(result.user, result.token);
        toast({
          title: "Login Successful",
          description: `Welcome back, ${result.user.username}!`,
        });
        router.push("/dashboard");
      } else {
        toast({
          title: "Login Failed",
          description: result.message || "Invalid username or password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex items-center justify-center">
          <Zap className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">Welcome to ePulsaku</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><UserCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />Username</FormLabel>
                  <FormControl>
                    <Input placeholder="yourusername" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground" />Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                      id="remember-me"
                    />
                  </FormControl>
                  <FormLabel htmlFor="remember-me" className="text-sm font-normal text-muted-foreground cursor-pointer">
                    Remember me on this device
                  </FormLabel>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          First time setup?{" "}
          <Link href="/signup" className="font-medium text-primary hover:text-primary/80">
            Create Admin Account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
