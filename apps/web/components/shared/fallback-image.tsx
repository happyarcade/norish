"use client";

import type { ImgHTMLAttributes } from "react";
import { useState } from "react";
import NextImage, { ImageProps as NextImageProps } from "next/image";
import { useTranslations } from "next-intl";

interface FallbackPlaceholderProps {
  className?: string;
  message?: string;
}

function FallbackPlaceholder({ className = "", message }: FallbackPlaceholderProps) {
  const t = useTranslations("recipes.carousel");

  return (
    <div className={`bg-default-200 flex h-full w-full items-center justify-center ${className}`}>
      <span className="text-default-500 font-medium">{message || t("noImageAvailable")}</span>
    </div>
  );
}

// Props for Next.js Image variant
type NextFallbackImageProps = Omit<NextImageProps, "onError"> & {
  variant?: "next";
  fallbackClassName?: string;
  fallbackMessage?: string;
};

// Props for HeroUI Image variant
type HeroFallbackImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "onError"> & {
  variant: "hero";
  fallbackClassName?: string;
  fallbackMessage?: string;
  removeWrapper?: boolean;
  radius?: "none" | "sm" | "md" | "lg" | "full";
};

export type FallbackImageProps = NextFallbackImageProps | HeroFallbackImageProps;

export default function FallbackImage(props: FallbackImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <FallbackPlaceholder className={props.fallbackClassName} message={props.fallbackMessage} />
    );
  }

  if (props.variant === "hero") {
    const {
      variant: _variant,
      fallbackClassName: _fallbackClassName,
      fallbackMessage: _fallbackMessage,
      removeWrapper: _removeWrapper,
      radius,
      ...imageProps
    } = props;

    const radiusClass = radius === "none" ? "rounded-none" : radius ? `rounded-${radius}` : "";

    // Remote recipe hosts are user data, so a native image avoids maintaining a hostname allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        {...imageProps}
        alt={imageProps.alt ?? ""}
        className={`${radiusClass} ${imageProps.className ?? ""}`}
        onError={() => setHasError(true)}
      />
    );
  }

  const {
    variant: _variant,
    fallbackClassName: _fallbackClassName,
    fallbackMessage: _fallbackMessage,
    ...imageProps
  } = props as NextFallbackImageProps;

  return <NextImage {...imageProps} onError={() => setHasError(true)} />;
}

// For components that track errors across multiple images (carousels)
export function useImageErrors() {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (src: string) => {
    setImageErrors((prev) => new Set(prev).add(src));
  };

  const hasError = (src: string) => imageErrors.has(src);

  return { handleImageError, hasError };
}

export { FallbackPlaceholder };
