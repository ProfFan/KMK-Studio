#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
KE_ROOT="$PWD/.cache/karabiner"
PIN=9312593e1a3bf72b94c63c524ebabe2637442e8a
if [[ ! -d "$KE_ROOT/.git" ]]; then
  git clone --depth 1 --branch v16.3.0 https://github.com/pqrs-org/Karabiner-Elements.git "$KE_ROOT"
fi
[[ "$(git -C "$KE_ROOT" rev-parse HEAD)" == "$PIN" ]] || { echo 'Unexpected Karabiner revision' >&2; exit 1; }
git -C "$KE_ROOT" submodule update --init --depth 1
mkdir -p .cache/native
/usr/bin/python3 scripts/prepare-native-helper.py
clang -O2 -I "$KE_ROOT/vendor/duktape-src" -c "$KE_ROOT/vendor/duktape-src/duktape.c" -o .cache/native/duktape.o
clang -O2 -I "$KE_ROOT/vendor/duktape-src" -c "$KE_ROOT/vendor/duktape-2.7.0/extras/console/duk_console.c" -o .cache/native/console.o
clang -O2 -I "$KE_ROOT/vendor/duktape-src" -c "$KE_ROOT/vendor/duktape-2.7.0/extras/module-node/duk_module_node.c" -o .cache/native/module.o
clang++ -std=c++23 -O1 -Wno-deprecated-declarations \
  -iquote "$KE_ROOT" -I "$PWD/.cache/native" -I "$KE_ROOT/src/share" \
  -isystem "$KE_ROOT/vendor/vendor/include" \
  -isystem "$KE_ROOT/vendor/Karabiner-DriverKit-VirtualHIDDevice/include" \
  -isystem "$KE_ROOT/vendor/duktape-src" \
  -isystem "$KE_ROOT/vendor/duktape-2.7.0/extras/console" \
  -isystem "$KE_ROOT/vendor/duktape-2.7.0/extras/module-node" \
  native/oracle.cpp .cache/native/duktape.o .cache/native/console.o .cache/native/module.o \
  -framework CoreFoundation -framework CoreGraphics -framework IOKit -framework Carbon \
  -o .cache/native/kmk-oracle
echo 'Built isolated Karabiner 16.3.0 oracle.'
