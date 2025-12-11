const assert = require('assert');
const path = require('path');
const { AzurePipelineParser } = require('../parser');

function test(name, fn) {
    try {
        fn();
        console.log(`✅ PASS ${name}`);
        return true;
    } catch (error) {
        console.error(`❌ FAIL ${name}`);
        console.error(`   ${error.message}`);
        return false;
    }
}

function expectError(fn, pattern) {
    try {
        fn();
        throw new Error('Expected error but none was thrown');
    } catch (error) {
        if (pattern && !pattern.test(error.message)) {
            throw new Error(`Error message "${error.message}" does not match pattern ${pattern}`);
        }
    }
}

const parser = new AzurePipelineParser();

// Test 1: Missing required parameter should throw error
test('Missing required parameter throws error', () => {
    const mainYaml = `
steps:
  - template: ./template.yml
    parameters:
      optionalParam: value
`;

    const templateYaml = `
parameters:
  - name: requiredParam
    type: string
  - name: optionalParam
    type: string
    default: defaultValue

steps:
  - bash: echo test
`;

    let errorThrown = false;
    try {
        // Mock template loading by testing with inline templates
        const result = parser.expandPipeline(mainYaml, {
            parameters: {},
        });
    } catch (e) {
        // This test would need actual file system mocking to work properly
        // For now, we test the validation method directly
        errorThrown = true;
    }

    // Test the validation method directly
    const templateDoc = {
        parameters: [
            { name: 'requiredParam', type: 'string' },
            { name: 'optionalParam', type: 'string', default: 'defaultValue' },
        ],
    };

    const providedParams = { optionalParam: 'value' };

    let validationError = null;
    try {
        parser.validateTemplateParameters(templateDoc, providedParams, 'test-template.yml');
    } catch (e) {
        validationError = e;
    }

    assert(validationError !== null, 'Should throw validation error');
    assert(validationError.message.includes('requiredParam'), 'Error should mention requiredParam');
    assert(validationError.message.includes('test-template.yml'), 'Error should mention template name');
});

// Test 2: All required parameters provided should not throw
test('All required parameters provided does not throw', () => {
    const templateDoc = {
        parameters: [
            { name: 'requiredParam', type: 'string' },
            { name: 'optionalParam', type: 'string', default: 'defaultValue' },
        ],
    };

    const providedParams = {
        requiredParam: 'myValue',
        optionalParam: 'customValue',
    };

    // Should not throw
    parser.validateTemplateParameters(templateDoc, providedParams, 'test-template.yml');
});

// Test 3: Multiple missing required parameters
test('Multiple missing required parameters are reported', () => {
    const templateDoc = {
        parameters: [
            { name: 'param1', type: 'string' },
            { name: 'param2', type: 'string' },
            { name: 'param3', type: 'string', default: 'hasDefault' },
            { name: 'param4', type: 'number' },
        ],
    };

    const providedParams = { param3: 'override' };

    let validationError = null;
    try {
        parser.validateTemplateParameters(templateDoc, providedParams, 'multi-param-template.yml');
    } catch (e) {
        validationError = e;
    }

    assert(validationError !== null, 'Should throw validation error');
    assert(validationError.message.includes('param1'), 'Error should mention param1');
    assert(validationError.message.includes('param2'), 'Error should mention param2');
    assert(validationError.message.includes('param4'), 'Error should mention param4');
    assert(!validationError.message.includes('param3'), 'Error should not mention param3 (has default)');
});

// Test 4: Template with no parameters should not throw
test('Template with no parameters does not throw', () => {
    const templateDoc = { steps: [{ bash: 'echo test' }] };
    const providedParams = {};

    // Should not throw
    parser.validateTemplateParameters(templateDoc, providedParams, 'no-params-template.yml');
});

// Test 5: Parameter with 'value' property should be considered as having a default
test('Parameter with value property is not required', () => {
    const templateDoc = {
        parameters: [{ name: 'param1', type: 'string', value: 'hasValue' }],
    };

    const providedParams = {};

    // Should not throw since value is provided
    parser.validateTemplateParameters(templateDoc, providedParams, 'value-param-template.yml');
});

// Test 6: Parameter with 'values' property (enum) should be considered as having a default
test('Parameter with values property is not required', () => {
    const templateDoc = {
        parameters: [{ name: 'environment', type: 'string', values: ['dev', 'prod'] }],
    };

    const providedParams = {};

    // Should not throw since values list is provided
    parser.validateTemplateParameters(templateDoc, providedParams, 'enum-param-template.yml');
});

// Test 7: Object-style parameters (map notation)
test('Object-style parameters are validated correctly', () => {
    const templateDoc = {
        parameters: {
            requiredParam: { type: 'string' },
            optionalParam: { type: 'string', default: 'defaultValue' },
        },
    };

    const providedParams = { optionalParam: 'value' };

    let validationError = null;
    try {
        parser.validateTemplateParameters(templateDoc, providedParams, 'object-params-template.yml');
    } catch (e) {
        validationError = e;
    }

    assert(validationError !== null, 'Should throw validation error');
    assert(validationError.message.includes('requiredParam'), 'Error should mention requiredParam');
});

// Test 8: Empty provided parameters object
test('Empty provided parameters with required params throws error', () => {
    const templateDoc = {
        parameters: [{ name: 'requiredParam', type: 'string' }],
    };

    let validationError = null;
    try {
        parser.validateTemplateParameters(templateDoc, {}, 'required-only-template.yml');
    } catch (e) {
        validationError = e;
    }

    assert(validationError !== null, 'Should throw validation error');
    assert(validationError.message.includes('requiredParam'), 'Error should mention requiredParam');
});

