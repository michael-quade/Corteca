import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">Page not found</h1>
      <p className="max-w-md text-sm text-neutral-500">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-1 rounded-md border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
      >
        Back to Dashboard
      </Link>
    </main>
  );
}
