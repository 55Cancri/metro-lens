import React from 'react'

type MapRef = string & ((node: HTMLElement) => void)
// type MapRef = string & React.RefObject<HTMLElement>
type Dimensions = Omit<DOMRectReadOnly, 'toJSON'>

export const getDimensionObject = (node: HTMLElement): Dimensions => {
  console.log({ node })
  const rect = node.getBoundingClientRect()

  return {
    width: rect.width,
    height: rect.height,
    top: rect.x ?? rect.top,
    left: rect.y ?? rect.left,
    x: rect.x ?? rect.left,
    y: rect.y ?? rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }
}

/**
 * 1. `useRef` creates a React.ref, lets you access the DOM.
 * 2. `useState` gives you place to store/read the result.
 * 3. `useLayoutEffect` runs before browser paint but after
 * all is known.
 * 4. `getClientBoundingRect()` measures a DOM node. Width,
 * height, x, y, etc.
 * 5. `toJSON` turns a DOMRect object into a plain object
 * so you can destructure.
 * author: https://swizec.com/blog/usedimensions-a-react-hook-to-measure-dom-nodes/swizec/8983
 */
export const useDimensions = () => {
  const [dimensions, setDimensions] = React.useState({})
  const [node, setNode] = React.useState<HTMLElement | null>(null)

  const ref = React.useCallback((node) => {
    setNode(node)
  }, [])

  React.useLayoutEffect(() => {
    const measure = () =>
      window.requestAnimationFrame(() => {
        if (node) {
          setDimensions(getDimensionObject(node))
        }
      })
    measure()

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure)

    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [node])

  console.log({ ref })
  console.log({ dimensions })

  return [ref, dimensions] as [MapRef, Dimensions]
}
