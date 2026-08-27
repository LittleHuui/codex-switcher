import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { switchAccountAtIndex } from "../lib/account-switch";
import { readCodexAuthPayload, writeCodexAuthFile } from "../lib/auth";
import { loadConfig, saveConfig } from "../lib/config";
import { createTestPaths, resetPaths, setPaths } from "../lib/paths";
import type { SecretStoreAdapter } from "../lib/secrets/store";
import type { Config, OAuthPayload } from "../lib/types";

const createJwt = (expires: number): string =>
  `header.${Buffer.from(JSON.stringify({ exp: expires })).toString("base64url")}.signature`;

const createPayload = (
  accountId: string,
  marker: string,
  expiresAtSeconds: number,
): OAuthPayload => ({
  accountId,
  access: createJwt(expiresAtSeconds),
  refresh: `refresh-${marker}`,
  idToken: `id-${marker}`,
  expires: expiresAtSeconds * 1000,
});

const createConfig = (): Config => ({
  current: 0,
  accounts: [
    { accountId: "account-a", keychainService: "test-a", label: "a" },
    { accountId: "account-b", keychainService: "test-b", label: "b" },
  ],
});

const clonePayload = (payload: OAuthPayload): OAuthPayload => ({ ...payload });

const createStore = (initial: OAuthPayload[]): {
  adapter: SecretStoreAdapter;
  payloads: Map<string, OAuthPayload>;
  savedAccountIds: string[];
} => {
  const payloads = new Map(initial.map((payload) => [
    payload.accountId,
    clonePayload(payload),
  ]));
  const savedAccountIds: string[] = [];

  return {
    payloads,
    savedAccountIds,
    adapter: {
      id: "test",
      label: "Test store",
      getServiceName: (accountId) => `test:${accountId}`,
      save: async (accountId, payload) => {
        savedAccountIds.push(accountId);
        payloads.set(accountId, clonePayload(payload));
      },
      load: async (accountId) => {
        const payload = payloads.get(accountId);
        if (!payload) throw new Error(`Missing payload for ${accountId}`);
        return clonePayload(payload);
      },
      delete: async (accountId) => {
        payloads.delete(accountId);
      },
      exists: async (accountId) => payloads.has(accountId),
      listAccountIds: async () => [...payloads.keys()],
      getCapability: () => ({ available: true }),
    },
  };
};

describe("switchAccountAtIndex", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cdx-switch-test-"));
    setPaths(createTestPaths(tempDir));
  });

  afterEach(async () => {
    resetPaths();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("backs up the active Codex auth payload before writing the target account", async () => {
    const staleA = createPayload("account-a", "a-stale", 100);
    const activeA = createPayload("account-a", "a-fresh", 200);
    const payloadB = createPayload("account-b", "b", 300);
    const store = createStore([staleA, payloadB]);
    const config = createConfig();
    await saveConfig(config);
    await writeCodexAuthFile(activeA);

    await switchAccountAtIndex(config, 1, store.adapter);

    expect(store.payloads.get("account-a")).toEqual(activeA);
    expect(store.savedAccountIds).toEqual(["account-a"]);
    expect(await readCodexAuthPayload()).toEqual(payloadB);
    expect((await loadConfig()).current).toBe(1);
  });

  it("does not overwrite the current vault entry when auth.json belongs to another account", async () => {
    const staleA = createPayload("account-a", "a-stale", 100);
    const payloadB = createPayload("account-b", "b", 300);
    const otherAccount = createPayload("account-other", "other", 200);
    const store = createStore([staleA, payloadB]);
    const config = createConfig();
    await saveConfig(config);
    await writeCodexAuthFile(otherAccount);

    await switchAccountAtIndex(config, 1, store.adapter);

    expect(store.payloads.get("account-a")).toEqual(staleA);
    expect(store.savedAccountIds).toEqual([]);
    expect(await readCodexAuthPayload()).toEqual(payloadB);
  });

  it("does not replace the current auth or current index when the backup fails", async () => {
    const activeA = createPayload("account-a", "a-fresh", 200);
    const payloadB = createPayload("account-b", "b", 300);
    const store = createStore([createPayload("account-a", "a-stale", 100), payloadB]);
    const originalSave = store.adapter.save;
    store.adapter.save = async (accountId, payload) => {
      if (accountId === "account-a") {
        throw new Error("Could not save current credentials");
      }
      await originalSave(accountId, payload);
    };
    const config = createConfig();
    await saveConfig(config);
    await writeCodexAuthFile(activeA);

    await expect(switchAccountAtIndex(config, 1, store.adapter)).rejects.toThrow(
      "Could not save current credentials",
    );

    expect(await readCodexAuthPayload()).toEqual(activeA);
    expect((await loadConfig()).current).toBe(0);
  });
});
