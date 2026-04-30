export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Welcome to Corteca
      </h1>
      <p className="text-sm text-neutral-500">
        Sign in using the button in the top right to get started.
      </p>
    </main>
  );
}
