#include "tree_sitter/parser.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

enum TokenType { INDENT, DEDENT, SAME_LINE, ADD, SUBTRACT, MODULO, LESS, GREATER, GREATER_EQUAL, SHIFT_RIGHT, ERROR_SENTINEL };
#define MAX_DEPTH 250
// Only syntactic suites create indentation levels. Ordinary continued
// expressions may span lines without creating layout tokens.
typedef struct { uint16_t levels[MAX_DEPTH]; uint16_t size; } Scanner;

void *tree_sitter_bend2_external_scanner_create(void) {
  Scanner *s = calloc(1, sizeof(Scanner));
  s->size = 1;
  return s;
}
void tree_sitter_bend2_external_scanner_destroy(void *payload) { free(payload); }
unsigned tree_sitter_bend2_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *s = payload;
  unsigned n = s->size * sizeof(uint16_t);
  memcpy(buffer, s->levels, n);
  return n;
}
void tree_sitter_bend2_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  Scanner *s = payload;
  memset(s, 0, sizeof(*s));
  if (length > sizeof(s->levels)) length = sizeof(s->levels);
  length -= length % sizeof(uint16_t);
  s->size = length / sizeof(uint16_t);
  if (length) memcpy(s->levels, buffer, length);
  if (!s->size) s->size = 1;
}
bool tree_sitter_bend2_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid) {
  Scanner *s = payload;
  if (valid[ERROR_SENTINEL]) return false;
  lexer->mark_end(lexer);
  bool had_space = false;
  bool newline = lexer->get_column(lexer) == 0;
  for (;;) {
    if (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
      had_space = true;
      lexer->advance(lexer, true);
    } else if (lexer->lookahead == '\n') {
      newline = true;
      had_space = true;
      lexer->advance(lexer, true);
    } else if (lexer->lookahead == '#') {
      while (lexer->lookahead && lexer->lookahead != '\n') lexer->advance(lexer, true);
    } else break;
  }
  uint32_t column = lexer->get_column(lexer);
  uint16_t top = s->levels[s->size - 1];
  if (valid[DEDENT] && s->size > 1 &&
      (lexer->eof(lexer) || (newline && column < top) ||
       lexer->lookahead == ')' || lexer->lookahead == ']' || lexer->lookahead == '}' || lexer->lookahead == ',')) {
    --s->size;
    lexer->result_symbol = DEDENT;
    return true;
  }
  if (valid[INDENT] && newline && !lexer->eof(lexer) && column > top && s->size < MAX_DEPTH && column <= UINT16_MAX) {
    s->levels[s->size++] = (uint16_t)column;
    lexer->result_symbol = INDENT;
    return true;
  }
  if (valid[SAME_LINE] && !newline && (lexer->lookahead == '(' || lexer->lookahead == '[')) {
    lexer->result_symbol = SAME_LINE;
    return true;
  }
  if (lexer->lookahead == '%' && valid[MODULO]) {
    lexer->advance(lexer, false);
    int32_t c = lexer->lookahead;
    if (c != ' ' && c != '\t' && c != '\r' && c != '\n') return false;
    lexer->mark_end(lexer);
    lexer->result_symbol = MODULO;
    return true;
  }
  if ((lexer->lookahead == '+' && valid[ADD]) || (lexer->lookahead == '-' && valid[SUBTRACT])) {
    enum TokenType kind = lexer->lookahead == '+' ? ADD : SUBTRACT;
    lexer->advance(lexer, false);
    int32_t c = lexer->lookahead;
    if (c == '>' || c == '+' || c == '_' || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) return false;
    lexer->mark_end(lexer);
    lexer->result_symbol = kind;
    return true;
  }
  if (had_space && lexer->lookahead == '<' && valid[LESS]) {
    lexer->advance(lexer, false);
    if (lexer->lookahead == '=' || lexer->lookahead == '>' || lexer->lookahead == '<' || lexer->lookahead == '&' || lexer->lookahead == '-') return false;
    lexer->mark_end(lexer);
    lexer->result_symbol = LESS;
    return true;
  }
  if (had_space && lexer->lookahead == '>' &&
      (valid[GREATER] || valid[GREATER_EQUAL] || valid[SHIFT_RIGHT])) {
    lexer->advance(lexer, false);
    enum TokenType kind = GREATER;
    if (lexer->lookahead == '=') { kind = GREATER_EQUAL; lexer->advance(lexer, false); }
    else if (lexer->lookahead == '>') { kind = SHIFT_RIGHT; lexer->advance(lexer, false); }
    if (!valid[kind]) return false;
    lexer->mark_end(lexer);
    lexer->result_symbol = kind;
    return true;
  }
  return false;
}
