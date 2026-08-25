# cdx API 接口文档

`@huui/cdx-switcher` 提供受限的脚本调用接口，用于读取本机已配置账号的状态、查询账号用量，以及按标签切换账号。

此接口不提供登录、重新登录、OAuth 流程、密钥库读写或令牌读取能力。

## 导入方式

```js
import {
  listAccounts,
  getCurrentAccount,
  getCurrentAccountUsage,
  getAccountUsages,
  switchNextAccount,
  switchToAccount,
} from "@huui/cdx-switcher/api";
```

所有接口均为异步函数，返回 `Promise<CdxApiResult<T>>`。不会写入终端、不会调用 `process.exit()`；调用方应自行处理返回值。

## 通用返回结构

### 成功

```ts
{
  ok: true;
  data: T;
}
```

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ok` | `true` | 表示请求成功。 |
| `data` | `T` | 当前接口的成功数据，具体结构见各接口说明。 |

### 失败

```ts
{
  ok: false;
  error: {
    code: CdxApiErrorCode;
    message: string;
    retryable: boolean;
  };
}
```

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ok` | `false` | 表示请求失败。 |
| `error.code` | `CdxApiErrorCode` | 供程序稳定判断的错误代码；不要依赖 `message` 文本做分支。 |
| `error.message` | `string` | 适合日志或人工排查的脱敏说明。 |
| `error.retryable` | `boolean` | 为 `true` 时，可采用退避策略后重试；为 `false` 时通常需要调整配置、标签或重新登录。 |

### 错误代码

| 错误代码 | 含义 | 是否建议重试 |
| --- | --- | --- |
| `CONFIGURATION_ERROR` | 无法读取或解析 cdx 账号配置。 | 否 |
| `CURRENT_ACCOUNT_UNAVAILABLE` | 当前账号索引无效，或当前账号不存在。 | 否 |
| `ACCOUNT_LABEL_REQUIRED` | 指定切换时未提供非空标签。 | 否 |
| `ACCOUNT_LABELS_INVALID` | 批量查询的标签不是字符串数组，或含有去除首尾空格后为空的标签。 | 否 |
| `ACCOUNT_LABEL_NOT_FOUND` | 未找到指定标签对应的账号。 | 否 |
| `ACCOUNT_LABEL_DUPLICATED` | 多个账号使用了相同标签，无法确定切换目标。 | 否 |
| `SECRET_STORE_UNAVAILABLE` | 系统凭据库无法初始化。 | 否 |
| `CREDENTIAL_UNAVAILABLE` | 无法读取目标账号凭据，或无法写入目标工具认证文件。 | 是 |
| `AUTH_FAILED` | 当前账号认证失效，需要通过 CLI 登录或重新登录。 | 否 |
| `USAGE_UNAVAILABLE` | 上游用量接口不可用或返回格式无法解析。 | 是 |
| `NETWORK_ERROR` | 查询用量时发生网络错误。 | 是 |

## 公共数据类型

### `AccountSummary`

账号的安全摘要；不会包含账号邮箱、内部账号 ID、访问令牌或刷新令牌。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `label` | `string \| null` | 使用 `cdx label` 设置的账号标签；未设置时为 `null`。 |
| `displayName` | `string` | 供界面与日志使用的安全显示名称；未设置标签时显示为“未命名账号 N”。 |
| `isCurrent` | `boolean` | 该账号是否为当前已写入 Codex、OpenCode 与 Pi 认证文件的账号。 |

### `UsageWindowData`

单个用量限额周期的规范化数据。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `kind` | `"primary" \| "secondary"` | 限额周期类别；分别表示主周期和辅助周期。 |
| `usedPercent` | `number` | 当前周期已使用百分比。 |
| `remainingPercent` | `number` | 当前周期剩余百分比，按 `100 - usedPercent` 计算。 |
| `limitWindowSeconds` | `number` | 限额周期总时长，单位为秒。 |
| `resetsAt` | `string` | 下次重置的 ISO 8601 时间。 |
| `resetsAtUnixMs` | `number` | 下次重置的 Unix 时间戳，单位为毫秒。 |
| `resetsInMs` | `number` | 相对于 `checkedAt` 的剩余时间，单位为毫秒；已到重置时间时为 `0`。 |

