import { useRef, useEffect } from 'react'

export function useAutoScroll(dependencies: unknown[]) {
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, dependencies)

  return outputRef
}
