"use client";

import { Avatar } from "@heroui-v3/react";

import { useUserAvatar } from "@norish/shared-react/hooks";

type Props = {
  userId?: string;
  name?: string | null;
  image?: string | null;
};
export default function AuthorChip({ userId, name, image }: Props) {
  const { avatarSrc, fallbackStyle } = useUserAvatar({
    image,
    fallbackSeed: userId || name || "U",
  });
  const avatarInitial = (name ?? "U").charAt(0).toUpperCase() || "U";

  return (
    <div className="flex items-center gap-2 rounded-full bg-black/40 py-1 pr-3 pl-2 shadow-sm backdrop-blur-md">
      <Avatar
        className={`border border-black/30 font-semibold dark:border-white/25 ${avatarSrc ? "bg-white dark:bg-black" : ""}`}
        size="sm"
      >
        {avatarSrc ? <Avatar.Image alt={name ?? ""} src={avatarSrc} /> : null}
        <Avatar.Fallback style={fallbackStyle}>{avatarInitial}</Avatar.Fallback>
      </Avatar>
      <span className="max-w-[140px] truncate text-sm font-medium text-white/90">
        {name || "Unknown"}
      </span>
    </div>
  );
}
