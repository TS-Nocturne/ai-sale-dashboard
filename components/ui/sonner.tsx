"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Shadcn-style toast surface backed by `sonner`.
 *
 * Mounted once in the root layout; trigger toasts anywhere on the client with
 * `import { toast } from "sonner"`. We read the theme from the `<html>` class
 * instead of `next-themes` (this project does not use a theme provider).
 */
function Toaster(props: ToasterProps) {
    return (
        <Sonner
            className="toaster group"
            position="top-right"
            richColors
            closeButton
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
                    description: "group-[.toast]:text-muted-foreground",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
