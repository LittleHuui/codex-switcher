import pkg from "../package.json";

const upstreamPackageName = "@bjesuiter/codex-switcher";
const upstreamRepository = "github.com/bjesuiter/codex-switcher";
const upstreamAuthor = "bjesuiter";

const repositoryUrl = typeof pkg.repository === "string"
  ? pkg.repository
  : pkg.repository?.url;

const errors: string[] = [];

if (pkg.name === upstreamPackageName) {
  errors.push(`Replace package name '${upstreamPackageName}' with a package name you own.`);
}

if (repositoryUrl?.includes(upstreamRepository)) {
  errors.push("Replace package.repository with the URL of this fork.");
}

if (pkg.author === upstreamAuthor) {
  errors.push("Replace package.author with the current maintainer's attribution.");
}

if (errors.length > 0) {
  console.error("Refusing to publish while upstream package metadata is still present:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Publish metadata check passed.");
