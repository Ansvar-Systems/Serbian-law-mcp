#!/usr/bin/env tsx
/**
 * Serbian Law MCP — Real data ingestion from official sources.
 *
 * Workflow:
 * 1) Resolve target acts via official REG search endpoint
 * 2) Fetch law metadata + full act HTML by GUID
 * 3) Parse real article text (Члан) into seed JSON files
 * 4) Save source snapshots for provenance and reproducibility
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchJson, fetchText, postJson } from './lib/fetcher.js';
import {
  TARGET_LAWS,
  parseLawHtml,
  type TargetLaw,
  type RegActMetadata,
  type RegSearchResponse,
  type RegSearchResult,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

const REG_API_BASE = 'https://reg.pravno-informacioni-sistem.rs/api/';
const DI_API_BASE = 'https://di.pravno-informacioni-sistem.rs/';
const PENG_API_BASE = 'https://peng.pravno-informacioni-sistem.rs/api/';

interface CliArgs {
  limit: number | null;
  skipFetch: boolean;
}

interface PengNode {
  name?: string;
  originalName?: string;
  children?: PengNode[];
}

interface IngestResult {
  lawId: string;
  title: string;
  guid: string;
  provisions: number;
  definitions: number;
  status: 'ok' | 'skipped' | 'error';
  note?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      i++;
      continue;
    }

    if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

function ensureDirectories(): void {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function clearSeedDirectory(): void {
  const files = fs.readdirSync(SEED_DIR).filter(name => name.endsWith('.json'));
  for (const file of files) {
    fs.unlinkSync(path.join(SEED_DIR, file));
  }
}

async function buildEnglishTitleMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    const tree = await fetchJson<PengNode[]>(`${PENG_API_BASE}Prins/GetProductsForContent`);

    const walk = (nodes: PengNode[]): void => {
      for (const node of nodes) {
        if (node.originalName && node.name) {
          map.set(node.originalName.trim(), node.name.trim());
        }
        if (node.children && node.children.length > 0) {
          walk(node.children);
        }
      }
    };

    walk(tree);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`WARN: Failed loading English title map: ${message}`);
  }

  return map;
}

function extractMaxYear(text: string): number {
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map(m => Number.parseInt(m[0], 10));
  return years.length > 0 ? Math.max(...years) : 0;
}

function chooseSearchResult(target: TargetLaw, results: RegSearchResult[]): RegSearchResult | null {
  if (results.length === 0) return null;

  const byGuid = results.find(r => r.uuid === target.expectedGuid);
  if (byGuid) return byGuid;

  const expectedLower = target.expectedTitle.toLowerCase();
  const filtered = results.filter(r => {
    const title = r.title.toLowerCase();
    return title.startsWith(expectedLower) && !title.includes('о изменама');
  });

  const pool = filtered.length > 0 ? filtered : results;

  return [...pool]
    .sort((a, b) => extractMaxYear(b.title) - extractMaxYear(a.title))[0] ?? null;
}

async function resolveLawFromSearch(target: TargetLaw): Promise<RegSearchResult | null> {
  const payload = {
    l: [458, -1, -1, -1, -1],
    pau: null,
    aids: [],
    dids: [53],
    tmo: true,
    bmo: true,
    limit: 25,
    tk: target.expectedTitle,
  };

  const response = await postJson<RegSearchResponse>(`${DI_API_BASE}REG/advancedSearch`, payload);
  return chooseSearchResult(target, response.result ?? []);
}

function buildDescription(target: TargetLaw, metadata: RegActMetadata): string {
  const abstract = (metadata.actAbstract ?? '').replace(/\s+/g, ' ').trim();
  if (abstract) {
    return `${abstract}. Пречишћени текст је преузет са званичног портала Правно-информационог система Републике Србије.`;
  }

  return `${target.expectedTitle} (${target.officialRef}) преузет је са званичног портала Правно-информационог система Републике Србије.`;
}

async function fetchLawInputs(
  target: TargetLaw,
  skipFetch: boolean,
): Promise<{ guid: string; metadata: RegActMetadata; html: string } | null> {
  const htmlPath = path.join(SOURCE_DIR, `${target.id}.html`);
  const metadataPath = path.join(SOURCE_DIR, `${target.id}.metadata.json`);
  const searchPath = path.join(SOURCE_DIR, `${target.id}.search.json`);

  if (skipFetch && fs.existsSync(htmlPath) && fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as RegActMetadata;
    const html = fs.readFileSync(htmlPath, 'utf-8');
    return {
      guid: metadata.hm,
      metadata,
      html,
    };
  }

  const match = await resolveLawFromSearch(target);
  if (!match) {
    console.warn(`  SKIP ${target.id}: no official search result found`);
    return null;
  }

  if (match.uuid !== target.expectedGuid) {
    console.warn(`  NOTE ${target.id}: using updated GUID ${match.uuid} (expected ${target.expectedGuid})`);
  }

  const metadata = await fetchJson<RegActMetadata>(
    `${REG_API_BASE}GetLawActViewByGuid?guid=${encodeURIComponent(match.uuid)}`,
  );

  if (!metadata?.id) {
    console.warn(`  SKIP ${target.id}: metadata endpoint did not return act id`);
    return null;
  }

  const htmlResponse = await fetchText(
    `${REG_API_BASE}viewAct/${encodeURIComponent(match.uuid)}?lawActId=${metadata.id}`,
    'text/html, */*',
  );

  fs.writeFileSync(searchPath, JSON.stringify(match, null, 2));
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  fs.writeFileSync(htmlPath, htmlResponse.body);

  return {
    guid: match.uuid,
    metadata,
    html: htmlResponse.body,
  };
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();
  const targets = limit ? TARGET_LAWS.slice(0, limit) : TARGET_LAWS;

  console.log('Serbian Law MCP — Real Ingestion');
  console.log('=================================');
  console.log(`Source (search): ${DI_API_BASE}REG/advancedSearch`);
  console.log(`Source (acts):   ${REG_API_BASE}`);
  console.log(`Targets:         ${targets.length}`);
  if (limit) console.log(`--limit          ${limit}`);
  if (skipFetch) console.log('--skip-fetch     true');
  console.log('');

  ensureDirectories();
  clearSeedDirectory();

  const englishMap = await buildEnglishTitleMap();
  const results: IngestResult[] = [];

  for (const target of targets) {
    process.stdout.write(`Processing ${target.id} ... `);

    try {
      const inputs = await fetchLawInputs(target, skipFetch);
      if (!inputs) {
        console.log('SKIPPED');
        results.push({
          lawId: target.id,
          title: target.expectedTitle,
          guid: target.expectedGuid,
          provisions: 0,
          definitions: 0,
          status: 'skipped',
          note: 'No search result or metadata',
        });
        continue;
      }

      const canonicalTitle = inputs.metadata.baseTitle?.trim() || target.expectedTitle;
      const titleEn = englishMap.get(canonicalTitle) ?? target.fallbackTitleEn;
      const url = `https://www.pravno-informacioni-sistem.rs/viewAct/${inputs.guid}`;

      const parsed = parseLawHtml(inputs.html, {
        id: target.id,
        title: canonicalTitle,
        titleEn,
        shortName: target.shortName,
        status: 'in_force',
        url,
        description: buildDescription(target, inputs.metadata),
      });

      if (parsed.provisions.length === 0) {
        console.log('SKIPPED (no provisions parsed)');
        results.push({
          lawId: target.id,
          title: canonicalTitle,
          guid: inputs.guid,
          provisions: 0,
          definitions: 0,
          status: 'skipped',
          note: 'No provisions parsed from official HTML',
        });
        continue;
      }

      const seedPath = path.join(SEED_DIR, target.fileName);
      fs.writeFileSync(seedPath, JSON.stringify(parsed, null, 2));

      console.log(`OK (${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions)`);
      results.push({
        lawId: target.id,
        title: canonicalTitle,
        guid: inputs.guid,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'ok',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`ERROR (${message})`);
      results.push({
        lawId: target.id,
        title: target.expectedTitle,
        guid: target.expectedGuid,
        provisions: 0,
        definitions: 0,
        status: 'error',
        note: message,
      });
    }
  }

  const successful = results.filter(r => r.status === 'ok');
  const provisionTotal = successful.reduce((sum, r) => sum + r.provisions, 0);
  const definitionTotal = successful.reduce((sum, r) => sum + r.definitions, 0);

  console.log('\nIngestion Summary');
  console.log('-----------------');
  console.log(`Successful laws:  ${successful.length}/${targets.length}`);
  console.log(`Total provisions: ${provisionTotal}`);
  console.log(`Total definitions:${definitionTotal}`);

  for (const row of results) {
    const status = row.status.toUpperCase().padEnd(7);
    console.log(`${status} ${row.lawId} (${row.provisions} provisions)` + (row.note ? ` - ${row.note}` : ''));
  }
}

main().catch(error => {
  console.error('Fatal ingestion error:', error);
  process.exit(1);
});
