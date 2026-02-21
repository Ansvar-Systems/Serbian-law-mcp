/**
 * Parser for Serbian law HTML from the official PIS REG API.
 *
 * Input format:
 *   https://reg.pravno-informacioni-sistem.rs/api/viewAct/{guid}?lawActId={id}
 *
 * The HTML is structured as paragraphs with classes such as:
 * - odluka-zakon (law heading)
 * - clan (chapter labels and article markers: "Члан N.")
 * - bold / italik (article titles / subheadings)
 * - Basic-Paragraph (article body text)
 */

export interface TargetLaw {
  order: number;
  fileName: string;
  id: string;
  shortName: string;
  expectedTitle: string;
  expectedGuid: string;
  officialRef: string;
  fallbackTitleEn?: string;
}

export const TARGET_LAWS: TargetLaw[] = [
  {
    order: 1,
    fileName: '01-personal-data-protection.json',
    id: 'rs-personal-data-protection',
    shortName: 'ZZPL',
    expectedTitle: 'Закон о заштити података о личности',
    expectedGuid: '611b2ebf-189d-4421-bf11-b8906ed7ff54',
    officialRef: '87/2018-54',
    fallbackTitleEn: 'Law on Personal Data Protection',
  },
  {
    order: 2,
    fileName: '02-information-security.json',
    id: 'rs-information-security',
    shortName: 'ZIB',
    expectedTitle: 'Закон о информационој безбедности',
    expectedGuid: '218d8c7e-9304-4276-b39a-92c66133ab0f',
    officialRef: '91/2025-17',
    fallbackTitleEn: 'Law on Information Security',
  },
  {
    order: 3,
    fileName: '03-electronic-communications.json',
    id: 'rs-electronic-communications',
    shortName: 'ZEK',
    expectedTitle: 'Закон о електронским комуникацијама',
    expectedGuid: '54fc78b1-4aa0-4cd0-837a-0c709c5b6ddf',
    officialRef: '35/2023-3',
    fallbackTitleEn: 'Law on Electronic Communications',
  },
  {
    order: 4,
    fileName: '04-electronic-commerce.json',
    id: 'rs-electronic-commerce',
    shortName: 'ZET',
    expectedTitle: 'Закон о електронској трговини',
    expectedGuid: '8f5b6a5f-81d8-4785-8a38-82f39a09aaa6',
    officialRef: '41/2009-68; 95/2013-14; 52/2019-14',
    fallbackTitleEn: 'Law on Electronic Commerce',
  },
  {
    order: 5,
    fileName: '05-electronic-document-identification.json',
    id: 'rs-electronic-document-identification',
    shortName: 'ZEDEIUP',
    expectedTitle: 'Закон о електронском документу, електронској идентификацији и услугама од поверења у електронском пословању',
    expectedGuid: 'ad1ba3ab-ac2a-4b7d-a08f-4faa6cfbcc26',
    officialRef: '94/2017-9; 52/2021-22',
    fallbackTitleEn: 'Law on Electronic Document, Electronic Identification and Trust Services in Electronic Business',
  },
  {
    order: 6,
    fileName: '06-freedom-of-information.json',
    id: 'rs-freedom-of-information',
    shortName: 'ZSPIJZ',
    expectedTitle: 'Закон о слободном приступу информацијама од јавног значаја',
    expectedGuid: '0b7f7931-f230-45cf-b550-a1495539249d',
    officialRef: '120/2004-5; 54/2007-3; 104/2009-25; 36/2010-10; 105/2021-8',
    fallbackTitleEn: 'Law on Free Access to Information of Public Importance',
  },
  {
    order: 7,
    fileName: '07-information-secrecy.json',
    id: 'rs-information-secrecy',
    shortName: 'ZTP',
    expectedTitle: 'Закон о тајности података',
    expectedGuid: '0f5a10f2-2e49-428a-8c83-ba0131a23b46',
    officialRef: '104/2009-13',
    fallbackTitleEn: 'Information Secrecy Law',
  },
  {
    order: 8,
    fileName: '08-critical-infrastructure.json',
    id: 'rs-critical-infrastructure',
    shortName: 'ZKI',
    expectedTitle: 'Закон о критичној инфраструктури',
    expectedGuid: 'fac7ef0b-8204-466b-8392-47ffbf027e4a',
    officialRef: '87/2018-41',
    fallbackTitleEn: 'Law on Critical Infrastructure',
  },
  {
    order: 9,
    fileName: '09-electronic-government.json',
    id: 'rs-electronic-government',
    shortName: 'ZEU',
    expectedTitle: 'Закон о електронској управи',
    expectedGuid: '2bd17d5f-15cc-4b72-ae79-e534ab25b4b2',
    officialRef: '27/2018-25',
    fallbackTitleEn: 'Law on Electronic Government',
  },
  {
    order: 10,
    fileName: '10-trade-secrets.json',
    id: 'rs-trade-secrets',
    shortName: 'ZZPT',
    expectedTitle: 'Закон о заштити пословне тајне',
    expectedGuid: '6e0c74bd-f0a6-442f-9f07-12a566de23b1',
    officialRef: '53/2021-4',
    fallbackTitleEn: 'Law on Protection of Trade Secret',
  },
];

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

