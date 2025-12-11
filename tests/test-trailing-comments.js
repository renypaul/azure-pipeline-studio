#!/usr/bin/env node

const { formatYaml } = require('../extension.js');

console.log('💬 Testing Trailing Comments Removal');
console.log('====================================\n');

let testCount = 0;
let passCount = 0;

function runTest(testName, testFn) {
    testCount++;
    console.log(`📋 Test ${testCount}: ${testName}`);
    try {
        const result = testFn();
        if (result) {
            passCount++;
            console.log('✅ PASS\n');
        } else {
            console.log('❌ FAIL\n');
        }
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
    }
}

// Test 1: Keep exactly one blank before trailing comments at EOF
runTest('Keep Exactly One Blank Before Trailing Comments at EOF', () => {
    const input = `steps:
- bash: echo "first"
  displayName: First Step

- bash: echo "second"
  displayName: Second Step


# This is a trailing comment
# Another trailing comment`;

    const result = formatYaml(input);

    // Should have EXACTLY ONE blank line between "Second Step" and the first comment
    const hasSingleBlank = /Second Step\n\n# This is a trailing/.test(result.text);
    const hasDoubleBlank = /Second Step\n\n\n# This is a trailing/.test(result.text);

    console.log(`   Has single blank before trailing comment: ${hasSingleBlank} (should be true)`);
    console.log(`   Has double blank before trailing comment: ${hasDoubleBlank} (should be false)`);
    console.log('   Output (last 5 lines):');
    result.text
        .split('\n')
        .slice(-5)
        .forEach((line, i) => {
            console.log(`   ${i + 1}: "${line}"`);
        });

    return hasSingleBlank && !hasDoubleBlank;
});

// Test 2: Keep blank before non-trailing comments
runTest('Keep Blank Before Non-Trailing Comments (Content After)', () => {
    const input = `steps:
- bash: echo "first"
  displayName: First Step

# Comment in the middle
- bash: echo "second"
  displayName: Second Step`;

    const result = formatYaml(input);

    // Should KEEP blank line before comment since there's content after
    const hasBlankBeforeComment = /First Step\n\n# Comment in the middle/.test(result.text);

    console.log(`   Has blank before mid-file comment: ${hasBlankBeforeComment} (should be true)`);

    return hasBlankBeforeComment;
});

// Test 3: Idempotency with trailing comments
runTest('Idempotency - Trailing Comments', () => {
    const input = `steps:
- script: |
    echo "First"
  displayName: 'Script 1'

- script: |
    echo "Second"
  displayName: 'Script 2'


# - stage: CommentedOut
# - job: AlsoCommented`;

    const result1 = formatYaml(input);
    const result2 = formatYaml(result1.text);
    const result3 = formatYaml(result2.text);

    const isIdempotent = result1.text === result2.text && result2.text === result3.text;

    console.log(`   First pass == Second pass: ${result1.text === result2.text}`);
    console.log(`   Second pass == Third pass: ${result2.text === result3.text}`);
    console.log(`   Idempotent: ${isIdempotent}`);

    if (!isIdempotent) {
        console.log('\n   First pass output (last 8 lines):');
        result1.text
            .split('\n')
            .slice(-8)
            .forEach((line, i) => console.log(`   ${i + 1}: "${line}"`));
        console.log('\n   Second pass output (last 8 lines):');
        result2.text
            .split('\n')
            .slice(-8)
            .forEach((line, i) => console.log(`   ${i + 1}: "${line}"`));
    }

    return isIdempotent;
});

// Test 4: Multiple blank lines before trailing comments reduced to one
runTest('Multiple Blanks Before Trailing Comments Reduced to One', () => {
    const input = `stages:
- stage: Build
  jobs:
  - job: BuildJob
    steps:
    - bash: echo "build"
      displayName: Build



# Commented stage
# Another comment`;

    const result = formatYaml(input);

    // Count blank lines before first comment
    const lines = result.text.split('\n');
    const firstCommentIndex = lines.findIndex((l) => l.trim().startsWith('# Commented'));
    let blankCount = 0;
    for (let i = firstCommentIndex - 1; i >= 0; i--) {
        if (lines[i].trim() === '') {
            blankCount++;
        } else {
            break;
        }
    }

    console.log(`   Blank lines before trailing comment: ${blankCount} (should be 1)`);

    return blankCount === 1;
});

