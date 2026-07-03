import test from 'node:test'
import assert from 'node:assert/strict'
import { detectFormat, htmlToText, textToHtml, wrapHtmlDocument } from './fileFormats'

test('detectFormat resolves word formats correctly', () => {
  assert.equal(detectFormat('C:\\docs\\report.docx'), 'docx')
  assert.equal(detectFormat('C:\\docs\\legacy.doc'), 'doc')
  assert.equal(detectFormat('C:\\docs\\site.html'), 'html')
  assert.equal(detectFormat('/tmp/notes.txt'), 'txt')
  assert.equal(detectFormat('/tmp/README.md'), 'txt')
})

test('textToHtml escapes unsafe entities and keeps line boundaries', () => {
  const html = textToHtml('Line 1\nLine <2> & "3"')
  assert.equal(html, '<p>Line 1</p><p>Line &lt;2&gt; &amp; &quot;3&quot;</p>')
})

test('htmlToText strips tags and decodes common entities', () => {
  const text = htmlToText('<p>Hello &amp; welcome</p><p>Line&nbsp;2</p><ul><li>One</li></ul>')
  assert.equal(text.trim(), 'Hello & welcome\nLine 2\n- One')
})

test('wrapHtmlDocument creates a full html shell', () => {
  const wrapped = wrapHtmlDocument('<p>Sample</p>')
  assert.match(wrapped, /^<!doctype html>/i)
  assert.match(wrapped, /<meta charset="utf-8" \/>/)
  assert.match(wrapped, /<body><p>Sample<\/p><\/body>/)
})
