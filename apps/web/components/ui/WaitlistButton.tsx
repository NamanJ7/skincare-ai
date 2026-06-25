"use client";

import { type ReactNode } from "react";
import { Button } from "./Button";
import { openWaitlist } from "@/lib/tally";

/** Every "Join the Waitlist" CTA on the site routes through here so they all
 *  open the same Tally popup (form LZVOM2). */
export function WaitlistButton({
  children = "Join the Waitlist",
  variant = "primary",
  size = "lg",
  className = "",
}: {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "soft";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={`${variant === "primary" ? "!text-on-primary" : ""} ${className}`}
      onClick={openWaitlist}
    >
      {children}
    </Button>
  );
}
