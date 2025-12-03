lexer grammar AzurePipelineLexer;

@lexer::members {
    this.getScriptBlockStack = function() {
        if (!this._scriptBlockStack) {
            this._scriptBlockStack = [];
        }
        return this._scriptBlockStack;
    };

    this.pushScriptBlock = function(baseIndent) {
        const stack = this.getScriptBlockStack();
        stack.push(baseIndent);
    };

    this.popScriptBlock = function() {
        const stack = this.getScriptBlockStack();
        if (stack.length > 0) {
            stack.pop();
        }
    };

    this.currentScriptBaseIndent = function() {
        const stack = this.getScriptBlockStack();
        return stack.length > 0 ? stack[stack.length - 1] : null;
    };

    this.computeCurrentLineIndent = function() {
        const stream = this._input;
        const tokenStart = this._tokenStartCharIndex;

        if (tokenStart === 0) {
            return 0;
        }

        let index = tokenStart - 1;

        while (index >= 0) {
            const ch = stream.getText(new antlr4.Interval(index, index));
            if (ch === '\n') {
                index++;
                break;
            }
            if (ch === '\r') {
                if (index > 0 && stream.getText(new antlr4.Interval(index - 1, index - 1)) === '\n') {
                    index--;
                }
                index++;
                break;
            }
            index--;
        }

        if (index < 0) {
            index = 0;
        }

        const end = tokenStart - 1;
        if (end < index) {
            return 0;
        }

        const prefix = stream.getText(new antlr4.Interval(index, end));
        let indent = 0;
        for (let i = 0; i < prefix.length; i++) {
            const c = prefix[i];
            if (c === ' ') {
                indent++;
            } else if (c === '\t') {
                indent += 2;
            } else {
                break;
            }
        }
        return indent;
    };

    this.readIndentAhead = function() {
        let indent = 0;
        let offset = 1;
        let ch = this._input.LA(offset);

        while (ch === 32 || ch === 9) {
            indent += (ch === 9 ? 2 : 1);
            offset++;
            ch = this._input.LA(offset);
        }

        return { indent, nextChar: ch };
    };

    this.shouldExitScript = function(indentInfo) {
        const baseIndent = this.currentScriptBaseIndent();

        if (baseIndent === null) {
            return true;
        }

        const { indent, nextChar } = indentInfo;

        if (nextChar === -1) {
            return true;
        }

        if (nextChar === 10 || nextChar === 13) {
            return false;
        }

        return indent <= baseIndent;
    };
}

// Default mode - for keys and structure
// Azure DevOps expressions - compile-time and runtime
// Order matters: more specific patterns first
COMPILE_TIME_CONDITIONAL: '${{' .*? '}}' [ \t]* ':' {
    const raw = this.text;
    let trimmed = raw.trimEnd();
    if (trimmed.endsWith(':')) {
        trimmed = trimmed.slice(0, -1).trimEnd();
    }
    this.text = trimmed;
};
COMPILE_TIME_EXPR: '${{' .*? '}}';
RUNTIME_EXPR: '$[' ~']'* ']';
VARIABLE: '$(' ( ~')' )* ')';

// PowerShell variables in script content
POWERSHELL_VAR: '$' [a-zA-Z_][a-zA-Z0-9_]*;

// Handle script blocks with pipe
PIPE: '|' { this.pushScriptBlock(this.computeCurrentLineIndent()); } -> pushMode(SCRIPT_MODE);

STRING: '"' ( '\\' . | ~('"'|'\\') )* '"' | '\'' ( '\\' . | ~('\''|'\\') )* '\'';
COLON: ':' -> pushMode(VALUE_MODE);
DASH: '-' -> pushMode(LIST_VALUE_MODE);

fragment LETTER: [a-zA-Z_];
fragment DIGIT: [0-9];
fragment ALNUM: LETTER | DIGIT | [.-];

