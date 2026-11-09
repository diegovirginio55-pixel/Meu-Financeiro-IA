"use client";

import { useCallback, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_SESSION_KEY = "financeiro-pwa-install-dismissed-session";
const CHANGE_EVENT = "mf-pwa-install-change";

declare global {
  interface Window {
    __pwaDeferred?: BeforeInstallPromptEvent | null;
  }
}

// Tudo que depende do navegador (user-agent, display-mode, sessionStorage, evento de instalação)
// é lido via useSyncExternalStore: no servidor e na hidratação vale "nada disponível", e o cliente
// atualiza logo depois — sem diferença de HTML entre servidor e celular.

let installedByEvent = false;
let dismissedInMemory = false;

function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function isStandalone() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || ios;
}

function userAgent() {
  return navigator.userAgent || "";
}

function isIos() {
  const ua = userAgent();
  const device = /iphone|ipad|ipod/i.test(ua);
  const iPadOs = /Macintosh/.test(ua) && "ontouchend" in document;
  return device || iPadOs;
}

function isSafari() {
  const ua = userAgent();
  return /safari/i.test(ua) && !/chrome|crios|fxios|edgios/i.test(ua);
}

function isAndroidChrome() {
  const ua = userAgent();
  return /android/i.test(ua) && /chrome/i.test(ua) && !/edga|opr|samsungbrowser|firefox/i.test(ua);
}

function isDesktopChrome() {
  const ua = userAgent();
  return !/android|iphone|ipad|ipod/i.test(ua) && /chrome/i.test(ua) && !/edg|opr|firefox/i.test(ua);
}

function readDismissed() {
  try {
    return dismissedInMemory || sessionStorage.getItem(DISMISS_SESSION_KEY) === "1";
  } catch {
    return dismissedInMemory;
  }
}

function subscribe(callback: () => void) {
  const onBeforeInstall = (event: Event) => {
    event.preventDefault();
    window.__pwaDeferred = event as BeforeInstallPromptEvent;
    dismissedInMemory = false;
    try {
      sessionStorage.removeItem(DISMISS_SESSION_KEY);
    } catch {
      /* ignore */
    }
    callback();
  };
  const onInstalled = () => {
    installedByEvent = true;
    window.__pwaDeferred = null;
    callback();
  };
  const mq = window.matchMedia("(display-mode: standalone)");
  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("focus", callback);
  mq.addEventListener("change", callback);
  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    window.removeEventListener("appinstalled", onInstalled);
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("focus", callback);
    mq.removeEventListener("change", callback);
  };
}

const noopSubscribe = () => () => undefined;
const serverFalse = () => false;
const serverNull = () => null;

const getDeferred = () => window.__pwaDeferred ?? null;
const getInstalled = () => installedByEvent || isStandalone();

export function usePwaInstall() {
  const deferred = useSyncExternalStore(subscribe, getDeferred, serverNull);
  const installed = useSyncExternalStore(subscribe, getInstalled, serverFalse);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, serverFalse);
  const ios = useSyncExternalStore(noopSubscribe, isIos, serverFalse);
  const safari = useSyncExternalStore(noopSubscribe, isSafari, serverFalse);
  const androidChrome = useSyncExternalStore(noopSubscribe, isAndroidChrome, serverFalse);
  const desktopChrome = useSyncExternalStore(noopSubscribe, isDesktopChrome, serverFalse);

  const promptInstall = useCallback(async () => {
    const event = window.__pwaDeferred;
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") installedByEvent = true;
    window.__pwaDeferred = null;
    notifyChange();
  }, []);

  const dismiss = useCallback(() => {
    dismissedInMemory = true;
    try {
      sessionStorage.setItem(DISMISS_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    notifyChange();
  }, []);

  return {
    canInstall: deferred != null && !installed,
    isIos: ios && !installed,
    isIosSafari: ios && safari && !installed,
    isAndroidChrome: androidChrome && !installed,
    isDesktopChrome: desktopChrome && !installed,
    installed,
    dismissed,
    promptInstall,
    dismiss,
  };
}
