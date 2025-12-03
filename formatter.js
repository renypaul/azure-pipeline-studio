const YAML = require('yaml');

/**
 * Escape special regex characters in a string
 * @param {string} string - The string to escape
 * @returns {string} The escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace Azure Pipeline template expressions with placeholders
 * @param {string} content - The YAML content
 * @returns {{ content: string, placeholderMap: Map }} The content with placeholders and the mapping
 */
function replaceTemplateExpressionsWithPlaceholders(content) {
    if (!content) {
        return { content, placeholderMap: new Map() };
    }

    // Match Azure Pipelines template expressions like ${{ parameters.x }}, $[variables.y]
    // Note: We only replace ${{}} and $[] because $(variable) is handled fine by YAML parser
    const templateExpressionPattern = /(\$\{\{[^}]+\}\}|\$\[[^\]]+\])/g;
    const placeholderMap = new Map();
    let counter = 0;

    const result = content.replace(templateExpressionPattern, (match) => {
        // Create a unique placeholder that replaces the expression entirely
        const placeholder = '__EXPR_PLACEHOLDER_' + counter + '__';
        placeholderMap.set(placeholder, match);
        counter++;
        return placeholder;
    });

    return { content: result, placeholderMap };
}

/**
 * Restore template expressions from placeholders
 * @param {string} content - The content with placeholders
 * @param {Map} placeholderMap - The mapping of placeholders to original expressions
 * @returns {string} The content with restored expressions
 */
function restoreTemplateExpressions(content, placeholderMap) {
    if (!content || !placeholderMap || placeholderMap.size === 0) {
        return content;
    }

    let result = content;
    for (const [placeholder, originalExpression] of placeholderMap) {
        // Replace all occurrences of the placeholder with the original expression
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escapedPlaceholder, 'g'), originalExpression);
    }

    return result;
}

/**
 * Protect empty YAML values from being formatted incorrectly
 * @param {string} content - The YAML content
 * @returns {{ content: string, commentMap: Map }} The content with protected values and comment mapping
 */
function protectEmptyValues(content) {
    if (!content) {
        return content;
    }

    const lines = content.split(/\r?\n/);
    const result = [];
    const commentMap = new Map();
    let commentCounter = 0;
    const emptyValuePattern = /^(\s*)([^:]+):\s*$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments, blank lines, and list items
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
            result.push(line);
            continue;
        }

        // Check if this is a key with empty value using regex
        const keyMatch = line.match(emptyValuePattern);
        if (!keyMatch) {
            result.push(line);
            continue;
        }

        const indent = keyMatch[1];
        const key = keyMatch[2];

        // Look ahead to find the first non-blank, non-comment line to determine if this key has child content
        let nextIndex = i + 1;
        let hasChildContent = false;

        // Skip blanks and comments to find first real content
        while (nextIndex < lines.length) {
            const nextLine = lines[nextIndex];
            const nextTrimmed = nextLine.trim();
            const nextIndent = nextLine.length - nextLine.trimStart().length;

            // Skip blank lines
            if (nextTrimmed === '') {
                nextIndex++;
                continue;
            }

            // Skip comments - we'll process them based on the content that follows
            if (nextTrimmed.startsWith('#')) {
                nextIndex++;
                continue;
            }

            // Found first real content - determine if it's a child
            // If it's a list item at same or greater indentation, it's child content
            if (nextTrimmed.startsWith('-') && nextIndent >= indent.length) {
                hasChildContent = true;
            } else if (nextIndent > indent.length) {
                // If it's content indented more than the key, it's child content
                hasChildContent = true;
            }
            // Otherwise it's a sibling or less-indented content (not a child)
            break;
        }

        // Only protect if there's NO child content (the key truly has an empty value)
        if (!hasChildContent) {
            // Collect all comments and blank lines at key's indent level or greater until we hit real content
            const allValueComments = [];
            let commentIndex = i + 1;

            while (commentIndex < lines.length) {
                const commentLine = lines[commentIndex];
                const commentTrimmed = commentLine.trim();

                // Blank lines are part of the empty value block
                if (commentTrimmed === '') {
                    allValueComments.push(commentLine);
                    commentIndex++;
                    continue;
                }

                // Stop at first non-comment content
                if (!commentTrimmed.startsWith('#')) {
                    break;
                }

                // Collect comments at key's indent level or greater
                const commentIndent = commentLine.length - commentLine.trimStart().length;
                if (commentIndent >= indent.length) {
                    allValueComments.push(commentLine);
                    commentIndex++;
                } else {
                    // Stop at less-indented comments (they belong to outer scope)
                    break;
                }
            }

            if (allValueComments.length > 0) {
                // Encode comments into placeholder
                const commentId = `__COMMENT_${commentCounter}__`;
                commentMap.set(commentId, allValueComments);
                commentCounter++;
                result.push(`${indent}${key}: __EMPTY_VALUE_PLACEHOLDER__${commentId}`);
                // Skip the comment lines we collected
                i = commentIndex - 1;
            } else {
                result.push(`${indent}${key}: __EMPTY_VALUE_PLACEHOLDER__`);
            }
            continue;
        }

        result.push(line);
    }

    return { content: result.join('\n'), commentMap };
}

