ROOT := $(shell git rev-parse --show-toplevel)
PROJECT := chat-lewi

GIT_SHA := $(shell git rev-parse HEAD)
GIT_SHA_SHORT := $(shell git rev-parse --short HEAD)
DATE := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION := $(shell git describe --tags)-$(GIT_SHA_SHORT)
LDFLAGS := -s -w \
        -X 'github.com/jlewi/cloud-assistant/app/pkg/version.Date=$(DATE)' \
        -X 'github.com/jlewi/cloud-assistant/app/pkg/version.Version=$(subst v,,$(VERSION))' \
        -X 'github.com/jlewi/cloud-assistant/app/pkg/version.Commit=$(GIT_SHA)'

build: build-dir build-assets
	CGO_ENABLED=0 go build -o .build/cas -ldflags="$(LDFLAGS)" github.com/jlewi/cloud-assistant/app

build-dir:
	mkdir -p .build
	mkdir -p pkg/server/dist

build-assets:
	@cd ../web && npm run build
	@rm -rf pkg/server/dist
	@mkdir -p pkg/server/dist
	@cp -rv ../web/dist/index.* pkg/server/dist/

tidy:
	gofmt -s -w .
	goimports -w .


lint:
	# golangci-lint automatically searches up the root tree for configuration files.
	golangci-lint run

test:
	GITHUB_ACTIONS=true go test -v ./...