import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = [
  "apps/mobile/src",
  "apps/web/app",
  "apps/web/components",
];

const forbidden = [
  "Pore Pro",
  "$19.99",
  "$9.99",
  "Unlimited scans",
  "unlimited scans",
  "climate-adjusted",
  "Your current routine gets the credit",
  "This is a placeholder privacy policy",
  "This is a placeholder set of terms",
  "Your quality-checked scan is in",
  "Analysis pipeline not wired",
  "submitForAnalysis stub",
  "uploadScanPhotos stub",
  "REPLACEABLE PLACEHOLDER ART",
  "MASCOT_ART_IS_PLACEHOLDER",
  "â€¦",
  "Â·",
  "â€”",
  "â†’",
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
    }),
  );
  return nested.flat();
}

const files = (await Promise.all(roots.map(sourceFiles))).flat();
const failures = [];

for (const file of files) {
  const contents = await readFile(file, "utf8");
  for (const phrase of forbidden) {
    if (contents.includes(phrase)) {
      failures.push(`${relative(process.cwd(), file)}: ${JSON.stringify(phrase)}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Unsupported or retired product copy found:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Copy audit passed (${files.length} source files checked).`);
}