/**
 * Restore empty values that were protected during formatting
 * @param {string} content - The formatted content with placeholders
 * @param {Map} commentMap - The mapping of comment placeholders
 * @returns {string} The content with restored empty values
 */
function restoreEmptyValues(content, commentMap) {
    if (!content) {
        return content;
    }

    if (!commentMap || commentMap.size === 0) {
        // No comments to restore, just remove placeholders
        return content.replace(/:\s*__EMPTY_VALUE_PLACEHOLDER__\s*$/gm, ':');
    }

    const lines = content.split(/\r?\n/);
    const result = [];

    for (const line of lines) {
        // Check if line has a placeholder with comment ID
        const match = line.match(/^(\s*)([^:]+):\s*__EMPTY_VALUE_PLACEHOLDER__(__COMMENT_\d+__)\s*$/);
        if (match) {
            const indent = match[1];
            const key = match[2];
            const commentId = match[3];
            const comments = commentMap.get(commentId);

            if (comments && comments.length > 0) {
                // Restore empty value with comments on separate lines
                result.push(`${indent}${key}:`);
                comments.forEach((comment) => result.push(comment));
            } else {
                // No comments found, just restore empty value
                result.push(`${indent}${key}:`);
            }
        } else if (line.match(/:\s*__EMPTY_VALUE_PLACEHOLDER__\s*$/)) {
            // Placeholder without comment ID
            result.push(line.replace(/:\s*__EMPTY_VALUE_PLACEHOLDER__\s*$/, ':'));
        } else {
            result.push(line);
        }
    }

    return result.join('\n');
}

/**
 * Parse file-level formatting directives from YAML comments
 * Supports:
 *   # ado-yaml-format=false (disables formatting)
 *   # ado-yaml-format newline=\r\n,lineWidth=120,indent=4 (custom options)
 *
 * @param {string} content - The YAML content
 * @returns {{ disabled: boolean, options: object|null }}
 */
