/**
 * Parser and catalog helpers for Serbian law ingestion from official PIS APIs.
 */

export interface RegSearchResult {
  id: string;
  uuid: string;
  title: string;
  docType: string;
  l2: string;
  l3: string;
}

export interface RegSearchResponse {
  limit: number;
  resultSize: number;
  result: RegSearchResult[];
}

interface LegacyLawOverride {
  id: string;
  shortName?: string;
  fallbackTitleEn?: string;
  fileName?: string;
}

const LEGACY_LAW_OVERRIDES: Record<string, LegacyLawOverride> = {
  'Закон о заштити података о личности': {
    id: 'rs-personal-data-protection',
    shortName: 'ZZPL',
    fallbackTitleEn: 'Law on Personal Data Protection',
    fileName: '01-personal-data-protection.json',
  },
  'Закон о информационој безбедности': {
    id: 'rs-information-security',
    shortName: 'ZIB',
    fallbackTitleEn: 'Law on Information Security',
    fileName: '02-information-security.json',
  },
  'Закон о електронским комуникацијама': {
    id: 'rs-electronic-communications',
    shortName: 'ZEK',
    fallbackTitleEn: 'Law on Electronic Communications',
    fileName: '03-electronic-communications.json',
  },
  'Закон о електронској трговини': {
    id: 'rs-electronic-commerce',
    shortName: 'ZET',
    fallbackTitleEn: 'Law on Electronic Commerce',
    fileName: '04-electronic-commerce.json',
  },
  'Закон о електронском документу, електронској идентификацији и услугама од поверења у електронском пословању': {
    id: 'rs-electronic-document-identification',
    shortName: 'ZEDEIUP',
    fallbackTitleEn: 'Law on Electronic Document, Electronic Identification and Trust Services in Electronic Business',
    fileName: '05-electronic-document-identification.json',
  },
  'Закон о слободном приступу информацијама од јавног значаја': {
    id: 'rs-freedom-of-information',
    shortName: 'ZSPIJZ',
    fallbackTitleEn: 'Law on Free Access to Information of Public Importance',
    fileName: '06-freedom-of-information.json',
  },
  'Закон о тајности података': {
    id: 'rs-information-secrecy',
    shortName: 'ZTP',
    fallbackTitleEn: 'Information Secrecy Law',
    fileName: '07-information-secrecy.json',
  },
  'Закон о критичној инфраструктури': {
    id: 'rs-critical-infrastructure',
    shortName: 'ZKI',
    fallbackTitleEn: 'Law on Critical Infrastructure',
    fileName: '08-critical-infrastructure.json',
  },
  'Закон о електронској управи': {
    id: 'rs-electronic-government',
    shortName: 'ZEU',
    fallbackTitleEn: 'Law on Electronic Government',
    fileName: '09-electronic-government.json',
  },
  'Закон о заштити пословне тајне': {
    id: 'rs-trade-secrets',
    shortName: 'ZZPT',
    fallbackTitleEn: 'Law on Protection of Trade Secret',
    fileName: '10-trade-secrets.json',
  },
};

const ASCII_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j',
  к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's',
  А: 'a', Б: 'b', В: 'v', Г: 'g', Д: 'd', Ђ: 'dj', Е: 'e', Ж: 'z', З: 'z', И: 'i', Ј: 'j',
  К: 'k', Л: 'l', Љ: 'lj', М: 'm', Н: 'n', Њ: 'nj', О: 'o', П: 'p', Р: 'r', С: 's',
  Т: 't', Ћ: 'c', У: 'u', Ф: 'f', Х: 'h', Ц: 'c', Ч: 'c', Џ: 'dz', Ш: 's',
  č: 'c', ć: 'c', ž: 'z', š: 's', đ: 'dj',
  Č: 'c', Ć: 'c', Ž: 'z', Š: 's', Đ: 'dj',
};

function transliterateToAscii(value: string): string {
  return value
    .split('')
    .map(ch => ASCII_MAP[ch] ?? ch)
    .join('');
}

