/**
 * Debug test to see what happens to duplicate ${{ insert }} expressions
 */

const { formatYaml } = require('../extension.js');

console.log('🔍 Debugging Duplicate ${{ insert }} Handling\n');

// Test 1: Simple duplicates
console.log('Test 1: Simple duplicate ${{ insert }}');
console.log('==========================================');
const input1 = `stages:
\${{ insert }}: value1
\${{ insert }}: value2
\${{ insert }}: value3`;

console.log('INPUT:');
console.log(input1);
console.log('\nOUTPUT:');
const result1 = formatYaml(input1);
console.log(result1.text);
console.log('\nError:', result1.error || 'none');
console.log('\n---\n');

// Test 2: Duplicates with arrays
console.log('Test 2: Duplicate ${{ insert }} with arrays');
console.log('==========================================');
const input2 = `stages:
\${{ insert }}:
  - stage: Stage1
\${{ insert }}:
  - stage: Stage2`;

console.log('INPUT:');
console.log(input2);
console.log('\nOUTPUT:');
const result2 = formatYaml(input2);
console.log(result2.text);
console.log('\nError:', result2.error || 'none');
console.log('\n---\n');

// Test 3: Check if YAML library handles duplicates
console.log('Test 3: Direct YAML library test');
console.log('==========================================');
const YAML = require('yaml');
const testYaml = `stages:
\${{ insert }}: value1
\${{ insert }}: value2
\${{ insert }}: value3`;

console.log('INPUT:');
console.log(testYaml);

console.log('\nParsing with uniqueKeys: false');
try {
    const doc = YAML.parseDocument(testYaml, { strict: false, uniqueKeys: false });
    console.log('Parsed successfully!');
    console.log('Errors:', doc.errors);
    console.log('Warnings:', doc.warnings);

    const obj = doc.toJS();
    console.log('\nParsed object:');
    console.log(JSON.stringify(obj, null, 2));

    console.log('\nStringified back:');
    console.log(doc.toString());
} catch (error) {
    console.log('Parse error:', error.message);
}

console.log('\n---\n');

// Test 4: Count ${{ insert }} before and after formatting
console.log('Test 4: Count ${{ insert }} before and after');
console.log('==========================================');
const input4 = `stages:
\${{ insert }}: stage1
\${{ insert }}: stage2
\${{ insert }}: stage3
\${{ insert }}: stage4`;

const beforeCount = (input4.match(/\$\{\{ insert \}\}/g) || []).length;
const result4 = formatYaml(input4);
const afterCount = (result4.text.match(/\$\{\{ insert \}\}/g) || []).length;

console.log('INPUT has', beforeCount, '${{ insert }} expressions');
console.log('OUTPUT has', afterCount, '${{ insert }} expressions');
console.log('\nINPUT:');
console.log(input4);
console.log('\nOUTPUT:');
console.log(result4.text);
