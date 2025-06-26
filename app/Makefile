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

build: clean build-binary

build-binary: build-dir
	CGO_ENABLED=0 go build -o .build/cas -ldflags="$(LDFLAGS)" github.com/jlewi/cloud-assistant/app

build-dir:
	@mkdir -p .build

dist: clean build-binary

clean:
	@rm -rf .build

tidy:
	gofmt -s -w .
	goimports -w .


lint:
	# golangci-lint automatically searches up the root tree for configuration files.
	golangci-lint run --fix

test:
	GITHUB_ACTIONS=$${GITHUB_ACTIONS:-true} go test -v ./...

install/pre-commit:
	pre-commit install
	pre-commit install --install-hooks
