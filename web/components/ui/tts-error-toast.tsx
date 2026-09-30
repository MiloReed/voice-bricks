"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { TTS_DEVICE_VOICE_EVENT, TTS_ERROR_EVENT } from "@/lib/audio/speech";

export function TtsErrorToast() {
  const [visible, setVisible] = useState(false);
  const [deviceVoice, setDeviceVoice] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const show = (event: Event) => {
      window.clearTimeout(timer);
      setDeviceVoice(event.type === TTS_DEVICE_VOICE_EVENT);
      setVisible(true);
      timer = window.setTimeout(() => setVisible(false), 3200);
    };
    window.addEventListener(TTS_ERROR_EVENT, show);
    window.addEventListener(TTS_DEVICE_VOICE_EVENT, show);
    return () => {
      window.removeEventListener(TTS_ERROR_EVENT, show);
      window.removeEventListener(TTS_DEVICE_VOICE_EVENT, show);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="tts-error-toast" role={deviceVoice ? "status" : "alert"} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}>
          <WarningCircle weight="fill" />
          <span><strong>{deviceVoice ? "本次使用设备朗读" : "暂时无法播放"}</strong><small>{deviceVoice ? "游戏音色暂不可用，单人体验可以继续。" : "请稍后重试；文字和进度仍会保留。"}</small></span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
