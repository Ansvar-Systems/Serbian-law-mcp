#!/usr/bin/env tsx
/**
 * Serbian ParlaMint Parliamentary Debates Ingestion
 *
 * Source: ParlaMint-RS v4.1 (CLARIN.SI)
 *         https://www.clarin.si/repository/xmlui/handle/11356/2004
 * License: CC BY 4.0
 * Format: TEI XML (ParlaMint schema), 362 MB TGZ
 * Coverage: Serbian National Assembly, 1997–2022 (9 legislative terms)
 * Volume: 84.57 million words across 25+ years
 *
 * Usage:
 *   npx tsx ingest-parlamint-rs.ts
 *   npx tsx ingest-parlamint-rs.ts --db /path/to/database.db
 *   npx tsx ingest-parlamint-rs.ts --limit 10000
 *   npx tsx ingest-parlamint-rs.ts --dir /path/to/extracted/ParlaMint-RS.TEI
 */

import Database from 'better-sqlite3';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execFileSync } from 'child_process';

const DB_PATH = path.resolve(process.cwd(), 'data', 'database.db');
const CUSTOM_DB = process.argv.indexOf('--db') >= 0 ? path.resolve(process.argv[process.argv.indexOf('--db') + 1]) : null;
const LIMIT = process.argv.indexOf('--limit') >= 0 ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : 0;
const CUSTOM_DIR = process.argv.indexOf('--dir') >= 0 ? path.resolve(process.argv[process.argv.indexOf('--dir') + 1]) : null;
const EXTRACT_DIR = CUSTOM_DIR || '/tmp/parlamint-rs';
const SPEECH_TRUNCATE = 50000;
const BATCH_SIZE = 2000;
const TGZ_URL = 'https://www.clarin.si/repository/xmlui/bitstream/handle/11356/2004/ParlaMint-RS.tgz?sequence=25&isAllowed=y';

interface Speaker {
  id: string;
  name: string;
  party: string;
  gender: string;
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000000) {
      console.log('  Using cached: ' + dest);
      return resolve();
    }
    console.log('  Downloading from CLARIN.SI...');
    const file = fs.createWriteStream(dest);
    const doRequest = (fetchUrl: string, redirects: number) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      https.get(fetchUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return doRequest(res.headers.location!, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (total > 0 && downloaded % (10 * 1024 * 1024) < chunk.length) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write('\r  Downloaded: ' + (downloaded / 1024 / 1024).toFixed(0) + ' MB (' + pct + '%)');
          }
        });
        res.on('end', () => {
          file.end();
          console.log('\n  Download complete: ' + (downloaded / 1024 / 1024).toFixed(0) + ' MB');
          resolve();
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    doRequest(url, 0);
  });
}

function extractTgz(tgzPath: string, destDir: string): void {
  const teiDir = path.join(destDir, 'ParlaMint-RS.TEI');
  if (fs.existsSync(teiDir) && fs.readdirSync(teiDir).length > 10) {
    console.log('  Already extracted: ' + teiDir);
    return;
  }
  console.log('  Extracting TGZ...');
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync('tar', ['xzf', tgzPath, '-C', destDir], { stdio: 'pipe' });
  console.log('  Extracted to: ' + destDir);
}

function parseSpeakers(corpusHeaderPath: string): Map<string, Speaker> {
  const speakers = new Map<string, Speaker>();
  if (!fs.existsSync(corpusHeaderPath)) return speakers;

  const xml = fs.readFileSync(corpusHeaderPath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name: string) => ['person', 'persName', 'affiliation', 'forename', 'surname'].includes(name),
    textNodeName: '#text',
  });
  const doc = parser.parse(xml);

  try {
    const persons = findDeep(doc, 'person') || [];
    for (const p of (Array.isArray(persons) ? persons : [persons])) {
      const id = p['@_xml:id'] || '';
      if (!id) continue;

      let name = '';
      const persName = p.persName;
      if (Array.isArray(persName)) {
        const fullName = persName[0];
        if (fullName) {
          const forenames = Array.isArray(fullName.forename) ? fullName.forename : (fullName.forename ? [fullName.forename] : []);
          const surnames = Array.isArray(fullName.surname) ? fullName.surname : (fullName.surname ? [fullName.surname] : []);
          const parts = [
            ...forenames.map((f: any) => typeof f === 'string' ? f : f['#text'] || ''),
            ...surnames.map((s: any) => typeof s === 'string' ? s : s['#text'] || ''),
          ];
          name = parts.filter(Boolean).join(' ');
        }
      } else if (typeof persName === 'string') {
        name = persName;
      }

      const gender = p.sex?.['@_value'] || '';
      let party = '';
      const aff = p.affiliation;
      if (Array.isArray(aff) && aff.length > 0) {
        party = aff[0]['@_ref'] || aff[0]['#text'] || '';
        party = party.replace('#', '');
      } else if (aff) {
        party = aff['@_ref'] || '';
        party = party.replace('#', '');
      }

      speakers.set('#' + id, { id, name, party, gender });
    }
  } catch {}

  return speakers;
}

