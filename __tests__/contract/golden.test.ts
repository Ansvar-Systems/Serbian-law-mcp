/**
 * Golden contract tests for Serbian Law MCP.
 * Validates core tool functionality against seed data.
 *
 * Skipped automatically in CI when the database file is absent
 * (e.g. npm-publish workflows that exclude the 120 MB+ SQLite DB).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/database.db');
const SEED_DIR = path.resolve(__dirname, '../../data/seed');

const DB_EXISTS = fs.existsSync(DB_PATH);

let db: InstanceType<typeof Database>;

beforeAll(() => {
  if (!DB_EXISTS) return;
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = DELETE');
});

describe.skipIf(!DB_EXISTS)('Database integrity', () => {
  it('should have broad law corpus coverage', () => {
    const row = db.prepare(
      'SELECT COUNT(*) as cnt FROM legal_documents'
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(800);

    const seedCount = fs.readdirSync(SEED_DIR).filter(name => name.endsWith('.json')).length;
    expect(row.cnt).toBe(seedCount);
  });

  it('should have at least 15,000 provisions', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(15000);
  });

  it('should have FTS index', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'података'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!DB_EXISTS)('Article retrieval', () => {
  it('should retrieve a provision by document_id and section', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'rs-critical-infrastructure' AND section = '1'"
    ).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(50);
  });
});

describe.skipIf(!DB_EXISTS)('Search', () => {
  it('should find results via FTS search', () => {
    const rows = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'безбедности'"
    ).get() as { cnt: number };
    expect(rows.cnt).toBeGreaterThan(0);
  });
});

describe.skipIf(!DB_EXISTS)('EU cross-references', () => {
  it('should have EU reference tables available', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type = 'table' AND name IN ('eu_documents', 'eu_references')"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(2);
  });

  it('should query eu_references without errors', () => {
    const rows = db.prepare(
      "SELECT COUNT(*) as cnt FROM eu_references"
    ).get() as { cnt: number };
    expect(rows.cnt).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!DB_EXISTS)('Negative tests', () => {
  it('should return no results for fictional document', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'fictional-law-2099'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('should return no results for invalid section', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'rs-critical-infrastructure' AND section = '999ZZZ-INVALID'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});

describe.skipIf(!DB_EXISTS)('All 10 laws are present', () => {
  const expectedDocs = [
    'rs-critical-infrastructure',
    'rs-electronic-commerce',
    'rs-electronic-communications',
    'rs-electronic-document-identification',
    'rs-electronic-government',
    'rs-freedom-of-information',
    'rs-information-security',
    'rs-information-secrecy',
    'rs-personal-data-protection',
    'rs-trade-secrets',
  ];

  for (const docId of expectedDocs) {
    it(`should contain document: ${docId}`, () => {
      const row = db.prepare(
        'SELECT id FROM legal_documents WHERE id = ?'
      ).get(docId) as { id: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.id).toBe(docId);
    });
  }
});

describe.skipIf(!DB_EXISTS)('list_sources', () => {
  it('should have db_metadata table', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM db_metadata').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});
