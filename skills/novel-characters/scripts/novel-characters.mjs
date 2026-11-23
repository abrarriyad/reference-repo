#!/usr/bin/env node
// novel-characters — deterministic helpers for the novel-characters skill.
// Zero dependencies on purpose: the skill must work in any directory
// without an npm install. Node 18+ (stdlib only).

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* chunk                                                               */
/* ------------------------------------------------------------------ */

// Chunk-size trade-off: the bigger the chunk, the heavier a single read; the smaller the chunk,
// the more chunks, and the more seams for cross-chunk merging (the hardest semantic step in the
// pipeline). Current models read 40k characters with no trouble, so lean large — three times fewer
// seams means three times fewer missed merges.
// Capped at 24 chunks; after 23 overlaps that is a net coverage of about 930k characters.
export const CHUNK_SIZE = 40_000;
export const CHUNK_OVERLAP = 1_200;
export const MAX_CHUNKS = 24;

/**
 * Split source text on paragraph boundaries into overlapping chunks.
 * Overlap keeps a character introduced at a chunk seam visible to both sides.
 */
export function chunkText(text) {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks = [];
  let cursor = 0;

  while (cursor < clean.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(cursor + CHUNK_SIZE, clean.length);

    if (end < clean.length) {
      // Prefer a paragraph break, then a sentence end, inside the last 20%.
      const windowStart = cursor + Math.floor(CHUNK_SIZE * 0.8);
      const window = clean.slice(windowStart, end);
      const para = window.lastIndexOf('\n\n');
      const sentence = Math.max(
        window.lastIndexOf('。'),
        window.lastIndexOf('！'),
        window.lastIndexOf('？'),
        window.lastIndexOf('. '),
      );
      const offset = para >= 0 ? para : sentence;
      if (offset >= 0) end = windowStart + offset + 1;
    }

    chunks.push(clean.slice(cursor, end).trim());
    if (end >= clean.length) break;
    cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
  }

  return chunks;
}

/* ------------------------------------------------------------------ */
/* merge                                                               */
/* ------------------------------------------------------------------ */

/**
 * Merge per-chunk rosters into one cast, keyed by name AND alias so that
 * 陆行远 / 陆 / 姑娘 collapse onto the same person regardless of which
 * chunk saw which form first.
 */
export function mergeRoster(batches) {
  const byKey = new Map();
  const keyOf = (s) => String(s).trim().toLowerCase();

  for (const batch of batches) {
    for (const entry of batch ?? []) {
      if (!entry?.name) continue;
      const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
      const candidates = [entry.name, ...aliases].map(keyOf).filter(Boolean);
      const existingKey = candidates.find((c) => byKey.has(c));
      const target = existingKey
        ? byKey.get(existingKey)
        : { name: String(entry.name).trim(), aliases: [], notes: [], quotes: [] };

      for (const alias of [entry.name, ...aliases]) {
        const trimmed = String(alias).trim();
        if (trimmed && trimmed !== target.name && !target.aliases.includes(trimmed)) {
          target.aliases.push(trimmed);
        }
      }
      if (entry.note && String(entry.note).trim()) target.notes.push(String(entry.note).trim());
      for (const quote of entry.quotes ?? []) {
        const trimmed = String(quote).trim();
        if (trimmed && !target.quotes.includes(trimmed)) target.quotes.push(trimmed);
      }

      for (const c of candidates) byKey.set(c, target);
    }
  }

  // Collapse the alias-keyed index back to one entry per character.
  const unique = new Map();
  for (const value of byKey.values()) unique.set(keyOf(value.name), value);
  // More chunks mentioning a character == more screen time.
  return [...unique.values()].sort((a, b) => b.notes.length - a.notes.length);
}

/**
 * Suspected same-person candidates. Cross-chunk identity resolution is a semantic problem, and
 * deterministic code can only do the cheap half: name containment (「陆」⊂「陆行远」) is a strong
 * merge signal that exact matching cannot converge — unless some chunk happens to list 「陆」 as an
 * alias of 「陆行远」. Whether 「陆先生」 and 「行远」 are the same person cannot even be detected by
 * containment, so candidates are only a suspect list and the judgement is left to the model; the
 * reviewed result is written to merges.json and applied deterministically with --apply.
 */
export function mergeCandidates(cast) {
  const keysOf = (c) => [c.name, ...(c.aliases ?? [])].map((s) => String(s).trim()).filter(Boolean);
  const candidates = [];
  for (let i = 0; i < cast.length; i++) {
    for (let j = i + 1; j < cast.length; j++) {
      let reason = null;
      for (const a of keysOf(cast[i])) {
        for (const b of keysOf(cast[j])) {
          const [short, long] = a.length <= b.length ? [a, b] : [b, a];
          if (short.toLowerCase() === long.toLowerCase()) continue; // equal keys are already converged by mergeRoster
          // For Latin script the short side needs at least 3 characters, or noise like 「Al」⊂「Alex」 overwhelms; a single CJK character already carries information
          const min = CJK.test(short) ? 1 : 3;
          if (short.length >= min && long.toLowerCase().includes(short.toLowerCase())) {
            reason = `「${short}」⊂「${long}」`;
            break;
          }
        }
        if (reason) break;
      }
      if (reason) candidates.push({ a: cast[i].name, b: cast[j].name, reason });
    }
  }
  return candidates;
}

/**
 * Apply the merge decisions the model has reviewed. merges: [{ keep, absorb: [...] }],
 * where keep / absorb may locate by name or any alias. If anything cannot be found, fail outright —
 * skipping silently would let the caller believe the merge succeeded.
 * Does not mutate the incoming cast: everything runs on copies, so the input stays usable after a throw.
 */
export function applyMerges(cast, merges) {
  cast = cast.map((c) => ({ ...c, aliases: [...c.aliases], notes: [...c.notes], quotes: [...c.quotes] }));
  const keyOf = (s) => String(s).trim().toLowerCase();
  const index = new Map();
  for (const c of cast) for (const k of [c.name, ...c.aliases]) index.set(keyOf(k), c);

  const removed = new Set();
  const problems = [];
  for (const m of merges ?? []) {
    const target = index.get(keyOf(m?.keep ?? ''));
    if (!target) {
      problems.push(`keep「${m?.keep}」not found in the merge result`);
      continue;
    }
    for (const name of m?.absorb ?? []) {
      const victim = index.get(keyOf(name));
      if (!victim) {
        problems.push(`absorb「${name}」not found in the merge result`);
        continue;
      }
      if (victim === target) continue; // already the same person, not an error
      for (const alias of [victim.name, ...victim.aliases]) {
        if (alias !== target.name && !target.aliases.includes(alias)) target.aliases.push(alias);
      }
      target.notes.push(...victim.notes);
      for (const q of victim.quotes) if (!target.quotes.includes(q)) target.quotes.push(q);
      for (const k of [victim.name, ...victim.aliases]) index.set(keyOf(k), target);
      removed.add(victim);
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));
  return cast.filter((c) => !removed.has(c)).sort((a, b) => b.notes.length - a.notes.length);
}

/* ------------------------------------------------------------------ */
/* slug                                                                */
/* ------------------------------------------------------------------ */

