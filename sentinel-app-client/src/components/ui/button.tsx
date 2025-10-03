import React, { forwardRef } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size, className = "", children, ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-md px-3 py-1 transition-colors";
    // use a lighter background for ghost/outline so filter boxes are readable;
    // keep the default variant (selected) using the primary color unchanged
    const variants =
      variant === "outline"
        ? "border bg-[hsl(var(--muted))] text-[hsl(var(--fg))]"
        : variant === "ghost"
        ? "bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] text-[hsl(var(--fg))]"
        : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]";
    const sizes = size === "sm" ? "text-sm h-8" : size === "lg" ? "text-base h-11" : "text-sm h-10";

    return (
      <button ref={ref} className={`${base} ${variants} ${sizes} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
