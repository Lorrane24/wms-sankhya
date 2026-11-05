// Testes automáticos da proteção contra injeção de SQL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoSql } from './sql.js';

test('texto comum fica entre aspas', () => {
  assert.equal(textoSql('789123'), "'789123'");
});

test('aspas do ataque são escapadas', () => {
  assert.equal(textoSql("' OR '1'='1"), "''' OR ''1''=''1'");
});

test('dois hífens viram CHR(45)', () => {
  assert.equal(textoSql('ab--cd'), "'ab' || CHR(45) || CHR(45) || 'cd'");
});

test('número também funciona', () => {
  assert.equal(textoSql(6), "'6'");
});