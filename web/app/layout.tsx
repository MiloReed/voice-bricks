import type { Metadata, Viewport } from "next";
import { TtsErrorToast } from "@/components/ui/tts-error-toast";
import { TestBotRunner } from "@/components/room/test-bot-runner";
import { PartySoundControls } from "@/components/ui/party-sound-controls";
import "./globals.css";
import "@/styles/party.css";

export const metadata: Metadata = {
  title: { default: "Voice Bricks｜声音积木", template: "%s · Voice Bricks" },
  description: "和朋友一起，把每句话变成一块会说话的声音积木。",
};

export const viewport: Viewport = { themeColor: "#faf8f4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="zh-CN" data-scroll-behavior="smooth"><body>{children}<TtsErrorToast /><PartySoundControls />{process.env.NODE_ENV === "development" && <TestBotRunner />}</body></html>;
}
