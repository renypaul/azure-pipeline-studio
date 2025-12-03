#!/usr/bin/env node

/**
 * Test for external resourceLocations feature
 *
 * This test verifies that repository locations can be provided externally via
 * the resourceLocations option, allowing repositories defined in YAML without
 * location fields to be resolved using external configuration.
 */

const { AzurePipelineParser } = require('../parser.js');
const fs = require('fs');
const path = require('path');

console.log('Testing external resourceLocations feature...\n');

// Create a test YAML with repository references
const testYaml = `
resources:
  repositories:
  - repository: templates
    type: githubenterprise
    name: company/templates
    endpoint: ghe
  - repository: recipes
    type: git
    name: myrepo/recipes

stages:
- stage: Build
  jobs:
  - job: TestJob
    steps:
    - script: echo "Hello World"
`;

// Test options with external resourceLocations
const options = {
    fileName: 'test.yaml',
    resourceLocations: {
        templates: '/root/workspace/templates',
        recipes: '/root/workspace/recipes',
    },
};

let testsPassed = 0;
let testsFailed = 0;

try {
    const parser = new AzurePipelineParser();

    // Test 1: Verify that resolveRepositoryEntry finds and merges locations
    const { document, context } = parser.expandPipeline(testYaml, options);

    console.log('Test 1: Check that resourceLocations are in context');
    if (context.resourceLocations && context.resourceLocations.templates === '/root/workspace/templates') {
        console.log('✓ Test 1 PASSED: resourceLocations in context');
        testsPassed++;
    } else {
        console.log('✗ Test 1 FAILED: resourceLocations not found in context');
        testsFailed++;
    }

    // Test 2: Verify repository entry resolution with external location
    console.log('\nTest 2: Resolve repository entry with external location');
    const templatesRepo = parser.resolveRepositoryEntry('templates', context);
    if (templatesRepo && templatesRepo.location === '/root/workspace/templates') {
        console.log('✓ Test 2 PASSED: Repository entry has external location merged');
        testsPassed++;
    } else {
        console.log('✗ Test 2 FAILED: Repository entry missing external location');
        console.log('  Got:', templatesRepo);
        testsFailed++;
    }

    // Test 3: Verify repository that doesn't exist in YAML can still be resolved
    console.log('\nTest 3: Resolve non-YAML repository from external locations');
    const externalRepo = parser.resolveRepositoryEntry('nonexistent', {
        ...context,
        resourceLocations: { nonexistent: '/some/path' },
    });
    if (externalRepo && externalRepo.location === '/some/path') {
        console.log('✓ Test 3 PASSED: External-only repository resolved');
        testsPassed++;
    } else {
        console.log('✗ Test 3 FAILED: External-only repository not resolved');
        testsFailed++;
    }
} catch (error) {
    console.error('✗ Test FAILED with exception:', error.message);
    console.error(error.stack);
    testsFailed++;
}

console.log('\n==================================================');
if (testsFailed === 0) {
    console.log(`Tests passed: ${testsPassed}/${testsPassed}`);
    console.log('PASS: All tests passed ✓');
} else {
    console.log(`Tests passed: ${testsPassed}/${testsPassed + testsFailed}`);
    console.log(`FAIL: ${testsFailed} test(s) failed ✗`);
    process.exit(1);
}
console.log('==================================================');
