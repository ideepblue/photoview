import * as React from 'react'

function SvgInfo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      {...props}
    >
      <path
        d="M18 33c8.284 0 15-6.716 15-15S26.284 3 18 3 3 9.716 3 18s6.716 15 15 15Z"
        stroke="#000"
        strokeWidth={3}
      />
      <path d="M18 16v10M18 10h.01" stroke="#000" strokeWidth={3} />
    </svg>
  )
}

export default SvgInfo