/** Filesystem-safe stem for a character name, CJK preserved. */
export function slug(name) {
  const cleaned = String(name)
    .trim()
    .replace(/[\s/\\:*?"<>|]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'character';
}

/* ------------------------------------------------------------------ */
/* i18n                                                                */
/* ------------------------------------------------------------------ */
/*
 * Report language. Chinese by default.
 * Two UI string sets are built in, zh / en; given any other language code it uses the en UI
 * skeleton, but the character content is still generated in that language — untranslated UI words
 * beat a whole report that has gone wrong.
 */

export const DEFAULT_LANG = 'zh';

const STRINGS = {
  zh: {
    kicker: '角色设定集',
    titleTail: ' · 角色',
    docTitle: (s) => `${s} · 角色设定集`,
    counts: (n, shots) => `${n} 位角色${shots ? ` · ${shots} 张设定图` : ''} · 按戏份排序`,
    synopsis: '故事摘要',
    indexLabel: '角色索引',
    aka: '又称',
    groups: { persona: '画像', image: '形象', voice: '声音' },
    persona: {
      gender: '性别', ageRange: '年龄', identity: '身份',
      appearance: '外貌', temperament: '性情', motivation: '动机',
      arc: '人物弧光', relationships: '关系', evidence: '原文依据',
    },
    image: {
      prompt: '出图提示词 · 喂出图模型用这条', promptLocal: '出图提示词（中文对照）',
      negative: '反向提示词', sheet: '角色设定图提示词 EN',
    },
    voice: {
      timbre: '音色', pitch: '音高', pace: '语速', accent: '口音',
      emotion: '情绪', referenceHint: '类比',
      prompt: '音色提示词 · 喂 TTS 引擎用这条',
    },
    importance: { protagonist: '主角', major: '主要角色', supporting: '配角', minor: '龙套' },
    graphTitle: '关系图谱',
    graphHint: '悬停看关系，点击进角色',
    graphCounts: (n, e) => `${n} 位角色 · ${e} 组关系`,
    exportJson: '导出 JSON',
    graphLabels: '关系文字',
    graphEmpty: '这批角色之间没有互相指认的关系',
    graphDangling: (n) => `另有 ${n} 条关系指向没做画像的角色，图里不画`,
    relationsAll: '全部关系',
    copy: '复制', copied: '已复制', copyFailed: '复制失败', copyJson: '复制整份角色 JSON',
    sheetCaption: '左：半身像　右：全身三视图',
    noImage: '尚未出图',
    noImageHint: '用下方提示词生成',
    colophonA: '画像与提示词由模型依据原文生成，',
    colophonB: '标记处为原文未明说、为可用性补全的内容。',
    mdTitle: (s) => `# ${s} — 角色表`,
    mdCast: (n, names) => `共 ${n} 位角色：${names}`,
    mdSynopsis: '## 故事摘要',
    searchPlaceholder: '搜索角色、特质、身份',
    rosterTitle: '角色 · 按戏份排序',
    footnote: '标注（推断）的条目为原文未明写、依据文本推演。',
    noMatch: '没有匹配的角色',
    voiceTag: 'VOICE',
    expandAll: '全部展开',
    zoomImage: '放大查看',
    copyImage: '复制图片',
    closeImage: '关闭',
  },
  en: {
    kicker: 'CHARACTER BIBLE',
    titleTail: ' · Cast',
    docTitle: (s) => `${s} · Character Bible`,
    counts: (n, shots) =>
      `${n} character${n === 1 ? '' : 's'}${shots ? ` · ${shots} sheet${shots === 1 ? '' : 's'}` : ''} · ordered by prominence`,
    synopsis: 'Synopsis',
    indexLabel: 'Cast index',
    aka: 'a.k.a.',
    groups: { persona: 'Profile', image: 'Design', voice: 'Voice' },
    persona: {
      gender: 'Gender', ageRange: 'Age', identity: 'Standing',
      appearance: 'Appearance', temperament: 'Temperament', motivation: 'Motivation',
      arc: 'Arc', relationships: 'Relationships', evidence: 'From the text',
    },
    image: {
      prompt: 'Image prompt · feed this to the image model', promptLocal: 'Image prompt (local translation)',
      negative: 'Negative prompt', sheet: 'Model sheet prompt',
    },
    voice: {
      timbre: 'Timbre', pitch: 'Pitch', pace: 'Pace', accent: 'Accent',
      emotion: 'Emotion', referenceHint: 'Sounds like',
      prompt: 'Voice prompt · feed this to the TTS engine',
    },
    importance: { protagonist: 'Lead', major: 'Major', supporting: 'Supporting', minor: 'Minor' },
    graphTitle: 'Relationship map',
    graphHint: 'Hover to trace, click to open',
    graphCounts: (n, e) => `${n} character${n === 1 ? '' : 's'} · ${e} link${e === 1 ? '' : 's'}`,
    exportJson: 'Export JSON',
    graphLabels: 'Link labels',
    graphEmpty: 'No one in this cast names anyone else',
    graphDangling: (n) => `${n} more link${n === 1 ? '' : 's'} point to characters without a profile and are not drawn`,
    relationsAll: 'All links',
    copy: 'Copy', copied: 'Copied', copyFailed: 'Failed', copyJson: 'Copy full JSON',
    sheetCaption: 'Left: bust　Right: full-body turnaround',
    noImage: 'Not generated yet',
    noImageHint: 'use the prompts below',
    colophonA: 'Profiles and prompts are model-generated from the source text; ',
    colophonB: 'marks what the text does not state and was filled in for usability.',
    mdTitle: (s) => `# ${s} — Cast`,
    mdCast: (n, names) => `${n} characters: ${names}`,
    mdSynopsis: '## Synopsis',
    searchPlaceholder: 'Search characters, traits, roles',
    rosterTitle: 'Cast · by prominence',
    footnote: 'Anything marked (inferred) is not stated in the text and was reasoned from it.',
    noMatch: 'No matching character',
    voiceTag: 'VOICE',
    expandAll: 'Expand all',
    zoomImage: 'View larger',
    copyImage: 'Copy image',
    closeImage: 'Close',
  },
  ja: {
    kicker: 'キャラクター設定集',
    titleTail: ' · 登場人物',
    docTitle: (s) => `${s} · キャラクター設定集`,
    counts: (n, shots) => `${n}人${shots ? ` · 設定画 ${shots}枚` : ''} · 出番順`,
    synopsis: 'あらすじ',
    indexLabel: '登場人物一覧',
    aka: '別名',
    groups: { persona: '人物像', image: 'ビジュアル', voice: '声' },
    persona: {
      gender: '性別', ageRange: '年齢', identity: '立場',
      appearance: '外見', temperament: '性格', motivation: '動機',
      arc: '人物の変化', relationships: '関係', evidence: '原文の根拠',
    },
    image: {
      prompt: '画像プロンプト · 画像モデルにはこれを', promptLocal: '画像プロンプト（対訳）',
      negative: 'ネガティブプロンプト', sheet: 'キャラ設定画プロンプト EN',
    },
    voice: {
      timbre: '声質', pitch: '音域', pace: '話速', accent: '訛り',
      emotion: '感情', referenceHint: 'たとえるなら',
      prompt: '音声プロンプト · TTS にはこれを',
    },
    importance: { protagonist: '主役', major: '主要人物', supporting: '脇役', minor: '端役' },
    graphTitle: '相関図',
    graphHint: 'ホバーで関係、クリックで詳細',
    graphCounts: (n, e) => `${n}人 · ${e}組の関係`,
    exportJson: 'JSON を書き出す',
    graphLabels: '関係ラベル',
    graphEmpty: 'この登場人物どうしを結ぶ関係はありません',
    graphDangling: (n) => `他に${n}件、設定を作っていない人物への関係があります（図には出ません）`,
    relationsAll: '関係一覧',
    copy: 'コピー', copied: 'コピー済み', copyFailed: '失敗', copyJson: 'JSON をコピー',
    sheetCaption: '左：バストアップ　右：三面図',
    noImage: '未生成',
    noImageHint: '下のプロンプトで生成',
    colophonA: '人物像とプロンプトは原文をもとにモデルが生成したものです。',
    colophonB: 'の箇所は原文に明記がなく、実用のために補ったものです。',
    mdTitle: (s) => `# ${s} — 登場人物`,
    mdCast: (n, names) => `全${n}人：${names}`,
    mdSynopsis: '## あらすじ',
    searchPlaceholder: 'キャラクター・特徴・立場を検索',
    rosterTitle: '登場人物 · 出番順',
    footnote: '（推断）の箇所は原文に明記がなく、本文から推し量ったものです。',
    noMatch: '該当するキャラクターがいません',
    voiceTag: 'VOICE',
    expandAll: 'すべて展開',
    zoomImage: '拡大表示',
    copyImage: '画像をコピー',
    closeImage: '閉じる',
  },
};

/**
 * Fetch the UI strings.
 *
 * Two layers: the built-in table covers common languages; for others the skill translates a copy at
 * generation time and puts it into `ui` in cast.json, merged in here. That is how supported languages
 * are not limited by the built-in table.
 *
 * @param lang      language code
 * @param overrides cast.json's `ui`, may override only some of the keys
 */
export function strings(lang = DEFAULT_LANG, overrides = null) {
  const base = STRINGS[lang] ?? STRINGS.en;
  if (!overrides || typeof overrides !== 'object') return base;

  // Merge only two layers — STRINGS is only two levels deep, which is enough and keeps dirty data from skewing it.
  const merged = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof base[k] === 'function') continue; // function templates do not accept overrides
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      merged[k] = { ...base[k], ...v };
    } else if (typeof v === 'string') {
      merged[k] = v;
    }
  }
  return merged;
}

export const SUPPORTED_UI_LANGS = Object.keys(STRINGS);

/** Languages that need the skill to supply a `ui` translation (not in the built-in table). */
export const needsUiTranslation = (lang) => !SUPPORTED_UI_LANGS.includes(lang);

