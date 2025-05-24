FROM golang:1.24 as gobuilder

WORKDIR /app
COPY app ./app
COPY protos ./protos
COPY go.mod ./go.mod
COPY go.sum ./go.sum

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GO111MODULE=on \
    go build \
    -ldflags "${LDFLAGS}" \
    -a -o /app/cas github.com/jlewi/cloud-assistant/app

FROM node:18-alpine AS builder
# Accept the build argument
ARG COMMIT_SHORT_SHA

# Set it as an environment variable
# This gets picked by our vit configuration and names the file index${GIT_SHA_SHORT}.js.
# This enables cache busting; when you refresh the app you get a new version.
# You can also tell which version of the code you are running by looking at your index.html
ENV GIT_SHA_SHORT=$COMMIT_SHORT_SHA

# Optional: print it for debug
RUN echo "Short SHA: GIT_SHA_SHORT"

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# TODO(jlewi): Do we still need this
RUN apk add --no-cache libc6-compat

# Install dependencies based on the preferred package manager
COPY web ./web
WORKDIR web

# We need to add the registry corresponding to the buf generated protos.
# https://buf.build/docs/bsr/generated-sdks/npm/
# This is so that we can load client libraries published through the buf registry.
RUN npm config set @buf:registry https://buf.build/gen/npm/v1 && \
    npm install

RUN npm run build

# Production image, copy all the files and run next
FROM cgr.dev/chainguard/static:latest as service

COPY --from=gobuilder /app/cas /cas
COPY --from=builder /web/dist /static
