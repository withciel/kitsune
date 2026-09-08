// workspace-lint: ignore — MCP OAuth binds workspace from the authenticated
// session (requireWorkspace / token claims), never from client request params.
import { NextResponse } from 'next/server';
import { engine } from '@/lib/engine';
import {
  authCodeTtlSeconds,
  ensureMcpOAuthTables,
  newAuthCode,
} from '@/lib/mcp-oauth';
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
  expires_at: string;
}

async function readDecision(
  request: Request,
): Promise<{ decision: string; pendingId: string }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as {
      decision?: string;
      pendingId?: string;
    };
    return { decision: body.decision ?? '', pendingId: body.pendingId ?? '' };
  }
  const form = await request.formData();
  return {
    decision: String(form.get('decision') ?? ''),
    pendingId: String(form.get('pendingId') ?? ''),
  };
}

/**
 * Consent decision endpoint. Approve issues the same auth code the old
 * authorize route used to mint directly; deny/expired never touch
 * mcp_oauth_codes. The pending row is deleted either way — single use.
 */
export async function POST(request: Request) {
  const { decision, pendingId } = await readDecision(request);

  if (!pendingId || (decision !== 'approve' && decision !== 'deny')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const workspace = await requireWorkspace();

  await ensureMcpOAuthTables(engine);

  const pendingResult = await engine.ownerPool.query<PendingRow>(
    `DELETE FROM kitsune.mcp_oauth_pending
      WHERE id = $1
      RETURNING id, client_id, workspace_id, principal_id, redirect_uri,
                code_challenge, code_challenge_method, scope, state, expires_at`,
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
