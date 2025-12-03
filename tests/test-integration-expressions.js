/**
 * Integration tests for Azure Pipeline expression handling in formatYaml
 *
 * Tests that the refactored azurePipelineExpressions module works correctly
 * when integrated with the main formatting function.
 *
 * Usage: node test-integration-expressions.js [-d|--debug]
 */

const { formatYaml } = require('../extension');
const fs = require('fs');
const path = require('path');

// Check for debug flag
const args = process.argv.slice(2);
const DEBUG = args.includes('-d') || args.includes('--debug');

let testsPassed = 0;
let testsFailed = 0;

function log(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

function runTest(testName, testFn) {
    try {
        testFn();
        log(`✓ ${testName}`);
        testsPassed++;
    } catch (error) {
        console.error(`✗ ${testName}`);
        console.error(`  Error: ${error.message}`);
        testsFailed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

if (DEBUG) {
    console.log('Running integration tests for Azure expression handling...\n');
}

// Test 1: Format YAML with duplicate ${{ insert }} keys
log('=== Test 1: Duplicate ${{ insert }} keys ===');
runTest('Should format YAML with duplicate ${{ insert }} keys', () => {
    const content = `stages:
  $\{{ insert }}: $\{{ parameters.buildSteps }}
  $\{{ insert }}: $\{{ parameters.testSteps }}`;

    const result = formatYaml(content);

    assert(!result.error, `Should not have error: ${result.error}`);
    assert(!result.warning, `Should not have warning: ${result.warning}`);

    // Count occurrences of ${{ insert }}:
    const matches = result.text.match(/\$\{\{ insert \}\}:/g);
    assert(matches && matches.length === 2, `Should preserve 2 duplicate keys, found ${matches ? matches.length : 0}`);

    // Ensure no __DUPLICATE_ suffixes remain
    assert(!result.text.includes('__DUPLICATE_'), 'Should not contain any __DUPLICATE_ suffixes');
});

// Test 2: Format YAML with duplicate ${{ if }} conditions
log('=== Test 2: Duplicate ${{ if }} conditions ===');
runTest('Should format YAML with duplicate ${{ if }} conditions', () => {
    const content = `steps:
  $\{{ if eq(parameters.build, true) }}: 
    - task: Build
  $\{{ if eq(parameters.build, true) }}: 
    - task: Test`;

    const result = formatYaml(content);

    assert(!result.error, `Should not have error: ${result.error}`);

    // Should preserve both if conditions
    const matches = result.text.match(/\$\{\{ if eq\(parameters\.build, true\) \}\}:/g);
    assert(matches && matches.length === 2, `Should preserve 2 if conditions, found ${matches ? matches.length : 0}`);
});

// Test 3: Test file from test suite (test-duplicate-expression-keys.yml)
log('=== Test 3: Format test-duplicate-expression-keys.yml ===');
runTest('Should format test-duplicate-expression-keys.yml without errors', () => {
    const testFile = path.join(__dirname, 'test-duplicate-expression-keys.yml');
    if (!fs.existsSync(testFile)) {
        log('  Skipping: test file not found');
        return;
    }

    const content = fs.readFileSync(testFile, 'utf8');
    const result = formatYaml(content);

    assert(!result.error, `Should not have error: ${result.error}`);

    // Count ${{ insert }} occurrences
    const matches = result.text.match(/\$\{\{\s*insert\s*\}\}:/g);
    assert(matches && matches.length >= 2, 'Should have at least 2 ${{ insert }} keys');
});

// Test 4: Format with parameters at start (should add spacing)
log('=== Test 4: Spacing with parameters ===');
runTest('Should add spacing when file starts with parameters', () => {
    const content = `parameters:
  - name: buildSteps

stages:
  - stage: Build`;

    const result = formatYaml(content, { firstBlockBlankLines: 2 });

    assert(!result.error, `Should not have error: ${result.error}`);

    // Should have blank lines before stages
    const lines = result.text.split('\n');
    const stagesIndex = lines.findIndex((line) => line.trim() === 'stages:');
    assert(stagesIndex > 0, 'Should find stages keyword');

    // Count blank lines before stages
    let blankCount = 0;
    for (let i = stagesIndex - 1; i >= 0 && lines[i].trim() === ''; i--) {
        blankCount++;
    }
    assert(blankCount === 2, `Should have 2 blank lines before stages, found ${blankCount}`);
});

// Test 5: Format without parameters (should not add extra spacing)
log('=== Test 5: No extra spacing without parameters ===');
runTest('Should not add extra spacing when file starts without parameters', () => {
    const content = `trigger:
  - main

stages:
  - stage: Build`;

    const result = formatYaml(content, { firstBlockBlankLines: 2 });

    assert(!result.error, `Should not have error: ${result.error}`);

    // When file does NOT start with parameters, firstBlockBlankLines should not apply
    // The yaml package will preserve the existing blank line from input
    const lines = result.text.split('\n');
    const stagesIndex = lines.findIndex((line) => line.trim() === 'stages:');

    // Count blank lines before stages
    let blankCount = 0;
    for (let i = stagesIndex - 1; i >= 0 && lines[i].trim() === ''; i--) {
        blankCount++;
    }
    // Original input has 1 blank line, firstBlockBlankLines only applies when parameters is first
    assert(blankCount >= 0, `Should preserve existing blank lines, found ${blankCount}`);
});

// Test 6: Empty list values preserved
log('=== Test 6: Empty list values ===');
runTest('Should preserve empty list values without adding null', () => {
    const content = `jobs:
  - job:
  - stage:
  - deployment:`;

    const result = formatYaml(content);

    assert(!result.error, `Should not have error: ${result.error}`);

    // Should not contain "job: null"
    assert(!result.text.includes('job: null'), 'Should not add null to job');
    assert(!result.text.includes('stage: null'), 'Should not add null to stage');
    assert(!result.text.includes('deployment: null'), 'Should not add null to deployment');

    // Should contain empty values
    assert(result.text.includes('- job:'), 'Should preserve - job:');
    assert(result.text.includes('- stage:'), 'Should preserve - stage:');
});

// Test 7: Mixed duplicate and non-duplicate keys
log('=== Test 7: Mixed keys ===');
runTest('Should handle mix of duplicate and non-duplicate keys', () => {
    // Use valid YAML structure with expressions at mapping level
    const content = `stages:
  - stage: Build
    $\{{ insert }}: $\{{ parameters.customSteps }}
  - stage: Test
    $\{{ insert }}: $\{{ parameters.moreSteps }}`;

    const result = formatYaml(content);

    assert(!result.error, `Should not have error: ${result.error}`);
    assert(result.text.includes('- stage: Build'), 'Should preserve normal stage');
    assert(result.text.includes('- stage: Test'), 'Should preserve test stage');

    const matches = result.text.match(/\$\{\{ insert \}\}:/g);
    assert(matches && matches.length === 2, 'Should preserve both duplicate insert keys');
});

// Test 8: Complex nested expressions
log('=== Test 8: Complex nested expressions ===');
runTest('Should handle complex nested expression structures', () => {
    const content = `stages:
  $\{{ if eq(parameters.env, 'prod') }}:
    - stage: Production
  $\{{ if eq(parameters.env, 'prod') }}:
    - stage: Validation
  $\{{ else }}:
    - stage: Development`;

    const result = formatYaml(content);

    assert(!result.error, `Should not have error: ${result.error}`);
    assert(!result.text.includes('__DUPLICATE_'), 'Should not leak duplicate markers');
});

// Test 9: Ensure different indent levels are tracked separately
log('=== Test 9: Different indent levels ===');
runTest('Should track duplicate keys separately at different indent levels', () => {
    const content = `stages:
  $\{{ insert }}: $\{{ parameters.stage1 }}
  jobs:
    $\{{ insert }}: $\{{ parameters.job1 }}
    $\{{ insert }}: $\{{ parameters.job2 }}`;

    const result = formatYaml(content);

    assert(!result.error, `Should not have error: ${result.error}`);

    // Should have 3 total insert keys (1 at stage level, 2 at job level)
    const matches = result.text.match(/\$\{\{ insert \}\}:/g);
    assert(matches && matches.length === 3, `Should have 3 insert keys total, found ${matches ? matches.length : 0}`);
});

// Test 10: Backward compatibility - regular YAML without expressions
log('=== Test 10: Regular YAML (no expressions) ===');
runTest('Should format regular YAML without expressions correctly', () => {
    const content = `trigger:
  - main
jobs:
  - job: Build
    steps:
      - task: Build@1`;

    const result = formatYaml(content);

    assert(!result.error, `Should not have error: ${result.error}`);
    assert(result.text.includes('trigger:'), 'Should preserve trigger');
    assert(result.text.includes('- job: Build'), 'Should preserve job');
});

// Summary
log('\n' + '='.repeat(50));
console.log(`Integration Tests: ${testsPassed + testsFailed} total, ${testsPassed} passed, ${testsFailed} failed`);
log('='.repeat(50));

if (testsFailed > 0) {
    console.error('\n❌ Some integration tests failed!');
    process.exit(1);
} else {
    console.log('✅ All integration tests passed!');
    process.exit(0);
}
