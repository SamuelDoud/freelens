#!/usr/bin/env bash
# Copyright (c) Freelens Authors. All rights reserved.
# Licensed under MIT License. See LICENSE in root directory for more information.
#
# Prototype only: builds the Pods rows service (experimentalRowsPodsList) for the build host's
# Linux architecture into binaries/client/linux/<arch>/freelens-rows, where the dev run and
# electron-builder's extraResources of the Linux target pick it up. It is not part of the
# binaries lock: the binary is built from the source next to this script, not downloaded.
#
# Needs a Go toolchain (the go.mod says which) and the module cache, or network access.
# Run it before `electron-builder`:  freelens/rows-service/build.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -m)" in
  x86_64 | amd64) arch=x64 goarch=amd64 ;;
  aarch64 | arm64) arch=arm64 goarch=arm64 ;;
  *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

out="$here/../binaries/client/linux/$arch"
mkdir -p "$out"

cd "$here"
CGO_ENABLED=0 GOOS=linux GOARCH="$goarch" go build -trimpath -ldflags "-s -w" -o "$out/freelens-rows" .
echo "built $out/freelens-rows"
