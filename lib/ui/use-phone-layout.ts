"use client";

import { useEffect, useState } from "react";

function computeIsPhone() {
  const ua = navigator.userAgent;
  const mobileUA = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (mobileUA) return true;
  const narrowTouch =
    window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 768;
  return narrowTouch;
}

/** No computador (mouse/Chrome desktop) fica false, mesmo com a janela estreita. */
export function usePhoneLayout() {
  const [phone, setPhone] = useState(() =>
    typeof window === "undefined" ? false : computeIsPhone(),
  );

  useEffect(() => {
    const update = () => setPhone(computeIsPhone());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return phone;
}
