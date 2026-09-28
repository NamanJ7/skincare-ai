import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const sourceRoot = "apps/mobile/src";
const sourceExtensions = new Set([".ts", ".tsx"]);
const rawColor = /(?:#[0-9a-f]{3,8}\b|\brgba?\s*\()/i;
const themeImport = /import\s*\{([^}]*)\}\s*from\s*["']@\/theme["']/gs;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      if (!sourceExtensions.has(extname(path)) || path.includes(".test.")) {
        return [];
      }
      return [path];
    }),
  );
  return nested.flat();
}

const failures = [];
for (const file of await sourceFiles(sourceRoot)) {
  const contents = await readFile(file, "utf8");
  const display = relative(process.cwd(), file);

  // Feature modules must resolve semantic colors at render time. The legacy
  // static export remains only as a temporary source-compatibility boundary.
  for (const match of contents.matchAll(themeImport)) {
    if (/(?:^|,)\s*colors\s*(?:,|$)/m.test(match[1])) {
      failures.push(`${display}: imports static compatibility colors`);
    }
  }

  // Approved palette values and derived theme colors belong in shared tokens,
  // not individual screens. Camera/debug overlays have semantic roles too.
  if (!display.includes(`${join("apps", "mobile", "src", "theme")}`) && rawColor.test(contents)) {
    failures.push(`${display}: contains a raw color literal`);
  }
}

if (failures.length) {
  console.error("Mobile theme audit failed:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Mobile theme audit passed: all feature colors are semantic and runtime-resolved.");
}
