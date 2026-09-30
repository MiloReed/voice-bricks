"use client";

import { useEffect, useState } from "react";

export function NetworkNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return offline ? <p className="network-notice" role="status">网络断开了，先别关页面。草稿留在这台设备，恢复联网后会重新同步房间。</p> : null;
}
