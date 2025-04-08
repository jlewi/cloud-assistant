package testutil

import (
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
)

// TODO(jlewi): We should deprecate this and use
//  cmp.Diff(tc.expected, tc.request, protocmp.Transform());

var (
	BlockComparer = cmpopts.IgnoreUnexported(cassie.Block{}, cassie.BlockOutput{}, cassie.BlockOutputItem{})
)
