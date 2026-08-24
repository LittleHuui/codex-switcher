import { switchAccountAtIndex } from "./lib/account-switch";
import { loadConfig, loadConfiguredSecretStoreSelection } from "./lib/config";
import {
  createSecretStoreAdapterFromSelection,
  type SecretStoreAdapter,
} from "./lib/secrets/store";
import type { AccountRecord, Config } from "./lib/types";
import { fetchUsage, type UsageResult, type WindowSnapshot } from "./lib/usage";

/** API 调用失败时使用的稳定错误代码，调用方应优先根据此字段处理。 */
export type CdxApiErrorCode =
  | "CONFIGURATION_ERROR"
  | "CURRENT_ACCOUNT_UNAVAILABLE"
  | "ACCOUNT_LABEL_REQUIRED"
  | "ACCOUNT_LABEL_NOT_FOUND"
  | "ACCOUNT_LABEL_DUPLICATED"
  | "SECRET_STORE_UNAVAILABLE"
  | "CREDENTIAL_UNAVAILABLE"
  | "AUTH_FAILED"
  | "USAGE_UNAVAILABLE"
  | "NETWORK_ERROR";

/** API 失败时的错误信息；不会包含访问令牌、刷新令牌或账号邮箱。 */
export interface CdxApiError {
  /** 供程序稳定判断的错误代码。 */
  code: CdxApiErrorCode;
  /** 供日志或人工排查使用的可读错误说明。 */
  message: string;
  /** 为 true 时，调用方可以在退避后重试当前请求。 */
  retryable: boolean;
}

/** 所有公开 API 统一使用的成功或失败返回结构。 */
export type CdxApiResult<T> =
  | {
      /** 调用是否成功。 */
      ok: true;
      /** 成功时返回的业务数据。 */
      data: T;
    }
  | {
      /** 调用是否成功。 */
      ok: false;
      /** 失败时返回的结构化错误信息。 */
      error: CdxApiError;
    };

/** 不暴露内部账号 ID 与邮箱的账号安全摘要。 */
export interface AccountSummary {
  /** 用户通过 `cdx label` 设置的账号标签；未设置时为 null。 */
  label: string | null;
  /** 用于界面或日志展示的安全名称；未设置标签时显示“未命名账号 N”。 */
  displayName: string;
  /** 此账号是否为当前已写入开发工具认证文件的账号。 */
  isCurrent: boolean;
}

/** `listAccounts` 成功时返回的数据。 */
export interface AccountListData {
  /** 已配置账号的安全摘要列表，按 cdx 配置中的顺序排列。 */
  accounts: AccountSummary[];
}

/** `getCurrentAccount` 成功时返回的数据。 */
export interface CurrentAccountData {
  /** 当前启用账号的安全摘要。 */
  account: AccountSummary;
}

/** 单个限额周期的规范化数据。 */
export interface UsageWindowData {
  /** 限额周期类别；primary 为主周期，secondary 为辅助周期。 */
  kind: "primary" | "secondary";
  /** 当前周期已经使用的百分比，范围通常为 0 到 100。 */
  usedPercent: number;
  /** 当前周期剩余的百分比，按 100 - usedPercent 计算。 */
  remainingPercent: number;
  /** 此限额周期的总时长，单位为秒。 */
  limitWindowSeconds: number;
  /** 限额下次重置的 ISO 8601 时间字符串。 */
  resetsAt: string;
  /** 限额下次重置的 Unix 时间戳，单位为毫秒。 */
  resetsAtUnixMs: number;
  /** 相对于 checkedAt 的剩余时间，单位为毫秒；过期时为 0。 */
  resetsInMs: number;
}

/** 账号额度附加信息。 */
export interface CreditsData {
  /** 账号是否拥有可用额度。 */
  hasCredits: boolean;
  /** 额度是否不受余额限制。 */
  unlimited: boolean;
  /** 可用余额；上游未提供时为 null。 */
  balance: number | null;
}

/** `getCurrentAccountUsage` 成功时返回的数据。 */
export interface CurrentAccountUsageData {
  /** 被查询的当前启用账号。 */
  account: AccountSummary;
  /** 本次用量数据查询完成时的 ISO 8601 时间。 */
  checkedAt: string;
  /** 账号套餐类型；上游未提供时为 null。 */
  planType: string | null;
  /** 主周期和辅助周期的规范化限额数据。 */
  windows: UsageWindowData[];
  /** 账号额度信息；上游未提供时为 null。 */
  credits: CreditsData | null;
}

/** 指定账号切换时的输入参数。 */
export interface SwitchToAccountInput {
  /** 目标账号的唯一标签；标签重复或不存在时会返回结构化错误。 */
  label: string;
}

