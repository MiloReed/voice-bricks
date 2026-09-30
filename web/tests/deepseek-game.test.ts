import assert from "node:assert/strict";
import { test } from "node:test";
import { completeDeepSeek } from "../lib/ai/deepseek.ts";
import { generateSoloReply, parseSoloStory } from "../lib/ai/solo-reply.ts";
import { partyThemes, pickPartyTheme } from "../lib/game/party-content.ts";
import { estimateDuration } from "../lib/audio/speech.ts";

const options = { key: "test-key" };
const reply = (text: string) => Response.json({ choices: [{ message: { content: JSON.stringify({ text }) }, finish_reason: "stop" }] });

test("accepts natural short replies and the observed provider wrapper without retrying", async () => {
  const story = { theme: "不限主题", blocks: ["国王叫我今天找他一下"] };
  for (const [content, expected] of [
    ['{"text":"我这就去见国王，"}</parameter>', "我这就去见国王，"],
    ['```json\n{"text":"国王递来一张请帖，"}\n```', "国王递来一张请帖，"],
    ['{"text":"我走进了王宫"}', "我走进了王宫"],
  ]) {
    let calls = 0;
    const text = await generateSoloReply(story, options, async () => {
      calls++;
      return Response.json({ choices: [{ message: { content }, finish_reason: "stop" }] });
    });
    assert.equal(text, expected);
    assert.equal(calls, 1);
  }
});

test("uses room saved by earlier short replies without exceeding the final story budget", async () => {
  const story = { theme: "不限主题", blocks: ["国王叫我今天找他一下", "我进宫了"] };
  assert.equal(await generateSoloReply(story, options, async () => reply("国王却请我帮他洗一堆碗。")), "国王却请我帮他洗一堆碗。");
  const crowded = { theme: "不限主题", blocks: Array.from({ length: 5 }, (_, index) => `${index}${"字".repeat(11)}`) };
  let calls = 0;
  const text = await generateSoloReply(crowded, options, async () => {
    calls++;
    return reply(calls === 1 ? "国王递来一张请帖，" : "王冠掉了。");
  });
  assert.equal(text, "王冠掉了。");
  assert.equal(calls, 2);
  assert.ok(crowded.blocks.join("").length + text.length <= 65);
});

test("every prior theme is excluded from the next entry or shuffle", () => {
  for (const previous of partyThemes) {
    for (const random of [0, 0.5, 0.999999]) {
      const theme = pickPartyTheme(previous, () => random);
      assert.ok(partyThemes.includes(theme));
      assert.notEqual(theme, previous);
    }
  }
});

test("rejects malformed stories and human turns before calling the model", () => {
  for (const body of [null, [], { theme: "", blocks: ["你好"] }, { theme: "主题", blocks: [] }, { theme: "主题", blocks: ["一", "二", "三"] }, { theme: "主题", blocks: [1] }, { theme: "主题", blocks: ["字".repeat(13)] }]) assert.equal(parseSoloStory(body), null);
  for (const theme of partyThemes) assert.ok(parseSoloStory({ theme, blocks: ["国王叫我今天找他一下"] }));
});

test("sends the entire story, derives each bot's role, and closes only the final turn", async () => {
  const story = { theme: "外星人入侵，先排队领优惠券", blocks: ["国王叫我今天找他一下", "国王递来一张请帖，", "他说今晚由我买单。", "我问能用王冠抵吗"] };
  const transport: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-key");
    const body = JSON.parse(init?.body as string);
    assert.equal(body.model, "deepseek-flash");
    assert.equal(body.thinking.type, "disabled");
    assert.equal(body.response_format.type, "json_object");
    assert.deepEqual(JSON.parse(body.messages[1].content).story.map((block: { text: string }) => block.text), story.blocks);
    assert.match(body.messages[0].content, /接梗鹅/);
    assert.match(body.messages[0].content, /玩家的开头比主题优先/);
    assert.doesNotMatch(body.messages[0].content, /这是最后一句/);
    return reply("加冕仪式变成饭局。");
  };
  assert.equal(await generateSoloReply(story, options, transport), "加冕仪式变成饭局。");
  await generateSoloReply({ ...story, blocks: [...story.blocks, "加冕仪式变成饭局。"] }, options, async (_url, init) => {
    const body = JSON.parse(init?.body as string);
    assert.match(body.messages[0].content, /反转猫/);
    assert.match(body.messages[0].content, /这是最后一句/);
    return reply("最后王冠拿去抵账。");
  });
});

test("corrects invalid output once without truncating or inserting canned text", async () => {
  let calls = 0;
  const story = { theme: "不限主题", blocks: ["国王叫我今天找他一下"] };
  assert.equal(await generateSoloReply(story, options, async (_url, init) => {
    calls++;
    if (calls === 1) return reply("这句话太长了不能直接截掉啊");
    const body = JSON.parse(init?.body as string);
    assert.equal(body.messages.length, 4);
    assert.match(body.messages[3].content, /重新续写/);
    return reply("国王递来一张请帖，");
  }), "国王递来一张请帖，");
  assert.equal(calls, 2);
  for (const text of ["短句", "国王叫我今天找他一下", "[laugh]哈哈哈", "[国王递来一张请帖]", "去死去死去死去死。", "国王递来一张请帖😂"]) {
    await assert.rejects(generateSoloReply(story, options, async () => reply(text)), /这句没接好/);
  }
  await assert.rejects(generateSoloReply(story, options, async () => Response.json({ choices: [{ message: { content: "not-json" }, finish_reason: "stop" }] })), /这句没接好/);
});

test("missing keys, provider failures and empty or incomplete results never advance the story", async () => {
  await assert.rejects(completeDeepSeek({ key: " " }, [], false, async () => { throw new Error("must not fetch"); }), /DEEPSEEK_API_KEY/);
  for (const [status, message] of [[401, /密钥无效/], [402, /余额不足/], [429, /请求较多/], [500, /暂时无法回应/]] as const) {
    await assert.rejects(completeDeepSeek(options, [], false, async () => new Response("private provider detail", { status })), message);
  }
  for (const [content, finish_reason] of [["", "stop"], ["部分句子", "length"]]) {
    await assert.rejects(completeDeepSeek(options, [], false, async () => Response.json({ choices: [{ message: { content }, finish_reason }] })), /完整句子/);
  }
});

test("short AI bricks preserve the six-brick estimated playback budget", () => {
  const lines = ["国王递来一张请帖，", "他说今晚由我买单。", "加冕仪式变成饭局。", "最后王冠拿去抵账。"];
  const duration = lines.reduce((sum, text) => sum + estimateDuration(text), 0);
  assert.ok(2 * estimateDuration("啊") + duration >= 10);
  assert.ok(2 * estimateDuration("字".repeat(12)) + duration <= 15);
});