function parseFormatDirectives(content) {
    const lines = content.split(/\r?\n/);
    const result = { disabled: false, options: null };

    // Only check first 5 lines for directives
    const headerLines = lines.slice(0, 5);

    for (const line of headerLines) {
        const trimmed = line.trim();

        // Check for disable directive
        if (trimmed === '# ado-yaml-format=false' || trimmed === '# ado-yaml-format: false') {
            result.disabled = true;
            return result;
        }

        // Check for options directive
        const optionsMatch = trimmed.match(/^#\s*ado-yaml-format[:\s]+(.+)$/);
        if (optionsMatch) {
            const optionsStr = optionsMatch[1].trim();
            result.options = parseDirectiveOptions(optionsStr);
        }

        // Stop at first non-comment, non-empty line
        if (trimmed.length > 0 && !trimmed.startsWith('#')) {
            break;
        }
    }

    return result;
}

/**
 * Parse directive options from string like "newline=\r\n,lineWidth=120,indent=4"
 * @param {string} optionsStr - Options string
 * @returns {object} Parsed options
 */
function parseDirectiveOptions(optionsStr) {
    const options = {};
    const pairs = optionsStr.split(',');

    for (const pair of pairs) {
        const [key, value] = pair.split('=').map((s) => s.trim());
        if (!key || value === undefined) continue;

        // Parse specific option types
        switch (key.toLowerCase()) {
            case 'newline':
            case 'newlineformat':
                // Handle escaped sequences
                options.newlineFormat = value
                    .replace(/\\r\\n/g, '\r\n')
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r');
                break;

            case 'linewidth':
                const width = parseInt(value, 10);
                if (!isNaN(width)) options.lineWidth = width;
                break;

            case 'indent':
                const indent = parseInt(value, 10);
                if (!isNaN(indent) && indent > 0 && indent <= 8) options.indent = indent;
                break;

            case 'noarrayindent':
                options.noArrayIndent = value.toLowerCase() === 'true';
                break;

            case 'forcequotes':
                options.forceQuotes = value.toLowerCase() === 'true';
                break;

            case 'sortkeys':
                options.sortKeys = value.toLowerCase() === 'true';
                break;

            case 'preservecomments':
                options.preserveComments = value.toLowerCase() === 'true';
                break;

            case 'stepspacing':
                options.stepSpacing = value.toLowerCase() === 'true';
                break;

            case 'sectionspacing':
                options.sectionSpacing = value.toLowerCase() === 'true';
                break;

            case 'normalizepaths':
                options.normalizePaths = value.toLowerCase() === 'true';
                break;

            case 'expandtemplates':
                options.expandTemplates = value.toLowerCase() === 'true';
                break;
        }
    }

    return options;
}

/**
 * Describe YAML syntax errors in a user-friendly way
 * @param {Error} error - The error object
 * @returns {string|undefined} A formatted error message or undefined
 */
function describeYamlSyntaxError(error) {
    if (!error || typeof error !== 'object') {
        return undefined;
    }

    const isYamlError = error.name === 'YAMLException' || error.name === 'YAMLError';
    if (!isYamlError && error.name && typeof error.name === 'string' && !error.name.includes('YAML')) {
        return undefined;
    }

    const reason = typeof error.reason === 'string' && error.reason.trim().length ? error.reason.trim() : undefined;
    const baseMessage = reason || (typeof error.message === 'string' ? error.message.trim() : undefined);

    // Allow "duplicated mapping key" errors for Azure Pipeline expressions
    // like ${{ insert }}, ${{ parameters.x }}, etc. which are valid at runtime
    if (baseMessage && baseMessage.includes('duplicated mapping key')) {
        // Check if this might be an expression key
        const snippet = error.snippet || '';
        if (snippet.includes('${{') || (error.mark && error.mark.snippet && error.mark.snippet.includes('${{'))) {
            // This is likely a valid Azure Pipelines expression with duplicate keys
            return undefined;
        }
    }

    const mark = error.mark && typeof error.mark === 'object' ? error.mark : undefined;
    const hasLine = mark && Number.isInteger(mark.line);
    const hasColumn = mark && Number.isInteger(mark.column);

    if (!baseMessage && !hasLine) {
        return undefined;
    }

    const lineText = hasLine ? `line ${mark.line + 1}` : undefined;
    const columnText = hasColumn ? `column ${mark.column + 1}` : undefined;
    const location = lineText && columnText ? `${lineText}, ${columnText}` : lineText || columnText;

    if (location && baseMessage) {
        return `YAML syntax error at ${location}: ${baseMessage}`;
    }

    if (baseMessage) {
        return `YAML syntax error: ${baseMessage}`;
    }

    return location ? `YAML syntax error at ${location}.` : undefined;
}

/**
 * Find the next non-blank line index starting from the given index.
 * @param {string[]} lines - Array of lines
 * @param {number} startIndex - Index to start searching from
 * @returns {number|null} Index of next non-blank line, or null if none found
 */
function findNextNonBlankLine(lines, startIndex) {
    for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].trim() !== '') {
            return i;
        }
    }
    return null;
}

