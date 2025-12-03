parser grammar AzurePipelineParser;

options { tokenVocab=AzurePipelineLexer; }

yamlFile: document;

document: (element | NEWLINE | WS)* EOF;

element
    : keyValue
    | listItem
    | conditionalBlock
        | INDENT* (KEY | STRING | COMPILE_TIME_CONDITIONAL | COMPILE_TIME_EXPR | RUNTIME_EXPR | VARIABLE | POWERSHELL_VAR)
            (WS (KEY | STRING | COMPILE_TIME_CONDITIONAL | COMPILE_TIME_EXPR | RUNTIME_EXPR | VARIABLE | POWERSHELL_VAR))*
    | INDENT+ 
    ;

conditionalBlock
        : INDENT* COMPILE_TIME_CONDITIONAL
            (
                WS* value
                | NEWLINE nestedElements?
            )?
    ;

keyValue
    : INDENT* KEY COLON (value | NEWLINE nestedElements?)
    ;

listItem
    : INDENT* DASH WS* keyValue
    | INDENT* DASH WS* value COLON NEWLINE nestedElements?
    | INDENT* DASH WS* value
        | INDENT* DASH WS* COMPILE_TIME_CONDITIONAL
            (
                WS* value
                | NEWLINE nestedElements?
            )?
    ;

nestedElements
    : (INDENT element NEWLINE?)+
    ;

value
    : blockScalar
    | valueAtom+
    ;

valueAtom
    : STRING
    | COMPILE_TIME_CONDITIONAL
    | COMPILE_TIME_EXPR
    | RUNTIME_EXPR
    | VARIABLE
    | POWERSHELL_VAR
    | VALUE_TEXT
    | LIST_VALUE
    | KEY
    ;

blockScalar
    : PIPE NEWLINE blockScalarLine* blockScalarContent?
    ;

blockScalarLine
    : blockScalarContent? NEWLINE
    ;

blockScalarContent
    : blockScalarAtom+
    ;

blockScalarAtom
    : SCRIPT_CONTENT
    | COMPILE_TIME_EXPR
    | RUNTIME_EXPR
    | VARIABLE
    | POWERSHELL_VAR
    ;
