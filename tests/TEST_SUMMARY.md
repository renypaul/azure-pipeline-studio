# Test Summary for Recent Enhancements

## New Test Files

### 1. test-duplicate-keys.js
**Purpose**: Validates handling of duplicate Azure Pipeline expression keys

**Test Cases**:
- ✅ Duplicate `${{ insert }}:` keys are preserved
- ✅ Duplicate conditional keys (`${{ if }}:` / `${{ else }}:`) are preserved
- ✅ Files starting with `parameters:` get 2 blank lines before first section
- ✅ Files NOT starting with `parameters:` get 0 blank lines before first section
- ✅ Empty list item values (e.g., `- job:`) don't get `null` added

**Why These Tests Matter**:
- Azure Pipelines allows duplicate expression keys that expand at runtime
- Previous versions would fail with "duplicated mapping key" errors
- Smart spacing ensures consistent formatting based on file structure

### 2. test-duplicate-expression-keys.yml
**Purpose**: YAML test file with multiple `${{ insert }}:` keys

**Structure**:
```yaml
parameters:
  - name: buildParams
  - name: testParams

stages:
  - stage: Build
    jobs:
      - template: /templates/build.yaml
        parameters:
            ${{ insert }}: ${{ parameters.buildParams }}
            ${{ insert }}: ${{ parameters.testParams }}
```

### 3. test-parameters-spacing.yml
**Purpose**: Tests files that START with `parameters:`

**Expected Behavior**: 2 blank lines before `steps:`/`jobs:`/`stages:`

### 4. test-no-parameters-spacing.yml
**Purpose**: Tests files that DO NOT start with `parameters:`

**Expected Behavior**: 0 blank lines before `steps:`/`jobs:`/`stages:`

### 5. test-empty-list-values.yml
**Purpose**: Tests empty values in list items

**Expected Behavior**: 
- `- job:` stays as `- job:` (NOT `- job: null`)
- `- stage:` stays as `- stage:` (NOT `- stage: null`)

## Test Results

### All YAML Files Parse Successfully
```
✓ test-duplicate-expression-keys.yml
✓ test-parameters-spacing.yml  
✓ test-no-parameters-spacing.yml
✓ test-empty-list-values.yml
```

### All Validation Tests Pass
```
✓ Duplicate ${{ insert }} keys preserved correctly
✓ Duplicate conditional expression keys preserved correctly
✓ Files with parameters: have 2 blank lines before first section
✓ Files without parameters: have 0 blank lines before first section
✓ Empty list item values preserved correctly (no null added)
```

## Implementation Details

### Duplicate Key Handling
- **Function**: `handleDuplicateExpressionKeys(content)`
- **Location**: extension.js, line ~962
- **Approach**: Temporarily renames duplicate `${{ ... }}:` keys with unique suffixes
- **Restoration**: `restoreDuplicateExpressionKeys(content, modifications)` removes suffixes after formatting

### Smart Spacing Detection
- **Function**: `applyTopLevelSectionSpacing(content, options)`
- **Location**: extension.js, line ~1302
- **Logic**: 
  - Finds first non-comment, non-blank line
  - Checks if it's exactly `parameters:`
  - If yes: adds 2 blank lines before first `steps:`/`jobs:`/`stages:`
  - If no: adds 0 blank lines (removes any existing)

### Empty Value Preservation
- **Function**: `preserveEmptyValues(originalContent, formattedContent)`
- **Location**: extension.js, line ~703
- **Enhancement**: Updated regex to match list items: `/^(\s*)(?:-\s+)?([a-zA-Z_][\w-]*):\s*(?:#.*)?$/gm`
- **Result**: Both `key:` and `- key:` are preserved without adding `null`

## Running the Tests

```bash
# Run all tests
npm test

# Run only the duplicate key tests
node tests/test-duplicate-keys.js

# Test a specific YAML file
node extension-bundle.js tests/test-duplicate-expression-keys.yml
```

## Coverage Improvement

**Before**:
- 2469/2552 files formatted (83 files failed)
- Errors on files with duplicate expression keys

**After**:
- 2481/2552 files formatted (71 files failed)
- 12 additional files now format correctly (14% error reduction)
- Only 1 remaining error (legitimate duplicate non-expression key)