export function slugifySerbian(value: string): string {
  return transliterateToAscii(value)
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function splitSearchTitle(rawTitle: string): { baseTitle: string; officialRef?: string } {
  const normalized = normalizeText(rawTitle);
  const splitIdx = normalized.lastIndexOf(':');

  if (splitIdx <= 0) {
    return { baseTitle: normalized };
  }

  const tail = normalized.slice(splitIdx + 1).trim();
  const head = normalized.slice(0, splitIdx).trim();

  if (!head || !tail) {
    return { baseTitle: normalized };
  }

  // Gazette refs consistently include year/number patterns.
  if (!/\d{2,4}\/\d{1,4}/.test(tail)) {
    return { baseTitle: normalized };
  }

  return { baseTitle: head, officialRef: tail };
}

function uniqueId(baseId: string, used: Set<string>): string {
  if (!used.has(baseId)) {
    used.add(baseId);
    return baseId;
  }

  let idx = 2;
  while (used.has(`${baseId}-${idx}`)) {
    idx += 1;
  }

  const id = `${baseId}-${idx}`;
  used.add(id);
  return id;
}

export interface CatalogLaw {
  order: number;
  id: string;
  fileName: string;
  guid: string;
  docType: string;
  titleRaw: string;
  title: string;
  titleEnFallback?: string;
  shortName?: string;
  officialRef?: string;
  l2: string;
  l3: string;
}

export function buildLawCatalog(results: RegSearchResult[]): CatalogLaw[] {
  const byGuid = new Map<string, RegSearchResult>();
  for (const row of results) {
    if (!row?.uuid || !row?.title) continue;
    if (!byGuid.has(row.uuid)) {
      byGuid.set(row.uuid, row);
    }
  }

  const sorted = Array.from(byGuid.values()).sort((a, b) => {
    const aKey = `${a.l2}\u0001${a.l3}\u0001${a.title}`;
    const bKey = `${b.l2}\u0001${b.l3}\u0001${b.title}`;
    return aKey.localeCompare(bKey, 'sr');
  });

  const usedIds = new Set<string>();

  return sorted.map((row, index) => {
    const { baseTitle, officialRef } = splitSearchTitle(row.title);
    const override = LEGACY_LAW_OVERRIDES[baseTitle];

    const defaultBaseId = `rs-law-${slugifySerbian(baseTitle).slice(0, 72) || 'untitled'}`;
    const id = uniqueId(override?.id ?? defaultBaseId, usedIds);
    const fileName = override?.fileName && id === override.id
      ? override.fileName
      : `${String(index + 1).padStart(4, '0')}-${id}.json`;

    return {
      order: index + 1,
      id,
      fileName,
      guid: row.uuid,
      docType: row.docType,
      titleRaw: row.title,
      title: baseTitle,
      titleEnFallback: override?.fallbackTitleEn,
      shortName: override?.shortName,
      officialRef,
      l2: row.l2,
      l3: row.l3,
    };
  });
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en?: string;
  short_name?: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date?: string;
  in_force_date?: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

interface ParsedParagraph {
  className: string;
  text: string;
}

interface ArticleMarker {
  section: string;
  inlineTitle?: string;
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ldquo;': '“',
    '&rdquo;': '”',
    '&bdquo;': '„',
    '&ndash;': '–',
    '&mdash;': '—',
  };

  let output = input;
  for (const [key, value] of Object.entries(named)) {
    output = output.replaceAll(key, value);
  }

  output = output.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
    const codePoint = parseInt(hex, 16);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
  });

  output = output.replace(/&#(\d+);/g, (_, dec: string) => {
    const codePoint = parseInt(dec, 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
  });

  return output;
}

