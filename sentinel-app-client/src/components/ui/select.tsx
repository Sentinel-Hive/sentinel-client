import React, { createContext, useContext } from "react";

type SelectContextType = { value: string; onValueChange: (v: string) => void };
const SelectContext = createContext<SelectContextType | null>(null);

export function Select({
    value,
    onValueChange,
    children,
}: {
    value: string;
    onValueChange: (v: string) => void;
    children?: React.ReactNode;
}) {
    return (
        <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>
    );
}

export const SelectTrigger = ({
    children,
    className = "",
}: {
    children?: React.ReactNode;
    className?: string;
}) => {
    return <div className={className}>{children}</div>;
};

export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
    const ctx = useContext(SelectContext);
    return <span>{ctx ? ctx.value || placeholder : placeholder}</span>;
};

export const SelectContent = ({
    children,
    className = "",
}: {
    children?: React.ReactNode;
    className?: string;
}) => {
    const ctx = useContext(SelectContext);
    if (!ctx) return null;
    // children are expected to be SelectItem (renders <option />)
    return (
        <div className={className}>
            <select
                value={ctx.value}
                onChange={(e) => ctx.onValueChange(e.target.value)}
                className="w-full border rounded p-2 bg-[hsl(var(--bg))] text-[hsl(var(--fg))]"
            >
                {children}
            </select>
        </div>
    );
};

export const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => {
    return <option value={value}>{children}</option>;
};
