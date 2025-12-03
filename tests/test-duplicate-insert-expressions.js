/**
 * Test duplicate ${{ insert }} expressions at the same indentation level
 * These are valid in Azure Pipelines and should be preserved
 */

const { formatYaml } = require('../extension.js');

function runTest(name, testFn) {
    process.stdout.write(`📋 Test: ${name}\n`);
    try {
        const result = testFn();
        if (result) {
            console.log('✅ PASS\n');
            return true;
        } else {
            console.log('❌ FAIL\n');
            return false;
        }
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
        return false;
    }
}

console.log('🧪 Testing Duplicate ${{ insert }} Expressions');
console.log('=========================================\n');

let passed = 0;
let failed = 0;

// Test 1: Multiple ${{ insert }} at root level in stages
if (
    runTest('Multiple ${{ insert }} in stages section', () => {
        const input = `stages:
\${{ insert }}: value1
\${{ insert }}: value2
\${{ insert }}: value3`;

        const result = formatYaml(input);

        // Should not error and should preserve all three inserts
        if (result.error) {
            console.log('Expected: No error');
            console.log('Got error:', result.error);
            return false;
        }

        const lines = result.text.split('\n');
        const insertCount = lines.filter((line) => line.includes('${{ insert }}')).length;

        if (insertCount !== 3) {
            console.log('Expected: 3 ${{ insert }} expressions');
            console.log('Got:', insertCount);
            console.log('Output:', result.text);
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

// Test 2: Multiple ${{ insert }} with different content
if (
    runTest('Multiple ${{ insert }} with array values', () => {
        const input = `stages:
\${{ insert }}:
  - stage: Stage1
\${{ insert }}:
  - stage: Stage2
\${{ insert }}:
  - stage: Stage3`;

        const result = formatYaml(input);

        if (result.error) {
            console.log('Expected: No error');
            console.log('Got error:', result.error);
            return false;
        }

        const hasStage1 = result.text.includes('Stage1');
        const hasStage2 = result.text.includes('Stage2');
        const hasStage3 = result.text.includes('Stage3');

        if (!hasStage1 || !hasStage2 || !hasStage3) {
            console.log('Expected: All three stages preserved');
            console.log('Output:', result.text);
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

// Test 3: Idempotency - format twice should produce same result
if (
    runTest('Idempotency of duplicate ${{ insert }} formatting', () => {
        const input = `stages:
\${{ insert }}: value1
\${{ insert }}: value2`;

        const result1 = formatYaml(input);
        const result2 = formatYaml(result1.text);

        if (result1.error || result2.error) {
            console.log('Got error on formatting');
            return false;
        }

        if (result1.text !== result2.text) {
            console.log('Expected: Same output on second format');
            console.log('First:', result1.text);
            console.log('Second:', result2.text);
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

// Test 4: Mixed ${{ insert }} and regular stages (using object notation)
if (
    runTest('Mixed ${{ insert }} and regular stage definitions', () => {
        const input = `stages:
- stage: BuildStage
  jobs:
  - job: Build

- \${{ insert }}: additional-stages-1

- stage: TestStage
  jobs:
  - job: Test

- \${{ insert }}: additional-stages-2`;

        const result = formatYaml(input);

        if (result.error) {
            console.log('Expected: No error');
            console.log('Got error:', result.error);
            return false;
        }

        const hasBuildStage = result.text.includes('BuildStage');
        const hasTestStage = result.text.includes('TestStage');
        const insertCount = (result.text.match(/\$\{\{ insert \}\}/g) || []).length;

        if (!hasBuildStage || !hasTestStage || insertCount !== 2) {
            console.log('Expected: Both regular stages and 2 inserts');
            console.log('Output:', result.text);
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

// Test 5: Nested ${{ insert }} in jobs (using list notation)
if (
    runTest('Duplicate ${{ insert }} in jobs section', () => {
        const input = `stages:
- stage: Build
  jobs:
  - \${{ insert }}: job-template-1
  - \${{ insert }}: job-template-2
  - job: RegularJob`;

        const result = formatYaml(input);

        if (result.error) {
            console.log('Expected: No error');
            console.log('Got error:', result.error);
            return false;
        }

        const insertCount = (result.text.match(/\$\{\{ insert \}\}/g) || []).length;
        const hasRegularJob = result.text.includes('RegularJob');

        if (insertCount !== 2 || !hasRegularJob) {
            console.log('Expected: 2 inserts and regular job');
            console.log('Got inserts:', insertCount);
            console.log('Output:', result.text);
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

// Test 6: ${{ parameters.x }} style duplicates (not insert)
if (
    runTest('Duplicate ${{ parameters.x }} expressions', () => {
        const input = `stages:
\${{ parameters.stages }}:
  - stage: FromParam1
\${{ parameters.stages }}:
  - stage: FromParam2`;

        const result = formatYaml(input);

        if (result.error) {
            console.log('Expected: No error');
            console.log('Got error:', result.error);
            return false;
        }

        const paramCount = (result.text.match(/\$\{\{ parameters\.stages \}\}/g) || []).length;

        if (paramCount !== 2) {
            console.log('Expected: 2 parameter expressions');
            console.log('Got:', paramCount);
            console.log('Output:', result.text);
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

// Test 7: Complex real-world scenario (using proper list notation)
if (
    runTest('Complex real-world pipeline with multiple inserts', () => {
        const input = `parameters:
- name: environments
  type: object

stages:
- \${{ insert }}: pre-build-stages

- stage: Build
  jobs:
  - job: BuildJob
    steps:
    - task: Build@1

- \${{ insert }}: post-build-stages

- stage: Deploy
  jobs:
  - \${{ each env in parameters.environments }}:
      job: Deploy_\${{ env }},
      steps:
      - task: Deploy@1

- \${{ insert }}: post-deploy-stages`;

        const result = formatYaml(input);

        if (result.error) {
            console.log('Expected: No error');
            console.log('Got error:', result.error);
            return false;
        }

        const insertCount = (result.text.match(/\$\{\{ insert \}\}/g) || []).length;
        const hasBuild = result.text.includes('BuildJob');
        const hasDeploy = result.text.includes('Deploy@1');

        if (insertCount !== 3 || !hasBuild || !hasDeploy) {
            console.log('Expected: 3 inserts, build and deploy tasks');
            console.log('Inserts found:', insertCount);
            console.log('Output:', result.text);
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

// Test 8: Exact count preservation - verify input and output have same number
if (
    runTest('Exact duplicate count preservation after formatting', () => {
        const input = `stages:
- \${{ insert }}: template-1
- \${{ insert }}: template-2
- stage: Middle
- \${{ insert }}: template-3
- \${{ insert }}: template-4
- \${{ insert }}: template-5`;

        // Count in input
        const inputCount = (input.match(/\$\{\{ insert \}\}/g) || []).length;

        const result = formatYaml(input);

        if (result.error) {
            console.log('Expected: No error');
            console.log('Got error:', result.error);
            return false;
        }

        // Count in output
        const outputCount = (result.text.match(/\$\{\{ insert \}\}/g) || []).length;

        if (inputCount !== outputCount) {
            console.log(`Expected: ${inputCount} inserts preserved`);
            console.log(`Got: ${outputCount} inserts in output`);
            console.log('Input:', input);
            console.log('Output:', result.text);
            return false;
        }

        if (inputCount !== 5) {
            console.log('Test setup error: Expected 5 inserts in input');
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

// Test 9: Multiple format passes preserve duplicates
if (
    runTest('Multiple formatting passes preserve all duplicates', () => {
        const input = `stages:
- \${{ insert }}: stage1
- \${{ insert }}: stage2
- \${{ insert }}: stage3
- \${{ insert }}: stage4`;

        const inputCount = (input.match(/\$\{\{ insert \}\}/g) || []).length;

        // Format 3 times
        const result1 = formatYaml(input);
        const result2 = formatYaml(result1.text);
        const result3 = formatYaml(result2.text);

        if (result1.error || result2.error || result3.error) {
            console.log('Got error during formatting');
            return false;
        }

        const count1 = (result1.text.match(/\$\{\{ insert \}\}/g) || []).length;
        const count2 = (result2.text.match(/\$\{\{ insert \}\}/g) || []).length;
        const count3 = (result3.text.match(/\$\{\{ insert \}\}/g) || []).length;

        if (count1 !== inputCount || count2 !== inputCount || count3 !== inputCount) {
            console.log(`Expected: ${inputCount} inserts in all outputs`);
            console.log(`Got: ${count1}, ${count2}, ${count3}`);
            console.log('Final output:', result3.text);
            return false;
        }

        return true;
    })
)
    passed++;
else failed++;

console.log('=========================================');
console.log(`📊 Test Summary: ${passed + failed} total`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('=========================================');

process.exit(failed > 0 ? 1 : 0);
