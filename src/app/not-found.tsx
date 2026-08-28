import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center md:px-12">
      <p className="text-xs tracking-widest text-brass uppercase">
        Page not found
      </p>
      <h1 className="mt-3 font-display text-4xl text-charcoal md:text-5xl">
        This page has wandered off.
      </h1>
      <p className="mt-4 text-charcoal/70">
        We couldn&apos;t find the page you were looking for. It may have been
        moved, renamed, or no longer exists.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-sm bg-verdant px-8 py-4 text-sm tracking-widest text-ivory uppercase transition-colors hover:bg-verdant/90"
      >
        Back to homepage
      </Link>
    </main>
  )
}