/** The keys that `ui` can override — used by the ui-template subcommand to generate a skeleton. */
export function uiTemplate() {
  const en = STRINGS.en;
  const out = {};
  for (const [k, v] of Object.entries(en)) {
    if (typeof v === 'function') continue;
    out[k] = v && typeof v === 'object' ? { ...v } : v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* seed — prefill the cast skeleton from an outline                       */
/* ------------------------------------------------------------------ */

/**
 * Map outline tier onto cast importance.
 *
 * Note the granularity differs: the outline's `lead` is the "lead group", containing the male lead,
 * female lead and main antagonist, which corresponds to both the protagonist and major tiers in cast.
 * Here everyone gets protagonist, and the model uses the role in seedNote (female lead / male lead /
 * villain) to demote the non-leads to major — **the tiers themselves are not overturned, only
 * subdivided within the lead group**.
 */
export const TIER_TO_IMPORTANCE = { lead: 'protagonist', support: 'supporting', functional: 'minor' };

/**
 * Prefill the cast.json skeleton from outline.json.
 *
 * The outline is upstream of the character design: who is in and who is out, and who is in the lead
 * group, are settled at the adaptation stage, and this layer does not judge it again. What is carried
 * over is **the facts the outline already fixed** (character code, name, tier, character arc, which
 * source characters were merged into this one); what is left blank is **the design this layer owes**
 * (aliases, profile, image prompt, voice prompt) — aliases require reading the source, which the
 * outline does not have.
 *
 * The same shape as seedFromOutline in novel-art / novel-script: carry the facts, leave the design,
 * attach a seedNote for context. The output is a skeleton, not a finished product; running validate
 * straight away reports a pile of missing fields, and that is expected.
 */
export function seedFromOutline(outline) {
  const characters = (outline?.characters ?? []).map((c) => {
    const note = [
      c?.id ? `角色码 ${c.id}` : null,
      c?.role ? `大纲定位：${c.role}` : null,
      c?.tier ? `大纲分档：${c.tier}` : null,
      (c?.from ?? []).length ? `合并自：${(c.from ?? []).join('、')}` : null,
    ].filter(Boolean).join('　');
    return {
      // facts carried over from the outline, no need to rethink them
      ...(c?.id ? { id: c.id } : {}),
      name: c?.name ?? '',
      importance: TIER_TO_IMPORTANCE[c?.tier] ?? 'supporting',
      // the design this layer owes, placeholder for now
      aliases: [],
      oneLiner: '',
      persona: {
        gender: '', ageRange: '', identity: '', appearance: '',
        personality: [], temperament: '', motivation: '',
        // the character arc is already written by the outline, use it as-is; if it looks wrong go fix the outline, do not write a different one here
        arc: c?.arc ?? '',
        relationships: [], evidence: [],
      },
      image: { prompt: '', promptLocal: '', negativePrompt: '', tags: [], sheet: '' },
      voice: { timbre: '', pitch: '', pace: '', accent: '', emotion: '', prompt: '', referenceHint: '' },
      ...(note ? { seedNote: note } : {}),
    };
  });
  return {
    source: outline?.source ?? '',
    lang: outline?.lang ?? DEFAULT_LANG,
    summary: '',
    characters,
  };
}

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */

const IMPORTANCE = ['protagonist', 'major', 'supporting', 'minor'];
/** CJK ideographs plus kana and hangul — if any appear in an image / TTS prompt, the languages have crossed. */
const CJK = /[㐀-鿿぀-ヿ가-힯]/;
/** Kana on its own: used to tell Japanese apart from Chinese. */
const KANA = /[぀-ヿ]/;

const PERSONA_STRINGS = ['gender', 'ageRange', 'identity', 'appearance', 'temperament', 'motivation', 'arc'];
/** Machine input, always English — image and TTS engines are steadiest with English, regardless of report language. */
const MACHINE_FIELDS = { image: ['prompt', 'negativePrompt', 'sheet'], voice: ['prompt'] };
/** For humans, follows the report language. */
const HUMAN_VOICE_FIELDS = ['timbre', 'pitch', 'pace', 'accent', 'emotion', 'referenceHint'];

const normalise = (s) => String(s).replace(/\s+/g, '');

/**
 * @param characters array of character cards
 * @param sourceText the source; null skips the verbatim-quote check
 * @param lang       report language, deciding what language the human-readable fields should be in
 */
export function validateCast(characters, sourceText, lang = DEFAULT_LANG) {
  const problems = [];
  const flatSource = sourceText === null ? null : normalise(sourceText);
  const at = (name, msg) => problems.push(`[${name}] ${msg}`);

  if (!Array.isArray(characters) || characters.length === 0) {
    return ['cast is empty or not an array'];
  }

  // --- prompts of characters in the same batch must not be near-duplicates ---
  /*
   * profile-pass.md has long said "characters in the same batch must be distinguishable, do not make
   * their looks and voices the same", but there was no gate. On pass 2 the model easily falls into one
   * template: short individual description, with the rest all photorealism boilerplate and a fixed
   * composition-and-lighting tail — two characters of similar age and gender come out as the same person (issue #9).
   *
   * Rule: compute Jaccard similarity over word sets, and name the pair once it crosses the threshold.
   * The 0.75 threshold is measured, not picked — the four bundled characters peak at 39% pairwise,
   * while the near-duplicate case that "only changes age and clothing colour" is 98%, leaving plenty of headroom.
   *
   * image.sheet is deliberately not checked: the three-zone layout spec is a long fixed block, and real
   * characters genuinely overlap 63%, so a gate would necessarily false-positive — a gate that blocks
   * wrongly is worse than no gate.
   */
  const promptSim = (a, b) => {
    const words = (s) => new Set(String(s ?? '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2));
    const A = words(a); const B = words(b);
    if (A.size < 8 || B.size < 8) return 0;
    const inter = [...A].filter((w) => B.has(w)).length;
    return inter / new Set([...A, ...B]).size;
  };
  const SIM_MAX = 0.75;
  for (const [field, label] of [['prompt', 'image prompt'], ['voice', 'voice prompt']]) {
    const get = (c) => (field === 'prompt' ? c?.image?.prompt : c?.voice?.prompt);
    for (let i = 0; i < characters.length; i += 1) {
      for (let j = i + 1; j < characters.length; j += 1) {
        const sim = promptSim(get(characters[i]), get(characters[j]));
        if (sim >= SIM_MAX) {
          const pct = Math.round(sim * 100);
          problems.push(
            `${characters[i]?.name ?? '(unnamed)'} and ${characters[j]?.name ?? '(unnamed)'} have near-duplicate ${label}s at ${pct}%`
            + ` (cap ${Math.round(SIM_MAX * 100)}%) — characters in the same batch must be distinguishable; do not copy one template`,
          );
        }
      }
    }
  }

  for (const c of characters) {
    const name = c?.name ?? '(unnamed)';

    // --- structure ---
    if (typeof c?.name !== 'string' || !c.name.trim()) at(name, 'missing name');
    if (!Array.isArray(c?.aliases)) at(name, 'aliases must be an array');
    if (!IMPORTANCE.includes(c?.importance)) {
      at(name, `importance must be one of ${IMPORTANCE.join('/')}, got ${JSON.stringify(c?.importance)}`);
    }
    if (typeof c?.oneLiner !== 'string' || !c.oneLiner.trim()) at(name, 'missing oneLiner');

    const persona = c?.persona;
    if (!persona || typeof persona !== 'object') {
      at(name, 'missing persona');
    } else {
      for (const f of PERSONA_STRINGS) {
        if (typeof persona[f] !== 'string' || !persona[f].trim()) at(name, `persona.${f} is missing or empty`);
      }
      if (!Array.isArray(persona.personality)) at(name, 'persona.personality must be an array');
      if (!Array.isArray(persona.relationships)) at(name, 'persona.relationships must be an array');
      if (!Array.isArray(persona.evidence)) at(name, 'persona.evidence must be an array');
    }

    const image = c?.image;
    if (!image || typeof image !== 'object') {
      at(name, 'missing image');
    } else {
      for (const f of ['prompt', 'negativePrompt']) {
        if (typeof image[f] !== 'string' || !image[f].trim()) at(name, `image.${f} is missing or empty`);
      }
      if (typeof image.sheet !== 'string' || !image.sheet.trim()) {
        at(name, 'image.sheet is missing or empty (the character model sheet prompt)');
      }
      if (!Array.isArray(image.tags)) at(name, 'image.tags must be an array');
    }

    const voice = c?.voice;
    if (!voice || typeof voice !== 'object') {
      at(name, 'missing voice');
    } else {
      for (const f of [...HUMAN_VOICE_FIELDS, 'prompt']) {
        if (typeof voice[f] !== 'string' || !voice[f].trim()) at(name, `voice.${f} is missing or empty`);
      }
      /*
       * The voice prompt must not contain quoted dialogue.
       * profile-pass.md rule 7 says "describe the instrument itself, not a performance of one line",
       * but the model writes sentences like "murderous intent hidden inside pleasantries such as
       * 'rules are rules'" — once dialogue goes in, some TTS engines treat it as text to be read aloud
       * (hit in production). Only paired quotes are checked, which is cleanly decidable: a normal voice
       * description never needs to quote a sentence.
       */
      /*
       * The voice prompt must be compact, not prose.
       * Voice design engines (Qwen3-TTS Voice Design / ElevenLabs / MiniMax) want parameter density:
       * age and gender, timbre, register, resonance, dynamics, volume, pace, intonation, accent, default
       * emotion. Flowing English prose dilutes those parameters — measured in production, the compact
       * version is clearly better.
       *
       * The 400-character cap is measured: the four bundled characters run 218–245, while the prose
       * version judged over-redundant ran 490–514, so there is plenty of headroom. It blocks "writing an
       * essay", not "writing in detail".
       */
      if (typeof voice.prompt === 'string' && voice.prompt.length > 400) {
        at(name, `voice.prompt is ${voice.prompt.length} characters, over 400 — a voice prompt should be a compact parameter string, not prose; include every parameter but do not sprawl`);
      }
      if (typeof voice.prompt === 'string') {
        const quoted = voice.prompt.match(/[「『"“][^」』"”]{2,}[」』"”]/);
        if (quoted) {
          at(name, `voice.prompt contains quoted dialogue「${quoted[0].slice(0, 24)}」— a voice prompt describes the voice itself, not a performance of one line`);
        }
      }
    }

    // --- quotes must be verbatim ---
    if (flatSource && Array.isArray(persona?.evidence)) {
      for (const quote of persona.evidence) {
        if (typeof quote !== 'string') {
          at(name, 'persona.evidence contains a non-string');
        } else if (!flatSource.includes(normalise(quote))) {
          at(name, `quote is not a verbatim passage from the source: ${quote}`);
        }
      }
    }

    // --- image prompts must not contain character names ---
    if (image) {
      const names = [c?.name, ...(Array.isArray(c?.aliases) ? c.aliases : [])].filter(
        (n) => typeof n === 'string' && n.trim(),
      );
      for (const field of ['prompt', 'promptLocal', 'sheet']) {
        const value = image[field];
        if (typeof value !== 'string') continue;
        for (const n of names) {
          if (value.includes(n)) at(name, `image.${field} contains the character name「${n}」`);
        }
      }
    }

    // --- language split ---
    // Machine fields are always English; human fields follow the report language.
    // Only zh / en can be reliably auto-detected; other languages are not guessed at and are skipped.
    for (const [group, fields] of Object.entries(MACHINE_FIELDS)) {
      const obj = c?.[group];
      if (!obj) continue;
      for (const f of fields) {
        if (typeof obj[f] === 'string' && CJK.test(obj[f])) {
          at(name, `${group}.${f} is fed to a model and must be English, but contains CJK characters`);
        }
      }
    }
    if (Array.isArray(image?.tags)) {
      for (const t of image.tags) {
        if (typeof t === 'string' && CJK.test(t)) at(name, `image.tags must be English, but「${t}」contains CJK characters`);
      }
    }
    // Only these three can be reliably auto-detected; other languages are not guessed at and are skipped — a false positive is more annoying than a miss.
    if (voice) {
      for (const f of HUMAN_VOICE_FIELDS) {
        const v = voice[f];
        if (typeof v !== 'string' || !v.trim()) continue;
        if (lang === 'en' && CJK.test(v)) at(name, `voice.${f} should be English, but contains CJK characters`);
        if (lang === 'zh' && !CJK.test(v)) at(name, `voice.${f} should be Chinese, but is「${v}」`);
        if (lang === 'zh' && KANA.test(v)) at(name, `voice.${f} should be Chinese, but contains Japanese kana`);
        if (lang === 'ja' && !KANA.test(v) && !CJK.test(v)) {
          at(name, `voice.${f} should be Japanese, but is「${v}」`);
        }
      }
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ */
/* assemble                                                            */
/* ------------------------------------------------------------------ */

/**
 * Combine the pass-2 character cards into the top-level structure of cast.json. Pure mechanical work —
 * this used to be left to the model to hand-build, and hand-building drops fields and writes the wrong
 * top-level key.
 *
 * Sorting: by importance tier, and within a tier by order (the name order from merge's output, i.e.
 * screen-time order). Without order it keeps the incoming order — the CLI reads cards by filename, which
 * is slug lexicographic order rather than screen-time order, so a report that is "sorted by screen time"
 * must be given order.
 */
export function assembleCast(cards, { source, lang = DEFAULT_LANG, summary = '', ui = null, order = null } = {}) {
  const rank = (c) => {
    const i = IMPORTANCE.indexOf(c?.importance);
    return i < 0 ? IMPORTANCE.length : i; // out-of-range sorts last, let validate report it; do not crash here
  };
  const orderIndex = new Map((order ?? []).map((name, i) => [String(name).trim().toLowerCase(), i]));
  // Names not in order sort to the end of their tier (keeping the incoming order) without error — cards are generated from merge's output, so they normally line up
  const byOrder = (c) => orderIndex.get(String(c?.name ?? '').trim().toLowerCase()) ?? orderIndex.size;
  const characters = cards
    .map((card, i) => [card, i])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || byOrder(a[0]) - byOrder(b[0]) || a[1] - b[1])
    .map(([card]) => card);
  const cast = { source, lang };
  if (ui) cast.ui = ui;
  cast.summary = summary;
  cast.characters = characters;
  return cast;
}

/* ------------------------------------------------------------------ */
/* render — markdown                                                   */
/* ------------------------------------------------------------------ */

export function renderMarkdown(characters, source, summary = '', lang = DEFAULT_LANG, ui = null) {
  const t = strings(lang, ui);
  const out = [t.mdTitle(source), '', t.mdCast(characters.length, characters.map((c) => c.name).join('、')), ''];
  if (summary) out.push(t.mdSynopsis, '', summary, '');

  for (const c of characters) {
    const { persona, image, voice } = c;
    out.push('---', '');
    out.push(`## ${c.name}${c.aliases.length ? `（${c.aliases.join('、')}）` : ''}`, '');
    out.push(`> ${t.importance[c.importance] ?? c.importance} · ${c.oneLiner}`, '');

    if (c.sheetImage) out.push(`![${c.name} ${t.sheetCaption}](${c.sheetImage})`, '');

    out.push(`### ${t.groups.persona}`, '');
    out.push(`- **${t.persona.gender}**：${persona.gender}`);
    out.push(`- **${t.persona.ageRange}**：${persona.ageRange}`);
    out.push(`- **${t.persona.identity}**：${persona.identity}`);
    if (persona.personality.length) out.push(`- ${persona.personality.join(' / ')}`);
    out.push('');
    out.push(`**${t.persona.appearance}**　${persona.appearance}`, '');
    out.push(`**${t.persona.temperament}**　${persona.temperament}`, '');
    out.push(`**${t.persona.motivation}**　${persona.motivation}`, '');
    out.push(`**${t.persona.arc}**　${persona.arc}`, '');

    if (persona.relationships.length) {
      out.push(`**${t.persona.relationships}**`, '');
      for (const r of persona.relationships) out.push(`- ${r.name} — ${r.relation}`);
      out.push('');
    }
    if (persona.evidence.length) {
      out.push(`**${t.persona.evidence}**`, '');
      for (const q of persona.evidence) out.push(`> ${q}`, '');
    }

    out.push(`### ${t.groups.image}`, '');
    if (image.tags.length) out.push(`\`${image.tags.join('`, `')}\``, '');
    out.push(`**${t.image.prompt}**`, '', '```text', image.prompt, '```', '');
    if (image.promptLocal) out.push(`${image.promptLocal}`, '');
    out.push(`**${t.image.negative}**`, '', '```text', image.negativePrompt, '```', '');
    out.push(`**${t.image.sheet}**`, '', '```text', image.sheet, '```', '');

    out.push(`### ${t.groups.voice}`, '');
    for (const f of HUMAN_VOICE_FIELDS) out.push(`- **${t.voice[f]}**：${voice[f]}`);
    out.push('');
    out.push(`**${t.voice.prompt}**`, '', '```text', voice.prompt, '```', '');
  }

  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* render — html                                                       */
/* ------------------------------------------------------------------ */
/*
 * Three-column workbench. For design conventions see references/report-style.md. What must not break:
 *   1. Two type domains: serif = narrative and source, sans = analysis, mono = prompts fed to machines
 *   2. "（推断）" / "(inferred)" highlights automatically, so the reader can tell grounded from filled-in at a glance
 *   3. One character at a time, switching via the left rail + finding people via the top-bar search
 *   4. Everything expands when printing — one at a time on screen, a complete copy on paper
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Inferred marker: all four spellings — half-width / full-width × Chinese / English — must be recognised, since the model produces them indiscriminately. */
const INFERRED = /（\s*(?:推断|inferred)[^）]*）|\(\s*(?:推断|inferred)[^)]*\)/gi;
const marked = (s) => esc(s).replace(INFERRED, (m) => `<span class="inf">${m}</span>`);

const IMPORTANCE_ORDER = ['protagonist', 'major', 'supporting', 'minor'];

/** One character in the left rail. The thumbnail takes the left half of the sheet — that is exactly the bust portrait. */
function renderRosterItem(c, index, t) {
  const meta = [c.persona?.gender, c.persona?.ageRange].filter(Boolean).join(' · ');
  const hay = [
    c.name,
    ...(c.aliases ?? []),
    c.persona?.identity,
    c.persona?.gender,
    c.persona?.ageRange,
    ...(c.persona?.personality ?? []),
    c.oneLiner,
  ]
    .filter(Boolean)
    .join(' ');

  return `<button class="rost${index === 0 ? ' on' : ''}" data-target="p-${slug(c.name)}" data-hay="${esc(hay)}">
  <span class="rost-thumb"${
    c.sheetImage ? ` style="background-image:url('${esc(c.sheetImage)}')"` : ''
  }></span>
  <span class="rost-body">
    <span class="rost-top">
      <em class="rost-n">${String(index + 1).padStart(2, '0')}</em>
      <b class="rost-name">${esc(c.name)}</b>
      <span class="badge">${esc(t.importance[c.importance] ?? c.importance)}</span>
      ${meta ? `<span class="rost-meta">${esc(meta)}</span>` : ''}
    </span>
    <span class="rost-one">${esc(c.oneLiner)}</span>
    ${
      c.persona?.personality?.length
        ? `<span class="rost-chips">${c.persona.personality.map((x) => `<i>${esc(x)}</i>`).join('')}</span>`
        : ''
    }
  </span>
</button>`;
}

function renderCharacter(c, index, t) {
  const { persona, image, voice } = c;

  const promptRow = (label, value) =>
    !value
      ? ''
      : `<details class="pr">
  <summary><span>${esc(label)}</span><button class="copy" data-copy="${esc(value)}">${esc(t.copy)}</button></summary>
  <p>${esc(value)}</p>
</details>`;

  const kv = (label, value) =>
    !value ? '' : `<div class="kv"><dt>${esc(label)}</dt><dd>${marked(value)}</dd></div>`;

  const block = (label, body) =>
    !body ? '' : `<section class="blk"><h3>${esc(label)}</h3><p>${marked(body)}</p></section>`;

  const plate = c.sheetImage
    ? `<figure class="plate-wrap">
         <button class="plate zoom" data-src="${esc(c.sheetImage)}" aria-label="${esc(t.zoomImage)}">
           <img src="${esc(c.sheetImage)}" alt="${esc(c.name)} ${esc(t.sheetCaption)}" loading="lazy">
         </button>
         <button class="copy-img" data-img="${esc(c.sheetImage)}" title="${esc(t.copyImage)}">${esc(t.copyImage)}</button>
       </figure>
       <p class="plate-c">${esc(t.sheetCaption)}</p>`
    : `<div class="plate plate-empty">
         <span>${esc(c.name)} · ${esc(t.noImage)}<br><em>${esc(t.noImageHint)}</em></span>
       </div>`;

  return `<article class="char${index === 0 ? ' on' : ''}" id="p-${slug(c.name)}">
  <header class="char-h">
    <span class="char-n">${String(index + 1).padStart(2, '0')}</span>
    <h2>${esc(c.name)}</h2>
    <span class="badge">${esc(t.importance[c.importance] ?? c.importance)}</span>
    ${c.aliases.length ? `<span class="aka">${esc(t.aka)}　${esc(c.aliases.join(' · '))}</span>` : ''}
    <span class="char-one">${marked(c.oneLiner)}</span>
  </header>

  <div class="upper">
    <div class="stage">
      ${plate}

      <div class="grid2">
        ${block(t.persona.appearance, persona.appearance)}
        ${block(t.persona.temperament, persona.temperament)}
        ${block(t.persona.motivation, persona.motivation)}
        ${block(t.persona.arc, persona.arc)}
      </div>

      ${
        persona.evidence.length
          ? `<section class="blk source"><h3>${esc(t.persona.evidence)}</h3>
               <div class="quotes">${persona.evidence.map((q) => `<blockquote>${esc(q)}</blockquote>`).join('')}</div>
             </section>`
          : ''
      }
    </div>

    <aside class="side-cards">
      <div class="card">
        <dl>${kv(t.persona.gender, persona.gender)}${kv(t.persona.ageRange, persona.ageRange)}${kv(t.persona.identity, persona.identity)}</dl>
      </div>

      ${
        persona.relationships.length
          ? `<div class="card"><h4>${esc(t.persona.relationships)}</h4>
               <dl>${persona.relationships.map((r) => `<div class="kv"><dt class="rel-n">${esc(r.name)}</dt><dd>${marked(r.relation)}</dd></div>`).join('')}</dl>
             </div>`
          : ''
      }

      <div class="card">
        <h4>${esc(t.groups.voice)}<i class="tag-en">${esc(t.voiceTag)}</i></h4>
        <dl>${HUMAN_VOICE_FIELDS.map((f) => kv(t.voice[f], voice[f])).join('')}</dl>
      </div>

      ${
        image.tags.length
          ? `<div class="card"><h4>${esc(t.groups.image)}</h4>
               <ul class="tags">${image.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
             </div>`
          : ''
      }
    </aside>
  </div>

  <div class="prompts">
    <div class="pgroup">
      ${promptRow(t.image.prompt, image.prompt)}
      ${promptRow(t.image.sheet, image.sheet)}
      ${promptRow(t.image.negative, image.negativePrompt)}
      ${promptRow(t.image.promptLocal, image.promptLocal)}
    </div>
    <div class="pgroup">
      ${promptRow(t.voice.prompt, voice.prompt)}
      <div class="pgroup-f">
        <button class="copy wide" data-copy="${esc(JSON.stringify(c, null, 2))}">${esc(t.copyJson)}</button>
      </div>
    </div>
  </div>
</article>`;
}

/* ------------------------------------------------------------------ */
/* render — relationship map                                            */
/* ------------------------------------------------------------------ */
/*
 * Circular layout + inward Béziers. Positions are computed in Node and written straight into inline SVG;
 * the browser side only handles highlighting and navigation — the report must open offline by double-click,
 * so no libraries.
 */

/** Node size tiers by screen time, so you can see who the leads are at a glance. */
const NODE_R = { protagonist: 11, major: 9, supporting: 7, minor: 5.5 };
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Resolve persona.relationships into undirected edges.
 *
 * Indexed by **name + alias**: a relationship written as 「老伯」 in 老周's entry must still connect to
 * the same node, and matching on name alone would miss half the edges. Two one-directional accounts of the
 * same pair collapse into one edge, keeping both directions' wording. A link pointing at someone without a
 * profile counts as dangling — not drawn, but counted.
 */
export function buildGraph(characters) {
  const key = (s) => String(s).trim().toLowerCase();
  const index = new Map();
  for (const c of characters) {
    index.set(key(c.name), c.name);
    for (const a of c.aliases ?? []) index.set(key(a), c.name);
  }

  const edges = new Map();
  let dangling = 0;
  for (const c of characters) {
    for (const r of c.persona?.relationships ?? []) {
      if (!r || typeof r.name !== 'string') continue;
      const target = index.get(key(r.name));
      if (!target || target === c.name) {
        dangling++;
        continue;
      }
      const [a, b] = [c.name, target].sort();
      const k = `${a} ${b}`;
      if (!edges.has(k)) edges.set(k, { a, b, notes: [] });
      edges.get(k).notes.push({ from: c.name, text: String(r.relation ?? '') });
    }
  }
  return { edges: [...edges.values()], dangling };
}

function renderGraph(ordered, t) {
  const { edges, dangling } = buildGraph(ordered);
  const n = ordered.length;
  // Radius follows headcount — four people need not fill the whole canvas; 110 on each side reserved for names
  const R = Math.max(130, Math.min(260, 40 + n * 14));
  const side = Math.round((R + 110) * 2);
  const c0 = side / 2;

  const pos = new Map();
  ordered.forEach((c, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 1);
    pos.set(c.name, { x: c0 + R * Math.cos(a), y: c0 + R * Math.sin(a), cos: Math.cos(a), sin: Math.sin(a) });
  });

  // Pull the control point toward the centre so chords are curved — straight lines blur into a net with many people
  const arcs = edges.map((e, i) => {
    const p = pos.get(e.a);
    const q = pos.get(e.b);
    const cxq = c0 + ((p.x + q.x) / 2 - c0) * 0.35;
    const cyq = c0 + ((p.y + q.y) / 2 - c0) * 0.35;
    // Offset labels along the chord: the two chords of characters facing each other both have their midpoint at the centre, so putting them all at t=0.5 piles them into one lump
    const t = 0.5 + ((i % 3) - 1) * 0.14;
    const u = 1 - t;
    return {
      e,
      d: `M${r1(p.x)} ${r1(p.y)} Q${r1(cxq)} ${r1(cyq)} ${r1(q.x)} ${r1(q.y)}`,
      lx: u * u * p.x + 2 * u * t * cxq + t * t * q.x,
      ly: u * u * p.y + 2 * u * t * cyq + t * t * q.y,
    };
  });

  const paths = arcs
    .map((a) => `<path class="gedge" data-a="${esc(a.e.a)}" data-b="${esc(a.e.b)}" d="${a.d}"></path>`)
    .join('');

  // Relationship text on the chord: take the shortest wording and truncate it, with the full text in <title> as a native tooltip
  const labels = arcs
    .map((a) => {
      const notes = a.e.notes.filter((x) => x.text.trim());
      if (!notes.length) return '';
      const pick = notes.reduce((s, x) => ([...x.text].length < [...s.text].length ? x : s), notes[0]);
      // Six characters. Any longer and it presses onto the neighbouring chord — the full text lives in title and the relationship table on the right
      const chars = [...pick.text.trim()];
      const text = chars.length > 6 ? `${chars.slice(0, 6).join('')}…` : chars.join('');
      const full = notes.map((x) => `${x.from} · ${x.text}`).join('\n');
      return `<text class="glabel" data-a="${esc(a.e.a)}" data-b="${esc(a.e.b)}" x="${r1(a.lx)}" y="${r1(a.ly)}" text-anchor="middle" dominant-baseline="middle">${esc(text)}<title>${esc(full)}</title></text>`;
    })
    .join('');

  const dots = ordered
    .map((c) => {
      const p = pos.get(c.name);
      // Names at the top and bottom of the circle are centred; the ones on the sides are thrown outward so they do not sit on the node
      const flat = Math.abs(p.cos) < 0.25;
      const anchor = flat ? 'middle' : p.cos < 0 ? 'end' : 'start';
      const lx = c0 + (R + 15) * p.cos;
      const ly = c0 + (R + 15) * p.sin + (flat ? (p.sin < 0 ? -6 : 14) : 4.5);
      return `<g class="gnode${c.importance === 'protagonist' ? ' lead' : ''}" data-node="${esc(c.name)}" data-target="p-${slug(c.name)}" tabindex="0" role="button" aria-label="${esc(c.name)}">
  <circle class="ghit" cx="${r1(p.x)}" cy="${r1(p.y)}" r="24"></circle>
  <circle class="gdot" cx="${r1(p.x)}" cy="${r1(p.y)}" r="${NODE_R[c.importance] ?? 7}"></circle>
  <text x="${r1(lx)}" y="${r1(ly)}" text-anchor="${anchor}">${esc(c.name)}</text>
</g>`;
    })
    .join('');

  const rows = edges
    .map(
      (e) => `<button class="grow" data-a="${esc(e.a)}" data-b="${esc(e.b)}" data-target="p-${slug(e.a)}">
  <b>${esc(e.a)}</b><i>—</i><b>${esc(e.b)}</b>
  ${e.notes.map((x) => `<span><em>${esc(x.from)}</em> ${marked(x.text)}</span>`).join('')}
</button>`,
    )
    .join('');

  // Few edges: label the relationship text directly. Many edges: it blurs into a lump, so collapse by default and leave the toggle to the user
  const labelsOn = edges.length <= 14;

  return `<section class="graph${labelsOn ? ' labels' : ''}" id="graph">
  <header class="graph-h">
    <h2>${esc(t.graphTitle)}</h2>
    <span class="badge">${esc(t.graphCounts(n, edges.length))}</span>
    <button class="glabtoggle${labelsOn ? ' on' : ''}" aria-pressed="${labelsOn}">${esc(t.graphLabels)}</button>
    <span class="hint">${esc(t.graphHint)}</span>
  </header>
  <div class="graph-body">
    <div class="graph-canvas">
      <svg viewBox="0 0 ${side} ${side}" role="img" aria-label="${esc(t.graphTitle)}">
        <g class="gedges">${paths}</g>
        <g class="gnodes">${dots}</g>
        <g class="glabels">${labels}</g>
      </svg>
      ${edges.length ? '' : `<p class="graph-empty">${esc(t.graphEmpty)}</p>`}
    </div>
    <aside class="grel">
      <h4>${esc(t.relationsAll)}</h4>
      <div class="grel-list">${rows}</div>
      ${dangling ? `<p class="grel-foot">${esc(t.graphDangling(dangling))}</p>` : ''}
    </aside>
  </div>
</section>`;
}

/*
 * The data embedded in the report **is exactly the shape of cast.json** — edit it and feed it straight back
 * into `render` to regenerate the report; there is no separate export format.
 *
 * `<` becomes \u003c: in JSON, `<` can only occur inside string values, so a global replace is safe, and
 * without it a single `</script` in the body could truncate this data block early.
 */
function embedCast(characters, source, summary, lang, ui) {
  const data = { source, lang, summary, ...(ui ? { ui } : {}), characters };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function renderHtml(
  characters,
  source,
  summary = '',
  lang = DEFAULT_LANG,
  ui = null,
) {
  const t = strings(lang, ui);
  const shots = characters.filter((c) => c.sheetImage).length;
  const ordered = [...characters].sort(
    (a, b) => IMPORTANCE_ORDER.indexOf(a.importance) - IMPORTANCE_ORDER.indexOf(b.importance),
  );

  return `<!doctype html>
<html lang="${esc(lang)}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.docTitle(source))}</title>
<style>
/* Cold grey stock + rust-red seal. Red is used only where it relates to the source and for the current selection. */
:root{
  --paper:#eceded; --panel:#f5f6f5; --side:#e4e6e3; --ink:#191d21; --ink-2:#5b636a; --ink-3:#8c9298;
  --rule:#d2d5d0; --rule-2:#c2c6bf; --seal:#8a3324; --seal-soft:#8a332412;
  --serif:"Songti SC","STSong","Source Han Serif SC","Noto Serif CJK SC",Georgia,"Iowan Old Style",serif;
  --sans:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --top:60px; --side-w:400px;
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.7 var(--sans);
  -webkit-font-smoothing:antialiased}
h1,h2,h3,h4{margin:0;font-weight:400}
button{font-family:inherit}

/* ---------- top bar ---------- */
.top{position:sticky;top:0;z-index:20;height:var(--top);display:flex;align-items:center;gap:24px;
  padding:0 20px;background:var(--panel);border-bottom:1px solid var(--rule-2)}
.brand{display:flex;align-items:baseline;gap:10px;flex:none}
.brand h1{font:400 22px/1 var(--serif);letter-spacing:.04em}
.brand em{font:italic 12px/1 var(--serif);color:var(--ink-3)}
.search{flex:1;max-width:720px;position:relative}
.search input{width:100%;height:34px;padding:0 12px 0 32px;border:1px solid var(--rule-2);
  border-radius:3px;background:var(--paper);color:var(--ink);font:14px/1 var(--sans);outline:none}
.search input:focus{border-color:var(--seal)}
.search svg{position:absolute;left:10px;top:9px;width:14px;height:14px;stroke:var(--ink-3);fill:none}
.topmeta{margin-left:auto;font-size:12px;color:var(--ink-3);display:flex;align-items:center;
  gap:10px;flex:none}
.topmeta i{font-style:normal;color:var(--rule-2)}
/* Export: what downloads is the embedded cast.json itself, ready to feed back into render */
.expo{margin-left:4px;font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--paper);
  border:1px solid var(--rule-2);border-radius:2px;padding:6px 10px;cursor:pointer;transition:.15s}
.expo:hover{border-color:var(--seal);color:var(--seal)}
.expo:focus-visible{outline:2px solid var(--seal);outline-offset:2px}

/* ---------- skeleton ---------- */
.shell{display:grid;grid-template-columns:var(--side-w) minmax(0,1fr);align-items:start}
@media(max-width:1080px){:root{--side-w:100%}.shell{grid-template-columns:1fr}}

/* ---------- left rail ---------- */
.side{position:sticky;top:var(--top);height:calc(100vh - var(--top));overflow-y:auto;
  background:var(--side);border-right:1px solid var(--rule-2)}
@media(max-width:1080px){.side{position:static;height:auto}}
.synopsis{padding:18px 20px;border-bottom:1px solid var(--rule)}
.lbl{font:500 10px/1 var(--sans);letter-spacing:.24em;text-transform:uppercase;color:var(--ink-3)}
.synopsis p{margin:10px 0 0;font:400 14px/1.95 var(--serif)}
/* The summary is three lines by default with a fade at the bottom — the first screen of the left rail belongs to the character list. Click to expand, and it does not collapse again */
.syn-clamp{cursor:pointer}
.syn-clamp p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
  -webkit-mask-image:linear-gradient(180deg,#000 58%,transparent);
  mask-image:linear-gradient(180deg,#000 58%,transparent)}
.syn-more{display:none;margin-top:7px;padding:0;background:none;border:0;cursor:pointer;
  font:500 11px/1 var(--sans);letter-spacing:.06em;color:var(--seal)}
.syn-clamp .syn-more{display:block}
.syn-more:hover{text-decoration:underline}
.syn-more:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.roster-h{padding:14px 20px 8px}
.roster{display:block}
.rost{display:grid;grid-template-columns:76px minmax(0,1fr);gap:12px;width:100%;text-align:left;
  padding:12px 20px;background:none;border:0;border-bottom:1px solid var(--rule);
  border-left:2px solid transparent;cursor:pointer;color:inherit}
.rost:hover{background:#00000006}
.rost.on{background:var(--panel);border-left-color:var(--seal)}
.rost:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
/* Thumbnail = the left-column slice of the sheet. The sheet is fixed 16:9 and the left column is about 34%,
   so scaling the whole image by 1/0.34 ≈ 294% and aligning top-left crops out exactly the bust portrait.
   More controllable than <img> + object-position: it does not depend on how the browser covers. */
.rost-thumb{display:block;width:76px;height:76px;border:1px solid var(--rule-2);border-radius:6px;
  background:#fff no-repeat left top;background-size:294% auto}
.rost-body{min-width:0}
.rost-top{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
.rost-n{font:500 10px/1 var(--mono);color:var(--ink-3);font-style:normal}
.rost-name{font:400 17px/1.2 var(--serif);letter-spacing:.03em}
.rost-meta{font-size:11px;color:var(--ink-3)}
.rost-one{display:block;margin-top:5px;font-size:12.5px;line-height:1.65;color:var(--ink-2)}
.rost-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
.rost-chips i{font-style:normal;font-size:11px;padding:1px 6px;border:1px solid var(--rule-2);
  border-radius:2px;color:var(--ink-2);background:var(--paper)}
.side-foot{padding:14px 20px 28px;font-size:11px;line-height:1.7;color:var(--ink-3)}
.badge{font-size:11px;padding:1px 7px;border:1px solid var(--rule-2);border-radius:2px;color:var(--ink-2)}
.rost.on .badge,.char-h .badge{border-color:var(--seal);color:var(--seal)}

/* ---------- main area ---------- */
.main{padding:26px 28px 72px;min-width:0;max-width:1500px}
.char{display:none}
.char.on{display:block}
.char-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--rule-2)}
.char-n{font:500 13px/1 var(--mono);color:var(--seal)}
.char-h h2{font:400 clamp(24px,2.4vw,30px)/1.1 var(--serif);letter-spacing:.05em}
.aka{font-size:12px;color:var(--ink-3)}
.char-one{margin-left:auto;font:400 14px/1.7 var(--serif);color:var(--ink-2);text-align:right;max-width:44ch}
@media(max-width:900px){.char-one{margin-left:0;text-align:left}}

.upper{display:grid;grid-template-columns:minmax(0,1fr) 500px;gap:26px;align-items:start;margin-top:20px}
@media(max-width:1240px){.upper{grid-template-columns:1fr}}

/* The sheet is white stock */
.plate-wrap{position:relative;margin:0}
.plate{display:block;width:100%;padding:0;background:#fff;border:1px solid var(--rule-2);
  border-radius:2px;overflow:hidden;cursor:zoom-in}
.plate img{display:block;width:100%;height:auto}
.plate:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
/* Floats over the image in the bottom-right corner, obvious only on hover — do not block the picture */
.copy-img{position:absolute;right:10px;bottom:10px;font:500 11px/1 var(--sans);color:var(--ink-2);
  background:var(--paper);border:1px solid var(--rule-2);border-radius:3px;padding:6px 10px;
  cursor:pointer;opacity:.55;transition:.15s}
.plate-wrap:hover .copy-img{opacity:1}
.copy-img:hover{border-color:var(--seal);color:var(--seal)}
.copy-img:focus-visible{opacity:1;outline:2px solid var(--seal);outline-offset:2px}
.copy-img[data-done]{border-color:var(--seal);color:var(--seal);opacity:1}

/* Lightbox */
.lightbox{position:fixed;inset:0;z-index:50;display:none;place-items:center;
  background:#191d21e6;padding:32px;cursor:zoom-out}
.lightbox.on{display:grid}
.lightbox img{max-width:100%;max-height:100%;background:#fff;border-radius:2px;
  box-shadow:0 8px 40px #0006}
.lightbox-x{position:absolute;top:18px;right:22px;font:500 13px/1 var(--sans);color:#fff;
  background:none;border:1px solid #fff6;border-radius:3px;padding:8px 12px;cursor:pointer}
.lightbox-x:hover{border-color:#fff}
.plate-empty{display:grid;place-items:center;min-height:220px;text-align:center;
  border:1px dashed var(--rule-2);background:var(--panel);color:var(--ink-3);font-size:13px}
.plate-empty em{font-style:normal;font-size:12px;opacity:.8}
.plate-c{margin:7px 0 0;font-size:11px;letter-spacing:.1em;color:var(--ink-3)}

.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 30px;margin-top:24px}
@media(max-width:700px){.grid2{grid-template-columns:1fr}}
.blk{margin-bottom:20px}
.blk h3{font:500 11px/1 var(--sans);letter-spacing:.2em;color:var(--seal);margin-bottom:7px}
.blk p{margin:0;font-size:13.5px;line-height:1.85}

/* Source text: serif, rust-red bar. This is the book itself speaking */
.source .quotes{display:grid;grid-template-columns:1fr 1fr;gap:10px 30px}
@media(max-width:700px){.source .quotes{grid-template-columns:1fr}}
.source blockquote{margin:0;padding-left:13px;border-left:2px solid var(--seal);
  font:400 13.5px/1.85 var(--serif)}

/* ---------- right-hand info card ---------- */
.side-cards{display:flex;flex-direction:column;gap:14px}
.card{border:1px solid var(--rule);border-radius:2px;background:var(--panel);padding:14px 16px}
.card h4{font:500 11px/1 var(--sans);letter-spacing:.2em;color:var(--ink-3);margin-bottom:10px;
  display:flex;align-items:center;gap:8px}
.tag-en{font:500 9px/1 var(--mono);letter-spacing:.22em;color:var(--rule-2);font-style:normal}
.card dl{margin:0}
.kv{display:flex;gap:12px;padding:2.5px 0;font-size:13px}
.kv dt{color:var(--ink-3);flex:none;width:46px}
.kv dd{margin:0;min-width:0}
.rel-n{color:var(--ink)!important;width:auto!important;min-width:46px}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 0;padding:0;list-style:none}
.tags li{font:400 11px/1.5 var(--mono);color:var(--ink-2);border:1px solid var(--rule-2);
  background:var(--paper);border-radius:2px;padding:1px 6px}

/* ---------- prompts ---------- */
.prompts{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px}
@media(max-width:900px){.prompts{grid-template-columns:1fr}}
.pgroup{border:1px solid var(--rule);border-radius:2px;background:var(--panel);padding:6px 14px 10px}
.pr{border-bottom:1px solid var(--rule)}
.pgroup .pr:last-of-type{border-bottom:0}
.pr summary{display:flex;align-items:center;gap:10px;padding:11px 0;cursor:pointer;list-style:none;
  font:500 12px/1 var(--sans);letter-spacing:.04em}
.pr summary::-webkit-details-marker{display:none}
.pr summary::before{content:"▸";color:var(--seal);font-size:11px;transition:transform .15s}
.pr[open] summary::before{transform:rotate(90deg)}
.pr summary span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pr p{margin:0 0 12px;padding:11px 12px;background:var(--paper);border:1px solid var(--rule);
  border-radius:2px;font:400 12px/1.75 var(--mono);white-space:pre-wrap;word-break:break-word}
.pgroup-f{padding:12px 0 4px}

.copy{flex:none;font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--paper);
  border:1px solid var(--rule-2);border-radius:2px;padding:4px 10px;cursor:pointer;transition:.15s}
.copy:hover{border-color:var(--seal);color:var(--seal)}
.copy:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.copy[data-done]{border-color:var(--seal);color:var(--seal)}
.copy.wide{width:100%;padding:9px}

/* ---------- relationship map ---------- */
/* The layout is computed in Node and written into the SVG; here we only handle highlighting. Red is still reserved for the selected state */
.gtoggle{display:flex;align-items:center;gap:9px;width:100%;padding:13px 20px;text-align:left;
  background:none;border:0;border-bottom:1px solid var(--rule);border-left:2px solid transparent;
  cursor:pointer;color:var(--ink-2);font:500 12px/1 var(--sans);letter-spacing:.1em}
.gtoggle:hover{background:#00000006}
.gtoggle.on{background:var(--panel);border-left-color:var(--seal);color:var(--seal)}
.gtoggle:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
.gtoggle svg{width:15px;height:15px;flex:none;stroke:currentColor;fill:none;stroke-width:1.3}
.graph{display:none}
.graph.on{display:block}
.main.gmode .char{display:none}
.graph-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--rule-2)}
.graph-h h2{font:400 clamp(22px,2.2vw,28px)/1.1 var(--serif);letter-spacing:.05em}
.graph-h .hint{margin-left:auto;font-size:12px;color:var(--ink-3)}
.graph-body{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:26px;
  align-items:start;margin-top:20px}
@media(max-width:1100px){.graph-body{grid-template-columns:1fr}}
.graph-canvas{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:10px}
.graph-canvas svg{display:block;width:100%;height:auto}
.graph-empty{margin:0 0 8px;text-align:center;font-size:12.5px;color:var(--ink-3)}
.gedge{fill:none;stroke:var(--rule-2);stroke-width:1.1;transition:.15s}
.gedge.hot{stroke:var(--seal);stroke-width:2}
.gedge.dim{opacity:.15}
.gnode{cursor:pointer;transition:.15s}
.gnode .gdot{fill:var(--paper);stroke:var(--ink-2);stroke-width:1.5}
/* Invisible hit area: the node itself is only ten-odd pixels, so the cursor rarely lands on it.
   A separate class, so the .lead / .hot rules below do not stain it too */
.gnode .ghit{fill:none;stroke:none;pointer-events:all}
.gnode text{font:400 13px var(--serif);fill:var(--ink)}
.gnode.lead .gdot{fill:var(--seal);stroke:var(--seal)}
.gnode.hot .gdot{stroke:var(--seal);stroke-width:2.5}
.gnode.hot text{fill:var(--seal)}
.gnode.dim{opacity:.22}
.gnode:focus-visible{outline:2px solid var(--seal)}
/* Relationship text on the chords. Shown or hidden by default according to edge count, and the hovered one always shows.
   paint-order + same-colour stroke = a backing ring around the glyphs, readable even over a chord */
.glabel{display:none;font:400 9px var(--sans);fill:var(--ink-3);pointer-events:none;
  paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round}
.graph.labels .glabel{display:block}
.glabel.dim{opacity:.15}
.glabel.hot{display:block;fill:var(--seal);font-weight:500}
.glabtoggle{font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--paper);
  border:1px solid var(--rule-2);border-radius:2px;padding:4px 10px;cursor:pointer;transition:.15s}
.glabtoggle:hover{border-color:var(--seal);color:var(--seal)}
.glabtoggle.on{border-color:var(--seal);color:var(--seal);background:var(--seal-soft)}
.glabtoggle:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.grel{border:1px solid var(--rule);border-radius:2px;background:var(--panel)}
.grel h4{font:500 11px/1 var(--sans);letter-spacing:.2em;color:var(--ink-3);padding:14px 16px 11px}
.grel-list{max-height:56vh;overflow-y:auto;border-top:1px solid var(--rule)}
.grow{display:block;width:100%;text-align:left;padding:11px 16px;background:none;border:0;
  border-bottom:1px solid var(--rule);cursor:pointer;color:inherit;transition:.15s}
.grow:last-child{border-bottom:0}
.grow:hover,.grow.hot{background:var(--seal-soft)}
.grow.dim{opacity:.3}
.grow:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
.grow b{font:400 14px/1.4 var(--serif);letter-spacing:.03em}
.grow i{font-style:normal;color:var(--ink-3);padding:0 6px}
.grow span{display:block;margin-top:4px;font-size:12.5px;line-height:1.65;color:var(--ink-2)}
.grow em{font-style:normal;color:var(--ink-3)}
.grel-foot{margin:0;padding:11px 16px;border-top:1px solid var(--rule);
  font-size:11px;line-height:1.6;color:var(--ink-3)}

/* Signature: inferred marker */
.inf{color:var(--ink-3);font-size:.88em;background:var(--seal-soft);padding:0 3px;border-radius:2px}

.nomatch{display:none;padding:20px;font-size:13px;color:var(--ink-3)}
.nomatch.on{display:block}

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

/* One character at a time on screen, complete on paper */
@media print{
  .top,.side,.copy{display:none!important}
  .shell{display:block}
  .main{padding:0}
  .graph{display:block!important;page-break-after:always}
  .char{display:block!important;page-break-after:always}
  .pr p{display:block!important}
  .pr summary::before{content:""}
  body{background:#fff}
}
</style></head><body>

<header class="top">
  <div class="brand"><h1>${esc(source)}</h1></div>
  <div class="search">
    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke-width="1.5"/><path d="M11 11l4 4" stroke-width="1.5"/></svg>
    <input id="q" type="search" placeholder="${esc(t.searchPlaceholder)}" aria-label="${esc(t.searchPlaceholder)}" autocomplete="off">
  </div>
  <div class="topmeta">
    <span>${esc(t.kicker)}</span><i>·</i>
    <span>${esc(t.counts(characters.length, shots))}</span>
    <button class="expo" data-name="${esc(slug(source))}-cast.json">${esc(t.exportJson)}</button>
  </div>
</header>

<div class="shell">
  <aside class="side">
    ${summary ? `<section class="synopsis syn-clamp"><div class="lbl">${esc(t.synopsis)}</div><p>${marked(summary)}</p><button class="syn-more">${esc(t.expandAll)}</button></section>` : ''}
    <button class="gtoggle" aria-controls="graph">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.2" cy="4" r="1.9"/><circle cx="12.8" cy="6.2" r="1.9"/><circle cx="7.2" cy="13" r="1.9"/><path d="M5 4.6l6 1.2M4 5.9l2.5 5.4M11.7 7.9l-3.3 3.7"/></svg>
      <span>${esc(t.graphTitle)}</span>
    </button>
    <div class="roster-h lbl">${esc(t.rosterTitle)}</div>
    <nav class="roster" aria-label="${esc(t.indexLabel)}">
      ${ordered.map((c, i) => renderRosterItem(c, i, t)).join('\n')}
    </nav>
    <p class="nomatch">${esc(t.noMatch)}</p>
    <p class="side-foot">${esc(t.footnote)}</p>
  </aside>

  <main class="main">
    ${renderGraph(ordered, t)}
    ${ordered.map((c, i) => renderCharacter(c, i, t)).join('\n')}
  </main>
</div>

<div class="lightbox" role="dialog" aria-modal="true">
  <button class="lightbox-x" aria-label="${esc(t.closeImage)}">${esc(t.closeImage)}</button>
  <img alt="">
</div>

<script type="application/json" id="cast-data">${embedCast(characters, source, summary, lang, ui)}</script>

<script>
const L = ${JSON.stringify({ copied: t.copied, failed: t.copyFailed })};

// Export: the report carries the complete cast.json itself, and downloads it as-is
document.querySelector('.expo').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const url = URL.createObjectURL(
    new Blob([document.getElementById('cast-data').textContent], { type: 'application/json' }),
  );
  const a = Object.assign(document.createElement('a'), { href: url, download: btn.dataset.name });
  a.click();
  // Do not revoke immediately after click — on Safari it revokes the blob before the download has finished reading, saving an empty file
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

// Left-rail switching: show only one character at a time
document.querySelector('.roster').addEventListener('click', (e) => {
  const btn = e.target.closest('.rost');
  if (!btn) return;
  document.querySelectorAll('.rost').forEach((b) => b.classList.toggle('on', b === btn));
  document.querySelectorAll('.char').forEach((a) => a.classList.toggle('on', a.id === btn.dataset.target));
  showGraph(false);
  document.querySelector('.main').scrollIntoView({ block: 'start', behavior: 'smooth' });
});

// Relationship map: a panoramic view, mutually exclusive with character detail
const gv = document.querySelector('.graph');
const gbtn = document.querySelector('.gtoggle');
function showGraph(on) {
  gv.classList.toggle('on', on);
  gbtn.classList.toggle('on', on);
  document.querySelector('.main').classList.toggle('gmode', on);
}
gbtn.addEventListener('click', () => {
  showGraph(true);
  document.querySelector('.main').scrollIntoView({ block: 'start', behavior: 'smooth' });
});
{
  // Chords and the text on them share data-a/data-b and the highlighting logic is identical, so they go in one array
  const edges = [...gv.querySelectorAll('.gedge, .glabel')];
  const nodes = [...gv.querySelectorAll('.gnode')];
  const rows = [...gv.querySelectorAll('.grow')];
  const clear = () => [...edges, ...nodes, ...rows].forEach((el) => el.classList.remove('hot', 'dim'));

  // Hover a person: their relationship lines light up, unrelated ones are pushed into the background
  const byNode = (name) => {
    const near = new Set([name]);
    for (const e of edges) {
      if (e.dataset.a === name) near.add(e.dataset.b);
      if (e.dataset.b === name) near.add(e.dataset.a);
    }
    for (const e of edges) {
      const hot = e.dataset.a === name || e.dataset.b === name;
      e.classList.toggle('hot', hot);
      e.classList.toggle('dim', !hot);
    }
    for (const nd of nodes) {
      nd.classList.toggle('hot', nd.dataset.node === name);
      nd.classList.toggle('dim', !near.has(nd.dataset.node));
    }
    for (const r of rows) {
      const hot = r.dataset.a === name || r.dataset.b === name;
      r.classList.toggle('hot', hot);
      r.classList.toggle('dim', !hot);
    }
  };

  // Hover a row of the relationship table: light up only that one chord
  const byEdge = (a, b) => {
    for (const e of edges) {
      const hot = e.dataset.a === a && e.dataset.b === b;
      e.classList.toggle('hot', hot);
      e.classList.toggle('dim', !hot);
    }
    for (const nd of nodes) {
      const hot = nd.dataset.node === a || nd.dataset.node === b;
      nd.classList.toggle('hot', hot);
      nd.classList.toggle('dim', !hot);
    }
    for (const r of rows) {
      const hot = r.dataset.a === a && r.dataset.b === b;
      r.classList.toggle('hot', hot);
      r.classList.toggle('dim', !hot);
    }
  };

  const jump = (el) => {
    const item = document.querySelector('.rost[data-target="' + el.dataset.target + '"]');
    if (item) item.click();
  };

  // Master toggle for relationship text: with many people the labels cover the map, so collapse them in one click
  const glab = gv.querySelector('.glabtoggle');
  glab.addEventListener('click', () => {
    const on = !gv.classList.contains('labels');
    gv.classList.toggle('labels', on);
    glab.classList.toggle('on', on);
    glab.setAttribute('aria-pressed', String(on));
  });

  gv.addEventListener('mouseover', (e) => {
    const nd = e.target.closest('.gnode');
    const row = e.target.closest('.grow');
    if (nd) byNode(nd.dataset.node);
    else if (row) byEdge(row.dataset.a, row.dataset.b);
    else clear();
  });
  gv.addEventListener('mouseleave', clear);
  gv.addEventListener('focusin', (e) => {
    const nd = e.target.closest('.gnode');
    if (nd) byNode(nd.dataset.node);
  });
  gv.addEventListener('click', (e) => {
    const hit = e.target.closest('.gnode, .grow');
    if (hit) jump(hit);
  });
  // SVG <g> is not a native button; Enter/Space must be wired up by hand
  gv.addEventListener('keydown', (e) => {
    const nd = e.target.closest('.gnode');
    if (!nd || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    jump(nd);
  });
}

// Search: filter the left rail; when only one result is left, switch straight to it
document.getElementById('q').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  let hits = [];
  document.querySelectorAll('.rost').forEach((b) => {
    const hit = !q || b.dataset.hay.toLowerCase().includes(q);
    b.style.display = hit ? '' : 'none';
    if (hit) hits.push(b);
  });
  document.querySelector('.nomatch').classList.toggle('on', hits.length === 0);
  if (q && hits.length === 1) hits[0].click();
});

// The summary is three lines by default; click to expand it fully, and short ones that need no collapsing drop the clamp entirely
const syn = document.querySelector('.synopsis');
if (syn) {
  const body = syn.querySelector('p');
  if (body.scrollHeight <= body.clientHeight + 1) syn.classList.remove('syn-clamp');
  syn.addEventListener('click', () => syn.classList.remove('syn-clamp'));
}

// Image lightbox
const lb = document.querySelector('.lightbox');
const lbImg = lb.querySelector('img');
function closeLb() { lb.classList.remove('on'); lbImg.removeAttribute('src'); }
document.addEventListener('click', (e) => {
  const z = e.target.closest('.zoom');
  if (z) { lbImg.src = z.dataset.src; lb.classList.add('on'); return; }
  if (e.target.closest('.lightbox')) closeLb();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });

// Copy the image itself to the clipboard (not the path)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-img');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const label = btn.textContent;
  try {
    const blob = await (await fetch(btn.dataset.img)).blob();
    // Safari only accepts image/png; transcode other formats through a canvas first
    let png = blob;
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob);
      const cv = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
      cv.getContext('2d').drawImage(bmp, 0, 0);
      png = await new Promise((r) => cv.toBlob(r, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    btn.textContent = L.copied;
    btn.dataset.done = '1';
  } catch {
    btn.textContent = L.failed;
  }
  setTimeout(() => { btn.textContent = label; delete btn.dataset.done; }, 1600);
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy');
  if (!btn) return;
  e.preventDefault();
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    btn.textContent = L.copied;
    btn.dataset.done = '1';
  } catch {
    btn.textContent = L.failed;
  }
  setTimeout(() => { btn.textContent = label; delete btn.dataset.done; }, 1600);
});
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = `novel-characters.mjs — deterministic helpers for the novel-characters skill

  seed <outline.json>              prefill the cast skeleton from an outline (prints to stdout; profile and prompts left blank)
  chunk <book.txt> <workdir>       paragraph-aware overlapping chunks, writes chunk-NN.txt, prints the chunk count
  merge <workdir>                  merge roster-*.json, prints {characters, mergeCandidates}
        [--apply merges.json]      apply the reviewed merge decisions: {"merges":[{"keep":…,"absorb":[…]}]}
  assemble <workdir> --source <book name>
        [--lang] [--out]           combine card-*.json + story summary (+ UI translation) into cast.json
        [--summary <file>]         story summary file (default <workdir>/summary.txt)
        [--ui <file>]              UI string translation (default <workdir>/ui.json; not needed for built-in languages)
        [--order merged.json]      screen-time order within a tier (default: finds <workdir>/merged.json automatically)
  validate <cast.json> <book.txt>  validate; prints each violation and exits 1
  render <cast.json> [--html|--md] render the report to stdout (--md by default)
  slug <name>                      turn a character name into a safe filename
  ui-template [lang]               print the UI string skeleton, for translating into a language not in the built-in table

Common options:
  --lang <code>     report language, defaulting to cast.json's lang, then to ${DEFAULT_LANG}
                    built-in UI strings: ${SUPPORTED_UI_LANGS.join(' / ')}; other language codes use the English skeleton

render options:
  --source <name>   book title for the report heading (default: cast.json's source, else the filename)
  --images <dir>    directory holding the sheets, any path (resolved against the current directory); default images/ next to cast.json
                    looks for <dir>/<slug>-sheet.png; image paths in the report assume "the report is written next to cast.json"`;

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

/** Read the value of --flag, returning fallback if absent. */
function flag(rest, name, fallback = null) {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback;
}

/** cast.json may be {source, lang, summary, characters}, or a bare array (the old format). */
function loadCast(path) {
  const raw = readJson(path);
  const characters = Array.isArray(raw) ? raw : raw.characters;
  if (!Array.isArray(characters)) throw new Error(`no characters array in ${path}`);
  return {
    characters,
    source: Array.isArray(raw) ? null : raw.source,
    summary: Array.isArray(raw) ? '' : (raw.summary ?? ''),
    lang: Array.isArray(raw) ? DEFAULT_LANG : (raw.lang ?? DEFAULT_LANG),
    ui: Array.isArray(raw) ? null : (raw.ui ?? null),
  };
}

function main(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  if (cmd === 'seed') {
    const [path] = rest;
    if (!path) throw new Error('usage: seed <outline.json>');
    console.log(JSON.stringify(seedFromOutline(readJson(path)), null, 2));
    return;
  }

  if (cmd === 'chunk') {
    const [book, workdir] = rest;
    if (!book || !workdir) throw new Error('usage: chunk <book.txt> <workdir>');
    const text = readFileSync(resolve(book), 'utf8');
    const chunks = chunkText(text);
    mkdirSync(resolve(workdir), { recursive: true });
    chunks.forEach((c, i) => {
      writeFileSync(join(resolve(workdir), `chunk-${String(i).padStart(2, '0')}.txt`), c, 'utf8');
    });
    const truncated = chunks.length >= MAX_CHUNKS && text.length > CHUNK_SIZE * MAX_CHUNKS;
    console.log(
      JSON.stringify(
        { chunks: chunks.length, chars: text.length, workdir: resolve(workdir), truncated },
        null,
        2,
      ),
    );
    if (truncated) console.error(`⚠️ text exceeds the ${MAX_CHUNKS}-chunk cap; the tail was not scanned`);
    return;
  }

  if (cmd === 'merge') {
    const [workdir] = rest;
    if (!workdir || workdir.startsWith('--')) throw new Error('usage: merge <workdir> [--apply merges.json]');
    const dir = resolve(workdir);
    const files = readdirSync(dir).filter((f) => /^roster-.*\.json$/.test(f)).sort();
    if (!files.length) throw new Error(`no roster-*.json in ${dir}`);
    const batches = files.map((f) => {
      const raw = readJson(join(dir, f));
      return Array.isArray(raw) ? raw : (raw.characters ?? []);
    });
    let cast = mergeRoster(batches);
    const applyPath = flag(rest, '--apply');
    if (applyPath) {
      const raw = readJson(applyPath);
      cast = applyMerges(cast, Array.isArray(raw) ? raw : (raw.merges ?? []));
    }
    // mergeCandidates is a suspect list, not a verdict: the caller reviews it, writes merges.json, then --apply
    console.log(JSON.stringify({ characters: cast, mergeCandidates: mergeCandidates(cast) }, null, 2));
    return;
  }

  if (cmd === 'assemble') {
    const [workdir] = rest;
    if (!workdir || workdir.startsWith('--')) {
      throw new Error('usage: assemble <workdir> --source <book name> [--lang zh] [--out cast.json]');
    }
    const dir = resolve(workdir);
    const sourceName = flag(rest, '--source');
    if (!sourceName) throw new Error('assemble needs --source <book name>');
    const lang = flag(rest, '--lang', DEFAULT_LANG);

    const files = readdirSync(dir).filter((f) => /^card-.*\.json$/.test(f)).sort();
    if (!files.length) throw new Error(`no card-*.json in ${dir}`);

    // Lenient parsing: one bad card does not spoil the batch — name them one by one and re-run just the bad character
    const problems = [];
    const cards = [];
    const seen = new Map();
    for (const f of files) {
      let card;
      try {
        card = readJson(join(dir, f));
      } catch (error) {
        problems.push(`${f} is not valid JSON (${error.message}) — re-run just this character`);
        continue;
      }
      if (!card || typeof card !== 'object' || Array.isArray(card) || !card.name) {
        problems.push(`${f} is not a single character card (no name) — re-run just this character`);
        continue;
      }
      if (seen.has(card.name)) {
        problems.push(`「${card.name}」has two cards (${seen.get(card.name)} and ${f}); delete the extra one`);
        continue;
      }
      seen.set(card.name, f);
      cards.push(card);
    }

    // All three side files can be given their own path; only when absent does it look in the work directory for the copy the skill wrote
    const summaryPath = resolve(flag(rest, '--summary', join(dir, 'summary.txt')));
    const summary = existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8').trim() : '';
    if (!summary) problems.push(`missing ${summaryPath} (story summary) — write 3–5 sentences in the report language, or pass --summary`);

    const uiPath = resolve(flag(rest, '--ui', join(dir, 'ui.json')));
    const ui = existsSync(uiPath) ? readJson(uiPath) : null;
    if (needsUiTranslation(lang) && !ui) {
      problems.push(`lang=${lang} is not a built-in UI language, and ${uiPath} is missing — generate a skeleton with ui-template, translate it, and put it there; or pass --ui`);
    }

    // A character's screen-time order within a tier comes from merge's output — cards read by filename are in slug
    // lexicographic order, and without the order, "sorted by screen time" is empty words
    const orderPath = flag(rest, '--order', existsSync(join(dir, 'merged.json')) ? join(dir, 'merged.json') : null);
    let order = null;
    if (orderPath) {
      const raw = readJson(orderPath);
      const list = Array.isArray(raw) ? raw : (raw.characters ?? []);
      order = list.map((e) => (typeof e === 'string' ? e : e?.name)).filter(Boolean);
    } else {
      console.error(`⚠️ no --order and no ${join(dir, 'merged.json')}; characters in the same tier will be ordered by filename rather than by screen time`);
    }

    if (problems.length) {
      console.error(`✗ ${problems.length} problem(s):\n`);
      for (const p of problems) console.error('  ' + p);
      process.exit(1);
    }

    const cast = assembleCast(cards, { source: sourceName, lang, summary, ui, order });
    const json = JSON.stringify(cast, null, 2) + '\n';
    const out = flag(rest, '--out');
    if (out) {
      writeFileSync(resolve(out), json, 'utf8');
      console.log(`✓ ${cast.characters.length} characters → ${resolve(out)}`);
    } else {
      process.stdout.write(json);
    }
    return;
  }

  if (cmd === 'validate') {
    const [castPath, bookPath] = rest;
    if (!castPath) throw new Error('usage: validate <cast.json> <book.txt>');
    const { characters, summary, lang: castLang, ui } = loadCast(castPath);
    const lang = flag(rest, '--lang', castLang);
    const source = bookPath ? readFileSync(resolve(bookPath), 'utf8') : null;
    if (!bookPath) console.error('⚠️ no source text given; skipping the verbatim-quote check');
    const problems = validateCast(characters, source, lang);
    // The top-level story summary — the report needs it, and without it the top of the report cannot set the scene
    if (typeof summary !== 'string' || !summary.trim()) {
      problems.unshift('top-level summary (story summary) is missing; the top of the report will be blank');
    }
    // This language is not in the built-in table and no ui translation was given — the report UI will show English
    if (needsUiTranslation(lang) && !ui) {
      problems.unshift(
        `lang=${lang} is not a built-in UI language (${SUPPORTED_UI_LANGS.join('/')}); ` +
          'the top level needs a ui translation, or the UI strings will be in English. ' +
          'Generate a skeleton with `ui-template`, translate it, and put it in.',
      );
    }
    if (problems.length) {
      console.error(`✗ ${problems.length} violation(s):\n`);
      for (const p of problems) console.error('  ' + p);
      process.exit(1);
    }
    console.log(`✓ all ${characters.length} characters passed validation (lang=${lang})`);
    return;
  }

  if (cmd === 'render') {
    const [castPath] = rest;
    if (!castPath) throw new Error('usage: render <cast.json> [--html|--md]');
    const html = rest.includes('--html');
    const imagesFlag = flag(rest, '--images');
    const sourceFlag = flag(rest, '--source');

    const { characters, source, summary, lang: castLang, ui } = loadCast(castPath);
    const lang = flag(rest, '--lang', castLang);
    const title = sourceFlag ?? source ?? basename(castPath).replace(/\.[^.]+$/, '');

    // Images are assets the user generated downstream, and where they live is the user's call: --images is resolved as a
    // normal command-line path; only when absent does it fall back to images/ next to cast.json. The report is written next
    // to cast.json by default, with src as a path relative to there, so moving the whole directory together does not break it.
    // A missing image renders as a placeholder.
    const outDir = resolve(castPath, '..');
    const imagesDir = imagesFlag ? resolve(imagesFlag) : join(outDir, 'images');
    for (const c of characters) {
      const abs = join(imagesDir, `${slug(c.name)}-sheet.png`);
      if (existsSync(abs)) c.sheetImage = relative(outDir, abs).split(sep).join('/');
    }

    process.stdout.write(
      (html
        ? renderHtml(characters, title, summary, lang, ui)
        : renderMarkdown(characters, title, summary, lang, ui)) + '\n',
    );
    return;
  }

  if (cmd === 'ui-template') {
    const lang = rest[0] ?? '<lang>';
    console.log(
      JSON.stringify(
        { note: `Translate every value below into ${lang}, then put the whole block into the top-level "ui" of cast.json`, ui: uiTemplate() },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === 'slug') {
    if (!rest[0]) throw new Error('usage: slug <name>');
    console.log(slug(rest[0]));
    return;
  }

  throw new Error(`unknown command ${cmd}\n\n${USAGE}`);
}

// Run the CLI only when executed directly — selftest.mjs needs to import these functions.
// Take realpath on both sides: with a symlinked install, argv[1] is the link path while import.meta.url
// has already been resolved by Node to the real path, so they never match without normalising.
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  // Exit quietly when a pipe such as `render ... | head` closes early, rather than dumping an EPIPE stack
  process.stdout.on('error', (e) => {
    if (e.code === 'EPIPE') process.exit(0);
    throw e;
  });
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