function findDeep(obj: any, key: string): any {
  if (!obj || typeof obj !== 'object') return null;
  if (key in obj) return obj[key];
  for (const k of Object.keys(obj)) {
    const result = findDeep(obj[k], key);
    if (result != null) return result;
  }
  return null;
}

function findAllDeep(obj: any, key: string): any[] {
  const results: any[] = [];
  if (!obj || typeof obj !== 'object') return results;
  if (key in obj) {
    const val = obj[key];
    if (Array.isArray(val)) results.push(...val);
    else results.push(val);
  }
  for (const k of Object.keys(obj)) {
    if (k === key) continue;
    results.push(...findAllDeep(obj[k], key));
  }
  return results;
}

function extractUtterances(xmlPath: string, speakers: Map<string, Speaker>): Array<{
  speakerId: string;
  speakerName: string;
  party: string;
  text: string;
  sessionDate: string;
  sessionName: string;
  role: string;
}> {
  const xml = fs.readFileSync(xmlPath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name: string) => ['u', 'seg', 'note'].includes(name),
    textNodeName: '#text',
  });
  const doc = parser.parse(xml);
  const results: any[] = [];

  const dateMatch = path.basename(xmlPath).match(/(\d{4}-\d{2}-\d{2})/);
  const sessionDate = dateMatch ? dateMatch[1] : null;
  const sessionName = path.basename(xmlPath, '.xml');

  const body = findDeep(doc, 'body');
  if (!body) return results;

  const utterances = findAllDeep(body, 'u');
  for (const u of utterances) {
    const who = u['@_who'] || '';
    const ana = u['@_ana'] || '';
    const speaker = speakers.get(who);

    let text = '';
    const segs = u.seg;
    if (Array.isArray(segs)) {
      for (const seg of segs) {
        if (typeof seg === 'string') text += seg + ' ';
        else if (seg?.['#text']) text += seg['#text'] + ' ';
      }
    } else if (typeof segs === 'string') {
      text = segs;
    } else if (segs?.['#text']) {
      text = segs['#text'];
    }

    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 10) continue;

    results.push({
      speakerId: who.replace('#', ''),
      speakerName: speaker?.name || who.replace('#', ''),
      party: speaker?.party || '',
      text,
      sessionDate: sessionDate || '',
      sessionName,
      role: ana.includes('chair') ? 'chairman' : (ana.includes('guest') ? 'guest' : 'regular'),
    });
  }

  return results;
}