## 接口

### `listAccounts()`

用途：查看所有已配置账号的安全摘要与当前启用状态，适合守护程序启动时建立账号视图。

| 参数 | 类型 | 是否必填 | 含义 |
| --- | --- | --- | --- |
| 无 | - | - | 此接口不接收参数。 |

返回类型：`Promise<CdxApiResult<AccountListData>>`

成功时的 `data`：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `accounts` | `AccountSummary[]` | 已配置账号列表，顺序与 cdx 配置中的顺序一致。 |

```js
const result = await listAccounts();
if (result.ok) {
  console.log(result.data.accounts);
}
```

### `getCurrentAccount()`

用途：查看当前已启用、且已写入目标开发工具认证文件的账号。

| 参数 | 类型 | 是否必填 | 含义 |
| --- | --- | --- | --- |
| 无 | - | - | 此接口不接收参数。 |

返回类型：`Promise<CdxApiResult<CurrentAccountData>>`

成功时的 `data`：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `account` | `AccountSummary` | 当前启用账号的安全摘要。 |

```js
const result = await getCurrentAccount();
if (result.ok) {
  console.log(result.data.account.displayName);
}
```

### `getCurrentAccountUsage()`

用途：查询当前启用账号的用量周期、已用比例与下次重置时间。适合自动切换守护程序据此决定下一次轮询时间或风险阈值。

| 参数 | 类型 | 是否必填 | 含义 |
| --- | --- | --- | --- |
| 无 | - | - | 此接口不接收参数。 |

返回类型：`Promise<CdxApiResult<CurrentAccountUsageData>>`

成功时的 `data`：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `account` | `AccountSummary` | 被查询的当前启用账号。 |
| `checkedAt` | `string` | 本次查询完成时的 ISO 8601 时间。 |
| `planType` | `string \| null` | 账号套餐类型；上游未提供时为 `null`。 |
| `windows` | `UsageWindowData[]` | 主周期与辅助周期的用量数据；上游未提供某周期时不会包含对应元素。 |
| `credits` | `CreditsData \| null` | 账号额度信息；上游未提供时为 `null`。 |

`credits` 的字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `hasCredits` | `boolean` | 账号是否拥有可用额度。 |
| `unlimited` | `boolean` | 额度是否不受余额限制。 |
| `balance` | `number \| null` | 可用余额；上游未提供时为 `null`。 |

```js
const result = await getCurrentAccountUsage();
if (!result.ok) {
  console.error(result.error.code, result.error.message);
} else {
  for (const window of result.data.windows) {
    console.log(window.kind, window.usedPercent, window.resetsAt);
  }
}
```

### `getAccountUsages(labels?)`

用途：一次性并发查询多个账号的用量周期、已用比例与下次重置时间。此接口只读取用量，**不会切换当前账号**；适合自动服务每轮评估只调用一次，再在内存中筛选与排序。

| 参数 | 类型 | 是否必填 | 含义 |
| --- | --- | --- | --- |
| `labels` | `string[] \| undefined` | 否 | 需要查询的标签集合。省略或传入空数组时查询全部已配置账号（包括无标签账号）。 |

- 非空 `labels` 会先对每项去除首尾空格；空标签或非字符串标签会使整个调用以 `ACCOUNT_LABELS_INVALID` 失败。
- 重复标签按首次出现顺序自动去重，不会重复请求同一账号。
- 指定标签时，账号不存在或标签重复不会中断其余账号；对应项会分别返回 `ACCOUNT_LABEL_NOT_FOUND` 或 `ACCOUNT_LABEL_DUPLICATED`。
- 查询全部账号时，结果按 cdx 配置顺序返回；无标签账号的结果项 `label` 为 `null`。

返回类型：`Promise<CdxApiResult<AccountUsagesData>>`

顶层 `ok: false` 仅表示配置无法读取、凭据库无法初始化或批量入参整体非法。顶层 `ok: true` 表示整批任务已完成，即使某些账号查询失败；应检查每个 `accounts` 项的 `error`。

`data` 字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `checkedAt` | `string` | 整批查询完成时的 ISO 8601 时间。 |
| `accounts` | `AccountUsageItem[]` | 单项结果列表，顺序与去重后的输入标签或 cdx 配置账号顺序一致。 |

