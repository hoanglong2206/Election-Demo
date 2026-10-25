import {
  InMemoryVectorStore,
  LocalRagIndex,
  type SourceDocument,
} from '../src/app/services/ai-model/copilot/localRag'

const store = new InMemoryVectorStore()
const index = new LocalRagIndex(undefined, store)
const documents: SourceDocument[] = [
  { documentId: 'cv', sourceType: 'cv', section: 'experience', text: 'Built payment APIs with TypeScript and PostgreSQL.' },
  { documentId: 'jd', sourceType: 'job_description', section: 'requirements', text: 'Experience with distributed systems and Kafka.' },
]

await index.indexDocuments(documents)
const result = await index.query('What did I build with TypeScript?', { topK: 2, tokenBudget: 100 })
if (result.citations[0]?.sourceType !== 'cv' || result.citations[0]?.score <= 0) {
  throw new Error('Relevant CV chunk should rank first')
}
if (result.diagnostics.selectedTokenCount <= 0 || !result.context.includes('payment APIs')) {
  throw new Error('Retrieval diagnostics or context is missing')
}

await index.indexDocuments([
  { ...documents[0], text: 'Built search APIs with Go and Redis.' },
  documents[1],
])
const updated = await index.query('What did I build with TypeScript?', { topK: 2 })
if (updated.context.includes('payment APIs')) {
  throw new Error('Changed documents must invalidate old chunks')
}

console.log('local RAG tests passed')
