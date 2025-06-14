
// src/components/core/Header.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, LayoutDashboard, History, LogOut, UserCircle2, Menu, DollarSign, Settings, KeyRound, ShieldCheck, TrendingUp, Shield, ShieldAlert, ShoppingCart, Cog } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const NavLink = ({ href, children, icon, onClick }: NavLinkProps) => (
  <Button variant="ghost" asChild className="justify-start text-foreground hover:bg-accent/20 hover:text-accent-foreground" onClick={onClick}>
    <Link href={href} className="flex items-center gap-2">
      {icon}
      {children}
    </Link>
  </Button>
);


export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = () => {
    logout();
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Digiflazz", icon: <Zap className="h-5 w-5" /> },
    { href: "/order/tokovoucher", label: "TokoVoucher", icon: <ShoppingCart className="h-5 w-5" /> },
    { href: "/transactions", label: "Transactions", icon: <History className="h-5 w-5" /> },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-primary">
          <Zap className="h-8 w-8" />
          <span className="text-2xl font-bold font-headline">ePulsaku</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navItems.map((item) => (
            <Button variant="ghost" asChild className="text-sm text-foreground hover:bg-accent/20 hover:text-accent-foreground px-3 py-2" key={item.href}>
                <Link href={item.href} className="flex items-center gap-2">
                {item.icon}
                {item.label}
                </Link>
            </Button>
          ))}
           {/* App Settings dropdown removed from here */}
        </nav>

        <div className="flex items-center gap-2">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden md:flex items-center gap-2 text-sm text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground px-3 py-2">
                  <UserCircle2 className="h-5 w-5" />
                  <span>{user.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                 <DropdownMenuItem asChild>
                  <Link href="/profit-report" className="flex items-center gap-2 cursor-pointer">
                    <TrendingUp className="h-4 w-4" /> Sales & Profit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5">
                      <Cog className="h-4 w-4" /> App Settings
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/admin-settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" /> Admin Credentials
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/price-settings" className="flex items-center gap-2 cursor-pointer">
                      <DollarSign className="h-4 w-4" /> Digiflazz Prices
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/tokovoucher-price-settings" className="flex items-center gap-2 cursor-pointer">
                      <DollarSign className="h-4 w-4" /> TokoVoucher Prices
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5">
                      <Shield className="h-4 w-4" /> Security
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/account/login-activity" className="flex items-center gap-2 cursor-pointer">
                      <ShieldAlert className="h-4 w-4" /> Login Activity
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/change-password" className="flex items-center gap-2 cursor-pointer">
                      <ShieldCheck className="h-4 w-4" /> Change Password
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/change-pin" className="flex items-center gap-2 cursor-pointer">
                      <KeyRound className="h-4 w-4" /> Change PIN
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-background p-4">
                <SheetHeader className="text-left mb-6">
                  <SheetTitle className="flex items-center gap-2 text-primary text-2xl font-bold font-headline">
                    <Zap className="h-8 w-8" />
                    ePulsaku
                  </SheetTitle>
                </SheetHeader>
                
                <nav className="flex flex-col gap-2">
                  {/* Main nav items for mobile */}
                  {navItems.map((item) => (
                     <SheetClose asChild key={`mobile-main-${item.href}`}>
                        <NavLink href={item.href} icon={item.icon}>
                          {item.label}
                        </NavLink>
                     </SheetClose>
                  ))}
                </nav>

                {user && (
                  <>
                    <DropdownMenuSeparator className="my-3" />
                    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground px-2">
                        <Cog className="h-5 w-5" />
                        <span>App Settings</span>
                    </div>
                    <nav className="flex flex-col gap-1 pl-2">
                        <SheetClose asChild>
                            <NavLink href="/admin-settings" icon={<Settings className="h-5 w-5" />}>
                            Admin Credentials
                            </NavLink>
                        </SheetClose>
                        <SheetClose asChild>
                            <NavLink href="/price-settings" icon={<DollarSign className="h-5 w-5" />}>
                            Digiflazz Prices
                            </NavLink>
                        </SheetClose>
                        <SheetClose asChild>
                            <NavLink href="/tokovoucher-price-settings" icon={<DollarSign className="h-5 w-5" />}>
                            TokoVoucher Prices
                            </NavLink>
                        </SheetClose>
                    </nav>

                    <DropdownMenuSeparator className="my-4" />
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground px-2">
                      <UserCircle2 className="h-5 w-5" />
                      <span>{user.username}</span>
                    </div>
                    <nav className="flex flex-col gap-1 pl-2">
                       <SheetClose asChild>
                        <NavLink href="/profit-report" icon={<TrendingUp className="h-5 w-5" />}>
                          Sales & Profit
                        </NavLink>
                      </SheetClose>
                    </nav>

                    <DropdownMenuSeparator className="my-3" />
                     <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground px-2">
                        <Shield className="h-5 w-5" />
                        <span>Security</span>
                    </div>
                    <nav className="flex flex-col gap-1 pl-2">
                      <SheetClose asChild>
                        <NavLink href="/account/login-activity" icon={<ShieldAlert className="h-5 w-5" />}>
                          Login Activity
                        </NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink href="/account/change-password" icon={<ShieldCheck className="h-5 w-5" />}>
                          Change Password
                        </NavLink>
                      </SheetClose>
                      <SheetClose asChild>
                        <NavLink href="/account/change-pin" icon={<KeyRound className="h-5 w-5" />}>
                          Change PIN
                        </NavLink>
                      </SheetClose>
                    </nav>
                  </>
                )}
                 <DropdownMenuSeparator className="my-3" />
                <Button variant="outline" onClick={() => { handleLogout(); }} className="mt-6 w-full border-destructive text-destructive hover:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

