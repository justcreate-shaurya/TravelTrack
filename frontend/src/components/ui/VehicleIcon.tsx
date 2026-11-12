import { Bus, Car, CarTaxiFront } from "lucide-react";

import type { Vehicle } from "@/lib/types";

export interface VehicleIconProps {
  vehicle: Vehicle;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** Auto-rickshaw, drawn in the lucide style (lucide has no rickshaw). */
function AutoIcon({ size = 20, strokeWidth = 1.75, className }: Omit<VehicleIconProps, "vehicle">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 16V11a5 5 0 0 1 5-5h6.5a2 2 0 0 1 1.8 1.1L19 12.5l1.6.7a1 1 0 0 1 .6.9V16" />
      <path d="M3 16h1.5" />
      <path d="M9.5 16h5" />
      <path d="M19.5 16h1.7" />
      <path d="M11 6v6.5h8" />
      <circle cx="7" cy="16.5" r="2.5" />
      <circle cx="17" cy="16.5" r="2.5" />
    </svg>
  );
}

/** The icon for a vehicle type: auto, cab (sedan), SUV, MUV. */
export function VehicleIcon({ vehicle, size = 20, strokeWidth = 1.75, className }: VehicleIconProps) {
  const props = { size, strokeWidth, className, "aria-hidden": true } as const;
  switch (vehicle) {
    case "auto":
      return <AutoIcon size={size} strokeWidth={strokeWidth} className={className} />;
    case "sedan":
      return <CarTaxiFront {...props} />;
    case "suv":
      return <Car {...props} />;
    case "muv":
      return <Bus {...props} />;
  }
}