function stripTags(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n');
  const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withoutTags)
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function extractParagraphs(html: string): ParsedParagraph[] {
  const paragraphs: ParsedParagraph[] = [];
  const paragraphRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;

  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(html)) !== null) {
    const attrs = match[1] ?? '';
    const raw = match[2] ?? '';

    const classMatch = attrs.match(/class\s*=\s*["']([^"']+)["']/i);
    const className = classMatch ? classMatch[1].trim().split(/\s+/)[0] : '';

    const text = stripTags(raw);
    if (!text) continue;

    paragraphs.push({ className, text });
  }

  return paragraphs;
}

const ARTICLE_REGEXES: RegExp[] = [
  /^(?:Члан|члан|Član|član|CLAN|ČLAN)\s+([0-9]+(?:[\/-][0-9]+)?(?:[\p{L}]+)?)\.?\s*(.*)$/u,
  /^(?:чл\.?|Чл\.?|ЧЛ\.?|čl\.?|Čl\.?)\s*([0-9]+(?:[\/-][0-9]+)?(?:[\p{L}]+)?)\.?\s*(.*)$/u,
];

function parseArticleMarker(text: string): ArticleMarker | null {
  const normalized = normalizeText(text);
  for (const regex of ARTICLE_REGEXES) {
    const match = normalized.match(regex);
    if (!match) continue;

    const section = (match[1] ?? '').replace(/\s+/g, '');
    if (!section) continue;

    const inlineTitle = normalizeText(match[2] ?? '');
    return {
      section,
      inlineTitle: inlineTitle.length > 0 ? inlineTitle : undefined,
    };
  }

  return null;
}

function isChapterHeading(paragraph: ParsedParagraph): boolean {
  const text = paragraph.text.trim();
  if (!text) return false;
  if (parseArticleMarker(text)) return false;

  if (/^(?:ГЛАВА|Глава|GLAVA|Glava|ДЕО|Deo|ОДЕЉАК|ОДЈЕЉАК|ПОГЛАВЉЕ|PART)\b/u.test(text)) {
    return true;
  }

  if (/^[IVXLCDM]+\.?\s+/u.test(text)) {
    return true;
  }

  return false;
}

function isTitleParagraph(paragraph: ParsedParagraph): boolean {
  if (parseArticleMarker(paragraph.text) || isChapterHeading(paragraph)) {
    return false;
  }

  const text = paragraph.text.trim();
  if (!text || text.length > 200) {
    return false;
  }

  if (/[.!?]$/.test(text)) {
    return false;
  }

  const cls = paragraph.className.toLowerCase();
  return cls.includes('bold') || cls.includes('italik') || cls.includes('clan');
}

function buildProvisionRef(section: string): string {
  const ascii = transliterateToAscii(section)
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, '');
  return `art${ascii || 'x'}`;
}

function dedupeProvisions(provisions: ParsedProvision[]): ParsedProvision[] {
  const indexBySection = new Map<string, number>();
  const deduped: ParsedProvision[] = [];

  for (const provision of provisions) {
    const sectionKey = provision.section.replace(/\s+/g, '').toLowerCase();
    const existingIndex = indexBySection.get(sectionKey);

    if (existingIndex === undefined) {
      indexBySection.set(sectionKey, deduped.length);
      deduped.push(provision);
      continue;
    }

    const existing = deduped[existingIndex];
    const existingLen = existing.content.trim().length;
    const candidateLen = provision.content.trim().length;

    if (candidateLen > existingLen) {
      deduped[existingIndex] = {
        ...provision,
        chapter: provision.chapter ?? existing.chapter,
      };
    }
  }

  return deduped;
}

