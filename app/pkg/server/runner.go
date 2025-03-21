package server

import (
	"github.com/pkg/errors"
	runnerv2 "github.com/stateful/runme/v3/pkg/api/gen/proto/go/runme/runner/v2"
	"github.com/stateful/runme/v3/pkg/command"
	"github.com/stateful/runme/v3/pkg/runnerv2service"
	"go.uber.org/zap"
)

// Runner lets you run commands using Runme.
type Runner struct {
	server runnerv2.RunnerServiceServer
}

func NewRunner(logger *zap.Logger) (*Runner, error) {
	factory := command.NewFactory(command.WithLogger(logger))
	server, err := runnerv2service.NewRunnerService(factory, logger)
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to create Runme runner service")
	}
	return &Runner{
		server: server,
	}, nil
}

//
//func (r Runner) CreateSession(ctx context.Context, c *connect.Request[v2.CreateSessionRequest]) (*connect.Response[v2.CreateSessionResponse], error) {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (r Runner) GetSession(ctx context.Context, c *connect.Request[v2.GetSessionRequest]) (*connect.Response[v2.GetSessionResponse], error) {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (r Runner) ListSessions(ctx context.Context, c *connect.Request[v2.ListSessionsRequest]) (*connect.Response[v2.ListSessionsResponse], error) {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (r Runner) UpdateSession(ctx context.Context, c *connect.Request[v2.UpdateSessionRequest]) (*connect.Response[v2.UpdateSessionResponse], error) {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (r Runner) DeleteSession(ctx context.Context, c *connect.Request[v2.DeleteSessionRequest]) (*connect.Response[v2.DeleteSessionResponse], error) {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (r Runner) MonitorEnvStore(ctx context.Context, c *connect.Request[v2.MonitorEnvStoreRequest], c2 *connect.ServerStream[v2.MonitorEnvStoreResponse]) error {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (r Runner) Execute(ctx context.Context, c *connect.BidiStream[v2.ExecuteRequest, v2.ExecuteResponse]) error {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (r Runner) ExecuteOneShot(ctx context.Context, req *connect.Request[v2.ExecuteOneShotRequest], res *connect.ServerStream[v2.ExecuteOneShotResponse]) error {
//	sender := &ExecuteOneShotSender{
//		Sender: res,
//		Ctx:    ctx,
//	}
//
//	// If env is empty we will
//	if req.Msg.Config == nil {
//		req.Msg.Config = &runnerv2.ProgramConfig{}
//	}
//	if req.Msg.Config.Env == nil {
//		req.Msg.Config.Env = make([]string, 0)
//	}
//	return r.server.ExecuteOneShot(req.Msg, sender)
//}
//
//func (r Runner) ResolveProgram(ctx context.Context, c *connect.Request[v2.ResolveProgramRequest]) (*connect.Response[v2.ResolveProgramResponse], error) {
//	//TODO implement me
//	panic("implement me")
//}
//
//// ExecuteOneShotSender implements ResponseSender but ships out the data as ExecuteOneShotResponse
//type ExecuteOneShotSender struct {
//	Sender *connect.ServerStream[v2.ExecuteOneShotResponse]
//	Ctx    context.Context
//}
//
////func (s *ExecuteOneShotSender) Send(res *Res) error {
////	//TODO implement me
////	panic("implement me")
////}
//
//func (s *ExecuteOneShotSender) SetHeader(md metadata.MD) error {
//	//s.Sender.ResponseHeader().Set(md)
//	panic("implement me")
//}
//
//func (s *ExecuteOneShotSender) SendHeader(md metadata.MD) error {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (s *ExecuteOneShotSender) SetTrailer(md metadata.MD) {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (s *ExecuteOneShotSender) Context() context.Context {
//	return s.Ctx
//}
//
//func (s *ExecuteOneShotSender) SendMsg(m any) error {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (s *ExecuteOneShotSender) RecvMsg(m any) error {
//	//TODO implement me
//	panic("implement me")
//}
//
//func (s *ExecuteOneShotSender) Send(resp *runnerv2.ExecuteOneShotResponse) error {
//	log := logs.FromContext(s.Ctx)
//	// TODO(jlewi): Get rid of this its only for debugging.
//	log.Info("Sending response", logs.ZapProto("response", resp))
//	return s.Sender.Send(resp)
//}
