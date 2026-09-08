// workspace-lint: ignore — MCP OAuth binds workspace from the authenticated
// session (requireWorkspace / token claims), never from client request params.
import { NextResponse } from 'next/server';
import { engine } from '@/lib/engine';
import {
  authCodeTtlSeconds,
  csrfTokensMatch,
  ensureMcpOAuthTables,
  newAuthCode,
} from '@/lib/mcp-oauth';
import { publicAppOrigin } from '@/lib/public-origin';
import { requireWorkspace } from '@/lib/require-workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PendingRow {
  id: string;
  client_id: string;
  workspace_id: string;
  principal_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  state: string;
  csrf_token: string;
  expires_at: string;
}

async function readDecision(
  request: Request,
): Promise<{ decision: string; pendingId: string; csrfToken: string }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as {
      decision?: string;
      pendingId?: string;
      csrfToken?: string;
    };
    return {
      decision: body.decision ?? '',
      pendingId: body.pendingId ?? '',
      csrfToken: body.csrfToken ?? '',
    };
  }
  const form = await request.formData();
  return {
    decision: String(form.get('decision') ?? ''),
    pendingId: String(form.get('pendingId') ?? ''),
    csrfToken: String(form.get('csrfToken') ?? ''),
  };
}

/**
 * Reject cross-origin form posts when the browser sent Origin/Referer.
 * Best-effort defense-in-depth alongside the per-pending CSRF token —
 * absence of these headers (e.g. some non-browser clients) is not itself
 * treated as an error since the token check still applies.
 */
function originMismatch(request: Request): boolean {
  const expectedHost = new URL(publicAppOrigin(request)).host;
  for (const headerName of ['origin', 'referer']) {
    const value = request.headers.get(headerName);
    if (!value) continue;
    try {
      if (new URL(value).host !== expectedHost) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * Consent decision endpoint. Approve issues the same auth code the old
 * authorize route used to mint directly; deny/expired never touch
 * mcp_oauth_codes. The pending row is deleted either way — single use.
 */
export async function POST(request: Request) {
  const { decision, pendingId, csrfToken } = await readDecision(request);

  if (!pendingId || (decision !== 'approve' && decision !== 'deny')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (originMismatch(request)) {
    return NextResponse.json(
      {
        error: 'access_denied',
        error_description: 'Origin or Referer does not match this app.',
      },
      { status: 403 },
    );
  }

  const workspace = await requireWorkspace();

  await ensureMcpOAuthTables(engine);

  // Read-only lookup first: never destroy the pending row until ownership
  // and the CSRF token are both verified against the *current* request.
  const pendingResult = await engine.ownerPool.query<PendingRow>(
    `SELECT id, client_id, workspace_id, principal_id, redirect_uri,
            code_challenge, code_challenge_method, scope, state, csrf_token,
            expires_at
       FROM kitsune.mcp_oauth_pending
      WHERE id = $1`,
    [pendingId],
  );
  const pending = pendingResult.rows[0];
  if (!pending) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        error_description: 'Unknown or already-used consent request.',
      },
      { status: 400 },
    );
  }
  if (
    pending.workspace_id !== workspace.workspaceId ||
    pending.principal_id !== workspace.principalId
  ) {
    return NextResponse.json(
      {
        error: 'access_denied',
        error_description: 'Signed-in account does not match this request.',
      },
      { status: 403 },
    );
  }
  if (!csrfTokensMatch(csrfToken, pending.csrf_token)) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        error_description: 'Missing or invalid CSRF token.',
      },
      { status: 403 },
    );
  }

  // Ownership + CSRF verified — now it's safe to consume the row. The
  // WHERE clause re-checks ownership atomically so a concurrent request
  // can't race between the SELECT above and this DELETE.
  const deleteResult = await engine.ownerPool.query(
    `DELETE FROM kitsune.mcp_oauth_pending
      WHERE id = $1 AND workspace_id = $2 AND principal_id = $3
      RETURNING id`,
    [pendingId, workspace.workspaceId, workspace.principalId],
  );
  if (deleteResult.rowCount === 0) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        error_description: 'Unknown or already-used consent request.',
      },
      { status: 400 },
    );
  }

  const redirect = new URL(pending.redirect_uri);
  if (pending.state) redirect.searchParams.set('state', pending.state);

  if (
    decision === 'deny' ||
    new Date(pending.expires_at).getTime() < Date.now()
  ) {
    redirect.searchParams.set('error', 'access_denied');
    return NextResponse.redirect(redirect);
  }

  const code = newAuthCode();
  const expiresAt = new Date(Date.now() + authCodeTtlSeconds() * 1000);
  await engine.ownerPool.query(
    `INSERT INTO kitsune.mcp_oauth_codes
       (code, client_id, workspace_id, principal_id, redirect_uri,
        code_challenge, code_challenge_method, scope, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      code,
      pending.client_id,
      pending.workspace_id,
      pending.principal_id,
      pending.redirect_uri,
      pending.code_challenge,
      pending.code_challenge_method,
      pending.scope,
      expiresAt.toISOString(),
    ],
  );

  redirect.searchParams.set('code', code);
  return NextResponse.redirect(redirect);
}
