package ai

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/go-logr/zapr"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/app/pkg/version"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie/cassieconnect"
	"github.com/pkg/errors"
	"go.uber.org/zap"
	"golang.org/x/net/http2"
	"google.golang.org/protobuf/encoding/protojson"
	"gopkg.in/yaml.v3"
)

type Asserter interface {
	Assert(ctx context.Context, as *cassie.Assertion, blocks map[string]*cassie.Block) error
}

type shellRequiredFlag struct{}

func (s shellRequiredFlag) Assert(ctx context.Context, as *cassie.Assertion, blocks map[string]*cassie.Block) error {
	shellFlag := as.GetShellRequiredFlag()
	command := shellFlag.Command
	flags := shellFlag.Flags
	contain_command := false                    // Tracks if the target command is found in any code block
	as.Result = cassie.Assertion_RESULT_SKIPPED // Default result is SKIPPED unless the command is found
	for _, block := range blocks {
		if block.Kind == cassie.BlockKind_CODE {
			if strings.Contains(block.Contents, command) { // Check if the code block contains the target command
				if !contain_command {
					contain_command = true
					as.Result = cassie.Assertion_RESULT_TRUE // Set to PASSED if the command is present (may be overridden below)
				}
				for _, flag := range flags { // If the command is present, check for all required flags
					if !strings.Contains(block.Contents, flag) {
						as.Result = cassie.Assertion_RESULT_FALSE // Set to FAILED if any required flag is missing
					}
				}
			}
		}
	}
	fmt.Println("shellRequiredFlag", as.Name, as.Result)
	return nil
}

type toolInvocation struct{}

func (t toolInvocation) Assert(ctx context.Context, as *cassie.Assertion, blocks map[string]*cassie.Block) error {
	// TODO: implement
	fmt.Println("toolInvocation", as.Name, as.Result)
	return nil
}

type fileRetrieved struct{}

func (f fileRetrieved) Assert(ctx context.Context, as *cassie.Assertion, blocks map[string]*cassie.Block) error {
	targetFileId := as.GetFileRetrieval().FileId
	as.Result = cassie.Assertion_RESULT_FALSE // Default to false unless the file is found
	for _, block := range blocks {
		if block.Kind == cassie.BlockKind_FILE_SEARCH_RESULTS {
			for _, file := range block.FileSearchResults {
				if file.FileID == targetFileId {
					as.Result = cassie.Assertion_RESULT_TRUE
					break
				}
			}
		}
	}
	fmt.Println("fileRetrieved", as.Name, as.Result)
	return nil
}

type llmJudge struct{}

func (l llmJudge) Assert(ctx context.Context, as *cassie.Assertion, blocks map[string]*cassie.Block) error {
	// TODO: implement
	fmt.Println("llmJudge", as.Name, as.Result)
	return nil
}

type codeblockRegex struct{}

func (c codeblockRegex) Assert(ctx context.Context, as *cassie.Assertion, blocks map[string]*cassie.Block) error {
	regexPattern := as.GetCodeblockRegex().Regex
	if regexPattern == "" {
		as.Result = cassie.Assertion_RESULT_SKIPPED
		return nil
	}
	re, err := regexp.Compile(regexPattern)
	if err != nil {
		as.Result = cassie.Assertion_RESULT_FALSE
		return errors.Wrapf(err, "invalid regex pattern: %s", regexPattern)
	}
	matched := false
	for _, block := range blocks {
		if block.Kind == cassie.BlockKind_CODE {
			if re.MatchString(block.Contents) {
				matched = true
				break
			}
		}
	}
	if matched {
		as.Result = cassie.Assertion_RESULT_TRUE
	} else {
		as.Result = cassie.Assertion_RESULT_FALSE
	}
	fmt.Println("codeblockRegex", as.Name, as.Result)
	return nil
}

var registry = map[cassie.Assertion_Type]Asserter{
	cassie.Assertion_TYPE_SHELL_REQUIRED_FLAG: shellRequiredFlag{},
	cassie.Assertion_TYPE_TOOL_INVOKED:        toolInvocation{},
	cassie.Assertion_TYPE_FILE_RETRIEVED:      fileRetrieved{},
	cassie.Assertion_TYPE_LLM_JUDGE:           llmJudge{},
	cassie.Assertion_TYPE_CODEBLOCK_REGEX:     codeblockRegex{},
}

