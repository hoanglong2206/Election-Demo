import React from 'react'

export interface HighlightTextProps {
  text: string
  query: string
}

export const HighlightText = React.memo(function HighlightText({
  text,
  query,
}: HighlightTextProps) {
  if (!query.trim() || !text) return <>{text}</>

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-amber-400/35 text-amber-200 rounded px-0.5 font-semibold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
})