export interface RegActMetadata {
  id: number;
  hm: string;
  title: string;
  baseTitle: string;
  actAbstract?: string;
  url: string;
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

function parseArticleSection(text: string): string | null {
  const match = text.match(/^Члан\s+([0-9]+(?:[\p{L}]+)?(?:[\/-][0-9]+(?:[\p{L}]+)?)?)\.?$/u);
  return match ? match[1].replace(/\s+/g, '') : null;
}

function isChapterHeading(paragraph: ParsedParagraph): boolean {
  return paragraph.className.includes('clan')
    && !parseArticleSection(paragraph.text)
    && /^[IVXLCDM]+\.?\s+/u.test(paragraph.text);
}

function isTitleParagraph(paragraph: ParsedParagraph): boolean {
  return (paragraph.className.includes('bold') || paragraph.className.includes('italik'))
    && !parseArticleSection(paragraph.text);
}

function transliterateForRef(value: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j',
    к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's',
    т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's',
    А: 'a', Б: 'b', В: 'v', Г: 'g', Д: 'd', Ђ: 'dj', Е: 'e', Ж: 'z', З: 'z', И: 'i', Ј: 'j',
    К: 'k', Л: 'l', Љ: 'lj', М: 'm', Н: 'n', Њ: 'nj', О: 'o', П: 'p', Р: 'r', С: 's',
    Т: 't', Ћ: 'c', У: 'u', Ф: 'f', Х: 'h', Ц: 'c', Ч: 'c', Џ: 'dz', Ш: 's',
  };

  const transliterated = value
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .toLowerCase();

  const compact = transliterated.replace(/[^0-9a-z]+/g, '');
  return compact || 'x';
}

function buildProvisionRef(section: string): string {
  return `art${transliterateForRef(section)}`;
}

function extractDefinitionsFromProvision(provision: ParsedProvision): ParsedDefinition[] {
  const keyText = `${provision.title}\n${provision.content}`.toLowerCase();
  const looksLikeDefinitions = keyText.includes('значење израза')
    || keyText.includes('поједини изрази')
    || keyText.includes('дефинициј');

  if (!looksLikeDefinitions) {
    return [];
  }

  const definitions: ParsedDefinition[] = [];
  const seen = new Set<string>();

  for (const rawLine of provision.content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const numbered = line.match(/^\d+\)\s*[„"“]?([^„"”]+?)[”"“]?\s+(?:је|означава)\s+(.+)$/u);
    if (!numbered) continue;

    const term = numbered[1].trim().replace(/[.;:]+$/g, '');
    const definition = numbered[2].trim().replace(/[;]+$/g, '');

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

  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

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

    const provision: ParsedProvision = {
      provision_ref: buildProvisionRef(currentSection),
      chapter: currentChapter,
      section: currentSection,
      title: currentTitle ?? `Члан ${currentSection}.`,
      content,
    };

    provisions.push(provision);
    definitions.push(...extractDefinitionsFromProvision(provision));

    currentSection = null;
    currentContent = [];
    currentTitle = undefined;
  };

  for (const paragraph of paragraphs) {
    const section = parseArticleSection(paragraph.text);

    if (isChapterHeading(paragraph)) {
      flushCurrentProvision();
      currentChapter = paragraph.text;
      pendingTitle = undefined;
      continue;
    }

    if (isTitleParagraph(paragraph)) {
      pendingTitle = paragraph.text;
      continue;
    }

    if (section) {
      flushCurrentProvision();
      currentSection = section;
      currentTitle = pendingTitle ? `Члан ${section}. ${pendingTitle}` : `Члан ${section}.`;
      pendingTitle = undefined;
      continue;
    }

    if (currentSection) {
      currentContent.push(paragraph.text);
    }
  }

  flushCurrentProvision();

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
    definitions,
  };
}
