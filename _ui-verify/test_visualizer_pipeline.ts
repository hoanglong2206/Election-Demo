import { WebAudioCaptureService } from '../src/app/infrastructure/audio/WebAudioCaptureService'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`)
  }
}

async function testVisualizerPipeline() {
  console.log('Testing Audio Visualizer Pipeline decoupling & zero-allocation...')

  const service = new WebAudioCaptureService()
  assert(service.isCapturing === false, 'Service should start idle')

  // Initial metrics before capture
  const initialMetrics = service.getMetrics()
  assert(initialMetrics.volume === 0, 'Initial volume should be 0')
  assert(initialMetrics.db === -60, 'Initial dB should be -60')
  assert(initialMetrics.frequencyBands.length === 16, 'Frequency bands should have 16 bands')
  assert(initialMetrics.isAudioDetected === false, 'isAudioDetected should be false initially')

  // Verify that consecutive calls return the same memory reference (zero allocation)
  const metrics2 = service.getMetrics()
  assert(initialMetrics.frequencyBands === metrics2.frequencyBands, 'frequencyBands should reuse array without reallocating')

  // Verify getAnalyser method exists
  assert(typeof service.getAnalyser === 'function', 'getAnalyser should be a function')
  assert(service.getAnalyser() === null, 'getAnalyser should be null when not capturing')

  console.log('✔ Zero-allocation telemetry verified (reusable cached arrays)')
  console.log('✔ Decoupled analyser getter verified')
  console.log('\nAll Visualizer Pipeline tests PASSED! 🎉')
}

testVisualizerPipeline().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
