import nextEnv from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generateVuiAudio } from "../lib/tts/vui.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
nextEnv.loadEnvConfig(root, true);
const key = process.env.VUILABS_API_KEY?.trim();
const voiceId = "jingcheng";
const missing = [!key && "VUILABS_API_KEY"].filter(Boolean);

if (missing.length) {
  console.error(`请先在 web/.env.local 填写：${missing.join("、")}。未发送 API 请求。`);
  process.exitCode = 1;
} else {
  try {
    const started = Date.now();
    const bytes = await generateVuiAudio({
      text: "欢迎来到声音积木，叫上朋友，一起把脑洞念出声。",
      key, voiceId, baseUrl: process.env.VUILABS_API_BASE_URL,
      signal: AbortSignal.timeout(45000),
    });
    const output = new URL("../../output/audio/vui-party-connection-test.wav", import.meta.url);
    await mkdir(new URL("./", output), { recursive: true });
    await writeFile(output, new Uint8Array(bytes));
    console.log(`VUI 请求成功，WAV ${bytes.byteLength} 字节，耗时 ${Date.now() - started} ms。`);
    console.log(`音频：${fileURLToPath(output)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "VUI 连接测试失败。");
    process.exitCode = 1;
  }
}
