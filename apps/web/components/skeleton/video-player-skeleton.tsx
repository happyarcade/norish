"use client";

import { Skeleton } from "@heroui-v3/react";

interface VideoPlayerSkeletonProps {
  className?: string;
}

export default function VideoPlayerSkeleton({ className = "" }: VideoPlayerSkeletonProps) {
  return (
    <Skeleton className={`bg-default-200 aspect-[9/16] w-full sm:aspect-video ${className}`} />
  );
}
