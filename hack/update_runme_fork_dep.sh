#!/bin/bash
set -ex
# This is a simple script to get the pseudo-version for our Runme fork


repo_url=https://github.com/jlewi/runme.git
branch=jlewi/cloud-assistant
owner=jlewi
repo=runme

# Fetch the latest commit hash and timestamp for the specified branch

# Fetch the latest commit SHA for the specified branch
commit_sha=$(gh api repos/$owner/$repo/commits/$branch --jq '.sha')

if [ -z "$commit_sha" ]; then
  echo "Failed to retrieve commit SHA for branch '$branch' in repository '$repo_url'"
  exit 1
fi

# Fetch the commit date in ISO 8601 format
commit_date_iso=$(gh api repos/$owner/$repo/commits/$commit_sha --jq '.commit.committer.date')

if [ -z "$commit_date_iso" ]; then
  echo "Failed to retrieve commit date for commit '$commit_sha'"
  exit 1
fi

# Determine the operating system
os_name=$(uname)

# Convert ISO 8601 date to UTC timestamp in the format YYYYMMDDHHMMSS
if [[ "$os_name" == "Darwin" ]]; then
  # macOS
  commit_date_iso=${commit_date_iso%Z}
  commit_date=${commit_date_iso%T*}
  commit_time=${commit_date_iso#*T}
  commit_timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${commit_date}T${commit_time}" +"%Y%m%d%H%M%S")
else
  # Linux
  commit_timestamp=$(date -u -d "$commit_date_iso" +"%Y%m%d%H%M%S")
fi

# Extract the first 12 characters of the commit SHA
short_hash=${commit_sha:0:12}

# Construct the pseudo-version
pseudo_version="v3.0.0-${commit_timestamp}-${short_hash}"
