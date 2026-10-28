import Image from "next/image";

type BrandLogoProps = {
  width?: number;
  className?: string;
  priority?: boolean;
};

const LOGO_ASPECT_RATIO = 2370 / 639;

export function BrandLogo({ width = 120, className, priority = false }: BrandLogoProps) {
  // const classes = ["object-contain", "dark:brightness-0", "dark:invert", className]
  //   .filter(Boolean)
  //   .join(" ");

  return (
    <Image
      alt="Norish logo"
      className={className}
      height={Math.round(width / LOGO_ASPECT_RATIO)}
      priority={priority}
      src="/logo.svg"
      width={width}
    />
  );
}