async function main(): Promise<void> {
  const dbPath = CUSTOM_DB || DB_PATH;
  console.log('Serbian ParlaMint Parliamentary Debates Ingestion\n');
  console.log('  Database: ' + dbPath);
  console.log('  Source: ParlaMint-RS v4.1 (CLARIN.SI, CC BY 4.0)');
  if (LIMIT > 0) console.log('  Limit: ' + LIMIT);

  if (!fs.existsSync(dbPath)) {
    console.error('ERROR: Database not found at ' + dbPath);
    process.exit(1);
  }

  // Step 1: Download and extract
  const tgzPath = path.join(EXTRACT_DIR, 'ParlaMint-RS.tgz');
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });

  const teiDir = path.join(EXTRACT_DIR, 'ParlaMint-RS.TEI');
  if (!fs.existsSync(teiDir) || fs.readdirSync(teiDir).length < 10) {
    if (!fs.existsSync(tgzPath) || fs.statSync(tgzPath).size < 10000000) {
      console.log('\nStep 1: Downloading ParlaMint-RS...');
      await downloadFile(TGZ_URL, tgzPath);
    }
    console.log('\nStep 2: Extracting...');
    extractTgz(tgzPath, EXTRACT_DIR);
  } else {
    console.log('\n  Using existing extraction: ' + teiDir);
  }

  // Step 2: Parse speakers
  console.log('\n  Parsing speaker metadata...');
  const corpusHeader = path.join(teiDir, 'ParlaMint-RS.xml');
  const speakers = parseSpeakers(corpusHeader);
  console.log('  Speakers loaded: ' + speakers.size);

  // Step 3: Find XML files
  const xmlFiles: string[] = [];
  const walkDir = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walkDir(path.join(dir, entry.name));
      else if (entry.name.endsWith('.xml') && entry.name.startsWith('ParlaMint-RS_')) {
        xmlFiles.push(path.join(dir, entry.name));
      }
    }
  };
  walkDir(teiDir);
  xmlFiles.sort();
  console.log('  Session files: ' + xmlFiles.length);

  // Step 4: Open DB and insert
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const hasPrepWorks = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='preparatory_works'").get();
  if (!hasPrepWorks) {
    console.error('ERROR: preparatory_works table not found.');
    db.close();
    process.exit(1);
  }

  const insert = db.prepare(
    'INSERT OR IGNORE INTO preparatory_works (' +
    '  document_id, type, title, bill_number, legislative_period,' +
    '  summary, full_text, date_introduced, date_enacted, status,' +
    '  voting_result, url, legislature, committee, proposer, source' +
    ') VALUES (' +
    '  @documentId, @type, @title, @billNumber, @legislativePeriod,' +
    '  @summary, @fullText, @dateIntroduced, @dateEnacted, @status,' +
    '  @votingResult, @url, @legislature, @committee, @proposer, @source' +
    ')'
  );

  const insertFull = db.prepare(
    'INSERT OR IGNORE INTO preparatory_works_full (prep_work_id, full_text, section_summaries) ' +
    'VALUES (@prepWorkId, @fullText, @sectionSummaries)'
  );

  let inserted = 0;
  let skipped = 0;
  let batch: any[] = [];
  const startTime = Date.now();

  const flushBatch = () => {
    if (batch.length === 0) return;
    const tx = db.transaction(() => {
      for (const params of batch) {
        try {
          const result = insert.run(params.main);
          if (result.changes > 0 && params.overflow) {
            try {
              insertFull.run({ prepWorkId: result.lastInsertRowid, fullText: params.overflow, sectionSummaries: null });
            } catch {}
          }
          if (result.changes > 0) inserted++;
          else skipped++;
        } catch (err: any) {
          if (skipped < 5) console.error('    Insert error: ' + err.message);
          skipped++;
        }
      }
    });
    tx();
    batch = [];
  };

  console.log('\n  Processing session files...');
  let fileCount = 0;

  for (const xmlFile of xmlFiles) {
    if (LIMIT > 0 && inserted >= LIMIT) break;
    fileCount++;

    try {
      const utterances = extractUtterances(xmlFile, speakers);

      for (let i = 0; i < utterances.length; i++) {
        if (LIMIT > 0 && inserted >= LIMIT) break;

        const u = utterances[i];
        const docId = 'parlamint-rs-' + u.sessionName + '-' + i;

        const termMatch = u.sessionName.match(/T(\d+)/);
        const term = termMatch ? termMatch[1] : null;

        const title = u.sessionDate + ' — ' + u.speakerName + (u.party ? ' (' + u.party + ')' : '');
        const summary = [
          'Speaker: ' + u.speakerName,
          u.party ? 'Party: ' + u.party : '',
          u.role !== 'regular' ? 'Role: ' + u.role : '',
          term ? 'Term: ' + term : '',
        ].filter(Boolean).join(' | ');

        const truncated = u.text.length > SPEECH_TRUNCATE ? u.text.substring(0, SPEECH_TRUNCATE) : u.text;

        batch.push({
          main: {
            documentId: docId,
            type: u.role === 'chairman' ? 'chairman_statement' : 'speech',
            title: title.substring(0, 1000),
            billNumber: null,
            legislativePeriod: term ? 'Term ' + term : null,
            summary: summary.substring(0, 2000),
            fullText: truncated,
            dateIntroduced: u.sessionDate || null,
            dateEnacted: null,
            status: 'delivered',
            votingResult: null,
            url: null,
            legislature: term ? parseInt(term) : null,
            committee: null,
            proposer: u.speakerName || null,
            source: 'parlamint_rs',
          },
          overflow: u.text.length > SPEECH_TRUNCATE ? u.text : null,
        });

        if (batch.length >= BATCH_SIZE) {
          flushBatch();
        }
      }
    } catch (err: any) {
      if (skipped < 5) console.error('  Error parsing ' + path.basename(xmlFile) + ': ' + err.message);
      skipped++;
    }

    if (fileCount % 50 === 0 || fileCount === xmlFiles.length) {
      flushBatch();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = inserted > 0 ? (inserted / ((Date.now() - startTime) / 1000)).toFixed(0) : '0';
      console.log('  Files: ' + fileCount + '/' + xmlFiles.length + ' | ' +
        inserted.toLocaleString() + ' inserted | ' + elapsed + 's | ' + rate + ' rec/s');
    }
  }

  flushBatch();

  if (inserted > 0) {
    console.log('\n  Rebuilding FTS index...');
    try {
      db.exec("INSERT INTO preparatory_works_fts(preparatory_works_fts) VALUES ('rebuild')");
      console.log('    FTS rebuild complete.');
    } catch (err: any) {
      console.log('    FTS rebuild note: ' + err.message);
    }
  }

  const totalPW = (db.prepare('SELECT COUNT(*) as c FROM preparatory_works').get() as { c: number }).c;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log('\n=== ParlaMint-RS Ingestion Complete ===');
  console.log('  Files processed: ' + fileCount);
  console.log('  New records: ' + inserted.toLocaleString());
  console.log('  Skipped: ' + skipped.toLocaleString());
  console.log('  Total preparatory_works: ' + totalPW.toLocaleString());
  console.log('  Duration: ' + elapsed + 's');

  db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