// Test 5: Trailing comments in steps section - keep one blank
runTest('Trailing Comments in Steps Section - Keep One Blank', () => {
    const input = `steps:
- task: Build@1
  displayName: Build

- task: Test@1
  displayName: Test


# - task: Deploy@1
#   displayName: Deploy (disabled)`;

    const result = formatYaml(input);

    // Should keep exactly one blank before trailing comment
    const hasSingleBlank = /displayName: Test\n\n# - task: Deploy/.test(result.text);
    const hasDoubleBlank = /displayName: Test\n\n\n# - task: Deploy/.test(result.text);

    console.log(`   Has single blank before trailing comment: ${hasSingleBlank} (should be true)`);
    console.log(`   Has double blank before trailing comment: ${hasDoubleBlank} (should be false)`);

    return hasSingleBlank && !hasDoubleBlank;
});

// Test 6: Trailing comments in jobs section - keep one blank
runTest('Trailing Comments in Jobs Section - Keep One Blank', () => {
    const input = `jobs:
- job: Job1
  displayName: First Job
  steps:
  - bash: echo "test"


# - job: Job2
#   displayName: Second Job (disabled)`;

    const result = formatYaml(input);

    const hasSingleBlank = /echo "test"\n\n# - job: Job2/.test(result.text);
    const hasDoubleBlank = /echo "test"\n\n\n# - job: Job2/.test(result.text);

    console.log(`   Has single blank before trailing comment: ${hasSingleBlank} (should be true)`);
    console.log(`   Has double blank before trailing comment: ${hasDoubleBlank} (should be false)`);

    return hasSingleBlank && !hasDoubleBlank;
});

// Test 7: Trailing comments in stages section - keep one blank
runTest('Trailing Comments in Stages Section - Keep One Blank', () => {
    const input = `stages:
- stage: Stage1
  displayName: First Stage
  jobs:
  - job: Job1
    steps:
    - bash: echo "stage1"


# - stage: Stage2
#   displayName: Second Stage (disabled)`;

    const result = formatYaml(input);

    const hasSingleBlank = /echo "stage1"\n\n# - stage: Stage2/.test(result.text);
    const hasDoubleBlank = /echo "stage1"\n\n\n# - stage: Stage2/.test(result.text);

    console.log(`   Has single blank before trailing comment: ${hasSingleBlank} (should be true)`);
    console.log(`   Has double blank before trailing comment: ${hasDoubleBlank} (should be false)`);

    return hasSingleBlank && !hasDoubleBlank;
});

// Test 8: Mixed content and trailing comments - keep one blank
runTest('Mixed Content - Keep One Blank Before Trailing Comments', () => {
    const input = `trigger:
  branches:
    include:
    - main

variables:
  buildConfig: Release

steps:
- bash: echo "build"
  displayName: Build


# Commented out steps below
# - bash: echo "test"
#   displayName: Test`;

    const result = formatYaml(input);

    // Should keep exactly one blank before trailing comments
    const hasSingleBlank = /displayName: Build\n\n# Commented out/.test(result.text);
    const hasDoubleBlank = /displayName: Build\n\n\n# Commented out/.test(result.text);

    console.log(`   Has single blank before trailing comment: ${hasSingleBlank} (should be true)`);
    console.log(`   Has double blank before trailing comment: ${hasDoubleBlank} (should be false)`);

    return hasSingleBlank && !hasDoubleBlank;
});

