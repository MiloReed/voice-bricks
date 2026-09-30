"use client";

import { Lightning, Waveform } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type GameCountdownProps = {
  count: number;
  variant: "chaos" | "reveal";
  eyebrow: string;
  caption: string;
};

export function GameCountdown({ count, variant, eyebrow, caption }: GameCountdownProps) {
  const reduceMotion = useReducedMotion();
  const safeCount = Math.max(1, Math.min(3, count));
  const Icon = variant === "chaos" ? Lightning : Waveform;

  return (
    <section className="game-countdown" data-variant={variant}>
      <span className="sr-only" aria-live="assertive">倒计时 {safeCount}</span>
      <div className="countdown-kicker">
        <span className="countdown-emblem" aria-hidden="true"><Icon weight={variant === "chaos" ? "fill" : "bold"} /></span>
        <small>{eyebrow}</small>
      </div>
      <motion.div
        className="countdown-brick"
        initial={reduceMotion ? false : { y: 3, scale: 0.985 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.23, 1, 0.32, 1] }}
        aria-hidden="true"
      >
        <span className="countdown-studs" aria-hidden="true"><i /><i /><i /></span>
        <span className="countdown-face">
          <span className="countdown-number-window">
            <AnimatePresence mode="sync" initial={false}>
              <motion.strong
                key={safeCount}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 34, scale: reduceMotion ? 1 : 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -30, scale: reduceMotion ? 1 : 1.015 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                {safeCount}
              </motion.strong>
            </AnimatePresence>
          </span>
        </span>
        <span className="countdown-lip" aria-hidden="true" />
      </motion.div>
      <div className="countdown-progress" aria-hidden="true">
        {[3, 2, 1].map((step) => <span key={step} data-active={step === safeCount || undefined} data-passed={step > safeCount || undefined}>0{step}</span>)}
      </div>
      <p>{caption}</p>
    </section>
  );
}
