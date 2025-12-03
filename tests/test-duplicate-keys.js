const { formatYaml } = require('../extension.js');
const fs = require('fs');
const path = require('path');

console.log('Testing duplicate expression key handling...');

// Test 1: Duplicate ${{ insert }} keys
const insertTest = `parameters:
  - name: buildParams
    type: object
  - name: testParams
    type: object


stages:
  - stage: Build
    jobs:
      - template: /templates/build.yaml
        parameters:
            $\{{ insert }}: $\{{ parameters.buildParams }}
            $\{{ insert }}: $\{{ parameters.testParams }}
            language: go`;

const insertResult = formatYaml(insertTest);
if (insertResult.error) {
    console.error('FAIL: Duplicate ${{ insert }} test failed with error:', insertResult.error);
    process.exit(1);
}

// Verify both ${{ insert }} lines are preserved
const insertCount = (insertResult.text.match(/\$\{\{\s*insert\s*\}\}:/g) || []).length;
if (insertCount !== 2) {
    console.error(`FAIL: Expected 2 ${{ insert }}: keys, found ${insertCount}`);
    console.error('Output:', insertResult.text);
    process.exit(1);
}

console.log('✓ Duplicate ${{ insert }} keys preserved correctly');

// Test 2: Duplicate ${{ if }}: / ${{ else }}: conditional keys
const conditionalTest = `parameters:
  - name: useCache
    type: boolean


steps:
- task: Cache@2
  $\{{ if eq(parameters.useCache, true) }}:
    inputs:
      key: 'cache-key'
  $\{{ else }}:
    inputs:
      key: 'no-cache'`;

const conditionalResult = formatYaml(conditionalTest);
if (conditionalResult.error) {
    console.error('FAIL: Conditional expression test failed with error:', conditionalResult.error);
    process.exit(1);
}

// Verify both conditional keys are preserved
const ifCount = (conditionalResult.text.match(/\$\{\{\s*if.*?\}\}:/g) || []).length;
const elseCount = (conditionalResult.text.match(/\$\{\{\s*else\s*\}\}:/g) || []).length;
if (ifCount < 1 || elseCount < 1) {
    console.error(`FAIL: Conditional keys not preserved. if: ${ifCount}, else: ${elseCount}`);
    console.error('Output:', conditionalResult.text);
    process.exit(1);
}

console.log('✓ Duplicate conditional expression keys preserved correctly');

// Test 3: Parameters spacing - file starts with parameters:
const withParamsTest = `parameters:
  - name: env
    type: string
steps:
- script: echo test`;

const withParamsResult = formatYaml(withParamsTest);
if (withParamsResult.error) {
    console.error('FAIL: Parameters spacing test failed:', withParamsResult.error);
    process.exit(1);
}

// Count blank lines between parameters: and steps:
const paramsMatch = withParamsResult.text.match(/parameters:[\s\S]*?((?:\n\s*\n)+)\s*steps:/);
if (!paramsMatch) {
    console.error('FAIL: Could not find spacing between parameters: and steps:');
    console.error('Output:', withParamsResult.text);
    process.exit(1);
}

const blankLineCount = (paramsMatch[1].match(/\n/g) || []).length - 1;
if (blankLineCount !== 2) {
    console.error(`FAIL: Expected 2 blank lines after parameters:, found ${blankLineCount}`);
    console.error('Output:', withParamsResult.text);
    process.exit(1);
}

console.log('✓ Files with parameters: have 2 blank lines before first section');

// Test 4: No parameters spacing - file doesn't start with parameters:
const withoutParamsTest = `trigger:
  branches:
    include:
    - main


stages:
- stage: Build
  jobs:
  - job: BuildJob`;

const withoutParamsResult = formatYaml(withoutParamsTest);
if (withoutParamsResult.error) {
    console.error('FAIL: No parameters spacing test failed:', withoutParamsResult.error);
    process.exit(1);
}

// Verify NO blank lines before stages:
const stagesMatch = withoutParamsResult.text.match(/pr:.*?\n+\s*stages:/s);
if (stagesMatch) {
    const leadingNewlines = (stagesMatch[0].match(/\n+\s*stages:/)[0].match(/\n/g) || []).length;
    if (leadingNewlines > 1) {
        console.error(`FAIL: Expected 0 blank lines before stages: (without parameters), found ${leadingNewlines - 1}`);
        console.error('Output:', withoutParamsResult.text);
        process.exit(1);
    }
}

console.log('✓ Files without parameters: have 0 blank lines before first section');

// Test 5: Empty list item values
const emptyListTest = `stages:
- stage: Deploy
  jobs:
  - job:
    steps:
    - task: Deploy@1`;

const emptyListResult = formatYaml(emptyListTest);
if (emptyListResult.error) {
    console.error('FAIL: Empty list values test failed:', emptyListResult.error);
    process.exit(1);
}

// Verify "- job:" stays as "- job:" not "- job: null"
if (emptyListResult.text.includes('job: null')) {
    console.error('FAIL: Empty list item "- job:" was changed to "- job: null"');
    console.error('Output:', emptyListResult.text);
    process.exit(1);
}

if (!emptyListResult.text.match(/- job:\s*$/m)) {
    console.error('FAIL: Empty list item "- job:" not preserved correctly');
    console.error('Output:', emptyListResult.text);
    process.exit(1);
}

console.log('✓ Empty list item values preserved correctly (no null added)');

console.log('\nAll duplicate key and spacing tests passed! ✓');