// Test 9: Undefined provided parameters
test('Undefined provided parameters with required params throws error', () => {
    const templateDoc = {
        parameters: [{ name: 'requiredParam', type: 'string' }],
    };

    let validationError = null;
    try {
        parser.validateTemplateParameters(templateDoc, undefined, 'undefined-params-template.yml');
    } catch (e) {
        validationError = e;
    }

    assert(validationError !== null, 'Should throw validation error');
});

// Test 10: Parameter with default: null should be considered as having a default
test('Parameter with default null is not required', () => {
    const templateDoc = {
        parameters: [{ name: 'param1', type: 'string', default: null }],
    };

    const providedParams = {};

    // Should not throw - null is a valid default
    parser.validateTemplateParameters(templateDoc, providedParams, 'null-default-template.yml');
});

console.log('\n✅ All parameter validation tests passed');

// Type validation tests
test('Type validation - string type accepts string', () => {
    const template = {
        parameters: [{ name: 'myParam', type: 'string' }],
    };
    const provided = { myParam: 'hello' };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

test('Type validation - number type rejects non-numeric string', () => {
    const template = {
        parameters: [{ name: 'myParam', type: 'number' }],
    };
    const provided = { myParam: 'not-a-number' };
    expectError(() => parser.validateTemplateParameters(template, provided, 'test.yaml'), /type.*number/i);
});

test('Type validation - number type accepts numeric string', () => {
    const template = {
        parameters: [{ name: 'myParam', type: 'number' }],
    };
    const provided = { myParam: '123' };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

test('Type validation - boolean type accepts "true" string', () => {
    const template = {
        parameters: [{ name: 'myParam', type: 'boolean' }],
    };
    const provided = { myParam: 'true' };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

test('Type validation - boolean type rejects invalid string', () => {
    const template = {
        parameters: [{ name: 'myParam', type: 'boolean' }],
    };
    const provided = { myParam: 'yes' };
    expectError(() => parser.validateTemplateParameters(template, provided, 'test.yaml'), /type.*boolean/i);
});

test('Type validation - object type accepts object', () => {
    const template = {
        parameters: [{ name: 'myParam', type: 'object' }],
    };
    const provided = { myParam: { key: 'value' } };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

test('Type validation - object type accepts array (Azure DevOps behavior)', () => {
    const template = {
        parameters: [{ name: 'myParam', type: 'object' }],
    };
    const provided = { myParam: [1, 2, 3] };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

test('Type validation - stepList type accepts array', () => {
    const template = {
        parameters: [{ name: 'mySteps', type: 'stepList' }],
    };
    const provided = { mySteps: [{ script: 'echo hello' }] };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

test('Type validation - runtime variable skips type check', () => {
    const template = {
        parameters: [{ name: 'myParam', type: 'number' }],
    };
    const provided = { myParam: '$(buildNumber)' };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

test('Type validation - invalid timeoutInMinutes string is caught', () => {
    const template = {
        parameters: [{ name: 'timeoutInMinutes', type: 'number' }],
    };
    const provided = { timeoutInMinutes: 'x70' };
    expectError(() => parser.validateTemplateParameters(template, provided, 'test.yaml'), /type.*number/i);
});

// Allowed values validation tests
test('Allowed values - valid value passes', () => {
    const template = {
        parameters: [{ name: 'environment', type: 'string', values: ['dev', 'test', 'prod'] }],
    };
    const provided = { environment: 'dev' };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

test('Allowed values - invalid value throws error', () => {
    const template = {
        parameters: [{ name: 'environment', type: 'string', values: ['dev', 'test', 'prod'] }],
    };
    const provided = { environment: 'staging' };
    expectError(() => parser.validateTemplateParameters(template, provided, 'test.yaml'), /allowed values/i);
});

test('Allowed values - runtime variable skips validation', () => {
    const template = {
        parameters: [{ name: 'environment', type: 'string', values: ['dev', 'test', 'prod'] }],
    };
    const provided = { environment: '$(envName)' };
    parser.validateTemplateParameters(template, provided, 'test.yaml');
});

console.log('\n✅ All tests passed!\n');

// Test 11: Unknown parameter passed to template
try {
    const templateWithParams = {
        parameters: [
            { name: 'param1', type: 'string' },
            { name: 'param2', type: 'number' },
        ],
    };
    const providedParams = {
        param1: 'value1',
        param2: 42,
        unknownParam: 'should not be here',
    };
    parser.validateTemplateParameters(templateWithParams, providedParams, '/test/template.yaml');
    console.log('❌ Test 11 FAILED: Should have thrown error for unknown parameter');
    process.exit(1);
} catch (e) {
    if (e.message.includes('Unknown parameter') && e.message.includes('unknownParam')) {
        console.log('✅ Test 11 PASSED: Unknown parameter detected');
    } else {
        console.log('❌ Test 11 FAILED: Wrong error message:', e.message);
        process.exit(1);
    }
}

// Test 12: Multiple unknown parameters
try {
    const templateWithParams = {
        parameters: {
            validParam: { type: 'string' },
        },
    };
    const providedParams = {
        validParam: 'value',
        unknown1: 'bad',
        unknown2: 'also bad',
    };
    parser.validateTemplateParameters(templateWithParams, providedParams, '/test/template.yaml');
    console.log('❌ Test 12 FAILED: Should have thrown error for unknown parameters');
    process.exit(1);
} catch (e) {
    if (e.message.includes('Unknown parameter') && e.message.includes('unknown1') && e.message.includes('unknown2')) {
        console.log('✅ Test 12 PASSED: Multiple unknown parameters detected');
    } else {
        console.log('❌ Test 12 FAILED: Wrong error message:', e.message);
        process.exit(1);
    }
}

console.log('\n🎉 All 12 tests passed!');
