# Critical Analysis: Requirements Tracker Plugin

## Executive Summary

The plugin tracks requirements with test coverage verification. Recent refactoring addressed major conceptual issues (separating "unverified" from "stale", removing test pass/fail tracking). Some design friction remains around manual YAML editing.

---

## 1. Resolved Issues ✅

### Verification Status Model (Fixed)

**Before:** "No AI assessment" was treated as a staleness reason, making every new requirement with tests appear "stale".

**After:** Clear separation of verification states:
| Status | Meaning |
|--------|---------|
| `n/a` | No tests linked |
| `unverified` | Has tests, no AI assessment yet |
| `verified` | AI assessed, tests unchanged |
| `stale` | Tests changed since assessment |

A requirement with 20 tests is now correctly marked "unverified" (needs assessment) rather than "stale" (implies something broke).

### Test Pass/Fail Tracking (Removed)

**Before:** The plugin ran tests and tracked pass/fail status on each test link. This duplicated CI functionality and added complexity.

**After:** Removed entirely. Test pass/fail is CI's responsibility. The plugin focuses on:
- Does the requirement have tests? (coverage)
- Do the tests actually test the requirement? (AI verification)

---

## 2. Remaining Design Friction

### Manual Feature Files + Automated Hash Tracking

The design requires:
1. Users manually create YAML feature files
2. Users manually write gherkin requirements
3. CLI tracks test hashes automatically and mutates the YAML

This creates friction: hand-crafted YAML files that the tool silently modifies (updating hashes, clearing assessments). Acceptable if documented clearly, but feels like an awkward middle ground.

**Mitigation:** Documentation now clearly states what the CLI manages vs what users manage.

---

## 3. Missing Functionality

| Missing | Impact |
|---------|--------|
| `req add` command | Users must manually edit YAML to add requirements |
| `req unlink` command | No way to remove a test link except editing YAML |
| `req question` command | Questions are in the schema but no CLI to manage them |
| Bulk operations | Can't link multiple tests at once |
| Feature file creation | Must manually create `FEAT_NNN_*.yml` files |
| `--dry-run` mode | `req check` modifies files; can't preview changes |

---

## 4. Technical Limitations

### Test Parsing

The regex in test-parser.ts won't match:
- Template literals: `` test(`validates ${scenario}`, ...) ``
- Dynamic test names: `test(testName, ...)`
- `describe.each` or `it.each` table-driven tests
- Tests using `.only` or `.skip` modifiers

### Feature Matching Ambiguity

Fuzzy matching allows `req link 1 ...` to match `FEAT_001_anything.yml`. Convenient but unpredictable for users with many feature files.

### Scale Concerns

50 feature files × 20 requirements × 5 tests = 5000 test links to parse and hash on every `req check`. No caching or incremental checking.

---

## 5. What Works Well

- **Hash-based change detection** - Solid concept for tracking test modifications
- **YAML storage** - Human-readable, version-control friendly
- **Orphaned test detection** - Useful for finding untethered tests
- **Clear verification model** - Four distinct states with clear meanings
- **Test coverage** - 73 tests for a small tool
- **Clean separation of concerns** - Types, commands, and store logic are well-organized

---

## 6. Future Considerations

1. **Add missing CRUD commands** - `add`, `unlink`, `question` at minimum

2. **Add `--dry-run`** - Show what would change without mutating files

3. **Consider SQLite for scale** - Would enable queries like "requirements from Slack without tests" and incremental checking

4. **Improve error messages** - Suggest alternatives when test not found
