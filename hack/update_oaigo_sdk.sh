#!/bin/bash
set -ex
# This is a simple script to get the pseudo-version for openai-go SDK.
# Since

branch=v2/next
owner=openai
repo=openai-go

# Fetch the latest commit hash and timestamp for the specified branch

# Fetch the latest commit SHA for the specified branch
commit_sha=$(gh api repos/$owner/$repo/commits/$branch --jq '.sha')

# We do it by hash because there is a "/" in the branch name
go get github.com/openai/openai-go@${commit_sha}
