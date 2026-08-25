"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_SESSION_KEY = "financeiro-pwa-install-dismissed-session";

declare global {
  interface Window {
    __pwaDeferred?: BeforeInstallPromptEvent | null;
  }
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || ios;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const device = /iphone|ipad|ipod/i.test(ua);
  const iPadOs = /Macintosh/.test(ua) && "ontouchend" in document;
  return device || iPadOs;
}

function isSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /safari/i.test(ua) && !/chrome|crios|fxios|edgios/i.test(ua);
}

function isAndroidChrome() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /android/i.test(ua) && /chrome/i.test(ua) && !/edga|opr|samsungbrowser|firefox/i.test(ua);
}

function isDesktopChrome() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return !/android|iphone|ipad|ipod/i.test(ua) && /chrome/i.test(ua) && !/edg|opr|firefox/i.test(ua);
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (window.__pwaDeferred) setDeferred(window.__pwaDeferred);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      window.__pwaDeferred = promptEvent;
      setDeferred(promptEvent);
      setDismissed(false);
      try {
        sessionStorage.removeItem(DISMISS_SESSION_KEY);
      } catch {
        /* ignore */
      }
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      window.__pwaDeferred = null;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(isStandalone());
    mq.addEventListener("change", onDisplayChange);
    window.addEventListener("focus", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener("change", onDisplayChange);
      window.removeEventListener("focus", onDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
    window.__pwaDeferred = null;
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  return {
    canInstall: deferred != null && !installed,
    isIos: isIos() && !installed,
    isIosSafari: isIos() && isSafari() && !installed,
    isAndroidChrome: isAndroidChrome() && !installed,
    isDesktopChrome: isDesktopChrome() && !installed,
    installed,
    dismissed,
    promptInstall,
    dismiss,
  };
}
