#!/usr/bin/env tsx
/**
 * Serbian Law MCP — full-corpus ingestion from official sources.
 *
 * Workflow:
 * 1) Discover all public Serbian laws via REG advanced search (doc type: Закон)
 * 2) Fetch full act HTML by GUID from official PIS API
 * 3) Parse article provisions into seed JSON files
 * 4) Emit ingestion coverage report with explicit skip/error reasons
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchJson, fetchText, postJson } from './lib/fetcher.js';
import {
  buildLawCatalog,
  parseLawHtml,
  type CatalogLaw,
  type RegSearchResponse,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

const DI_API_BASE = 'https://di.pravno-informacioni-sistem.rs/';
const REG_API_BASE = 'https://reg.pravno-informacioni-sistem.rs/api/';
const PENG_API_BASE = 'https://peng.pravno-informacioni-sistem.rs/api/';

const DISCOVERY_PAYLOAD = {
  l: [458, -1, -1, -1, -1],
  pau: null,
  aids: [],
  dids: [53],
  tmo: true,
  bmo: true,
  limit: 5000,
  tk: '',
};

interface CliArgs {
  start: number;
  limit: number | null;
  resume: boolean;
  skipFetch: boolean;
  saveHtml: boolean;
}

interface PengNode {
  name?: string;
  originalName?: string;
  children?: PengNode[];
}

type IngestStatus = 'ok' | 'skipped' | 'error';

interface IngestResult {
  lawId: string;
  guid: string;
  title: string;
  status: IngestStatus;
  provisions: number;
  definitions: number;
  fallback: boolean;
  note?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let start = 0;
  let limit: number | null = null;
  let resume = false;
  let skipFetch = false;
  let saveHtml = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      i++;
      continue;
    }

    if (args[i] === '--start' && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        start = parsed;
      }
      i++;
      continue;
    }

    if (args[i] === '--resume') {
      resume = true;
      continue;
    }

    if (args[i] === '--skip-fetch') {
      skipFetch = true;
      continue;
    }

    if (args[i] === '--save-html') {
      saveHtml = true;
      continue;
    }
  }

  return { start, limit, resume, skipFetch, saveHtml };
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

function clearSourceDirectory(saveHtml: boolean): void {
  const files = fs.readdirSync(SOURCE_DIR);
  for (const file of files) {
    if (file === 'README.md') continue;
    if (file === '.gitkeep') continue;
    if (!saveHtml && file.endsWith('.html')) continue;

    if (
      file.endsWith('.json')
      || file.endsWith('.html')
    ) {
      fs.unlinkSync(path.join(SOURCE_DIR, file));
    }
  }
}

const PARTIAL_RESULTS_PATH = path.join(SOURCE_DIR, 'ingestion-results.partial.json');

function loadPartialResults(): IngestResult[] {
  if (!fs.existsSync(PARTIAL_RESULTS_PATH)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(PARTIAL_RESULTS_PATH, 'utf-8')) as { results?: IngestResult[] };
    return parsed.results ?? [];
  } catch {
    return [];
  }
}

function writePartialResults(discoveredTotal: number, results: IngestResult[]): void {
  fs.writeFileSync(
    PARTIAL_RESULTS_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        discovered_total: discoveredTotal,
        results,
      },
      null,
      2,
    ),
  );
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

async function discoverLaws(): Promise<CatalogLaw[]> {
  const response = await postJson<RegSearchResponse>(
    `${DI_API_BASE}REG/advancedSearch`,
    DISCOVERY_PAYLOAD,
  );

  const laws = buildLawCatalog(response.result ?? []);

  fs.writeFileSync(
    path.join(SOURCE_DIR, 'catalog.search.json'),
    JSON.stringify(
      {
        fetched_at: new Date().toISOString(),
        endpoint: `${DI_API_BASE}REG/advancedSearch`,
        payload: DISCOVERY_PAYLOAD,
        resultSize: response.resultSize,
        returned: response.result?.length ?? 0,
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(SOURCE_DIR, 'catalog.laws.json'),
    JSON.stringify(laws, null, 2),
  );

  return laws;
}

function buildDescription(law: CatalogLaw): string {
  const parts: string[] = [];

  if (law.officialRef) {
    parts.push(`Службени гласник: ${law.officialRef}`);
  }

  if (law.l2 || law.l3) {
    parts.push(`Област: ${[law.l2, law.l3].filter(Boolean).join(' / ')}`);
  }

  parts.push('Извор: Правно-информациони систем Републике Србије.');

  return parts.join(' ');
}

function readSeedStats(seedPath: string): { provisions: number; definitions: number; fallback: boolean } {
  try {
    const parsed = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as {
      provisions?: Array<{ provision_ref?: string }>;
      definitions?: unknown[];
    };

    const provisions = parsed.provisions?.length ?? 0;
    const definitions = parsed.definitions?.length ?? 0;
    const fallback = (parsed.provisions ?? []).some(p => p.provision_ref === 'artfull');
    return { provisions, definitions, fallback };
  } catch {
    return { provisions: 0, definitions: 0, fallback: false };
  }
}

async function fetchLawHtml(law: CatalogLaw, args: CliArgs): Promise<string> {
  const htmlPath = path.join(SOURCE_DIR, `${law.id}.html`);

  if (args.skipFetch && fs.existsSync(htmlPath)) {
    return fs.readFileSync(htmlPath, 'utf-8');
  }

  const htmlResponse = await fetchText(
    `${REG_API_BASE}viewAct/${encodeURIComponent(law.guid)}`,
    'text/html, */*',
  );

  if (args.saveHtml) {
    fs.writeFileSync(htmlPath, htmlResponse.body);
  }

  return htmlResponse.body;
}

