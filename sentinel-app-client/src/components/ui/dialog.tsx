import React, { createContext, useContext, useRef, useEffect } from "react";

type DialogContextType = { open: boolean; onOpenChange?: (open: boolean) => void } | null;
const DialogContext = createContext<DialogContextType>(null);

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode }) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

export function DialogContent({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  const ctx = useContext(DialogContext);
  if (!ctx || !ctx.open) return null;


  const isOpen = ctx.open;
  const onOpenChange = ctx.onOpenChange;

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !onOpenChange) return;
    function handleDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onOpenChange!(false);
      }
    }
    // listen for click (bubbles after target handlers) so clicking a log item won't cause a reopen race
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, [isOpen, onOpenChange]);

  return (
    <div className="flex-1 my-4">
      {}
      <div
        ref={panelRef}
        className={`mx-0 p-4 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] rounded h-full ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div className="mb-2">{children}</div>;
export const DialogTitle = ({ children, id }: { children?: React.ReactNode; id?: string }) => (
  <h3 id={id} className="text-lg font-bold">
    {children}
  </h3>
);
