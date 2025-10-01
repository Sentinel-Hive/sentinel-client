import React, { forwardRef } from "react";

type CheckboxProps = {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ checked, onCheckedChange, className = "", ...rest }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={`inline-block h-4 w-4 rounded ${className}`}
      {...rest}
    />
  );
});
Checkbox.displayName = "Checkbox";
