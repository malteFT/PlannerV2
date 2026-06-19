import {
  CalendarDays,
  ShoppingCart,
  Boxes,
  BookOpen,
  Carrot,
  History,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/shopping", label: "Einkauf", icon: ShoppingCart },
  { href: "/inventory", label: "Vorrat", icon: Boxes },
  { href: "/recipes", label: "Rezepte", icon: BookOpen },
  { href: "/ingredients", label: "Zutaten", icon: Carrot },
  { href: "/history", label: "Historie", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
