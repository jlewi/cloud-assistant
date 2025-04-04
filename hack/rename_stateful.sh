#!/bin/bash
# This script is an example of handling renaming of golang packages and repositories.
set -ex
ORIGINAL="github.com\/stateful\/runme"
NEW="github.com\/runmedev\/runme"

# These rule updates all go files
find ./ -name "*.go"  -exec  sed -i ".bak" "s/${ORIGINAL}/${NEW}/g" {} ";"
# Find and update all go.mod files
find ./ -name "go.mod"  -exec sed -i ".bak" "s/${ORIGINAL}/${NEW}/g" {} ";"

find ./ -name "*.bak" -exec rm {} ";"

