# cdx

`cdx` 是一个社区维护的命令行工具，用于在本机保存的多个账号凭据之间切换，并将当前账号凭据写入兼容的开发工具配置中。

> 非官方项目：本仓库基于 [bjesuiter/codex-switcher](https://github.com/bjesuiter/codex-switcher) 二次开发，遵循 MIT 许可证。原作者署名、许可证和本分叉声明见 [NOTICE](./NOTICE) 与 [LICENSE](./LICENSE)。本项目与原作者及 OpenAI 均不存在隶属、赞助或认可关系。

## 当前版本

### 1.8.7

- 修复 Windows 上 OAuth 登录链接被 `cmd` 截断的问题，改用 Windows 系统 URL 协议处理器打开浏览器。
- 更新 OAuth 请求的 scope、state 与 originator 兼容处理，并按当前 Codex CLI 的格式写入 `auth.json`。
- 增加分叉来源说明、第三方依赖声明与发布前元数据检查。
- 移除仅用于 PKCE 的第三方 OAuth 依赖，改用 Node 内置加密实现。

完整变更记录见 [CHANGELOG.md](./CHANGELOG.md)。

## 使用范围与安全边界

- 仅使用你本人拥有或已获授权使用的账号；不要借此规避订阅、地区、用量、访问控制或服务条款限制。
- 登录后，本工具会在系统凭据库中保存令牌，并向目标工具写入本地认证文件。令牌等同于账号访问凭据，请不要提交、截图或分享这些文件。
- 本仓库不含 OpenAI 徽标或官方视觉素材。文档中出现 OpenAI、Codex、OpenCode、Pi 等名称仅用于说明兼容对象，不表示官方关系。

## 支持的目标与系统

| 目标 | 写入位置 |
| --- | --- |
| Codex CLI | `~/.codex/auth.json`；Windows 为 `%USERPROFILE%\\.codex\\auth.json` |
| OpenCode | `~/.local/share/opencode/auth.json`；Windows 为 `%LOCALAPPDATA%\\opencode\\auth.json` |
| Pi Agent | `~/.pi/agent/auth.json`；Windows 为 `%USERPROFILE%\\.pi\\agent\\auth.json` |

| 系统 | 凭据存储 | 状态 |
| --- | --- | --- |
| macOS | Keychain | 已支持 |
| Windows | Windows Credential Manager | Beta，已针对 OAuth 浏览器启动修复 |
| Linux | Secret Service/keyring | Beta，需要可用的 keyring 服务 |

运行环境需要 [Bun](https://bun.sh)。Linux 推荐先安装并启动 GNOME Keyring 或兼容的 Secret Service 服务。

## 安装

此个人分叉在发布前必须先替换 npm 包元数据，不能安装或发布为原作者的 `@bjesuiter/codex-switcher` 包名。

发布到你自己的 npm 包后，使用实际包名安装：

```bash
bun install -g <你的-npm-包名>
```

例如，若你发布的包名是 `@你的-npm-scope/cdx-switcher`，就执行：

```bash
bun install -g @你的-npm-scope/cdx-switcher
```

安装成功后可验证：

```bash
cdx --version
cdx --help
```

### 从源码运行（不会注册全局 `cdx`）

```bash
git clone https://github.com/LittleHuui/codex-switcher.git
cd codex-switcher
bun install --frozen-lockfile
bun cdx.ts --help
```

## 快速操作流程

### 1. 添加第一个账号

```bash
cdx login
```

保持终端窗口开启。命令会启动本地回调地址 `http://localhost:1455/auth/callback` 并尝试打开浏览器；在浏览器完成授权后，浏览器会跳回该本地地址，终端将保存账号。

Windows 若没有打开浏览器、错误打开文件夹，或自动页仍报认证参数错误：

1. 先确认运行的是本仓库发布的 1.8.7 或更高版本：`cdx --version`。
2. 不要关闭运行 `cdx login` 的终端。
3. 复制终端打印的**完整**授权链接，在正常浏览器地址栏重新打开；不要手动删改 `originator`、`state`、`scope`、`code_challenge` 等参数。
4. 完成登录后，浏览器必须回跳到 `http://localhost:1455/auth/callback`，终端才会完成保存。

### 2. 查看账号状态

```bash
cdx status
```

### 3. 切换当前账号

交互选择账号：

```bash
cdx switch
```

切换到下一个账号：

```bash
cdx switch --next
```

按账号 ID 或标签切换：

```bash
cdx switch <账号-ID-或标签>
```

切换后，重新打开对应的 Codex CLI、OpenCode 或 Pi 会话，使其读取新的本地认证文件。

### 4. 给账号设置标签

```bash
cdx label
cdx label <账号-ID-或旧标签> <新标签>
```

### 5. 重新登录已有账号

```bash
cdx relogin
cdx relogin <账号-ID-或标签>
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `cdx` | 进入交互模式 |
| `cdx login` | 通过浏览器 OAuth 添加账号 |
| `cdx login --device-flow` | 使用设备授权流程；某些 VPS/IP 可能被 Cloudflare 拦截 |
| `cdx relogin [账号]` | 重新授权指定账号；不带账号时交互选择 |
| `cdx switch [账号]` | 切换账号；`--next` 切到下一个 |
| `cdx label [账号] [标签]` | 查看或修改账号标签 |
| `cdx status` | 查看账号、令牌过期时间与用量状态 |
| `cdx usage [账号]` | 查看所有或指定账号的用量 |
| `cdx doctor` | 显示认证文件位置、状态与运行环境能力 |
| `cdx keyring check` | 检查 Linux keyring 依赖和安全存储能力 |
| `cdx keyring install` | 在 Debian/Ubuntu/Mint 安装 Linux keyring 依赖 |
| `cdx migrate-secrets` | 将 macOS 旧 Keychain 条目迁移到默认后端 |
| `cdx complete <shell>` | 生成 `zsh`、`bash`、`fish` 或 `powershell` 补全脚本 |
| `cdx update-self` | 更新已发布的全局包；仅在你自己的 npm 包发布后使用 |

所有命令和选项以 `cdx --help`、`cdx help <命令>` 为准。

## 凭据与配置位置

账号列表不包含明文令牌；令牌存入系统凭据库：

| 系统 | 账号列表 | 凭据库 |
| --- | --- | --- |
| macOS / Linux | `~/.config/cdx/accounts.json`，或 `$XDG_CONFIG_HOME/cdx/accounts.json` | macOS Keychain / Linux Secret Service |
| Windows | `%APPDATA%\\cdx\\accounts.json` | Windows Credential Manager |

默认凭据后端为 `auto`。macOS 需要兼容旧条目时，可临时指定：

```bash
cdx --secret-store legacy-keychain status
```

若某个平台只能使用降级安全存储，工具会要求明确确认。只有在理解风险时才可设置非交互覆盖：

```bash
CDX_ALLOW_SECURE_STORE_FALLBACK=1
```

Windows PowerShell 等价写法：

```powershell
$env:CDX_ALLOW_SECURE_STORE_FALLBACK = "1"
```

## Shell 补全

```bash
# zsh
source <(cdx complete zsh)

# bash
source <(cdx complete bash)
```

Fish 和 PowerShell 请使用 `cdx complete fish`、`cdx complete powershell` 生成相应脚本后，按各自 shell 的配置方式加载。

## 排错

### OAuth 页面显示“缺少必填参数”

- 确认没有使用旧的全局 `cdx`、缓存链接或原项目构建产物。
- 使用 `cdx --version` 确认版本；重新安装自己的发布包后再重试。
- 通过终端输出的完整授权 URL 打开浏览器。该 URL 与本次运行的本地回调、state 和 PKCE verifier 绑定，不能复用旧链接。
- 若手动打开能成功而自动打开失败，请保留终端输出和 `cdx doctor` 结果后提交 Issue；不要公开令牌、回调 `code` 或完整授权 URL。

### Linux 无法保存凭据

先执行：

```bash
cdx keyring check
```

在 Debian、Ubuntu 或 Mint 上可执行：

```bash
cdx keyring install
```

### 远程 SSH / VPS 登录

优先使用普通 `cdx login` 并按终端提示完成手动回调。设备授权模式可能遇到 Cloudflare 验证，不能作为可靠替代方案。

## 开发与发布自己的分叉

### 本地验证

```bash
bun install --frozen-lockfile
bun run build
npm pack --dry-run ./dist
```

### 首次发布前必须完成

1. 在 npm 注册并登录你自己的账号或 scope。
2. 修改 `package.json` 的 `name`、`author` 和 `repository`：三者都不能继续指向 `bjesuiter` 或上游仓库。
3. 推荐使用不包含第三方品牌的包名，例如 `@你的-npm-scope/cdx-switcher`。
4. 在 GitHub 仓库 Secrets 中配置你自己的 `NPM_TOKEN`；不要复制或使用原作者的令牌。
5. 执行 `bun run check-publish-metadata`。元数据仍指向上游时，该检查会失败并阻止发布。
6. 检查 `LICENSE`、`NOTICE`、`THIRD_PARTY_NOTICES.md` 是否随发布内容生成。

### 发布新版本

1. 增加 `package.json` 的版本号。
2. 按最新 tag 到 `HEAD` 的变化更新 `CHANGELOG.md`，并用相同内容替换本 README 的“当前版本”部分。
3. 运行本地验证命令和 `bun run check-publish-metadata`。
4. 提交修改，创建不带前缀的版本 tag，例如 `git tag 1.8.8`。
5. 推送提交和 tag：`git push && git push --tags`。
6. 确认 GitHub Actions 的 **Publish to npm** 工作流成功完成。

## 许可证与署名

本仓库保留了上游 MIT 许可证和原作者署名，并通过 `NOTICE` 明确列出二次开发关系。MIT 允许修改和再发布，但要求在副本或实质部分中保留版权和许可声明。对第三方依赖，见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

这份说明是工程层面的合规措施，不构成法律意见；若计划商业化、使用品牌进行宣传，或将工具提供给组织用户，建议让具备资质的律师按你的实际发布地区、服务条款和使用方式复核。
