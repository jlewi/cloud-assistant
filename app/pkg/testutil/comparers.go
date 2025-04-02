package testutil

import (
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
)

var (
	BlockComparer = cmpopts.IgnoreUnexported(cassie.Block{}, cassie.BlockOutput{}, cassie.BlockOutputItem{})
)