func runInference(input string, cassieCookie string, inferenceEndpoint string) (map[string]*cassie.Block, error) {
	log := zapr.NewLoggerWithOptions(zap.L(), zapr.AllowZapFields(true))

	blocks := make(map[string]*cassie.Block)

	Block := cassie.Block{
		Kind:     cassie.BlockKind_MARKUP,
		Contents: "This is a block",
	}

	log.Info("Block", logs.ZapProto("block", &Block))

	baseURL := inferenceEndpoint
	if baseURL == "" {
		return blocks, errors.New("inferenceEndpoint is not set in config")
	}

	u, err := url.Parse(baseURL)
	if err != nil {
		log.Error(err, "Failed to parse URL")
		return blocks, errors.Wrapf(err, "Failed to parse URL")
	}

	var client cassieconnect.BlocksServiceClient

	var options []connect.ClientOption
	if u.Scheme == "https" {
		// Configure the TLS settings
		tlsConfig := &tls.Config{
			InsecureSkipVerify: true, // Set to true only for testing; otherwise validate the server's certificate
		}

		client = cassieconnect.NewBlocksServiceClient(
			&http.Client{
				Transport: &http2.Transport{
					TLSClientConfig: tlsConfig,
					DialTLSContext: func(ctx context.Context, network, addr string, config *tls.Config) (net.Conn, error) {
						// Create a secure connection with TLS
						return tls.Dial(network, addr, config)
					},
				},
			},
			baseURL,
			options...,
		)
	} else {
		client = cassieconnect.NewBlocksServiceClient(
			&http.Client{
				Transport: &http2.Transport{
					AllowHTTP: true,
					DialTLSContext: func(ctx context.Context, network, addr string, _ *tls.Config) (net.Conn, error) {
						// Use the standard Dial function to create a plain TCP connection
						return net.Dial(network, u.Host)
					},
				},
			},
			baseURL,
			options...,
		)
	}

	ctx := context.Background()
	genReq := &cassie.GenerateRequest{
		Blocks: []*cassie.Block{
			{
				Kind:     cassie.BlockKind_MARKUP,
				Role:     cassie.BlockRole_BLOCK_ROLE_USER,
				Contents: input,
			},
		},
	}
	req := connect.NewRequest(genReq)
	cookie := &http.Cookie{
		Name:  "cassie-session",
		Value: cassieCookie, // supply the real value here, temporary solution
		Path:  "/",          // adjust if needed
	}
	req.Header().Add("Cookie", cookie.String())
	stream, err := client.Generate(ctx, req)
	if err != nil {
		return blocks, errors.Wrapf(err, "Failed to create generate stream")
	}

	// Receive responses
	for stream.Receive() {
		response := stream.Msg()

		for _, block := range response.Blocks {
			blocks[block.Id] = block

			options := protojson.MarshalOptions{
				Multiline: true,
				Indent:    "  ", // Two spaces for indentation
			}

			// Marshal the protobuf message to JSON
			jsonData, err := options.Marshal(block)
			if err != nil {
				log.Error(err, "Failed to marshal block to JSON")
			} else {
				log.Info("Block", "block", string(jsonData))
			}
		}

	}

	if stream.Err() != nil {
		return blocks, errors.Wrapf(stream.Err(), "Error receiving response")
	}
	return blocks, nil
}

// markdownReport holds the data needed to render the evaluation markdown report
type markdownReport struct {
	ExperimentName     string
	DatasetName        string
	NumSamples         int
	NumAssertions      int
	NumPassed          int
	NumFailed          int
	NumSkipped         int
	AssertionTypeStats map[string]struct{ Passed, Failed, Skipped int }
	FailedAssertions   []struct {
		Sample    string
		Assertion string
		Reason    string
	}
	Commit    string
	Version   string
	Model     string
	Runner    string
	GoVersion string
	Date      string
}

func (r *markdownReport) Render() string {
	passRate := 100.0
	if r.NumPassed+r.NumFailed > 0 {
		passRate = float64(r.NumPassed) / float64(r.NumPassed+r.NumFailed) * 100
	}
	lines := []string{}
	lines = append(lines, fmt.Sprintf("# AI-SRE Level-1 Evaluation — %s", r.Date))
	lines = append(lines, "")
	lines = append(lines, "| Metric | Value |\n|--------|------:|")
	lines = append(lines, fmt.Sprintf("| Datasets              | `%s` |", r.DatasetName))
	lines = append(lines, fmt.Sprintf("| Samples               | %d |", r.NumSamples))
	lines = append(lines, fmt.Sprintf("| Assertions  | %d |", r.NumAssertions))
	lines = append(lines, fmt.Sprintf("| **Pass rate**         | **%.0f %%** (%d / %d) |", passRate, r.NumPassed, r.NumPassed+r.NumFailed))
	lines = append(lines, "")
	lines = append(lines, "## Pass / fail by assertion type")
	lines = append(lines, "| Assertion | ✅ Passed | ❌ Failed | ⏭️ Skipped | Pass % |")
	lines = append(lines, "|-----------|----------:|---------:|----------:|-------:|")
	// Sort assertion types for stable output
	var types []string
	for typ := range r.AssertionTypeStats {
		types = append(types, typ)
	}
	sort.Strings(types)
	for _, typ := range types {
		stat := r.AssertionTypeStats[typ]
		total := stat.Passed + stat.Failed
		passPct := 0.0
		if total > 0 {
			passPct = float64(stat.Passed) / float64(total) * 100
		}
		lines = append(lines, fmt.Sprintf("| `%s` | %d | %d | %d | %.0f %% |", typ, stat.Passed, stat.Failed, stat.Skipped, passPct))
	}
	lines = append(lines, "")
	if len(r.FailedAssertions) > 0 {
		lines = append(lines, fmt.Sprintf("<details>\n<summary>❌ %d failed assertions (click to expand)</summary>\n", len(r.FailedAssertions)))
		lines = append(lines, "\n| Sample | Assertion | Reason |\n|--------|-----------|--------|")
		for _, fail := range r.FailedAssertions {
			lines = append(lines, fmt.Sprintf("| `%s` | `%s` | %s |", fail.Sample, fail.Assertion, fail.Reason))
		}
		lines = append(lines, "\n</details>\n")
	}
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("_Run metadata: commit `%s`, version `%s`, model `%s`, runner `%s`, %s_", r.Commit, r.Version, r.Model, r.Runner, r.GoVersion))
	return strings.Join(lines, "\n")
}

