import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import JSZip from 'jszip'
import { DocumentAgent } from '@eigenpal/docx-editor-core/agent'

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', 'docx')

async function loadFixtureNames(): Promise<string[]> {
  const entries = await readdir(FIXTURES_DIR)
  return entries.filter((name) => name.endsWith('.docx'))
}

function toArrayBuffer(data: Buffer): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

test('docx fixtures contain required OOXML parts', async () => {
  const names = await loadFixtureNames()
  assert.ok(names.length > 0, 'Run pnpm run test:fixtures:generate first')

  for (const name of names) {
    const buffer = await readFile(join(FIXTURES_DIR, name))
    const zip = await JSZip.loadAsync(buffer)
    assert.ok(zip.file('word/document.xml'), `${name}: missing word/document.xml`)
    assert.ok(zip.file('[Content_Types].xml'), `${name}: missing [Content_Types].xml`)
    const docXml = await zip.file('word/document.xml')!.async('string')
    assert.match(docXml, /<w:document/, `${name}: invalid document root`)
  }
})

test('docx fixtures are non-empty binary packages', async () => {
  const names = await loadFixtureNames()
  for (const name of names) {
    const buffer = await readFile(join(FIXTURES_DIR, name))
    assert.ok(buffer.byteLength > 200, `${name}: suspiciously small`)
    assert.equal(buffer[0], 0x50)
    assert.equal(buffer[1], 0x4b)
  }
})

test('eigenpal parse → save round-trips fixture OOXML', async () => {
  const names = await loadFixtureNames()
  assert.ok(names.length > 0, 'No fixtures found')

  for (const name of names) {
    const fileBuffer = await readFile(join(FIXTURES_DIR, name))
    const input = toArrayBuffer(fileBuffer)

    const agent = await DocumentAgent.fromBuffer(input)
    const saved = await agent.toBuffer()
    const savedBytes = new Uint8Array(saved)

    assert.ok(saved.byteLength > 200, `${name}: round-trip output too small`)
    assert.equal(savedBytes[0], 0x50, `${name}: round-trip is not a ZIP`)
    assert.equal(savedBytes[1], 0x4b, `${name}: round-trip is not a ZIP`)

    const zip = await JSZip.loadAsync(savedBytes)
    assert.ok(zip.file('word/document.xml'), `${name}: round-trip missing word/document.xml`)
    assert.ok(zip.file('word/styles.xml'), `${name}: round-trip missing word/styles.xml`)

    const docXml = await zip.file('word/document.xml')!.async('string')
    assert.match(docXml, /<w:document/, `${name}: round-trip invalid document root`)
    assert.match(docXml, /<w:body/, `${name}: round-trip missing body`)
  }
})