/** 认证文件更新后的写入状态。 */
export interface AuthTargetWriteData {
  /** OpenCode 认证文件的写入状态。 */
  openCode: "written";
  /** Codex CLI 认证文件的写入、清理或跳过状态。 */
  codex: "written" | "cleared" | "skipped";
  /** Pi Agent 认证文件的写入状态。 */
  pi: "written";
}

/** `switchNextAccount` 与 `switchToAccount` 成功时返回的数据。 */
export interface AccountSwitchData {
  /** 切换前当前启用账号的安全摘要。 */
  previousAccount: AccountSummary;
  /** 切换后当前启用账号的安全摘要。 */
  currentAccount: AccountSummary;
  /** 是否实际切换到了另一个账号；只有一个账号或指定当前账号时为 false。 */
  changed: boolean;
  /** 切换完成时的 ISO 8601 时间。 */
  switchedAt: string;
  /** 本次切换写入各开发工具认证文件的结果。 */
  targets: AuthTargetWriteData;
}

const success = <T>(data: T): CdxApiResult<T> => ({ ok: true, data });

const failure = <T>(
  code: CdxApiErrorCode,
  message: string,
  retryable: boolean,
): CdxApiResult<T> => ({
  ok: false,
  error: { code, message, retryable },
});

const formatAccount = (
  account: AccountRecord,
  index: number,
  currentIndex: number,
): AccountSummary => {
  const label = account.label?.trim() || null;
  return {
    label,
    displayName: label ?? `未命名账号 ${index + 1}`,
    isCurrent: index === currentIndex,
  };
};

const loadApiConfig = async (): Promise<CdxApiResult<Config>> => {
  try {
    return success(await loadConfig());
  } catch {
    return failure("CONFIGURATION_ERROR", "无法读取 cdx 账号配置。", false);
  }
};

const resolveCurrentAccount = (
  config: Config,
): CdxApiResult<{ account: AccountRecord; index: number }> => {
  const account = config.accounts[config.current];
  if (!account?.accountId) {
    return failure(
      "CURRENT_ACCOUNT_UNAVAILABLE",
      "当前启用账号不存在或账号配置无效。",
      false,
    );
  }

  return success({ account, index: config.current });
};

const createConfiguredSecretStore = async (): Promise<
  CdxApiResult<SecretStoreAdapter>
> => {
  try {
    const selection = (await loadConfiguredSecretStoreSelection()) ?? "auto";
    return success(createSecretStoreAdapterFromSelection(selection));
  } catch {
    return failure(
      "SECRET_STORE_UNAVAILABLE",
      "无法初始化系统凭据库。",
      false,
    );
  }
};

const mapUsageFailure = <T>(result: Extract<UsageResult, { ok: false }>): CdxApiResult<T> => {
  if (result.error.type === "auth_failed") {
    return failure(
      "AUTH_FAILED",
      "当前账号凭据不可用，请使用 CLI 完成登录或重新登录。",
      false,
    );
  }
  if (result.error.type === "network_error") {
    return failure("NETWORK_ERROR", "查询账号用量时网络请求失败。", true);
  }
  return failure("USAGE_UNAVAILABLE", "当前无法获取账号用量。", true);
};

const mapUsageWindow = (
  kind: UsageWindowData["kind"],
  snapshot: WindowSnapshot,
  checkedAtMs: number,
): UsageWindowData => {
  const resetsAtUnixMs = snapshot.reset_at * 1000;
  return {
    kind,
    usedPercent: snapshot.used_percent,
    remainingPercent: Math.max(0, 100 - snapshot.used_percent),
    limitWindowSeconds: snapshot.limit_window_seconds,
    resetsAt: new Date(resetsAtUnixMs).toISOString(),
    resetsAtUnixMs,
    resetsInMs: Math.max(0, resetsAtUnixMs - checkedAtMs),
  };
};

const mapAuthTargets = (authResult: {
  piWritten: boolean;
  codexWritten: boolean;
  codexCleared: boolean;
}): AuthTargetWriteData => ({
  openCode: "written",
  pi: "written",
  codex: authResult.codexWritten
    ? "written"
    : authResult.codexCleared
      ? "cleared"
      : "skipped",
});

/**
 * 返回所有已配置账号的安全摘要。
 *
 * 不会返回账号邮箱、内部账号 ID 或任何认证凭据。
 */
export const listAccounts = async (): Promise<CdxApiResult<AccountListData>> => {
  const configResult = await loadApiConfig();
  if (!configResult.ok) {
    return configResult;
  }

  return success({
    accounts: configResult.data.accounts.map((account, index) =>
      formatAccount(account, index, configResult.data.current)
    ),
  });
};

/** 返回当前已经写入开发工具认证文件的账号信息。 */
export const getCurrentAccount = async (): Promise<
  CdxApiResult<CurrentAccountData>
> => {
  const configResult = await loadApiConfig();
  if (!configResult.ok) {
    return configResult;
  }

  const currentResult = resolveCurrentAccount(configResult.data);
  if (!currentResult.ok) {
    return currentResult;
  }

  return success({
    account: formatAccount(
      currentResult.data.account,
      currentResult.data.index,
      configResult.data.current,
    ),
  });
};

