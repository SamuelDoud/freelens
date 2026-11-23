/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// Builds the rows service (the `rowsService` option) from the Go source next to this script into
// binaries/client/<platform>/<arch>/freelens-rows[.exe], where the dev run and electron-builder's
// extraResources pick it up. It is built from source, not downloaded, so it is not in the binaries
// lock.
//
//   node rows-service/build.cjs          the platform and architecture of this machine
//   node rows-service/build.cjs --all    every platform and architecture Freelens ships
//
// Without a Go toolchain it builds nothing and says so. The option then reports the service as
// unavailable and the lists keep using full objects, so a build without Go still works. Set
// FREELENS_REQUIRE_ROWS_SERVICE=1 to make a missing toolchain fail the build instead, as a release
// build should.

const { spawnSync } = require("node:child_process");
const { mkdirSync } = require("node:fs");
const path = require("node:path");

const here = __dirname;
const binariesDir = path.resolve(here, "..", "binaries", "client");

const platforms = { linux: "linux", darwin: "darwin", win32: "windows" };
const architectures = { x64: "amd64", arm64: "arm64" };

const allTargets = Object.entries(platforms).flatMap(([nodePlatform]) =>
  Object.keys(architectures).map((arch) => ({ nodePlatform, arch })),
);
const targets = process.argv.includes("--all") ? allTargets : [{ nodePlatform: process.platform, arch: process.arch }];

const goVersion = spawnSync("go", ["version"], { encoding: "utf8" });

if (goVersion.error || goVersion.status !== 0) {
  const message = "rows-service: no Go toolchain on PATH (run `mise install`); the rows service is not built";

  if (process.env.FREELENS_REQUIRE_ROWS_SERVICE === "1") {
    console.error(message);
    process.exit(1);
  }

  console.warn(`${message}, and the option will report it as unavailable.`);
  process.exit(0);
}

for (const { nodePlatform, arch } of targets) {
  const platform = platforms[nodePlatform];
  const goArch = architectures[arch];

  if (!platform || !goArch) {
    console.error(`rows-service: unsupported target ${nodePlatform}/${arch}`);
    process.exit(1);
  }

  const outDir = path.join(binariesDir, platform, arch);
  const output = path.join(outDir, platform === "windows" ? "freelens-rows.exe" : "freelens-rows");

  mkdirSync(outDir, { recursive: true });

  const build = spawnSync("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", output, "."], {
    cwd: here,
    stdio: "inherit",
    env: { ...process.env, CGO_ENABLED: "0", GOOS: platform, GOARCH: goArch },
  });

  if (build.status !== 0) {
    console.error(`rows-service: go build failed for ${platform}/${arch}`);
    process.exit(build.status ?? 1);
  }

  console.log(`rows-service: built ${path.relative(process.cwd(), output)}`);
}
