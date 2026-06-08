/** Global site footer — minimal brand mark only. */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center">
        <div className="flex items-center gap-2">
          <img
            src="/logo_Aryabhattaapp.png"
            alt="Aryabhata Workspace"
            className="h-10 w-10 rounded"
          />
          <p className="text-base font-semibold text-gray-800">Aryabhata Workspace</p>
        </div>
        <p className="text-xs text-gray-400">Systematic literature review, organized.</p>
      </div>
    </footer>
  );
}
