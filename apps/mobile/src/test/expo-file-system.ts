/**
 * An in-memory stand-in for the slice of expo-file-system the journal uses.
 *
 * Only what lib/journal.ts and lib/photos.ts actually touch: Paths.document,
 * Directory (exists/create/delete/list), and File (exists/create/delete/write/
 * textSync/copy/uri/name). Behaviour matches the real API closely enough that
 * the journal's own read-modify-write logic is what's under test, not a mock.
 */

const files = new Map<string, string>();
const dirs = new Set<string>(["/documents"]);

/** Wipe the fake filesystem between tests. */
export function __reset(): void {
  files.clear();
  dirs.clear();
  dirs.add("/documents");
}

function join(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`;
}

export class Directory {
  readonly uri: string;

  constructor(base: Directory | string, name?: string) {
    const baseUri = typeof base === "string" ? base : base.uri;
    this.uri = name === undefined ? baseUri : join(baseUri, name);
  }

  get exists(): boolean {
    return dirs.has(this.uri);
  }

  get name(): string {
    return this.uri.split("/").pop() ?? "";
  }

  create(_options?: { intermediates?: boolean }): void {
    dirs.add(this.uri);
  }

  delete(): void {
    for (const key of [...dirs]) {
      if (key === this.uri || key.startsWith(`${this.uri}/`)) dirs.delete(key);
    }
    for (const key of [...files.keys()]) {
      if (key.startsWith(`${this.uri}/`)) files.delete(key);
    }
  }

  list(): (Directory | File)[] {
    const out: (Directory | File)[] = [];
    const prefix = `${this.uri}/`;
    for (const key of dirs) {
      if (key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) {
        out.push(new Directory(key));
      }
    }
    for (const key of files.keys()) {
      if (key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) {
        out.push(new File(key));
      }
    }
    return out;
  }
}

export class File {
  readonly uri: string;

  constructor(base: Directory | string, name?: string) {
    const baseUri = typeof base === "string" ? base : base.uri;
    this.uri = name === undefined ? baseUri : join(baseUri, name);
  }

  get exists(): boolean {
    return files.has(this.uri);
  }

  get name(): string {
    return this.uri.split("/").pop() ?? "";
  }

  create(): void {
    files.set(this.uri, "");
  }

  delete(): void {
    files.delete(this.uri);
  }

  write(contents: string): void {
    files.set(this.uri, contents);
  }

  textSync(): string {
    const contents = files.get(this.uri);
    if (contents === undefined) throw new Error(`No such file: ${this.uri}`);
    return contents;
  }

  copy(dest: File): void {
    files.set(dest.uri, this.textSync());
  }
}

export const Paths = { document: "/documents" };