/**
 * 查询当前启用账号的周期用量和下一次重置时间。
 *
 * 此方法不会输出 CLI 文本，也不会返回令牌或原始上游响应。
 */
export const getCurrentAccountUsage = async (): Promise<
  CdxApiResult<CurrentAccountUsageData>
> => {
  const configResult = await loadApiConfig();
  if (!configResult.ok) {
    return configResult;
  }

  const currentResult = resolveCurrentAccount(configResult.data);
  if (!currentResult.ok) {
    return currentResult;
  }

  const secretStoreResult = await createConfiguredSecretStore();
  if (!secretStoreResult.ok) {
    return secretStoreResult;
  }

  const usageResult = await fetchUsage(
    currentResult.data.account.accountId,
    secretStoreResult.data,
  );
  if (!usageResult.ok) {
    return mapUsageFailure(usageResult);
  }

  try {
    const checkedAtMs = Date.now();
    const windows: UsageWindowData[] = [];
    if (usageResult.data.rate_limit?.primary_window) {
      windows.push(mapUsageWindow("primary", usageResult.data.rate_limit.primary_window, checkedAtMs));
    }
    if (usageResult.data.rate_limit?.secondary_window) {
      windows.push(mapUsageWindow("secondary", usageResult.data.rate_limit.secondary_window, checkedAtMs));
    }

    const credits = usageResult.data.credits
      ? {
          hasCredits: usageResult.data.credits.has_credits,
          unlimited: usageResult.data.credits.unlimited,
          balance: usageResult.data.credits.balance ?? null,
        }
      : null;

    return success({
      account: formatAccount(
        currentResult.data.account,
        currentResult.data.index,
        configResult.data.current,
      ),
      checkedAt: new Date(checkedAtMs).toISOString(),
      planType: usageResult.data.plan_type ?? null,
      windows,
      credits,
    });
  } catch {
    return failure(
      "USAGE_UNAVAILABLE",
      "上游用量数据格式异常，暂时无法解析。",
      true,
    );
  }
};

const switchToIndex = async (
  config: Config,
  targetIndex: number,
): Promise<CdxApiResult<AccountSwitchData>> => {
  const currentResult = resolveCurrentAccount(config);
  if (!currentResult.ok) {
    return currentResult;
  }

  const secretStoreResult = await createConfiguredSecretStore();
  if (!secretStoreResult.ok) {
    return secretStoreResult;
  }

  try {
    const result = await switchAccountAtIndex(
      config,
      targetIndex,
      secretStoreResult.data,
    );
    return success({
      previousAccount: formatAccount(
        currentResult.data.account,
        currentResult.data.index,
        currentResult.data.index,
      ),
      currentAccount: formatAccount(result.account, result.currentIndex, result.currentIndex),
      changed: result.previousIndex !== result.currentIndex,
      switchedAt: new Date().toISOString(),
      targets: mapAuthTargets(result.authResult),
    });
  } catch {
    return failure(
      "CREDENTIAL_UNAVAILABLE",
      "无法读取目标账号凭据或更新认证文件。",
      true,
    );
  }
};

/** 按配置顺序切换到下一个账号。 */
export const switchNextAccount = async (): Promise<
  CdxApiResult<AccountSwitchData>
> => {
  const configResult = await loadApiConfig();
  if (!configResult.ok) {
    return configResult;
  }

  const nextIndex = (configResult.data.current + 1) % configResult.data.accounts.length;
  return switchToIndex(configResult.data, nextIndex);
};

/**
 * 按用户设置的唯一标签切换账号。
 *
 * 不接受账号邮箱或内部账号 ID；请先通过 CLI 的 `cdx label` 为账号设置标签。
 */
export const switchToAccount = async (
  input: SwitchToAccountInput,
): Promise<CdxApiResult<AccountSwitchData>> => {
  const label = typeof input?.label === "string" ? input.label.trim() : "";
  if (!label) {
    return failure("ACCOUNT_LABEL_REQUIRED", "切换账号时必须提供非空标签。", false);
  }

  const configResult = await loadApiConfig();
  if (!configResult.ok) {
    return configResult;
  }

  const matchingIndices = configResult.data.accounts
    .map((account, index) => ({ account, index }))
    .filter(({ account }) => account.label === label)
    .map(({ index }) => index);

  if (matchingIndices.length === 0) {
    return failure("ACCOUNT_LABEL_NOT_FOUND", `未找到标签为“${label}”的账号。`, false);
  }
  if (matchingIndices.length > 1) {
    return failure("ACCOUNT_LABEL_DUPLICATED", `账号标签“${label}”重复，无法确定切换目标。`, false);
  }

  return switchToIndex(configResult.data, matchingIndices[0]);
};
