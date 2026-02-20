import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-nesema-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <p className="font-serif text-4xl text-nesema-bark mb-2">Nesema</p>
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-10 mt-8 shadow-sm">
          <p className="font-serif text-6xl text-nesema-sage mb-4">404</p>
          <h1 className="text-xl font-semibold text-nesema-t1 mb-2">Page not found</h1>
          <p className="text-sm text-nesema-t2 mb-8 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-2.5 bg-nesema-sage text-white text-sm font-medium rounded-full hover:bg-nesema-sage-l transition-colors"
          >
            Go home
          </Link>
        </div>
        <p className="mt-6 text-xs text-nesema-t3">Health, felt whole.</p>
      </div>
    </div>
  );
}