// Test 9: Preserve step spacing, keep one blank before trailing comments
runTest('Preserve Step Spacing, Keep One Blank Before Trailing Comments', () => {
    const input = `steps:
- bash: echo "first"
  displayName: First
- bash: echo "second"
  displayName: Second


# Trailing comment`;

    const result = formatYaml(input);

    // Should have blank between steps (step spacing)
    const hasStepSpacing = /First\n\n- bash: echo "second"/.test(result.text);

    // Should have exactly ONE blank before trailing comment
    const hasSingleBlank = /Second\n\n# Trailing/.test(result.text);
    const hasDoubleBlank = /Second\n\n\n# Trailing/.test(result.text);

    console.log(`   Has step spacing: ${hasStepSpacing} (should be true)`);
    console.log(`   Has single blank before trailing comment: ${hasSingleBlank} (should be true)`);
    console.log(`   Has double blank before trailing comment: ${hasDoubleBlank} (should be false)`);

    return hasStepSpacing && hasSingleBlank && !hasDoubleBlank;
});

// Test 10: Real-world pattern - git-tag.yaml structure
runTest('Real-World Pattern - git-tag.yaml Structure', () => {
    const input = `jobs:
- job: GitTag
  displayName: Tag Git Repository
  steps:
  - script: |
      version=$(cat version.txt)
      echo "##vso[task.setvariable variable=codeVersion]$version"
    workingDirectory: $(Build.SourcesDirectory)
    name: getCodeVersion
    displayName: 'Get Code Version'

  - script: |
      git tag v$(getCodeVersion.codeVersion)
      git push origin v$(getCodeVersion.codeVersion)
    workingDirectory: $(Build.SourcesDirectory)
    name: tagGit
    displayName: Tag Git with v$(getCodeVersion.codeVersion)


# - stage: GitTagging
#   displayName: Git Tagging
#   dependsOn: ParsingVersionVariables`;

    const result1 = formatYaml(input);
    const result2 = formatYaml(result1.text);
    const result3 = formatYaml(result2.text);

    const isIdempotent = result1.text === result2.text && result2.text === result3.text;

    console.log(`   Idempotent: ${isIdempotent}`);

    if (!isIdempotent) {
        console.log('\n   First vs Second diff:');
        const lines1 = result1.text.split('\n');
        const lines2 = result2.text.split('\n');
        const maxLen = Math.max(lines1.length, lines2.length);
        for (let i = 0; i < maxLen; i++) {
            if (lines1[i] !== lines2[i]) {
                console.log(`   Line ${i + 1}: "${lines1[i] || 'MISSING'}" vs "${lines2[i] || 'MISSING'}"`);
            }
        }
    }

    return isIdempotent;
});

// Test 11: Empty file with only comments
runTest('File With Only Trailing Comments', () => {
    const input = `# This is a comment-only file
# Another comment
# Third comment`;

    const result1 = formatYaml(input);
    const result2 = formatYaml(result1.text);

    const isIdempotent = result1.text === result2.text;

    console.log(`   Idempotent: ${isIdempotent}`);
    console.log(`   No errors: ${!result1.error}`);

    return isIdempotent && !result1.error;
});

// Test 12: Comment block followed by content (not trailing)
runTest('Comment Block Followed By Content (Not Trailing)', () => {
    const input = `steps:
- bash: echo "first"
  displayName: First


# Comment block
# More comments
- bash: echo "second"
  displayName: Second`;

    const result = formatYaml(input);

    // Should KEEP blank before comment block since there's content after
    const hasBlankBeforeComments = /First\n\n# Comment block/.test(result.text);

    console.log(`   Keeps blank before non-trailing comments: ${hasBlankBeforeComments}`);

    return hasBlankBeforeComments;
});

// Final Results
console.log('🏁 TRAILING COMMENTS TEST RESULTS');
console.log('==================================');
console.log(`Total Tests: ${testCount}`);
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${testCount - passCount}`);
console.log(`📊 Success Rate: ${Math.round((passCount / testCount) * 100)}%\n`);

if (passCount === testCount) {
    console.log('🎉 ALL TRAILING COMMENTS TESTS PASSED!');
    process.exit(0);
} else {
    console.log('❌ Some trailing comments tests failed.');
    process.exit(1);
}