/**
 * Apply pipeline-specific formatting rules to the YAML output.
 * This handles step spacing, section spacing, and blank line management.
 * @param {string} text - The YAML text to format
 * @param {string} newline - The newline character(s) to use
 * @param {object} options - Formatting options
 * @returns {string} The formatted text
 */
function applyPipelineFormatting(text, newline, options) {
    if (!text) return text;

    let lines = text.split(newline);
    const result = [];

    // Define parent keys that should not have blank lines after them
    const parentKeys = [
        'steps:',
        'jobs:',
        'stages:',
        'pool:',
        'variables:',
        'parameters:',
        'resources:',
        'trigger:',
        'pr:',
    ];

    // Define sections where step spacing should apply (blank lines between items are preserved/added)
    const stepSpacingSections = ['steps'];

    // Define sections where list item spacing should apply (stages, jobs, etc.)
    const listItemSpacingSections = ['stages', 'jobs'];

    // Define step types for step spacing
    const stepPattern =
        /^\s*-\s+(task|bash|powershell|pwsh|script|sh|checkout|download|downloadBuild|getPackage|publish|reviewApp|template):/;

    // Define top-level sections for first block blank lines
    const topLevelSections = ['stages:', 'jobs:', 'steps:', 'trigger:', 'pr:', 'resources:', 'pool:', 'variables:'];

    // Track if we've seen parameters at the start (for firstBlockBlankLines)
    let hasParametersAtStart = false;
    let firstNonEmptyLine = -1;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed && !trimmed.startsWith('#')) {
            firstNonEmptyLine = i;
            hasParametersAtStart = trimmed === 'parameters:';
            break;
        }
    }

    // Single Pass: Compact nested structures, apply spacing rules, and cleanup
    // This preserves blank lines between root sections and in step sections
    const pass1 = [];
    let currentSection = null;
    let currentSectionIndent = 0;
    let prevWasComment = false;

    // Step spacing state
    let prevWasCommentBeforeStep = false;
    const lastListItemAtIndent = new Map();

    // Section spacing state
    let foundFirstSection = false;
    let foundFirstMainSection = false;
    let firstSectionWasMainSection = false;
    let parametersEnded = false;
    let lastRootSectionIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineIndent = line.length - line.trimStart().length;

        // Track the current root section
        if (lineIndent === 0 && trimmed && !trimmed.startsWith('#') && trimmed.endsWith(':')) {
            currentSection = trimmed.slice(0, -1);
            currentSectionIndent = 0;
        }

        // Check if this is a blank line
        if (trimmed === '') {
            const nextNonBlank = findNextNonBlankLine(lines, i + 1);
            if (nextNonBlank !== null) {
                const nextLineIndent = lines[nextNonBlank].length - lines[nextNonBlank].trimStart().length;
                const nextTrimmed = lines[nextNonBlank].trim();

                let keepBlank = false;

                // Only keep blank lines that are directly after stages:, jobs:, or steps: (indent 0 or 2)
                // Find the previous non-blank line
                const prevNonBlankIndex = pass1.length - 1;
                let prevLine = null;
                for (let j = prevNonBlankIndex; j >= 0; j--) {
                    if (pass1[j].trim() !== '') {
                        prevLine = pass1[j];
                        break;
                    }
                }

                if (prevLine) {
                    const prevIndent = prevLine.length - prevLine.trimStart().length;
                    const prevTrimmed = prevLine.trim();

                    // Keep blank if previous line was stages:, jobs:, or steps: at root level
                    if (
                        prevIndent === 0 &&
                        (prevTrimmed === 'stages:' || prevTrimmed === 'jobs:' || prevTrimmed === 'steps:')
                    ) {
                        keepBlank = true;
                    }
                    // NOTE: We DON'T keep blank lines between root-level sections here
                    // because Section 3 (section spacing logic) handles that with betweenSectionBlankLines option
                    // Keep blank if previous line was a comment (preserve blank after comment)
                    // Cases where code is commented out from VSCode where there are spaces in between stages/steps or jobs
                    else if (prevWasComment) {
                        keepBlank = true;
                    }
                    // Keep blank lines in steps section (for step spacing)
                    else if (currentSection === 'steps' || stepSpacingSections.includes(currentSection)) {
                        keepBlank = true;
                    }
                    // Keep blank lines between direct children in stages/jobs sections (indent 0 or 2 only)
                    else if (listItemSpacingSections.includes(currentSection)) {
                        if (nextLineIndent === 0 || nextLineIndent === 2) {
                            keepBlank = true;
                        }
                    }
                }

                // Trailing Comments removal rule
                if (keepBlank && nextTrimmed.startsWith('#')) {
                    let hasContentBefore = false;
                    for (let j = pass1.length - 1; j >= 0; j--) {
                        if (pass1[j].trim() !== '' && !pass1[j].trim().startsWith('#')) {
                            hasContentBefore = true;
                            break;
                        }
                        if (pass1[j].trim().startsWith('#')) break;
                    }

                    if (hasContentBefore) {
                        let hasContentAfter = false;
                        for (let j = nextNonBlank; j < lines.length; j++) {
                            const futureTrimmed = lines[j].trim();
                            if (futureTrimmed !== '' && !futureTrimmed.startsWith('#')) {
                                hasContentAfter = true;
                                break;
                            }
                        }

                        if (!hasContentAfter) {
                            keepBlank = false;
                        }
                    }
                }

                if (keepBlank) {
                    pass1.push(line);
                    prevWasComment = false;
                }
            }

            // Skip this blank line (compact)
            prevWasComment = false;
            continue;
        }

        // --- Handle Non-Blank Lines ---

        // 1. Step Spacing
        if (options.stepSpacing) {
            // Only match actual steps (task, bash, etc.) with template expressions
            // Don't match simple list items with template expressions (like dependsOn items)
            const isStepWithExpression = /^\s*-\s+\$\{\{.*\}\}:/.test(line);
            const isStep = stepPattern.test(line) || isStepWithExpression;
            let isListItemInSection = false;

            if (stepSpacingSections.includes(currentSection)) {
                isListItemInSection = isStep;
            } else if (listItemSpacingSections.includes(currentSection)) {
                // For stages/jobs, include template items at any indent level,
                // conditional expressions at indent <= 4 (sibling level conditionals),
                // but restrict other list items to indent 0 or 2
                const isTemplateItem = /^\s*-\s+template:/.test(line);
                const isConditionalExpression = /^\s*-\s+\$\{\{\s*if\s/.test(line) && lineIndent <= 4;
                isListItemInSection =
                    isStep ||
                    isTemplateItem ||
                    isConditionalExpression ||
                    (/^\s*-\s+/.test(line) && (lineIndent === 0 || lineIndent === 2));
            }

            const shouldApplySpacing = listItemSpacingSections.includes(currentSection) ? isListItemInSection : isStep;

            let isCommentBeforeStep = false;
            if (trimmed.startsWith('#')) {
                // Look ahead to find the next non-blank, non-comment line
                for (let j = i + 1; j < lines.length; j++) {
                    const nextTrimmed = lines[j].trim();
                    if (nextTrimmed === '') continue;
                    if (nextTrimmed.startsWith('#')) continue;
                    const nextIndent = lines[j].length - lines[j].trimStart().length;

                    const nextIsStepWithExpression = /^\s*-\s+\$\{\{.*\}\}:/.test(lines[j]);
                    if (stepPattern.test(lines[j]) || nextIsStepWithExpression) {
                        if (
                            stepSpacingSections.includes(currentSection) ||
                            (listItemSpacingSections.includes(currentSection) && (nextIndent === 0 || nextIndent === 2))
                        ) {
                            isCommentBeforeStep = true;
                        }
                    } else if (
                        listItemSpacingSections.includes(currentSection) &&
                        /^\s*-\s+/.test(lines[j]) &&
                        (nextIndent === 0 || nextIndent === 2)
                    ) {
                        isCommentBeforeStep = true;
                    }
                    break;
                }
            }

            const hadPreviousAtSameIndent = lastListItemAtIndent.has(lineIndent);

            if ((shouldApplySpacing || isCommentBeforeStep) && hadPreviousAtSameIndent && !prevWasCommentBeforeStep) {
                // Add blank lines for:
                // 1. Items at indent 0 or 2 (direct children of stages/jobs/steps)
                // 2. Template items at any indent (they're actual pipeline items, not just nested conditions)
                // 3. Conditional expressions at indent <= 4 (sibling level conditionals, not nested in parameters)
                const isTemplateItem = /^\s*-\s+template:/.test(line);
                const isConditionalExpression = /^\s*-\s+\$\{\{\s*if\s/.test(line) && lineIndent <= 4;
                if (
                    (lineIndent <= 2 || isTemplateItem || isConditionalExpression) &&
                    pass1.length > 0 &&
                    pass1[pass1.length - 1].trim() !== ''
                ) {
                    pass1.push('');
                }
            }

            prevWasCommentBeforeStep = isCommentBeforeStep;

            if (shouldApplySpacing) {
                lastListItemAtIndent.set(lineIndent, i);
                for (const [indent, _] of lastListItemAtIndent) {
                    if (indent > lineIndent) lastListItemAtIndent.delete(indent);
                }
                prevWasCommentBeforeStep = false;
            }
        }

        // 2. First Block Blank Lines
        let section2HandledThisLine = false;
        if (hasParametersAtStart) {
            if (!parametersEnded && i > firstNonEmptyLine) {
                if (
                    trimmed &&
                    !trimmed.startsWith('#') &&
                    !trimmed.startsWith('-') &&
                    line[0] !== ' ' &&
                    trimmed.endsWith(':')
                ) {
                    parametersEnded = true;
                }
            }

            if (parametersEnded && !foundFirstSection && topLevelSections.some((s) => trimmed === s)) {
                foundFirstSection = true;
                section2HandledThisLine = true;
                // Track if first section was a main section (stages/jobs/steps)
                const keyOnly = trimmed.includes(':') ? trimmed.substring(0, trimmed.indexOf(':') + 1).trim() : trimmed;
                const isMainSec = keyOnly === 'steps:' || keyOnly === 'stages:' || keyOnly === 'jobs:';
                firstSectionWasMainSection = isMainSec;
                if (isMainSec) {
                    foundFirstMainSection = true;
                }
                // Remove existing blanks
                while (pass1.length > 0 && pass1[pass1.length - 1].trim() === '') {
                    pass1.pop();
                }
                // Add required blanks
                for (let k = 0; k < options.firstBlockBlankLines; k++) {
                    pass1.push('');
                }
            }
        }

        // 3. Section Spacing (betweenSectionBlankLines and firstBlockBlankLines)
        // Detect root sections: lines at indent 0 that are keys (end with : or have : followed by a value)
        const isRootSection =
            trimmed &&
            !trimmed.startsWith('#') &&
            !trimmed.startsWith('-') &&
            line[0] !== ' ' &&
            /^[^:]+:/.test(trimmed); // Matches keys at root level (with or without inline values)

        // Only skip if Section 2 just handled this specific line
        if (isRootSection && lastRootSectionIndex >= 0 && !section2HandledThisLine) {
            // Remove existing blanks before this section
            while (pass1.length > 0 && pass1[pass1.length - 1].trim() === '') {
                pass1.pop();
            }

            // Use firstBlockBlankLines for steps:, stages:, jobs: (but ONLY for the first occurrence AND only if there were parameters)
            // Use betweenSectionBlankLines for other sections (NOT for main sections after the first IF there were parameters)
            const keyOnly = trimmed.includes(':') ? trimmed.substring(0, trimmed.indexOf(':') + 1).trim() : trimmed;
            const isMainSection = keyOnly === 'steps:' || keyOnly === 'stages:' || keyOnly === 'jobs:';

            // Only apply firstBlockBlankLines to the FIRST main section encountered when there are parameters
            const isFirstMainSection =
                isMainSection && !foundFirstMainSection && hasParametersAtStart && parametersEnded;

            if (isFirstMainSection) {
                foundFirstMainSection = true;
            }

            // Determine blank lines to add:
            // - First main section with parameters: firstBlockBlankLines
            // - Main sections after the first (when first section was also a main section): 0 (compact)
            // - All other cases: betweenSectionBlankLines
            let blankLinesToAdd;
            if (isFirstMainSection) {
                blankLinesToAdd = options.firstBlockBlankLines;
            } else if (isMainSection && hasParametersAtStart && parametersEnded && firstSectionWasMainSection) {
                // Compact subsequent main sections only if the first section was also a main section
                blankLinesToAdd = 0;
            } else {
                blankLinesToAdd = options.betweenSectionBlankLines;
            }

            if (isFirstMainSection) {
                foundFirstSection = true;
            }

            for (let k = 0; k < blankLinesToAdd; k++) {
                pass1.push('');
            }
        }
        if (isRootSection) {
            lastRootSectionIndex = pass1.length;
        }

        // Add non-blank line
        pass1.push(line);
        prevWasComment = trimmed.startsWith('#');

        // Remove blank lines immediately after parent keys
        if (parentKeys.some((pk) => trimmed === pk || trimmed.startsWith(pk + ' '))) {
            // Skip subsequent blank lines
            while (i + 1 < lines.length && lines[i + 1].trim() === '') {
                i++;
            }
        }
    }

    return pass1.join(newline);
}

/**
 * Format YAML content with Azure Pipeline-specific rules
 * @param {string} content - The YAML content to format
 * @param {object} options - Formatting options
 * @returns {{ text: string, warning: string|undefined, error: string|undefined }}
 */
function formatYaml(content, options = {}) {
    const baseResult = {
        text: content,
        warning: undefined,
        error: undefined,
    };

    if (!content) {
        return baseResult;
    }

    // Check for file-level formatting directives
    const directives = parseFormatDirectives(content);

    // If formatting is disabled, return original content
    if (directives.disabled) {
        return baseResult;
    }

    // Merge directive options with provided options (directives take precedence)
    if (directives.options) {
        options = { ...options, ...directives.options };
    }

    const effective = {
        noArrayIndent: options && typeof options.noArrayIndent === 'boolean' ? options.noArrayIndent : true,
        indent: options && Number.isInteger(options.indent) && options.indent > 0 ? options.indent : 2,
        lineWidth:
            options && typeof options.lineWidth === 'number' && options.lineWidth >= 0
                ? options.lineWidth === 0
                    ? -1
                    : options.lineWidth
                : -1,
        forceQuotes: options && typeof options.forceQuotes === 'boolean' ? options.forceQuotes : false,
        sortKeys: options && typeof options.sortKeys === 'boolean' ? options.sortKeys : false,
        expandTemplates: options && typeof options.expandTemplates === 'boolean' ? options.expandTemplates : false,
        newlineFormat:
            options &&
            typeof options.newlineFormat === 'string' &&
            (options.newlineFormat === '\n' || options.newlineFormat === '\r\n')
                ? options.newlineFormat
                : '\n',
        fileName: options && options.fileName ? options.fileName : undefined,
        // Pipeline-specific formatting options
        stepSpacing: options && typeof options.stepSpacing === 'boolean' ? options.stepSpacing : true,
        firstBlockBlankLines:
            options && Number.isInteger(options.firstBlockBlankLines) && options.firstBlockBlankLines >= 0
                ? Math.min(options.firstBlockBlankLines, 4)
                : 2,
        betweenSectionBlankLines:
            options && Number.isInteger(options.betweenSectionBlankLines) && options.betweenSectionBlankLines >= 0
                ? Math.min(options.betweenSectionBlankLines, 4)
                : options &&
                    Number.isInteger(options.blankLinesBetweenSections) &&
                    options.blankLinesBetweenSections >= 0
                  ? Math.min(options.blankLinesBetweenSections, 4)
                  : 1,
        sectionSpacing: options && typeof options.sectionSpacing === 'boolean' ? options.sectionSpacing : false,
    };

    try {
        // Replace template expressions with placeholders
        const { content: preprocessedContent, placeholderMap } = effective.expandTemplates
            ? { content: content, placeholderMap: new Map() }
            : replaceTemplateExpressionsWithPlaceholders(content);

        // Protect empty values from being formatted
        const { content: protectedContent, commentMap } = protectEmptyValues(preprocessedContent);

        // Parse with comment preservation using yaml package
        // Set strict: false to allow duplicate keys and other issues
        const doc = YAML.parseDocument(protectedContent, { strict: false, uniqueKeys: false });

        // Check if document has errors
        if (doc.errors && doc.errors.length > 0) {
            // Filter out warnings about invalid escape sequences (common in Windows paths)
            const genuineErrors = doc.errors.filter(
                (e) => !e.message || !e.message.includes('Invalid escape sequence'),
            );

            if (genuineErrors.length > 0) {
                // Return original content and set error when there are genuine parse errors
                const errorMessages = genuineErrors.map((e) => e.message).join(', ');
                const filePrefix = effective.fileName ? `[${effective.fileName}] ` : '';
                if (errorMessages.length > 200) {
                    console.error(`${filePrefix}[yaml package warnings]:`, errorMessages.substring(0, 200) + '...');
                } else {
                    console.error(`${filePrefix}[yaml package warnings]:`, errorMessages);
                }

                return {
                    text: content,
                    warning: undefined,
                    error: errorMessages.length > 100 ? errorMessages.substring(0, 100) + '...' : errorMessages,
                };
            }
        }

        doc.errors = [];
        doc.warnings = [];

        // Stringify with preserved comments and no line wrapping
        let result = doc.toString({
            indent: effective.indent,
            indentSeq: !effective.noArrayIndent,
            lineWidth: -1, // Disable line wrapping completely (unlimited line width)
            doubleQuotedAsJSON: true, // Preserve \n escape sequences in double-quoted strings
            doubleQuotedMinMultiLineLength: Infinity, // Never convert double-quoted to multi-line
            singleQuote: null, // Preserve original quote style
            blockQuote: true, // Use block quotes for multi-line scalars
            defaultStringType: 'PLAIN', // Default to plain strings (unquoted)
        });

        // Restore template expressions from placeholders
        result = restoreTemplateExpressions(result, placeholderMap);

        // Restore empty values
        result = restoreEmptyValues(result, commentMap);

        const newline = effective.newlineFormat;

        // Convert all line endings to match the target format
        let normalized = result.replace(/\r?\n/g, newline);

        // Apply pipeline-specific formatting
        normalized = applyPipelineFormatting(normalized, newline, effective);

        // Ensure single newline at end of file
        normalized = normalized.replace(new RegExp(`(?:${escapeRegExp(newline)})*$`), newline);

        return {
            text: normalized,
            warning: undefined,
            error: undefined,
        };
    } catch (error) {
        // If yaml package fails, return error
        const syntaxMessage = describeYamlSyntaxError(error);
        if (syntaxMessage) {
            return {
                text: content,
                warning: undefined,
                error: syntaxMessage,
            };
        }

        return {
            text: content,
            warning: undefined,
            error: `YAML formatting failed: ${error.message}`,
        };
    }
}

module.exports = {
    formatYaml,
    escapeRegExp,
};
