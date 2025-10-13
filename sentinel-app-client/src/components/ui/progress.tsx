import React, { forwardRef } from "react";

type ProgressProps = {
    value?: number; // 0–100
    className?: string;
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
    ({ value = 0, className = "", ...rest }, ref) => {
        return (
            <div
                ref={ref}
                className={`relative h-4 w-full overflow-hidden rounded-full bg-gray-200 ${className}`}
                {...rest}
            >
                <div
                    className="h-full bg-blue-500 transition-all duration-200"
                    style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
                />
            </div>
        );
    }
);

Progress.displayName = "Progress";
