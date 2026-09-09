# Dimpho Intelligence R5–R8

This release completes the governed production path from tool execution through customer memory/workflow persistence, evaluation gates, provider-aware model routing, fine-tuning operations, release promotion and rollback.

Production runtime components:
- R5 governed tool registry and `dimpho-tool-engine`
- R6 Customer 360 memory, conversation state and resumable workflow context
- R7 `dimpho-eval-worker` production regression gate
- R8 provider-aware model registry/router and `dimpho-model-ops`
- `adminos-agent` R8 runtime integration
- AdminOS `DimphoReleaseControl`

Fine-tuning submission remains explicitly cost-gated and requires the administrator to confirm the provider charge before a paid job can be created.
