"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./ui";

/** A button that opens its children in a popup. Escape, the close button or a click outside closes it. */
export function DialogButton({
  label,
  title,
  children,
  variant = "primary",
}: {
  label: string;
  title: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        aria-label={title}
        onMouseDown={(e) => e.target === e.currentTarget && close()}
        className="m-auto max-h-[92vh] w-[calc(100%-32px)] max-w-[760px] rounded-2xl bg-white p-0 text-black backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-full text-charcoal hover:bg-surface"
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