function writeIngestionReport(
  discoveredTotal: number,
  processedTotal: number,
  results: IngestResult[],
): void {
  const successful = results.filter(r => r.status === 'ok');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');
  const fallback = successful.filter(r => r.fallback);

  const report = {
    generated_at: new Date().toISOString(),
    source: {
      search_endpoint: `${DI_API_BASE}REG/advancedSearch`,
      act_endpoint: `${REG_API_BASE}viewAct/{guid}`,
      english_endpoint: `${PENG_API_BASE}Prins/GetProductsForContent`,
    },
    discovered_total: discoveredTotal,
    processed_total: processedTotal,
    success_total: successful.length,
    skipped_total: skipped.length,
    error_total: errors.length,
    fallback_total: fallback.length,
    provision_total: successful.reduce((sum, item) => sum + item.provisions, 0),
    definition_total: successful.reduce((sum, item) => sum + item.definitions, 0),
    skips: skipped,
    errors,
    fallback_documents: fallback,
  };

  fs.writeFileSync(path.join(SOURCE_DIR, 'ingestion-report.json'), JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('Serbian Law MCP — Full-Corpus Ingestion');
  console.log('========================================');
  console.log(`Source (search): ${DI_API_BASE}REG/advancedSearch`);
  console.log(`Source (acts):   ${REG_API_BASE}viewAct/{guid}`);
  if (args.start > 0) console.log(`--start          ${args.start}`);
  if (args.limit) console.log(`--limit          ${args.limit}`);
  if (args.resume) console.log('--resume         true');
  if (args.skipFetch) console.log('--skip-fetch     true');
  if (args.saveHtml) console.log('--save-html      true');
  console.log('');

  ensureDirectories();
  if (!args.resume) {
    clearSeedDirectory();
    clearSourceDirectory(args.saveHtml);
  }

  const englishMap = await buildEnglishTitleMap();

  const discovered = await discoverLaws();
  const start = Math.max(0, args.start);
  const end = args.limit ? Math.min(discovered.length, start + args.limit) : discovered.length;
  const targets = discovered.slice(start, end);

  console.log(`Discovered laws: ${discovered.length}`);
  console.log(`Processing:      ${targets.length} (range ${start}..${Math.max(start, end - 1)})`);
  console.log('');

  const previousResults = args.resume ? loadPartialResults() : [];
  const resultByLaw = new Map<string, IngestResult>();
  for (const row of previousResults) {
    resultByLaw.set(row.lawId, row);
  }

  const results: IngestResult[] = [];

  for (let i = 0; i < targets.length; i++) {
    const law = targets[i];
    const globalIndex = start + i + 1;
    process.stdout.write(`[${String(globalIndex).padStart(4, ' ')}/${discovered.length}] ${law.id} ... `);

    try {
      const seedPath = path.join(SEED_DIR, law.fileName);
      if (args.resume && fs.existsSync(seedPath)) {
        const stats = readSeedStats(seedPath);
        console.log(`SKIP (existing seed: ${stats.provisions} provisions)`);
        const row: IngestResult = {
          lawId: law.id,
          guid: law.guid,
          title: law.title,
          status: 'ok',
          provisions: stats.provisions,
          definitions: stats.definitions,
          fallback: stats.fallback,
          note: 'Reused existing seed file',
        };
        results.push(row);
        resultByLaw.set(row.lawId, row);
        continue;
      }

      const html = await fetchLawHtml(law, args);

      const titleEn = englishMap.get(law.title) ?? law.titleEnFallback;
      const parsed = parseLawHtml(html, {
        id: law.id,
        title: law.title,
        titleEn,
        shortName: law.shortName,
        status: 'in_force',
        url: `https://www.pravno-informacioni-sistem.rs/viewAct/${law.guid}`,
        description: buildDescription(law),
      });

      if (parsed.provisions.length === 0) {
        console.log('SKIPPED (no text parsed)');
        results.push({
          lawId: law.id,
          guid: law.guid,
          title: law.title,
          status: 'skipped',
          provisions: 0,
          definitions: 0,
          fallback: false,
          note: 'No provisions parsed from official HTML',
        });
        continue;
      }

      fs.writeFileSync(seedPath, JSON.stringify(parsed, null, 2));

      const fallbackUsed = parsed.provisions.some(prov => prov.provision_ref === 'artfull');

      console.log(
        `OK (${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions${fallbackUsed ? ', fallback' : ''})`,
      );

      const row: IngestResult = {
        lawId: law.id,
        guid: law.guid,
        title: law.title,
        status: 'ok',
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        fallback: fallbackUsed,
      };
      results.push(row);
      resultByLaw.set(row.lawId, row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`ERROR (${message})`);
      const row: IngestResult = {
        lawId: law.id,
        guid: law.guid,
        title: law.title,
        status: 'error',
        provisions: 0,
        definitions: 0,
        fallback: false,
        note: message,
      };
      results.push(row);
      resultByLaw.set(row.lawId, row);
    }
  }

  const accumulatedResults = Array.from(resultByLaw.values());
  writePartialResults(discovered.length, accumulatedResults);
  writeIngestionReport(discovered.length, accumulatedResults.length, accumulatedResults);

  const successful = results.filter(r => r.status === 'ok');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');
  const fallback = successful.filter(r => r.fallback);

  console.log('\nIngestion Summary');
  console.log('-----------------');
  console.log(`Discovered laws:  ${discovered.length}`);
  console.log(`Processed laws:   ${targets.length} (this batch)`);
  console.log(`Accumulated rows: ${accumulatedResults.length}/${discovered.length}`);
  console.log(`Successful:       ${successful.length}`);
  console.log(`Fallback used:    ${fallback.length}`);
  console.log(`Skipped:          ${skipped.length}`);
  console.log(`Errors:           ${errors.length}`);
  console.log(`Total provisions: ${successful.reduce((sum, r) => sum + r.provisions, 0)}`);
  console.log(`Total definitions:${successful.reduce((sum, r) => sum + r.definitions, 0)}`);

  if (skipped.length > 0 || errors.length > 0) {
    console.log('\nCoverage gaps');
    console.log('-------------');
    for (const row of [...skipped, ...errors]) {
      console.log(`${row.status.toUpperCase().padEnd(7)} ${row.lawId} - ${row.note ?? 'unknown reason'}`);
    }
  }

  console.log('\nReports written to data/source/ingestion-results.partial.json and data/source/ingestion-report.json');
}

main().catch(error => {
  console.error('Fatal ingestion error:', error);
  process.exit(1);
});