function extractDefinitionsFromProvision(provision: ParsedProvision): ParsedDefinition[] {
  const keyText = `${provision.title}\n${provision.content}`.toLowerCase();
  const looksLikeDefinitions = keyText.includes('значење израза')
    || keyText.includes('поједини изрази')
    || keyText.includes('дефинициј')
    || keyText.includes('изрази употребљени');

  if (!looksLikeDefinitions) {
    return [];
  }

  const definitions: ParsedDefinition[] = [];
  const seen = new Set<string>();

  for (const rawLine of provision.content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const quoted = line.match(/^\d+\)\s*[„"“]?([^„"”]+?)[”"“]?\s+(?:је|означава)\s+(.+)$/u);
    const dashed = line.match(/^\d+\)\s*[„"“]?([^„"”]+?)[”"“]?\s*[-–—]\s*(.+)$/u);
    const match = quoted ?? dashed;

    if (!match) continue;

    const term = match[1].trim().replace(/[.;:]+$/g, '');
    const definition = match[2].trim().replace(/[;]+$/g, '');

    if (term.length < 2 || definition.length < 4) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    definitions.push({
      term,
      definition,
      source_provision: provision.provision_ref,
    });
  }

  return definitions;
}

function buildFallbackProvisions(paragraphs: ParsedParagraph[]): ParsedProvision[] {
  const body = paragraphs
    .map(p => p.text)
    .join('\n\n')
    .trim();

  if (!body) {
    return [];
  }

  return [
    {
      provision_ref: 'artfull',
      section: 'full',
      title: 'Текст акта',
      content: body,
    },
  ];
}

export interface ParseLawOptions {
  id: string;
  title: string;
  titleEn?: string;
  shortName?: string;
  status?: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  url: string;
  description?: string;
  issuedDate?: string;
  inForceDate?: string;
}

export function parseLawHtml(html: string, options: ParseLawOptions): ParsedAct {
  const paragraphs = extractParagraphs(html);

  const rawProvisions: ParsedProvision[] = [];

  let currentChapter: string | undefined;
  let pendingTitle: string | undefined;

  let currentSection: string | null = null;
  let currentContent: string[] = [];
  let currentTitle: string | undefined;

  const flushCurrentProvision = (): void => {
    if (!currentSection) return;

    const content = currentContent.join('\n\n').trim();
    if (!content) {
      currentSection = null;
      currentContent = [];
      currentTitle = undefined;
      return;
    }

    rawProvisions.push({
      provision_ref: buildProvisionRef(currentSection),
      chapter: currentChapter,
      section: currentSection,
      title: currentTitle ?? `Члан ${currentSection}.`,
      content,
    });

    currentSection = null;
    currentContent = [];
    currentTitle = undefined;
  };

  for (const paragraph of paragraphs) {
    const marker = parseArticleMarker(paragraph.text);

    if (isChapterHeading(paragraph)) {
      flushCurrentProvision();
      currentChapter = paragraph.text;
      pendingTitle = undefined;
      continue;
    }

    if (marker) {
      flushCurrentProvision();

      currentSection = marker.section;
      const articleTitle = marker.inlineTitle ?? pendingTitle;
      currentTitle = articleTitle
        ? `Члан ${marker.section}. ${articleTitle}`
        : `Члан ${marker.section}.`;
      pendingTitle = undefined;
      continue;
    }

    if (isTitleParagraph(paragraph)) {
      pendingTitle = paragraph.text;
      continue;
    }

    if (currentSection) {
      currentContent.push(paragraph.text);
    }
  }

  flushCurrentProvision();

  const provisions = rawProvisions.length > 0
    ? dedupeProvisions(rawProvisions)
    : buildFallbackProvisions(paragraphs);

  const definitionDedup = new Map<string, ParsedDefinition>();
  for (const provision of provisions) {
    for (const definition of extractDefinitionsFromProvision(provision)) {
      const key = `${definition.source_provision ?? ''}::${definition.term.toLowerCase()}`;
      if (!definitionDedup.has(key)) {
        definitionDedup.set(key, definition);
      }
    }
  }

  return {
    id: options.id,
    type: 'statute',
    title: options.title,
    title_en: options.titleEn,
    short_name: options.shortName,
    status: options.status ?? 'in_force',
    issued_date: options.issuedDate,
    in_force_date: options.inForceDate,
    url: options.url,
    description: options.description,
    provisions,
    definitions: Array.from(definitionDedup.values()),
  };
}