// EvalFromExperiment runs an experiment based on the Experiment config.
func EvalFromExperiment(exp *cassie.Experiment, cookie map[string]string) (map[string]*cassie.Block, error) {
	// Read the experiment YAML file
	data, err := os.ReadFile(exp.Spec.GetDatasetPath())
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read dataset yaml file %q", exp.Spec.GetDatasetPath())
	}
	// Unmarshal YAML to generic map
	var yamlObj interface{}
	if err := yaml.Unmarshal(data, &yamlObj); err != nil {
		return nil, errors.Wrapf(err, "failed to unmarshal dataset yaml file %q", exp.Spec.GetDatasetPath())
	}
	// Convert YAML to JSON
	jsonData, err := json.Marshal(yamlObj)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal dataset yaml to json for file %q", exp.Spec.GetDatasetPath())
	}
	var dataset cassie.EvalDataset
	if err := protojson.Unmarshal(jsonData, &dataset); err != nil {
		return nil, errors.Wrapf(err, "failed to unmarshal json to proto for dataset file %q", exp.Spec.GetDatasetPath())
	}

	cassieCookie := cookie["cassie-session"]
	inferenceEndpoint := exp.Spec.GetInferenceEndpoint()

	loc, _ := time.LoadLocation("America/Los_Angeles")
	report := &markdownReport{
		ExperimentName:     exp.Metadata.GetName(),
		DatasetName:        exp.Spec.GetDatasetPath(),
		NumSamples:         len(dataset.Samples),
		AssertionTypeStats: map[string]struct{ Passed, Failed, Skipped int }{},
		Commit:             version.Commit,
		Version:            version.Version,
		Model:              "gpt-4o-mini", // TODO: fetch dynamically if possible
		Runner:             "linux-amd64", // TODO: fetch dynamically if possible
		GoVersion:          runtime.Version(),
		Date:               time.Now().In(loc).Format("2006-01-02 15:04 MST"),
	}

	totalAssertions := 0
	numPassed := 0
	numFailed := 0
	numSkipped := 0
	failedAssertions := []struct{ Sample, Assertion, Reason string }{}

	for _, sample := range dataset.Samples {
		blocks, err := runInference(sample.InputText, cassieCookie, inferenceEndpoint)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to run inference")
		}
		for _, assertion := range sample.Assertions {
			err := registry[assertion.Type].Assert(context.TODO(), assertion, blocks)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to assert %q", assertion.Name)
			}
			totalAssertions++
			typeName := assertion.Type.String()
			stat := report.AssertionTypeStats[typeName]
			switch assertion.Result {
			case cassie.Assertion_RESULT_TRUE:
				numPassed++
				stat.Passed++
			case cassie.Assertion_RESULT_FALSE:
				numFailed++
				stat.Failed++
				failedAssertions = append(failedAssertions, struct{ Sample, Assertion, Reason string }{
					Sample:    sample.Name,
					Assertion: assertion.Name,
					Reason:    "failed", // TODO: add more detailed reason if available
				})
			case cassie.Assertion_RESULT_SKIPPED:
				numSkipped++
				stat.Skipped++
			}
			report.AssertionTypeStats[typeName] = stat
		}
	}
	report.NumAssertions = totalAssertions
	report.NumPassed = numPassed
	report.NumFailed = numFailed
	report.NumSkipped = numSkipped
	report.FailedAssertions = failedAssertions

	// Write markdown report to outputDir
	outputDir := exp.Spec.GetOutputDir()
	if outputDir == "" {
		outputDir = "."
	}
	timestamp := time.Now().In(loc).Format("20060102_150405")
	reportPath := fmt.Sprintf("%s/eval_report_%s.md", outputDir, timestamp)
	if err := os.WriteFile(reportPath, []byte(report.Render()), 0644); err != nil {
		return nil, errors.Wrapf(err, "failed to write markdown report to %s", reportPath)
	}

	return nil, nil
}
