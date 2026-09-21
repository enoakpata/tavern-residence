import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

// The site's only two button treatments, per the quiet-luxury design
// system — primary (brass fill) and secondary (outline/ghost). Anything
// needing a button-like control should use one of these rather than a
// new one-off className combination.
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-xs tracking-[0.2em] uppercase transition-colors duration-base'

const VARIANT_CLASSES = {
  primary: 'bg-brass text-ivory hover:bg-brass/90',
  // border-current + text-inherit: reads correctly whether it's placed on
  // an ivory section (charcoal text/border) or a dark one (ivory
  // text/border), without a separate prop for that.
  secondary: 'border border-current bg-transparent hover:bg-current/10',
} as const

type Variant = keyof typeof VARIANT_CLASSES

type CommonProps = {
  variant?: Variant
  className?: string
  children: ReactNode
}

type LinkButtonProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & {
    href: string
  }

type ElementButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    href?: undefined
  }

export type ButtonProps = LinkButtonProps | ElementButtonProps

export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = `${BASE} ${VARIANT_CLASSES[variant]} ${className}`

  if (rest.href !== undefined) {
    const { href, ...anchorProps } = rest as Omit<LinkButtonProps, keyof CommonProps>
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    )
  }

  const { type = 'button', ...buttonProps } = rest as Omit<
    ElementButtonProps,
    keyof CommonProps
  >
  return (
    <button type={type} className={classes} {...buttonProps}>
      {children}
    </button>
  )
}
