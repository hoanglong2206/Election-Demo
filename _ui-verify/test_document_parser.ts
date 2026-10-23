import { parseDocumentFile, cleanDocumentText } from '../src/app/services/documentParser'
import * as mammoth from 'mammoth'
import { getDocumentProxy, extractText } from 'unpdf'

async function test() {
  console.log('Testing documentParser...')

  // 1. Test cleanDocumentText
  const sampleRaw = 'Hello world  \r\n\r\n\r\n\r\nLine 2   \r\n\x00Line 3'
  const cleaned = cleanDocumentText(sampleRaw)
  console.log('Cleaned text:', JSON.stringify(cleaned))

  // 2. Test plain text file
  const textBlob = new Blob(['Nguyễn Văn A - Senior React Developer\nKinh nghiệm 5 năm frontend'], {
    type: 'text/plain',
  })
  const textFile = new File([textBlob], 'cv_nguyen_van_a.txt', { type: 'text/plain' })
  const textResult = await parseDocumentFile(textFile)
  console.log('Text file parsed successfully:', textResult.fileName, 'Length:', textResult.charCount)

  // 3. Test unpdf imports
  console.log('unpdf getDocumentProxy is function:', typeof getDocumentProxy === 'function')
  console.log('unpdf extractText is function:', typeof extractText === 'function')

  // 4. Test mammoth imports
  console.log('mammoth extractRawText is function:', typeof mammoth.extractRawText === 'function')

  console.log('All basic checks PASSED!')
}

test().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
