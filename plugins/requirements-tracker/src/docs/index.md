# Requirements Tracker Documentation

A tool for tracking project requirements with test coverage verification and AI-powered assessment.

## Quick Links

- [Usage Guide](usage-guide) - Learn how to use the web UI
- [CLI Reference](cli-reference) - All available commands
- [Architecture](architecture) - System design and data structures
- [How It Works](how-it-works) - Internal mechanics explained

## What is Requirements Tracker?

Requirements Tracker helps you:

1. **Capture requirements** in Gherkin format (Given/When/Then)
2. **Link tests** to requirements for traceability
3. **Track verification status** - know when tests change
4. **Get AI assessments** of test coverage sufficiency
5. **Visualize everything** in a web UI

## Getting Started

```bash
# Initialize in your project
req init

# Add a requirement
req add auth/REQ_login.yml \
  --gherkin "Given a user with valid credentials When they submit the login form Then they are authenticated" \
  --source-type doc \
  --source-desc "PRD v2.1"

# Link a test
req link auth/REQ_login.yml src/auth.test.ts:validates login

# Open the web UI
req ui
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Requirement** | A Gherkin-format specification stored as YAML in `.requirements/` |
| **Test Link** | Connection between a requirement and a test function |
| **Verification** | Status indicating if linked tests have been AI-assessed and unchanged |
| **AI Assessment** | Claude's evaluation of whether tests adequately cover the requirement |
| **Staleness** | When tests change after assessment, verification becomes "stale" |
