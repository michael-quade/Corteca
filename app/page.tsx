"use client";

import { useState } from "react";
import { Button } from "@/web/components/ui/Button";
import { ConfirmModal } from "@/web/components/modals/ConfirmModal";

export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-neutral-900">Corteca</h1>
        <p className="mt-2 text-neutral-500">Your project is ready. Start building.</p>
      </div>

      <Button onClick={() => setModalOpen(true)}>Open Confirm Modal</Button>

      <ConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={() => console.log("Confirmed")}
        title="Confirm Action"
        description="This is an example confirm modal. You can reuse this component anywhere in the app."
      />
    </main>
  );
}
