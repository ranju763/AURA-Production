"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/calendar", icon: Calendar, label: "Calendar" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  // Alternative nav items for different screens
  const tournamentNavItems = [
    { href: "/", icon: Home, label: "Tournaments" },
    { href: "/tournaments/hosted", icon: Calendar, label: "My Tournaments" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  const profileNavItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/tournaments/hosted", icon: Calendar, label: "My Tournaments" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  // Determine which nav items to show based on current route
  let items = navItems;
  if (pathname?.startsWith("/profile")) {
    items = profileNavItems;
  } else if (pathname?.startsWith("/tournaments") || pathname === "/") {
    items = tournamentNavItems;
  }

  // Update active state to handle nested routes
  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className="border fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 max-w-[500px] mx-auto">
      <div className="flex justify-around items-center h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full text-gray-500",
                active && "text-purple-600"
              )}
            >
              <Icon
                className={cn("size-6 flex-1", active && "text-purple-600")}
              />
              <div
                className={cn(
                  "w-full h-1 rounded-full mt-1 bg-transparent",
                  active && "bg-purple-600"
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
