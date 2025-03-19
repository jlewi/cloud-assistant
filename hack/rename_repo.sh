#!/bin/bash
# This script is an example of handling renaming of golang packages and repositories.
set -ex
ORIGINAL="github.com\/jlewi\/goapp-template"
NEW="github.com\/YOURORG\/YOURREPO"

# These rule updates all go files
find ./ -name "*.go"  -exec  sed -i ".bak" "s/${ORIGINAL}/${NEW}/g" {} ";"
# Find and update all go.mod files
find ./ -name "go.mod"  -exec sed -i ".bak" "s/${ORIGINAL}/${NEW}/g" {} ";"

# Find and update all Docker files
find ./ -name "Dockerfile*"  -exec sed -i ".bak" "s/${ORIGINAL}/${NEW}/g" {} ";"

# Update all markdown
find ./ -name "*.md"  -exec sed -i ".bak" "s/${ORIGINAL}/${NEW}/g" {} ";"

# Update all makefile
find ./ -name "Makefile"  -exec sed -i ".bak" "s/${ORIGINAL}/${NEW}/g" {} ";"

# Update all ManifestSync files
find ./ -name "manifestsync.yaml" -exec yq -i '.spec.sourceRepo.repo="code"' {} ";"

# Update YAML files containing K8s jobs
find ./ -name "*.yaml"  -exec  sed -i ".bak" "s/${ORIGINAL}/${NEW}/g" {} ";"

find ./ -name "*.bak" -exec rm {} ";"
