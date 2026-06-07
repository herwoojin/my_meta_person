"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  History,
  MessageCircle,
  Settings,
  Sparkles,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/journal", label: "음성 일기", icon: BookOpen },
  { href: "/records", label: "기록", icon: History },
  { href: "/coach", label: "코칭", icon: MessageCircle },
  { href: "/blog-reader", label: "블로그 읽기", icon: BookOpen },
  { href: "/settings", label: "설정", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, profile } = useAuthStore();

  const handleSignOut = async () => {
    const { signOut } = await import("firebase/auth");
    const { getClientAuth } = await import("@/lib/firebase/client");
    await signOut(getClientAuth());
    window.location.href = "/login";
  };

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 glass border-r border-border/50 z-40">
      {/* 로고 */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">MetaMe</h1>
          <p className="text-xs text-muted-foreground">AI 자기성찰 코칭</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-200 group
                ${
                  isActive
                    ? "bg-primary/10 text-primary glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }
              `}
            >
              <item.icon
                className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? "text-primary" : ""
                }`}
              />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 사용자 프로필 */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-2">
          <Avatar className="w-9 h-9 ring-2 ring-primary/20">
            <AvatarImage src={user?.photoURL ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {profile?.displayName?.[0] ?? user?.email?.[0] ?? "M"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {profile?.displayName ?? "사용자"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {profile?.mbti ?? "MBTI 미설정"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { user, profile } = useAuthStore();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    const { signOut } = await import("firebase/auth");
    const { getClientAuth } = await import("@/lib/firebase/client");
    await signOut(getClientAuth());
    window.location.href = "/login";
  };

  return (
    <>
      {/* 모바일 상단 바 */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 glass border-b border-border/50 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm">MetaMe</span>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" />}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </SheetTrigger>
          <SheetContent side="right" className="w-72 glass">
            <div className="flex items-center gap-3 mb-8 mt-4">
              <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                <AvatarImage src={user?.photoURL ?? ""} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {profile?.displayName?.[0] ?? "M"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {profile?.displayName ?? "사용자"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile?.mbti ?? "MBTI 미설정"}
                </p>
              </div>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-colors
                      ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto pt-8">
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* 모바일 하단 탭바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass border-t border-border/50 z-50 flex items-center justify-around px-2">
        {navItems.slice(0, 4).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg
                transition-all duration-200
                ${isActive ? "text-primary" : "text-muted-foreground"}
              `}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform`} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-4 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
