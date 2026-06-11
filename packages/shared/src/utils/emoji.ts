/**
 * 将文本中的表情字符串（如 [啊]）替换为 moe 表情图片的 HTML img 标签。
 * @param text 包含表情字符串的原始文本
 * @returns 替换后的文本
 */
export function replaceEmojiStrings(text: string): string {
  if (!text)
    return ''

  // 表情字符串到拼音文件名的映射表
  const pinyinMap: Record<string, string> = {
    '[啊]': 'a',
    '[闭嘴]': 'bizui',
    '[白眼]': 'baiyan',
    '[爱心]': 'aixin',
    '[爱你]': 'aini',
    '[奋斗]': 'fendou',
    '[鼻涕]': 'biti',
    '[哼]': 'heng',
    '[呼气]': 'huqi',
    '[瞌睡]': 'keshui',
    '[睡醒]': 'shuixing',
    '[骷髅]': 'kulou',
    '[冷]': 'leng',
    '[大惊]': 'dajing',
    '[呲牙]': 'ciya',
    '[大小]': 'daxiao',
    '[饿死]': 'esi',
    '[发呆]': 'fadai',
    '[犯困]': 'fankun',
    '[尴尬]': 'ganga',
    '[愤怒]': 'fennu',
    '[汗颜]': 'hanyan',
    '[惊恐]': 'jingkong',
    '[好吃]': 'haochi',
    '[恶魔]': 'emo',
    '[惊悚]': 'jingsong',
    '[惊讶]': 'jingya',
    '[开心]': 'kaixin',
    '[冷酷]': 'lengku',
    '[大闹]': 'danao',
    '[流口水]': 'liukoushui',
    '[流泪]': 'liulei',
    '[面无表情]': 'mengbi',
    '[难过]': 'nanguo',
    '[睡着]': 'shuizhao',
    '[讨厌]': 'taoyan',
    '[贪吃]': 'tanchi',
    '[死了]': 'sile',
    '[调皮]': 'tiaopi',
    '[笑出泪]': 'xiaochulei',
    '[无聊]': 'wuliao',
    '[星星眼]': 'xingxingyan',
    '[斜眼]': 'xieyan',
    '[吓死]': 'xiasi',
    '[酷]': 'ku',
    '[生气]': 'shengqi',
    '[又死了]': 'yousile',
    '[恩]': 'en',
    '[不舒服]': 'bushufu',
    '[便便]': 'bianbian',
    '[飞吻]': 'feiwen',
    '[感冒]': 'ganmao',
    '[坏笑]': 'huaixiao',
    '[流汗]': 'liuhan',
    '[呕吐]': 'outu',
    '[忍者]': 'renzhe',
    '[无语]': 'wuyu',
    '[怪物]': 'guaiwu',
    '[受伤]': 'shoushang',
    '[衰]': 'shuai',
    '[笑掉大牙]': 'xiaodiaodaya',
    '[凶]': 'xiong',
    '[疑问]': 'yiwen',
    '[晕]': 'yun',
    '[流鼻血]': 'liubixie',
    '[什么]': 'shenme',
    '[点赞]': 'zan',
    '[心]': 'xin',
    '[心碎]': 'xinsui',
    '[炸弹]': 'zhadan',
    '[骂人]': 'maren',
    '[猪头]': 'zhutou',
    '[企鹅]': 'qier',
    '[幽灵]': 'youlin',
    // 以下没有对应的 moe 图片，保留为 emoji 字符
    '[扫雷]': '💣',
    '[舒尔特方格]': '🧩',
    '[数字华容道]': '🔢',
    '[2048]': '🎮',
    '[数独]': '✏️',
    '[数织]': '🧵',
    '[雷币]': '🪙',
    '[扫雷空]': '⬜',
    '[扫雷默认]': '🟦',
    '[扫雷2]': '2️⃣',
    '[扫雷1]': '1️⃣',
    '[扫雷3]': '3️⃣',
    '[扫雷4]': '4️⃣',
    '[扫雷5]': '5️⃣',
    '[扫雷6]': '6️⃣',
    '[扫雷7]': '7️⃣',
    '[扫雷8]': '8️⃣',
    '[扫雷雷]': '💣',
    '[扫雷开雷]': '💥',
    '[扫雷标记]': '🚩',
    '[扫雷爆炸]': '💥',
    '[扫雷问号]': '❓',
  }

  // pinyin 值只包含小写字母，emoji 回退值包含非字母字符
  const isPinyin = (v: string) => /^[a-z]+$/.test(v)

  // 使用正则表达式匹配所有 [xxx] 格式的字符串，并替换为对应表情
  return text.replace(/\[[^\]]+\]/g, (match) => {
    const value = pinyinMap[match]
    if (!value)
      return match
    // 有对应 moe 图片的（值为拼音），输出 img 标签；否则输出 emoji 字符
    if (isPinyin(value)) {
      return `<img src="./icons/moe/moe_${value}.webp" alt="${match}" style="width:1.25em;height:1.25em;vertical-align:text-bottom">`
    }
    return value
  })
}
