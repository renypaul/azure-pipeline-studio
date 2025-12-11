const { formatYaml } = require('../formatter.js');

console.log('Testing Multi-Line Block Blank Line Handling\n');

// Test 1: Blank lines inside multi-line blocks should remain empty (no indentation)
const input1 = `steps:
- bash: |
    echo "first"
    
    echo "second"
  displayName: Test Script`;

console.log('Test 1: Blank lines inside multi-line blocks');
console.log('Input:');
console.log(input1);

const result1 = formatYaml(input1);
const result2 = formatYaml(result1.text);

console.log('\nFormatted (pass 1):');
console.log(result1.text);
console.log('\nFormatted (pass 2):');
console.log(result2.text);
console.log('\nIdempotent:', result1.text === result2.text ? '✅' : '❌');

// Check that blank line inside block has no spaces
const lines1 = result1.text.split('\n');
const blankLineIndex = lines1.findIndex((line, idx) => idx > 1 && line === '');
console.log('Blank line is truly empty (no spaces):', blankLineIndex >= 0 ? '✅' : '❌');

// Test 2: Nested content that looks like YAML is preserved as-is
const input2 = `steps:
- bash: |
    
    - bash: |
        echo "check version"
  displayName: Nested Content`;

console.log('\n\nTest 2: Nested YAML-like content in multi-line blocks');
console.log('Input:');
console.log(input2);

const result2_1 = formatYaml(input2);
const result2_2 = formatYaml(result2_1.text);
const result2_3 = formatYaml(result2_2.text);

console.log('\nFormatted (pass 1):');
console.log(result2_1.text);
console.log('\nFormatted (pass 2):');
console.log(result2_2.text);
console.log('\nIdempotent:', result2_1.text === result2_2.text && result2_2.text === result2_3.text ? '✅' : '❌');

// Test 3: Multiple blank lines in multi-line block
const input3 = `steps:
- script: |
    echo "start"
    
    
    echo "end"
  displayName: Multiple Blanks`;

console.log('\n\nTest 3: Multiple blank lines inside multi-line blocks');
const result3_1 = formatYaml(input3);
const result3_2 = formatYaml(result3_1.text);

console.log('Idempotent:', result3_1.text === result3_2.text ? '✅' : '❌');

console.log('\n✅ All multi-line block blank line tests completed');