KEY: LETTER (ALNUM)*;
EMPTY_LINE: [ \t]* '\r'? '\n' [ \t]* '\r'? '\n' -> skip;
BLANK_LINE: [ \t]* '\r'? '\n' -> type(NEWLINE);
INDENT: [ \t]+;
NEWLINE: '\r'? '\n';
COMMENT: '#' ~[\r\n]* -> skip;
WS: [ \t]+;

// List value mode - after dash, capture everything as value until colon or newline
mode LIST_VALUE_MODE;
LIST_WS: [ \t]+ -> skip;
LIST_COMPILE_TIME_CONDITIONAL: '${{' .*? '}}' [ \t]* ':' {
    const raw = this.text;
    let trimmed = raw.trimEnd();
    if (trimmed.endsWith(':')) {
        trimmed = trimmed.slice(0, -1).trimEnd();
    }
    this.text = trimmed;
} -> type(COMPILE_TIME_CONDITIONAL);
LIST_COMPILE_TIME_EXPR: '${{' .*? '}}' -> type(COMPILE_TIME_EXPR);
LIST_RUNTIME_EXPR: '$[' ~']'* ']' -> type(RUNTIME_EXPR);
LIST_VARIABLE: '$(' ( ~')' )* ')' -> type(VARIABLE);
LIST_KEY: LETTER (ALNUM)* -> type(KEY);
LIST_COLON: ':' -> type(COLON), popMode, pushMode(VALUE_MODE);
LIST_POWERSHELL_VAR: '$' [a-zA-Z_][a-zA-Z0-9_]* -> type(POWERSHELL_VAR);
LIST_VALUE: (~[\r\n: \t$])+ {this.text = this.text.trim();};
LIST_NEWLINE: '\r'? '\n' -> type(NEWLINE), popMode;

// Value mode - after colon, capture everything as value until newline
mode VALUE_MODE;
VALUE_WS: [ \t]+ -> skip;
VALUE_POWERSHELL_VAR: '$' [a-zA-Z_][a-zA-Z0-9_]* -> type(POWERSHELL_VAR);
VALUE_COMPILE_TIME_EXPR: '${{' .*? '}}' -> type(COMPILE_TIME_EXPR);
VALUE_RUNTIME_EXPR: '$[' ~']'* ']' -> type(RUNTIME_EXPR);
VALUE_VARIABLE: '$(' ( ~')' )* ')' -> type(VARIABLE);
VALUE_STRING: '"' ( '\\' . | ~('"'|'\\'|'\r'|'\n') )* '"' -> type(STRING);
VALUE_STRING_SINGLE: '\'' ( '\\' . | ~('\''|'\\'|'\r'|'\n') )* '\'' -> type(STRING);
VALUE_PIPE: '|' { this.pushScriptBlock(this.computeCurrentLineIndent()); } -> type(PIPE), popMode, pushMode(SCRIPT_MODE);
VALUE_TEXT: (~[\r\n|$])+ {this.text = this.text.trim();};
VALUE_NEWLINE: '\r'? '\n' -> type(NEWLINE), popMode;

// Script mode - for handling multi-line script content
mode SCRIPT_MODE;
SCRIPT_WS: [ \t]+ -> skip;
SCRIPT_POWERSHELL_VAR: '$' [a-zA-Z_][a-zA-Z0-9_]* -> type(POWERSHELL_VAR);
SCRIPT_COMPILE_TIME_EXPR: '${{' .*? '}}' -> type(COMPILE_TIME_EXPR);
SCRIPT_RUNTIME_EXPR: '$[' .*? ']' -> type(RUNTIME_EXPR);
SCRIPT_VARIABLE: '$(' .*? ')' -> type(VARIABLE);
SCRIPT_CONTENT: (~[\r\n$])+ {
    if (this._input.LA(1) === -1) {
        this.popScriptBlock();
        this.popMode();
    }
};
SCRIPT_NEWLINE: '\r'? '\n' {
    const indentInfo = this.readIndentAhead();
    if (this.shouldExitScript(indentInfo)) {
        this.popScriptBlock();
        this.popMode();
    }
} -> type(NEWLINE);
