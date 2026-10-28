"use client";

import dynamic from "next/dynamic";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useAutoHide } from "@/hooks/auto-hide";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { siteConfig } from "@norish/web/config/site";

const NavbarUserMenu = dynamic(() => import("@/components/navbar/navbar-user-menu"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-13 w-13" />,
});

const MobileNav = dynamic(() => import("@/components/navbar/mobile-nav"), {
  ssr: false,
});

// Map hrefs to translation keys
const navLabelKeys: Record<string, "dashboard" | "home" | "calendar" | "prep" | "groceries"> = {
  "/dashboard": "dashboard",
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
  "/prep-table": "prep",
};

export const Navbar = () => {
  const t = useTranslations("navbar.nav");
  const pathname = usePathname();
  const { isVisible, onHoverStart, onHoverEnd } = useAutoHide({
    idleDelay: Infinity, // Only hide on scroll, not on idle
  });

  return (
    <>
      {/* Spacer since navbar is fixed */}
      <div className="hidden md:block" style={{ height: "100px" }} />

      {/* Desktop navbar */}
      <motion.div
        animate={{
          y: isVisible ? 0 : -100,
          opacity: isVisible ? 1 : 0,
        }}
        className="fixed top-4 left-1/2 z-[60] hidden w-full max-w-7xl -translate-x-1/2 px-4 md:block"
        initial={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      >
        <nav
          aria-label="Primary navigation"
          className="bg-content1 grid h-16 grid-cols-[1fr_auto_1fr] items-center rounded-[40px] px-6 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)] transition-all"
        >
          {/* Left */}
          <div className="flex min-w-0 items-center justify-start">
            <div className="max-w-fit">
              <NextLink
                aria-label="Go to home"
                className="flex items-center"
                href="/"
                onClick={(e) => {
                  if (pathname === "/") {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              >
                <BrandLogo priority width={120} />
              </NextLink>
            </div>
          </div>

          {/* Center */}
          <div className="flex items-center justify-center">
            <ul className="flex items-center justify-center gap-3">
              {siteConfig.navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href + "/"));

                return (
                  <li key={item.href}>
                    <NextLink
                      className={`hover:text-primary rounded-md px-3 py-1.5 font-medium transition-colors ${
                        isActive ? "text-primary font-semibold" : "text-foreground/80"
                      }`}
                      href={item.href}
                    >
                      {t(navLabelKeys[item.href] ?? "home")}
                    </NextLink>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right */}
          <div className="flex items-center justify-end">
            <div className="flex items-center">
              <NavbarUserMenu />
            </div>
          </div>
        </nav>
      </motion.div>

      {/* Mobile navbar */}
      <MobileNav />
    </>
  );
};

export default Navbar;
