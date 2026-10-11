"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { getDesktopUrl } from "@/actions/desktop"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"

type DesktopPanelContextValue = {
  open: boolean
  toggle: () => void
  url: string | null
  setPanelSlot: (el: HTMLElement | null) => void
  openFullscreen: () => void
}

const DesktopPanelContext = createContext<DesktopPanelContextValue | null>(
  null
)

// Owns the desktop panel's state and the single VNC iframe, which is shared by
// the panel and the fullscreen dialog. Moving an iframe in the DOM reloads it,
// so it lives in one fixed place and is laid over whichever slot is showing.
export function DesktopPanelProvider({
  chatId,
  children,
}: {
  chatId: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null)
  const [dialogSlot, setDialogSlot] = useState<HTMLElement | null>(null)
  const loading = useRef(false)
  const frame = useRef<HTMLDivElement>(null)

  async function loadDesktop() {
    if (url || loading.current) return
    loading.current = true
    try {
      setUrl(await getDesktopUrl(chatId))
    } catch (error) {
      toast.add({
        title:
          error instanceof Error ? error.message : "Couldn't start the desktop.",
        type: "error",
      })
    } finally {
      loading.current = false
    }
  }

  function toggle() {
    if (!open) loadDesktop()
    setOpen(!open)
  }

  // Keeps the iframe over the active slot, following resizes and animations.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const target = fullscreen ? dialogSlot : panelSlot
    if (!target) {
      el.style.visibility = "hidden"
      return
    }
    el.style.visibility = "visible"
    let raf = 0
    const sync = () => {
      const { top, left, width, height } = target.getBoundingClientRect()
      el.style.top = `${top}px`
      el.style.left = `${left}px`
      el.style.width = `${width}px`
      el.style.height = `${height}px`
      raf = requestAnimationFrame(sync)
    }
    sync()
    return () => cancelAnimationFrame(raf)
  }, [url, fullscreen, panelSlot, dialogSlot])

  return (
    <DesktopPanelContext.Provider
      value={{
        open,
        toggle,
        url,
        setPanelSlot,
        openFullscreen: () => setFullscreen(true),
      }}
    >
      {children}

      {url &&
        createPortal(
          <div
            ref={frame}
            className={
              fullscreen
                ? "fixed z-60"
                : "pointer-events-none fixed z-40"
            }
            style={{ visibility: "hidden" }}
          >
            <iframe src={url} title="Desktop" className="size-full" />
          </div>,
          document.body
        )}

      <Dialog
        open={fullscreen}
        // Only the close button closes it, so keys and clicks meant for the
        // desktop never do. Non-modal so the iframe, which sits outside the
        // popup, keeps focus and input.
        onOpenChange={(next, { reason }) => {
          if (!next && reason === "close-press") setFullscreen(false)
        }}
        modal={false}
        disablePointerDismissal
      >
        <DialogContent className="top-0 left-0 flex h-svh w-screen max-w-none translate-0 flex-col gap-0 rounded-none p-0 sm:max-w-none">
          <DialogHeader className="h-12 shrink-0 justify-center border-b px-4">
            <DialogTitle>Desktop</DialogTitle>
          </DialogHeader>
          <div ref={setDialogSlot} className="min-h-0 flex-1" />
        </DialogContent>
      </Dialog>
    </DesktopPanelContext.Provider>
  )
}

export function useDesktopPanel() {
  const context = useContext(DesktopPanelContext)
  if (!context) {
    throw new Error("useDesktopPanel must be used within DesktopPanelProvider.")
  }
  return context
}

export function DesktopPanel() {
  const { open, url, setPanelSlot, openFullscreen } = useDesktopPanel()
  if (!open) return null

  return (
    <>
      <ResizableHandle />
      <ResizablePanel
        id="desktop"
        defaultSize="50%"
        minSize="20%"
        className="h-full bg-muted"
      >
        {/* Matches the desktop's 1024x768 resolution, so noVNC fills it
            instead of centering it in spare space. */}
        <button
          ref={setPanelSlot}
          type="button"
          aria-label="Open desktop fullscreen"
          disabled={!url}
          onClick={openFullscreen}
          className="flex aspect-4/3 w-full cursor-zoom-in items-center justify-center gap-2 text-sm text-muted-foreground disabled:cursor-default"
        >
          {!url && (
            <>
              <Spinner />
              Starting desktop…
            </>
          )}
        </button>
      </ResizablePanel>
    </>
  )
}
