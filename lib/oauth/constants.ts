export const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
export const DEVICE_CODE_URL = "https://auth.openai.com/oauth/device/code";
export const TOKEN_URL = "https://auth.openai.com/oauth/token";
export const REDIRECT_URI = "http://localhost:1455/auth/callback";
// Keep this in sync with the OAuth scopes requested by the current Codex CLI.
// auth.openai.com now requires the connector scopes for the Codex client flow.
export const SCOPE =
  "openid profile email offline_access api.connectors.read api.connectors.invoke";
export const CALLBACK_PORT = 1455;
// `cdx` is a companion for Codex Desktop. Calling it from a regular terminal
// does not inherit the Desktop process environment, so it must use the same
// originator explicitly instead of falling back to the standalone CLI value.
export const DEFAULT_ORIGINATOR = "Codex Desktop";

/**
 * Preserve an explicit Codex Desktop originator override when it is present.
 * Regular terminals use the Desktop default above.
 */
export const resolveOriginator = (
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const override = env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE?.trim();
  return override || DEFAULT_ORIGINATOR;
};
