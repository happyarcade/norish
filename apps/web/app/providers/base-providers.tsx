"use client";

import type { ComponentProps, ComponentType, PropsWithChildren } from "react";
import { Toast as HeroUIV3Toast } from "@heroui-v3/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { TRPCProviderWrapper } from "./trpc-provider";

export interface BaseProvidersProps {
  children: React.ReactNode;
  themeProps?: Omit<ComponentProps<typeof NextThemesProvider>, "children">;
}

type NextThemesProps = ComponentProps<typeof NextThemesProvider>;
const ThemeProvider = NextThemesProvider as unknown as ComponentType<
  PropsWithChildren<NextThemesProps>
>;

export function BaseProviders({ children, themeProps }: BaseProvidersProps) {
  return (
    <ThemeProvider enableSystem attribute="class" defaultTheme="system" {...themeProps}>
      <TRPCProviderWrapper>
        <HeroUIV3Toast.Provider maxVisibleToasts={1} placement="top end" />
        {children}
      </TRPCProviderWrapper>
    </ThemeProvider>
  );
}
