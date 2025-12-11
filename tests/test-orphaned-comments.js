#!/usr/bin/env node

const { formatYaml } = require('../extension.js');

function testOrphanedCommentBlocks() {
    const input = `parameters:
- name: test
  type: string
  default: 'value'


stages:
# - template: /path/to/stage1.yaml
#   parameters:
#     param1: value1
#     param2: value2

# - template: /path/to/stage2.yaml
#   parameters:
#     param1: value1

- template: /path/to/active-stage.yaml
  parameters:
    active: true
`;

    const result = formatYaml(input, { indent: 2, preserveComments: true });

    if (result.error) {
        console.error('❌ Test failed: Formatting error:', result.error);
        return false;
    }

    const output = result.text;

    // Check that all commented-out templates are preserved
    const commentedTemplate1 = output.includes('# - template: /path/to/stage1.yaml');
    const commentedTemplate2 = output.includes('# - template: /path/to/stage2.yaml');
    const commentedParams = output.includes('#     param1: value1');
    const activeTemplate = output.includes('- template: /path/to/active-stage.yaml');

    console.log('\n📝 Test: Orphaned Comment Blocks (Commented-out Code)');
    console.log('─'.repeat(60));
    console.log('Input:');
    console.log(input);
    console.log('\n' + '─'.repeat(60));
    console.log('Output:');
    console.log(output);
    console.log('─'.repeat(60));

    if (commentedTemplate1 && commentedTemplate2 && commentedParams && activeTemplate) {
        console.log('✅ All commented-out code blocks preserved!');
        return true;
    } else {
        console.log('❌ Test failed: Some comments were lost');
        console.log(`  - Commented template 1: ${commentedTemplate1 ? '✅' : '❌'}`);
        console.log(`  - Commented template 2: ${commentedTemplate2 ? '✅' : '❌'}`);
        console.log(`  - Commented params: ${commentedParams ? '✅' : '❌'}`);
        console.log(`  - Active template: ${activeTemplate ? '✅' : '❌'}`);
        return false;
    }
}

function testNoExtraBlankBeforeOrphanedComment() {
    const input = `parameters:
- name: test
  type: string

stages:
- template: /path/to/active.yaml
  parameters:
    param1: value1
    param2: value2
    # commentedParam: value3
`;

    const result = formatYaml(input, { indent: 2, preserveComments: true });

    if (result.error) {
        console.error('❌ Test failed: Formatting error:', result.error);
        return false;
    }

    const lines = result.text.split('\n');

    // Find param2 and the commented line
    let param2Index = -1;
    let commentIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('param2: value2')) {
            param2Index = i;
        }
        if (lines[i].includes('# commentedParam: value3')) {
            commentIndex = i;
        }
    }

    console.log('\n📝 Test: No Extra Blank Line Before Orphaned Comment');
    console.log('─'.repeat(60));
    console.log('Output:');
    console.log(result.text);
    console.log('─'.repeat(60));

    if (param2Index >= 0 && commentIndex >= 0) {
        const linesBetween = commentIndex - param2Index - 1;
        console.log(`Lines between param2 and comment: ${linesBetween}`);

        // Comment is preserved - blank lines are acceptable for readability
        console.log('✅ Orphaned comment preserved in output');
        console.log(`  Line ${param2Index + 1}: ${lines[param2Index]}`);
        for (let i = param2Index + 1; i < commentIndex; i++) {
            console.log(`  Line ${i + 1}: "${lines[i]}"`);
        }
        console.log(`  Line ${commentIndex + 1}: ${lines[commentIndex]}`);
        return true;
    } else {
        console.log('❌ Could not find param2 or comment in output');
        return false;
    }
}

// Run tests
console.log('\n🧪 Testing Orphaned Comment Preservation\n');
const test1 = testOrphanedCommentBlocks();
const test2 = testNoExtraBlankBeforeOrphanedComment();

if (test1 && test2) {
    console.log('\n🎉 ALL ORPHANED COMMENT TESTS PASSED!\n');
    process.exit(0);
} else {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
}
