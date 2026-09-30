// Traits follow https://doc.vuilabs.cn/api-reference/system-voice/.
// Stable game IDs preserve saved rooms; VUI IDs are shared by UI and generation.
export const voiceOptions = [
  { id: "warm", vuiId: "jingcheng", sourceName: "播客景澄", name: "温和男声", note: "温和稳重 · 亲切叙述", sample: "各位晚上好，冰箱刚刚宣布，夜宵需要竞聘上岗。" },
  { id: "bright", vuiId: "qingyan", sourceName: "清妍", name: "明亮女声", note: "明亮清晰 · 有感染力", sample: "好消息，今天全员放假！坏消息，这是老板的梦话。" },
  { id: "deep", vuiId: "jingyuan", sourceName: "靖哥说书", name: "慵懒磁性", note: "磁性男声 · 霸总气质", sample: "这家公司的命运，由我决定。先问问食堂今天吃什么。" },
  { id: "cheerful", vuiId: "nianan", sourceName: "念安FM", name: "清新女声", note: "清新活泼 · 轻快接梗", sample: "恭喜你获得今日幸运大奖，帮全群取一下外卖！" },
  { id: "dramatic", vuiId: "linhao", sourceName: "霖浩", name: "热血解说", note: "激情解说 · 小事大播报", sample: "最后三秒！他冲向了冰箱！漂亮，抢到了最后一块蛋糕！" },
  { id: "playful", vuiId: "wukong", sourceName: "孙悟空", name: "孙悟空", note: "桀骜灵动 · 猴王角色", sample: "俺老孙一个筋斗十万八千里，还是没赶上早高峰！" },
  { id: "bajie", vuiId: "bajie", sourceName: "猪八戒", name: "猪八戒", note: "憨厚喜感 · 贪吃搭子", sample: "师父，妖怪可以明天再打，这顿自助可不能白交钱啊。" },
  { id: "linzi", vuiId: "linzi", sourceName: "东北琳子", name: "东北老妹", note: "东北风味 · 直爽逗趣", sample: "你可拉倒吧，说好出来散步，咋又走到烧烤摊了呢？" },
] as const;

// Retired from the picker, but existing rooms and works must still resolve.
export const legacyVoiceOptions = [
  { id: "cinema", vuiId: "yuheng", sourceName: "予衡", name: "成熟男声", note: "成熟有质感 · 中年男声", sample: "他拯救了世界，却没抢到优惠券。" },
  { id: "story", vuiId: "jinyu", sourceName: "有声的瑾瑜", name: "温柔叙事", note: "温柔成熟 · 富有表现力", sample: "后来，他成了传说中的已读不回。" },
  { id: "crisp", vuiId: "lixing", sourceName: "有声的砺行", name: "温润男声", note: "清晰温润 · 中年男声", sample: "收到。理解。下次还敢。" },
  { id: "calm", vuiId: "bochen", sourceName: "柏辰", name: "温柔男声", note: "温柔男友 · 亲近语气", sample: "别焦虑，事情还能更离谱一点。" },
  { id: "radio", vuiId: "bochuan", sourceName: "柏川FM", name: "开朗男声", note: "成熟开朗 · 青年男声", sample: "紧急通知：今晚的自律已取消。" },
  { id: "documentary", vuiId: "linning", sourceName: "霖宁", name: "激情解说", note: "专业解说 · 富有激情", sample: "这只打工人，正在假装网不好。" },
] as const;

export const allVoiceOptions = [...voiceOptions, ...legacyVoiceOptions];
