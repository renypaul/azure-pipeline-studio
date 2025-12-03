const { formatYaml } = require('../extension.js');
const assert = require('assert');

console.log('Testing blank line removal in nested structures...\n');

// Test 1: Nested dependsOn with conditionals (similar to codeway-windows-client-v0.yaml)
const test1Input = `stages:
- \${{ if eq(parameters.enableBuild, true) }}:
  - template: /stages/windows/build-v0.yaml
    parameters:
      stageName: Build
      dependsOn:
      - Configure
      - Lint

- \${{ if eq(parameters.enableUnitTests, true) }}:
  - template: /stages/windows/unit-tests-v0.yaml
    parameters:
      stageName: UnitTests
      dependsOn:
      - Configure
      - Build
      - \${{ if eq(parameters.enableSigning, true) }}:
        - Signing
`;

const test1Result = formatYaml(test1Input);
const test1Lines = test1Result.text.split('\n');

// Check that there are no blank lines between nested dependsOn items
let foundNestedDependsOn = false;
let nestedBlankLines = 0;
for (let i = 0; i < test1Lines.length; i++) {
    const line = test1Lines[i];
    const indent = line.length - line.trimStart().length;

    // Look for deeply nested items (indent > 2)
    if (indent > 2 && line.trim().startsWith('- ')) {
        foundNestedDependsOn = true;
        // Check if next line is blank and also deeply nested context
        if (i + 1 < test1Lines.length) {
            const nextLine = test1Lines[i + 1];
            if (nextLine.trim() === '') {
                const lineAfterBlank = test1Lines[i + 2] || '';
                const indentAfterBlank = lineAfterBlank.length - lineAfterBlank.trimStart().length;
                // If the line after blank is also deeply nested, count it as unwanted blank
                if (indentAfterBlank > 2) {
                    nestedBlankLines++;
                }
            }
        }
    }
}

assert(foundNestedDependsOn, 'Test 1: Should have found nested dependsOn items');
assert.strictEqual(
    nestedBlankLines,
    0,
    `Test 1: Should have no blank lines between nested items, found ${nestedBlankLines}`,
);
console.log('✓ Test 1: No blank lines between nested dependsOn items');

// Test 2: Multiple levels of conditional nesting
const test2Input = `stages:
- \${{ if condition1 }}:
  - template: template1.yaml
    parameters:
      dependsOn:
      - Stage1
      - \${{ if condition2 }}:
        - Stage2
      - \${{ if condition3 }}:
        - Stage3
      - Stage4
`;

const test2Result = formatYaml(test2Input);
const test2Lines = test2Result.text.split('\n');

let test2BlankLines = 0;
for (let i = 0; i < test2Lines.length; i++) {
    const line = test2Lines[i];
    const indent = line.length - line.trimStart().length;

    if (indent > 2 && line.trim().startsWith('- ')) {
        if (i + 1 < test2Lines.length && test2Lines[i + 1].trim() === '') {
            const lineAfterBlank = test2Lines[i + 2] || '';
            const indentAfterBlank = lineAfterBlank.length - lineAfterBlank.trimStart().length;
            if (indentAfterBlank > 2) {
                test2BlankLines++;
            }
        }
    }
}

assert.strictEqual(
    test2BlankLines,
    0,
    `Test 2: Should have no blank lines in multi-level nesting, found ${test2BlankLines}`,
);
console.log('✓ Test 2: No blank lines in multi-level conditional nesting');

// Test 3: Complex real-world scenario (similar to codeway-windows-client-v0.yaml lines 174-184)
const test3Input = `stages:
- \${{ if eq(parameters.publishParams.artifactsBuildId, '') }}:
  - template: /stages/windows/publish-v0.yaml
    parameters:
      stageName: Publish
      dependsOn:
      - Configure
      - \${{ if eq(parameters.enableBuild, true) }}:
        - Build
        - \${{ if eq(parameters.enableUnitTests, true) }}:
          - UnitTests
        - \${{ if eq(parameters.enableVeracodeScan, true) }}:
          - ArtifactScan
        - \${{ if eq(parameters.enableSigning, true) }}:
          - Signing
`;

const test3Result = formatYaml(test3Input);
const test3Lines = test3Result.text.split('\n');

let test3BlankLines = 0;
for (let i = 0; i < test3Lines.length; i++) {
    const line = test3Lines[i];
    const indent = line.length - line.trimStart().length;

    if (indent > 2 && line.trim().startsWith('- ')) {
        if (i + 1 < test3Lines.length && test3Lines[i + 1].trim() === '') {
            const lineAfterBlank = test3Lines[i + 2] || '';
            const indentAfterBlank = lineAfterBlank.length - lineAfterBlank.trimStart().length;
            if (indentAfterBlank > 2) {
                test3BlankLines++;
                console.log(`  Found blank line after: "${line.trim()}" (indent ${indent})`);
            }
        }
    }
}

assert.strictEqual(
    test3BlankLines,
    0,
    `Test 3: Should have no blank lines in complex nested structure, found ${test3BlankLines}`,
);
console.log('✓ Test 3: No blank lines in complex real-world scenario');

// Test 4: Should preserve blank lines between direct children (indent ≤ 2)
const test4Input = `stages:
- stage: Stage1
  jobs:
  - job: Job1
- stage: Stage2
  jobs:
  - job: Job2
`;

const test4Result = formatYaml(test4Input);
const test4Lines = test4Result.text.split('\n');

// Count blank lines between stages (should exist)
let blanksBetweenStages = 0;
for (let i = 0; i < test4Lines.length; i++) {
    const line = test4Lines[i];
    const indent = line.length - line.trimStart().length;

    if (indent === 0 && line.trim().startsWith('- stage:')) {
        if (i > 0 && test4Lines[i - 1].trim() === '') {
            blanksBetweenStages++;
        }
    }
}

assert(blanksBetweenStages > 0, 'Test 4: Should preserve blank lines between direct stage children');
console.log('✓ Test 4: Blank lines preserved between direct children (indent ≤ 2)');

console.log('\n✅ All 4 tests passed! No unwanted blank lines in nested structures.');
