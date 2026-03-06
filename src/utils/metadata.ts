/**
 * Response metadata utilities for Serbian Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Republic of Serbia Official Gazette (sluzbenig lasnik.rs) / propisi.net — Ministry of Justice of Serbia',
    jurisdiction: 'RS',
    disclaimer:
      'This data is sourced from official Serbian legal sources under public domain. ' +
      'The authoritative versions are published in the Official Gazette of the Republic of Serbia (Službeni glasnik RS). ' +
      'Always verify with the official legal information portal (pravno-informacioni-sistem.rs).',
    freshness,
  };
}
