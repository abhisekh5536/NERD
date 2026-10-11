/**
 * Generates minimal OOXML .docx fixtures for fidelity / round-trip tests.
 * Run: node tests/scripts/generate-docx-fixtures.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'fixtures', 'docx')

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
</w:styles>`

function para(text, opts = {}) {
  const { bold, italic, styleId, paraId } = opts
  const runs = []
  if (bold || italic) {
    let rPr = ''
    if (bold) rPr += '<w:b/>'
    if (italic) rPr += '<w:i/>'
    runs.push(`<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`)
  } else {
    runs.push(`<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`)
  }
  const pPr = styleId ? `<w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>` : ''
  const paraIdAttr = paraId ? ` w14:paraId="${paraId}"` : ''
  return `<w:p${paraIdAttr}>${pPr}${runs.join('')}</w:p>`
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function documentXml(bodyInner) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:body>
    ${bodyInner}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

async function writeDocx(name, bodyInner) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('word/_rels/document.xml.rels', DOC_RELS)
  zip.file('word/styles.xml', STYLES)
  zip.file('word/document.xml', documentXml(bodyInner))
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await writeFile(join(OUT_DIR, name), buffer)
}

const FIXTURES = {
  'simple-letter.docx': [
    para('Dear Reader,', { paraId: '11111111' }),
    para('This is a simple letter with bold and italic text.', { paraId: '22222222' }),
    para('Bold phrase here.', { bold: true, paraId: '33333333' }),
    para('Italic phrase here.', { italic: true, paraId: '44444444' }),
    para('Sincerely,', { paraId: '55555555' }),
    para('WordClone Test', { paraId: '66666666' })
  ].join(''),
  'headings-lists.docx': [
    para('Document Title', { styleId: 'Heading1', paraId: 'A0000001' }),
    para('Introduction paragraph.', { paraId: 'A0000002' }),
    para('Section One', { styleId: 'Heading2', paraId: 'A0000003' }),
    para('• First bullet item', { paraId: 'A0000004' }),
    para('• Second bullet item', { paraId: 'A0000005' }),
    para('1. First numbered item', { paraId: 'A0000006' }),
    para('2. Second numbered item', { paraId: 'A0000007' })
  ].join(''),
  'table-basic.docx': [
    para('Table Sample', { styleId: 'Heading1', paraId: 'B0000001' }),
    `<w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Header A</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Header B</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Cell 1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Cell 2</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>`
  ].join('')
}

await mkdir(OUT_DIR, { recursive: true })
for (const [name, body] of Object.entries(FIXTURES)) {
  await writeDocx(name, body)
  console.log('wrote', name)
}

console.log('Done — fixtures in', OUT_DIR)
