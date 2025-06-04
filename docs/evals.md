# 📊 Evaluation Framework Guide (Level 1 Evals)

This document explains **Level 1 evaluations** for the AI SRE project—simple, truth-valued assertions that help us catch regressions and measure improvements over time.

---

## 1 — Why Level 1 Evals?

| Goal | How Level 1 Evals Help |
|------|-----------------------|
| **Spot failures early** | Automated assertions flag obvious mistakes (missing flags, wrong tool, etc.) |
| **Focus doc work** | Failures pinpoint gaps in reference docs, guiding us on what to improve. |
| **Measure progress** | A stable test set + pass-rate stats let us quantify how doc or model tweaks affect quality. |





## 2 — Core Concepts

| Concept | Proto Message | Description |
|---------|---------------|-------------|
| **EvalDataset** | `EvalDataset` | A collection of `EvalSample`s plus metadata. |
| **EvalSample** | `EvalSample` | One **input text question** + a list of **Assertion**s to check. |
| **Assertion** | `Assertion` | A single check that yields **PASS / FAIL / SKIPPED**. |
| **Assertor** (Go) | N/A | Concrete implementation that evaluates one `Assertion` type. |

### Supported Assertion Kinds (v0)

| Kind | Assertor | Status |
|------|----------|--------|
| `ShellRequiredFlag` | `shell_required_flag_assertor.go` | ✅ Implemented |
| `ToolInvocation` | `tool_invocation_assertor.go` | 🛠️ Stub |
| `FileRetrieval` | `file_retrieval_assertor.go` | 🛠️ Stub |
| `LlmJudge` | `llm_judge_assertor.go` | 🛠️ Stub |

---

## 3 — Quick Start

1. **Build the CLI**

   ```bash
   make build
   ```

2. **Create a Dataset YAML**

   Define the questions and assertions you want to test.  A minimal example is shown below:

   ```yaml
   samples:
     - name: test_AKS_required_flags
       description: Checks that every az aks command carries the --subscription and --resource-group flags.
       inputText: What region is cluster unified-60 in?
       assertions:
         - name: az_aks_has_required_flag
           type: TYPE_SHELL_REQUIRED_FLAG
           shellRequiredFlag:
             command: az aks
             flags:
               - --subscription
               - --resource-group
   ```

3. **Create a Cookie File**

   The cookie file should be in .env format (one key=value per line). For example:

   ```env
   cassie-session=your-cassie-session-cookie
   another-cookie=another-value
   ```

4. **Create an Experiment YAML**

   Point the experiment at the dataset and your Cassie backend.

   ```yaml
   apiVersion: cloudassistant.io/v1alpha1
   kind: Experiment
   metadata:
      name: experiment-test 
   spec:
      datasetPath: "./dataset/dataset_test.yaml"  # path to the dataset file above
      outputDir:   "./experiments/out" # where reports will be written
      inferenceEndpoint: "http://localhost:8080" # Cassie inference service
   ```

5. **Run the evaluation**

   ```bash
   ./.build/cas eval ./dataset/experiment_test.yaml --cookie-file ./path/to/cookies.env
   ```

