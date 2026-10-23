declare module 'mammoth' {
  export interface MammothMessage {
    type: string
    message: string
  }

  export interface MammothResult {
    value: string
    messages: MammothMessage[]
  }

  export function extractRawText(options: {
    arrayBuffer?: ArrayBuffer
    buffer?: any
    path?: string
  }): Promise<MammothResult>

  export function convertToHtml(options: {
    arrayBuffer?: ArrayBuffer
    buffer?: any
    path?: string
  }): Promise<MammothResult>
}
