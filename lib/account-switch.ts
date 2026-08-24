import { writeAllAuthFiles, type WriteAuthResult } from "./auth";
import { saveConfig } from "./config";
import { getSecretStoreAdapter, type SecretStoreAdapter } from "./secrets/store";
import type { AccountRecord, Config, OAuthPayload } from "./types";

export type AccountSwitchExecution = {
  previousIndex: number;
  currentIndex: number;
  account: AccountRecord;
  payload: OAuthPayload;
  authResult: WriteAuthResult;
};

/**
 * Executes the existing account-switch sequence without producing CLI output.
 * Callers are responsible for presenting the result to their own interface.
 */
export const switchAccountAtIndex = async (
  config: Config,
  targetIndex: number,
  secretStore: SecretStoreAdapter = getSecretStoreAdapter(),
): Promise<AccountSwitchExecution> => {
  const account = config.accounts[targetIndex];
  if (!account?.accountId) {
    throw new Error("Account entry missing accountId.");
  }

  const previousIndex = config.current;
  const payload = await secretStore.load(account.accountId);
  const authResult = await writeAllAuthFiles(payload);

  config.current = targetIndex;
  await saveConfig(config);

  return {
    previousIndex,
    currentIndex: targetIndex,
    account,
    payload,
    authResult,
  };
};
