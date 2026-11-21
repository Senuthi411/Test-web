// Typed CSV building and download. No dependencies.
// Output: UTF-8 with BOM (so Excel detects the encoding), CRLF line endings, one header row, stable column order.
import { localDate } from '../domain/selectors';

export type CsvValue = string | number | null | undefined;
export interface CsvTable { columns: readonly string[]; rows: readonly CsvValue[][] }

/** Text starting with these characters can be run as a formula by spreadsheet apps (CSV/formula injection). */
const FORMULA_START = /^(?:[\t\r\n]|[\s]*[=+\-@])/;

/**
 * One CSV field. Numbers are written as plain numbers; empty values as an empty field. Text is always quoted,
 * embedded quotes are doubled (commas and line breaks are safe inside quotes) and text that could be read as a
 * formula is prefixed with an apostrophe.
 */
export function csvCell(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

/** Serialises a table. Every row must have exactly one value per column so the schema stays stable. */
export function toCsv(table: CsvTable): string {
  table.rows.forEach((row, i) => { if (row.length !== table.columns.length) throw new Error(`CSV row ${i + 1} has ${row.length} values; expected ${table.columns.length}.`); });
  return '﻿' + [table.columns, ...table.rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** tealeaf-{report-type}-{YYYY-MM-DD}.csv, dated by the snapshot (Colombo calendar day), never the computer clock. */
export function exportFilename(reportType: string, snapshotAsOf: string) {
  const slug = reportType.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
  return `tealeaf-${slug}-${localDate(snapshotAsOf)}.csv`;
}

export const CSV_MIME = 'text/csv;charset=utf-8';
