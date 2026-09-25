"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/admin/server";
import { cn } from "@/lib/utils";
import { btn } from "./styles";

// ───────────────────────── action runner (toasts) ─────────────────────────
type RunOpts<T> = {
  loading?: string;
  success?: string;
  onSuccess?: (data: T) => void;
  onError?: (error: string, fieldErrors?: Record<string, string>) => void;
};

/** Runs a Server Action inside a transition with a loading → success/error toast. */
export function useActionRunner() {
  const [pending, start] = useTransition();
  const run = useCallback(<T,>(fn: () => Promise<ActionResult<T>>, opts: RunOpts<T> = {}) => {
    const id = toast.loading(opts.loading ?? "Saglabā…");
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          toast.success(res.message ?? opts.success ?? "Saglabāts", { id });
          opts.onSuccess?.(res.data);
        } else {
          toast.error(res.error, { id });
          opts.onError?.(res.error, res.fieldErrors);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Radās kļūda";
        toast.error(msg, { id });
        opts.onError?.(msg);
      }
    });
  }, []);
  return { run, pending };
}

// ───────────────────────── modal / drawer base ─────────────────────────
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

const noopSubscribe = () => () => {};
/** true after hydration (safe replacement for a "mounted" effect). */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useIsClient();
  return mounted ? createPortal(children, document.body) : null;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  useEscape(open, onClose);
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-2xl",
                size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl",
              )}
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  <h2 id={titleId} className="text-base font-bold text-ink">
                    {title}
                  </h2>
                  {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-1 grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
                  aria-label="Aizvērt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
              {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-slate-50/60 px-5 py-3">{footer}</div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  useEscape(open, onClose);
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70]">
            <motion.div
              className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={reduce ? { opacity: 0 } : { x: "100%" }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className={cn("absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-lift", width)}
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <h2 id={titleId} className="truncate text-base font-bold text-ink">
                    {title}
                  </h2>
                  {description && <div className="mt-0.5 text-[13px] text-muted">{description}</div>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
                  aria-label="Aizvērt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
              {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-slate-50/60 px-5 py-3">{footer}</div>}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

// ───────────────────────── confirm dialog ─────────────────────────
type ConfirmOpts = { title: string; description?: React.ReactNode; confirmLabel?: string; danger?: boolean };
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { open: boolean }) | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback<ConfirmFn>((opts) => {
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState((s) => (s ? { ...s, open: false } : s));
  }, []);
  const onClose = useCallback(() => close(false), [close]);
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state?.open)}
        onClose={onClose}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            {state?.danger && (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
            )}
            {state?.title}
          </span>
        }
        description={state?.description}
        footer={
          <>
            <button type="button" className={btn("outline")} onClick={() => close(false)} autoFocus>
              Atcelt
            </button>
            <button type="button" className={btn(state?.danger ? "danger" : "dark")} onClick={() => close(true)}>
              {state?.confirmLabel ?? "Apstiprināt"}
            </button>
          </>
        }
      />
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx);
  return ctx ?? (async (o) => window.confirm(o.title));
}

// ───────────────────────── small controls ─────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />;
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy-200 disabled:opacity-50",
        size === "sm" ? "h-5 w-9" : "h-6 w-11",
        checked ? "bg-emerald-500" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow transition-transform",
          size === "sm" ? "h-4 w-4" : "h-5 w-5",
          checked ? (size === "sm" ? "translate-x-[18px]" : "translate-x-[22px]") : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  aside,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink/80">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="mt-1 text-[12px] font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

