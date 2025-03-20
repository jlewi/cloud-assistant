load("@rules_go//go:def.bzl", "go_library")

go_library(
    name = "cassie",
    srcs = [
        "blocks.pb.go",
        "filesearch.pb.go",
    ],
    importpath = "github.com/openai/openai/api/cloud-assistant/protos/gen/cassie",
    deps = [
        "@org_golang_google_protobuf//reflect/protoreflect",
        "@org_golang_google_protobuf//runtime/protoimpl",
    ],
    cgo = False,
    visibility = [
        "//visibility:public",
    ],
)
