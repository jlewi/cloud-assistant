load("@rules_go//go:def.bzl", "go_library")

go_library(
    name = "cassieconnect",
    srcs = [
        "blocks.connect.go",
    ],
    importpath = "github.com/openai/openai/api/cloud-assistant/protos/gen/cassie/cassieconnect",
    deps = [
        "//api/cloud-assistant/protos/gen/cassie",
        "@com_connectrpc_connect//:connect",
    ],
    cgo = False,
    visibility = [
        "//visibility:public",
    ],
)
