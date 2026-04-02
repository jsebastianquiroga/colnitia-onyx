import React from "react";
import { cn } from "@/lib/utils";

interface ColnitiaLogoProps {
  size?: number;
  className?: string;
}

export function ColnitiaLogo({ size = 24, className }: ColnitiaLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/colnitia-logo.svg"
      alt="Colnitia GPT"
      width={size}
      height={size}
      className={cn("flex-shrink-0", className)}
    />
  );
}
