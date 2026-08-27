import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPaths } from "./paths";
import type { OAuthPayload } from "./types";

const readExistingJson = async (filePath: string): Promise<Record<string, unknown>> => {
  if (!existsSync(filePath)) return {};
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const readJwtExpiry = (token: string): number | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
};

/**
 * Reads the OAuth credentials currently active in Codex's file cache.
 *
 * A successful return means the entire credential set can safely be copied
 * back into cdx's per-account vault before another account replaces it. The
 * access-token expiry is derived from its JWT because Codex's auth.json does
 * not persist cdx's `expires` field separately.
 */
export const readCodexAuthPayload = async (): Promise<OAuthPayload | null> => {
  const { codexAuthPath } = getPaths();
  const existing = await readExistingJson(codexAuthPath);
  const tokens = asRecord(existing.tokens);
  if (!tokens) return null;

  const access = tokens.access_token;
  const refresh = tokens.refresh_token;
  const accountId = tokens.account_id;
  if (
    typeof access !== "string" ||
    typeof refresh !== "string" ||
    typeof accountId !== "string"
  ) {
    return null;
  }

  const expires = readJwtExpiry(access);
  if (expires === null) return null;

  const idToken = typeof tokens.id_token === "string"
    ? tokens.id_token
    : undefined;

  return { access, refresh, accountId, expires, idToken };
};

export const writeAuthFile = async (payload: OAuthPayload): Promise<void> => {
  const { authPath } = getPaths();
  const authDir = path.dirname(authPath);
  await mkdir(authDir, { recursive: true });

  const existing = await readExistingJson(authPath);

  existing.openai = {
    type: "oauth",
    refresh: payload.refresh,
    access: payload.access,
    expires: payload.expires,
    accountId: payload.accountId,
  };

  await writeFile(authPath, JSON.stringify(existing, null, 2), "utf8");
};

export const writeCodexAuthFile = async (payload: OAuthPayload): Promise<void> => {
  const { codexAuthPath } = getPaths();
  const codexAuthDir = path.dirname(codexAuthPath);
  await mkdir(codexAuthDir, { recursive: true });

  const existing = await readExistingJson(codexAuthPath);

  const existingTokens = typeof existing.tokens === "object" && existing.tokens !== null
    ? (existing.tokens as Record<string, unknown>)
    : {};

  // Codex CLI uses auth_mode to decide between API-key and ChatGPT OAuth auth.
  // Keep an existing API key intact, but create the same OAuth-shaped file as
  // `codex login` when no API key has ever been configured.
  existing.auth_mode = "chatgpt";
  if (!("OPENAI_API_KEY" in existing)) {
    existing.OPENAI_API_KEY = null;
  }

  existing.tokens = {
    ...existingTokens,
    id_token: payload.idToken ?? null,
    access_token: payload.access,
    refresh_token: payload.refresh,
    account_id: payload.accountId,
  };
  existing.last_refresh = new Date().toISOString();

  await writeFile(codexAuthPath, JSON.stringify(existing, null, 2), "utf8");
};

export const writePiAuthFile = async (payload: OAuthPayload): Promise<void> => {
  const { piAuthPath } = getPaths();
  const piAuthDir = path.dirname(piAuthPath);
  await mkdir(piAuthDir, { recursive: true });

  const existing = await readExistingJson(piAuthPath);

  existing["openai-codex"] = {
    type: "oauth",
    access: payload.access,
    refresh: payload.refresh,
    expires: payload.expires,
    accountId: payload.accountId,
  };

  await writeFile(piAuthPath, JSON.stringify(existing, null, 2), "utf8");
};

export type WriteAuthResult = {
  piWritten: boolean;
  codexWritten: boolean;
  codexMissingIdToken: boolean;
  codexCleared: boolean;
};

export const writeAllAuthFiles = async (payload: OAuthPayload): Promise<WriteAuthResult> => {
  await writeAuthFile(payload);
  await writePiAuthFile(payload);

  if (payload.idToken) {
    await writeCodexAuthFile(payload);
    return {
      piWritten: true,
      codexWritten: true,
      codexMissingIdToken: false,
      codexCleared: false,
    };
  }

  const { codexAuthPath } = getPaths();
  let codexCleared = false;
  if (existsSync(codexAuthPath)) {
    try {
      await rm(codexAuthPath);
      codexCleared = true;
    } catch {
      codexCleared = false;
    }
  }

  return {
    piWritten: true,
    codexWritten: false,
    codexMissingIdToken: true,
    codexCleared,
  };
};
