/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// The renderer is bundled whole, so the packaged app needs in node_modules only
// what the main process loads at runtime: the packages its bundle imports, and
// their dependencies. electron-builder.yml leaves the others out of app.asar.
//
// This fails when the built main process needs a package that
// electron-builder.yml leaves out, which would break the packaged app only.
// With --report it lists the packaged dependencies the main process does not
// need, with their size, to keep the exclusions complete.
//
// Run after `pnpm build`: node build/check-packaged-dependencies.cjs [--report]

const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { builtinModules, createRequire } = require("node:module");
const path = require("node:path");

const appDir = path.resolve(__dirname, "..");
// pnpm links into an app only its own dependencies; the rest of the packaged
// tree, which electron-builder flattens, is in pnpm's hoisted store.
const hoistedDir = path.resolve(appDir, "..", "node_modules", ".pnpm", "node_modules");
const buildDir = path.join(appDir, "static", "build");
const report = process.argv.includes("--report");

const builtins = new Set(["electron", ...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const packageOf = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
const isPackageName = (name) => /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(name);

// The bare imports of the main process bundle (main.js and its chunks; the
// renderer's are under assets/).
const imported = new Set();

for (const file of readdirSync(buildDir).filter((name) => name.endsWith(".js"))) {
  // Without the comment lines: bundled packages keep their documentation, whose
  // examples are full of require() calls that never run.
  const source = readFileSync(path.join(buildDir, file), "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join("\n");

  for (const [, specifier] of source.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']([^"'./][^"']*)["']/g,
  )) {
    const name = packageOf(specifier);

    // Workspace packages are bundled from source and never packed (see
    // electron-builder.yml); a name of one in the bundle is not a runtime import.
    if (!builtins.has(specifier) && !builtins.has(name) && isPackageName(name) && !name.startsWith("@freelensapp/")) {
      imported.add(name);
    }
  }
}

// The package directory a name resolves to from a directory, as Node resolves it.
const resolvePackage = (name, fromDir) => {
  try {
    return path.dirname(createRequire(path.join(fromDir, "noop.js")).resolve(`${name}/package.json`));
  } catch {
    // A package without "./package.json" in its exports: look for it on the way up.
    for (let dir = fromDir; ; dir = path.dirname(dir)) {
      const candidate = path.join(dir, "node_modules", name);

      if (existsSync(path.join(candidate, "package.json"))) {
        return candidate;
      }

      if (dir === path.dirname(dir)) {
        const hoisted = path.join(hoistedDir, name);

        return existsSync(path.join(hoisted, "package.json")) ? hoisted : undefined;
      }
    }
  }
};

const readManifest = (dir) => JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));

// The names, and directories, of a set of packages and of everything they depend on.
const closure = (roots, fromDir, { includePeers = true, followWorkspace = false } = {}) => {
  const names = new Set();
  const visited = new Set();
  const unresolved = new Set();
  const visit = (name, from, required) => {
    const dir = resolvePackage(name, from);

    if (!dir) {
      if (required) {
        unresolved.add(name);
      }

      return;
    }

    if (visited.has(dir)) {
      return;
    }

    visited.add(dir);
    names.add(name);

    const manifest = readManifest(dir);
    const optional = new Set([
      ...Object.keys(manifest.optionalDependencies ?? {}),
      ...Object.keys(manifest.peerDependenciesMeta ?? {}).filter(
        (peer) => manifest.peerDependenciesMeta[peer].optional,
      ),
    ]);
    const dependencies = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
      ...(includePeers ? Object.keys(manifest.peerDependencies ?? {}) : []),
    ];

    for (const dependency of dependencies) {
      if (followWorkspace || !dependency.startsWith("@freelensapp/")) {
        visit(dependency, dir, !optional.has(dependency) && dependency in (manifest.dependencies ?? {}));
      }
    }
  };

  for (const name of roots) {
    visit(name, fromDir, true);
  }

  return { names, dirs: visited, unresolved };
};

const { names: needed, unresolved } = closure(imported, appDir);

// A package that cannot be found cannot be checked: it would be missing from the package too.
if (unresolved.size) {
  console.error(`The main process imports packages that cannot be resolved: ${[...unresolved].sort().join(", ")}.`);
  process.exit(1);
}

// The packages electron-builder.yml leaves out: "!**/node_modules/<name>/**".
const builderConfig = readFileSync(path.join(appDir, "electron-builder.yml"), "utf8");
const excluded = new Set(
  [...builderConfig.matchAll(/^\s*-\s*"?!(?:\*\*\/)?node_modules\/((?:@[^/\s"]+\/)?[^/\s"*{]+)\/\*\*"?\s*$/gm)].map(
    ([, name]) => name,
  ),
);

const missing = [...excluded].filter((name) => needed.has(name)).sort();

if (missing.length) {
  console.error(
    `electron-builder.yml leaves out packages the main process needs at runtime: ${missing.join(", ")}.\n` +
      "Remove them from its exclusions, or stop importing them from the main process.",
  );
  process.exit(1);
}

console.log(
  `The main process imports ${imported.size} packages and needs ${needed.size} with their dependencies; none is left out of the package.`,
);

if (report) {
  const dirSize = (dir) =>
    readdirSync(dir, { withFileTypes: true }).reduce((size, entry) => {
      const file = path.join(dir, entry.name);

      return size + (entry.isDirectory() ? (entry.name === "node_modules" ? 0 : dirSize(file)) : statSync(file).size);
    }, 0);
  const production = closure(Object.keys(readManifest(appDir).dependencies ?? {}), appDir, {
    includePeers: false,
    followWorkspace: true,
  });
  // The largest copy of each package, as it is installed once per version.
  const sizes = new Map();

  for (const dir of production.dirs) {
    const { name } = readManifest(dir);

    if (!name.startsWith("@freelensapp/") && !needed.has(name) && !excluded.has(name)) {
      sizes.set(name, Math.max(sizes.get(name) ?? 0, dirSize(dir)));
    }
  }

  const unneeded = [...sizes].map(([name, size]) => [size, name]).sort((a, b) => b[0] - a[0]);
  console.log("Packaged dependencies the main process does not need and electron-builder.yml does not leave out:");

  for (const [size, name] of unneeded) {
    console.log(`  ${(size / 1e6).toFixed(2).padStart(7)} MB  ${name}`);
  }
}
