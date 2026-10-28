"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
} from "@heroicons/react/20/solid";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { cssGlassBackdrop } from "@norish/web/config/css-tokens";
import { siteConfig } from "@norish/web/config/site";

import { useAutoHide } from "@/hooks/auto-hide";
import { useUserContext } from "@/context/user-context";
import NavbarUserMenu from "@/components/navbar/navbar-user-menu";

// Map hrefs to translation keys (same as navbar.tsx)
const navLabelKeys: Record<string, "dashboard" | "home" | "calendar" | "prep" | "groceries"> = {
  "/dashboard": "dashboard",
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
  "/prep-table": "prep",
};

const mobileNavLabels: Record<string, string> = {
  "/dashboard": "Home",
  "/": "Recipes",
  "/calendar": "Planner",
  "/prep-table": "Prep",
  "/groceries": "Shop",
};

export const MobileNav = () => {
  const tNav = useTranslations("navbar.nav");
  const pathname = usePathname();
  const { userMenuOpen, setUserMenuOpen } = useUserContext();
  const [isMounted, setIsMounted] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const { isVisible, show } = useAutoHide({
    disabled: userMenuOpen,
  });

  // Keep visible while user menu is open
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (userMenuOpen) {
      show();
    }
  }, [userMenuOpen, show]);

  // Close user menu callback
  const closeUserMenu = useCallback(() => {
    if (userMenuOpen) {
      setUserMenuOpen(false);
    }
  }, [userMenuOpen, setUserMenuOpen]);

  if (!isMounted) return null;

  return (
    <>
      {/* Backdrop overlay - blocks page interactions when menu is open */}
      <AnimatePresence>
        {userMenuOpen && (
          <motion.div
            key="mobile-nav-backdrop"
            animate={{ opacity: 1 }}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeUserMenu}
            onTouchEnd={closeUserMenu}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          y: isVisible ? 0 : 100,
          opacity: isVisible ? 1 : 0,
        }}
        className="fixed inset-x-0 z-[60] px-3 md:hidden"
        initial={false}
        style={{ bottom: "max(calc(env(safe-area-inset-bottom) - 0.2rem), 1rem)" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div ref={rootRef} className="mx-auto flex max-w-md items-center justify-center gap-2">
          {/* Nav items - full width */}
          <div
            className={`flex h-14 min-w-0 flex-1 items-center justify-center rounded-full px-2 ${cssGlassBackdrop}`}
          >
            <ul className="grid w-full grid-cols-5 items-center text-[10px]">
              {siteConfig.navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href + "/"));
                const Icon =
                  item.href === "/dashboard"
                    ? Squares2X2Icon
                    : item.href === "/"
                    ? BookOpenIcon
                    : item.href.startsWith("/calendar")
                      ? CalendarDaysIcon
                      : item.href.startsWith("/prep-table")
                        ? ClipboardDocumentCheckIcon
                      : ShoppingCartIcon;

                return (
                  <li key={item.href} className="min-w-0">
                    <NextLink
                      className={`flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors ${
                        isActive
                          ? "text-primary font-semibold"
                          : "text-default-600 hover:text-foreground hover:bg-default-100/70"
                      }`}
                      href={item.href}
                      onClick={(e) => {
                        if (item.href === "/" && pathname === "/") {
                          e.preventDefault();
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="block max-w-full truncate text-center leading-none">
                        {mobileNavLabels[item.href] ?? tNav(navLabelKeys[item.href] ?? "home")}
                      </span>
                    </NextLink>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* User menu */}
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${cssGlassBackdrop}`}
          >
            <NavbarUserMenu />
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default MobileNav;
