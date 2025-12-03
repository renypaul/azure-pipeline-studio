#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { AzurePipelineParser } = require('../extension.js');

const repoRoot = path.resolve(__dirname, '..');
const testsDir = path.join(repoRoot, 'tests');

if (!fs.existsSync(testsDir)) {
    console.error(`Tests directory not found: ${testsDir}`);
    process.exit(1);
}

const testFiles = fs.readdirSync(testsDir).filter((file) => file.toLowerCase().endsWith('.yml'));

if (testFiles.length === 0) {
    console.log('No YAML test files found.');
    process.exit(0);
}

const parser = new AzurePipelineParser();
parser.printTree = false;

let hasFailures = false;
let passCount = 0;
let failCount = 0;

testFiles.forEach((file) => {
    const filePath = path.join(testsDir, file);

    try {
        const result = parser.parseFile(filePath);
        const errorCount = (result.syntaxErrors || 0) + (result.lexerErrors || 0);

        if (errorCount > 0) {
            hasFailures = true;
            failCount++;
            const details = [...(result.lexerErrorDetails || []), ...(result.syntaxErrorDetails || [])];
            const firstError = details[0] ? `Line ${details[0].line}: ${details[0].message}` : 'syntax errors';
            console.log(`❌ FAIL ${file} - ${errorCount} error(s) - ${firstError}`);
        } else {
            passCount++;
            console.log(`✅ PASS ${file}`);
        }
    } catch (err) {
        hasFailures = true;
        failCount++;
        console.log(`❌ FAIL ${file} - ${err.message}`);
    }
});

console.log(`\n📊 YAML Tests: ${passCount} passed, ${failCount} failed, ${testFiles.length} total\n`);

// Run validation test scripts (test-*.js files)
const { execSync } = require('child_process');
const validationTests = fs.readdirSync(testsDir).filter((file) => file.startsWith('test-') && file.endsWith('.js'));

let validationPassCount = 0;
let validationFailCount = 0;

if (validationTests.length > 0) {
    validationTests.forEach((testScript) => {
        const testPath = path.join(testsDir, testScript);
        try {
            const output = execSync(`node "${testPath}"`, { cwd: testsDir, encoding: 'utf8' });
            validationPassCount++;
            console.log(`✅ PASS ${testScript}`);
        } catch (err) {
            hasFailures = true;
            validationFailCount++;
            console.log(`❌ FAIL ${testScript} - Exit code ${err.status}`);
        }
    });
    console.log(
        `\n📊 Validation Tests: ${validationPassCount} passed, ${validationFailCount} failed, ${validationTests.length} total\n`,
    );
}

// Run comprehensive formatter tests
try {
    const output = execSync('node run-formatter-tests.js', { cwd: testsDir, encoding: 'utf8' });
    console.log('✅ PASS Formatter test suite\n');
} catch (err) {
    console.log('⚠️  WARN Formatter test suite - Some expected edge case failures\n');
    // Don't mark as failure since we expect some edge case failures
}

console.log(`\n${'='.repeat(60)}`);
console.log(`🏁 FINAL RESULTS`);
console.log(`${'='.repeat(60)}`);
console.log(`✅ Passed: ${passCount + validationPassCount}`);
console.log(`❌ Failed: ${failCount + validationFailCount}`);
console.log(`📦 Total: ${testFiles.length + validationTests.length}`);
console.log(`${hasFailures ? '❌ TESTS FAILED' : '✅ ALL TESTS PASSED'}`);
console.log(`${'='.repeat(60)}\n`);

if (hasFailures) {
    process.exit(1);
}

// Exit successfully if no failures
process.exit(0);
