import Link from 'next/link';

export default function SiteNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-lg text-gray-600">Ce site n&apos;existe pas ou n&apos;est pas encore publie.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
