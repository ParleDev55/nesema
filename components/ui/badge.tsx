import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-nesema-sage text-white",
        secondary: "border-transparent bg-nesema-sage-p text-nesema-sage",
        sage: "border-transparent bg-nesema-sage-p text-nesema-sage",
        clay: "border-transparent bg-nesema-clay-p text-nesema-clay",
        sky: "border-transparent bg-nesema-sky-p text-nesema-sky",
        amber: "border-transparent bg-nesema-amb-p text-nesema-amber",
        lav: "border-transparent bg-nesema-lav-p text-nesema-lav",
        outline: "border-nesema-bdr text-nesema-t2",
        destructive: "border-transparent bg-red-100 text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