`AccountUsageItem` 字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `label` | `string \| null` | 请求标签；查询全部账号时，无标签账号为 `null`。 |
| `account` | `AccountSummary \| null` | 成功定位账号时的安全摘要；标签不存在或重复时为 `null`。 |
| `usage` | `AccountUsageData \| null` | 查询成功时的用量数据；失败时为 `null`。其中字段与 `getCurrentAccountUsage()` 的成功数据一致。 |
| `error` | `CdxApiError \| null` | 单项失败的结构化错误；成功时为 `null`。 |

单项错误规则：

| 情况 | `account` | `usage` | `error.code` |
| --- | --- | --- | --- |
| 标签不存在 | `null` | `null` | `ACCOUNT_LABEL_NOT_FOUND` |
| 配置中标签重复 | `null` | `null` | `ACCOUNT_LABEL_DUPLICATED` |
| 未认证或凭据失效 | 账号摘要 | `null` | `AUTH_FAILED` |
| 网络错误 | 账号摘要 | `null` | `NETWORK_ERROR` |
| 上游用量不可解析 | 账号摘要 | `null` | `USAGE_UNAVAILABLE` |
| 查询成功 | 账号摘要 | 用量数据 | `null` |

```js
const result = await getAccountUsages(); // 全部已配置账号
// const result = await getAccountUsages([]); // 同样查询全部账号
// const result = await getAccountUsages(["主账号", "备用账号"]);

if (result.ok) {
  const available = result.data.accounts.filter((item) => item.usage !== null);
  console.log(available);
}
```

### `switchNextAccount()`

用途：按 cdx 配置中的账号顺序切换到下一个账号。只有一个账号时会重新写入该账号的认证文件，`changed` 为 `false`。

| 参数 | 类型 | 是否必填 | 含义 |
| --- | --- | --- | --- |
| 无 | - | - | 此接口不接收参数。 |

返回类型：`Promise<CdxApiResult<AccountSwitchData>>`

### `switchToAccount(input)`

用途：按用户设置的唯一标签切换到指定账号。此接口不接受邮箱、内部账号 ID 或凭据。

参数 `input`：

| 字段 | 类型 | 是否必填 | 含义 |
| --- | --- | --- | --- |
| `label` | `string` | 是 | 目标账号标签。标签不存在时返回 `ACCOUNT_LABEL_NOT_FOUND`；重复时返回 `ACCOUNT_LABEL_DUPLICATED`。 |

返回类型：`Promise<CdxApiResult<AccountSwitchData>>`

```js
const result = await switchToAccount({ label: "备用账号" });
if (result.ok) {
  console.log(`已切换到 ${result.data.currentAccount.displayName}`);
}
```

### `AccountSwitchData`

`switchNextAccount()` 与 `switchToAccount()` 成功时的 `data` 结构：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `previousAccount` | `AccountSummary` | 切换前当前启用账号。 |
| `currentAccount` | `AccountSummary` | 切换后当前启用账号。 |
| `changed` | `boolean` | 是否切换到另一个账号。 |
| `switchedAt` | `string` | 切换完成时的 ISO 8601 时间。 |
| `targets` | `AuthTargetWriteData` | 各目标工具认证文件的更新状态。 |

`targets` 的字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `openCode` | `"written"` | OpenCode 认证文件已写入。 |
| `codex` | `"written" \| "cleared" \| "skipped"` | Codex CLI 认证文件状态：写入、因缺少 ID Token 清理、或跳过。 |
| `pi` | `"written"` | Pi Agent 认证文件已写入。 |

## 使用约束

- 使用 `switchToAccount()` 前，应通过 CLI 的 `cdx label` 为每个需要指定切换的账号设置唯一标签。
- `switchNextAccount()` 与 `switchToAccount()` 会真实改写本机的 Codex、OpenCode 与 Pi 认证文件。
- 用量数据来自上游接口，调用方应处理 `USAGE_UNAVAILABLE` 与 `NETWORK_ERROR`，并按 `retryable` 做退避重试。
- API 不负责跨进程的任务暂停、切换锁、重试队列或自动切换策略；这些应由后续独立守护模块负责。
