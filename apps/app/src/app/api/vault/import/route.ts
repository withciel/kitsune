import type { IngestRecord } from '@kitsuneos/core';
import { KitsuneError } from '@kitsuneos/core';
import { NextResponse } from 'next/server';
import { engine } from '@/lib/engine';
import { jsonError } from '@/lib/http-error';
import { requireWorkspace } from '@/lib/require-workspace';
import { parseVaultMarkdown } from '@/lib/vault-md';
import type { ZipEntry } from '@/lib/vault-zip';
import { readZip } from '@/lib/vault-zip';

interface ImportError {
  path: string;
  message: string;
}

/**
 * Import a zip of markdown files into a collection via `engine.ingest`.
 *
 * `mode` defaults to `propose` (agents/least-privileged humans get change
 * sets to review); `direct` requires write/admin capability on the
 * collection, enforced by `engine.ingest` itself.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspace();

    const form = await request.formData();
    const collection =
      typeof form.get('collection') === 'string'
        ? (form.get('collection') as string).trim()
        : '';
    if (!collection) {
      throw new KitsuneError('collection is required', 'validation');
    }
    const modeRaw = form.get('mode');
    const mode: 'propose' | 'direct' =
      modeRaw === 'direct' ? 'direct' : 'propose';

    const file = form.get('file');
    if (!(file instanceof Blob)) {
      throw new KitsuneError('file is required', 'validation');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let zipEntries: ZipEntry[];
    try {
      zipEntries = readZip(buffer);
    } catch {
      throw new KitsuneError('Could not read zip file', 'validation');
    }

    const mdEntries = zipEntries.filter(
      (entry) =>
        entry.name.toLowerCase().endsWith('.md') && !entry.name.includes('..'),
    );
    if (mdEntries.length === 0) {
      throw new KitsuneError('Zip contains no .md files', 'validation');
    }

    const records: IngestRecord[] = [];
    const recordSources: string[] = [];
    const parseErrors: ImportError[] = [];
    for (const entry of mdEntries) {
      try {
        const parsed = parseVaultMarkdown(
          entry.data.toString('utf8'),
          entry.name,
        );
        const fields = { title: parsed.title, body: parsed.body };
        records.push(parsed.id ? { id: parsed.id, fields } : { fields });
        recordSources.push(entry.name);
      } catch (err) {
        parseErrors.push({
          path: entry.name,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (records.length === 0) {
      return NextResponse.json(
        { changeSetIds: [], imported: 0, errors: parseErrors },
        { status: 400 },
      );
    }

    const result = await engine.ingest(ctx.workspaceId, ctx.principalId, {
      collection,
      records,
      mode,
    });

    const engineErrors: ImportError[] = result.errors.map((e) => ({
      path: recordSources[e.index] ?? `record[${e.index}]`,
      message: e.error,
    }));

    return NextResponse.json({
      changeSetIds: result.changeSetIds,
      imported: result.written.length,
      errors: [...parseErrors, ...engineErrors],
    });
  } catch (error) {
    return jsonError(error);
  }
}
