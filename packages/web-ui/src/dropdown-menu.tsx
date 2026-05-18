import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type DropdownCtx = { close: () => void };

const Ctx = createContext<DropdownCtx | null>(null);

export type DropdownMenuProps = {
  trigger: ReactNode;
  /** Panel alignment relative to trigger */
  align?: "start" | "end";
  /** Accessible label for the menu button */
  ariaLabel?: string;
  children: ReactNode;
};

export function DropdownMenu({
  trigger,
  align = "end",
  ariaLabel = "Menu",
  children,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <Ctx.Provider value={{ close }}>
      <div className="web-dropdown" ref={rootRef}>
        <button
          type="button"
          className="web-dropdown-trigger"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
        >
          {trigger}
        </button>
        {open ? (
          <div
            className={`web-dropdown-panel web-dropdown-panel--${align}`}
            role="menu"
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
          >
            {children}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}

export type DropdownMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function DropdownMenuItem({ children, onClick, className, ...rest }: DropdownMenuItemProps) {
  const ctx = useContext(Ctx);
  return (
    <button
      type="button"
      role="menuitem"
      className={["web-dropdown-item", className].filter(Boolean).join(" ")}
      onClick={(e) => {
        onClick?.(e);
        ctx?.close();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="web-dropdown-sep" role="separator" aria-hidden />;
}
