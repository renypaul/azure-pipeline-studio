const antlr4 = require('antlr4');
const AzurePipelineLexer = require('./dist/generated/AzurePipelineLexer').default;
const AzurePipelineParser = require('./dist/generated/AzurePipelineParser').default;

function parseAzurePipelineYaml(yamlText) {
    const chars = new antlr4.InputStream(yamlText);
    const lexer = new AzurePipelineLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new AzurePipelineParser(tokens);
    parser.buildParseTrees = true;
    const tree = parser.yamlFile();
    // You can now walk the tree or use a visitor/listener to process it
    // Example: return tree.toStringTree(parser.ruleNames);
    return tree;
}

module.exports = {
    parseAzurePipelineYaml,
};
