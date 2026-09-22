import type { SVGProps } from 'react'

type IronIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string
  strokeWidth?: number | string
}

// A clothes iron — not part of lucide-react (the icon set already used
// site-wide, see FeatureStrip.tsx), so drawn by hand to match its exact
// conventions: 24x24 viewBox, no fill, currentColor stroke, round caps/
// joins. Props mirror a lucide icon's own (size/strokeWidth/className),
// so it drops into the same amenity-icon list as any lucide import with
// no special-casing.
export default function IronIcon({ size = 24, strokeWidth = 2, ...props }: IronIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 6V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v1" />
      <path d="M4.5 8.5C4.5 7.12 5.62 6 7 6h8.5a4.5 4.5 0 0 1 4.5 4.5c0 3.3-2.3 8-5.5 8H8a3.5 3.5 0 0 1-3.5-3.5Z" />
      <path d="M8 18.5V20" />
      <path d="M13 18.5V20" />
    </svg>
  )
}
