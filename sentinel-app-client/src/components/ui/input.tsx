import React, { forwardRef } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { className?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className = "", ...props }, ref) => {
  return <input ref={ref} className={`w-full border rounded px-2 py-1 bg-[hsl(var(--bg))] text-[hsl(var(--fg))] ${className}`} {...props} />;
});
Input.displayName = "Input";
