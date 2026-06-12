/**
 * Chat layout: pin height to the viewport area below the dashboard header so
 * the message list scrolls inside the card instead of the whole page.
 */
export default function AssistantLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-[calc(100dvh-3.5rem-var(--mobile-nav-height,0px)-env(safe-area-inset-bottom,0px)-3rem)] min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-3.5rem-3rem)]">
            {children}
        </div>
    )
}
