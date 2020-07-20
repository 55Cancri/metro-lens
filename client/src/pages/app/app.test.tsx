import React from "react"
import { render } from "@testing-library/react"
import { App } from "."

test("renders loading message", () => {
  const { getByText } = render(<App />)
  const h1Element = getByText(/Metro lens/i)
  expect(h1Element).toBeInTheDocument()
})
