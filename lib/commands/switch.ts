import type { Command } from "commander";
import { loadConfig } from "../config";
import { handleSwitchAccount } from "../interactive";
import { switchAccountAtIndex } from "../account-switch";
import { exitWithCommandError } from "./errors";
import { writeSwitchSummary } from "./output";

export const switchNext = async (): Promise<void> => {
  const config = await loadConfig();
  const nextIndex = (config.current + 1) % config.accounts.length;
  const result = await switchAccountAtIndex(config, nextIndex);

  const displayName = result.account.label ?? result.payload.accountId;
  writeSwitchSummary(displayName, result.authResult);
};

export const switchToAccount = async (identifier: string): Promise<void> => {
  const config = await loadConfig();
  const index = config.accounts.findIndex(
    (account) => account.accountId === identifier || account.label === identifier,
  );

  if (index === -1) {
    throw new Error(
      `Account "${identifier}" not found. Use 'cdx login' to add it.`,
    );
  }

  const result = await switchAccountAtIndex(config, index);

  const displayName = result.account.label ?? result.account.accountId;
  writeSwitchSummary(displayName, result.authResult);
};

export const registerSwitchCommand = (program: Command): void => {
  program
    .command("switch")
    .description("Switch OpenAI account (interactive picker, by name, or --next)")
    .argument("[account-id]", "Account ID to switch to directly")
    .option("-n, --next", "Cycle to the next configured account")
    .action(async (accountId: string | undefined, options: { next?: boolean }) => {
      try {
        if (options.next) {
          await switchNext();
        } else if (accountId) {
          await switchToAccount(accountId);
        } else {
          await handleSwitchAccount();
        }
      } catch (error) {
        exitWithCommandError(error);
      }
    });
};
