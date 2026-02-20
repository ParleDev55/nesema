export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-nesema-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <p className="font-serif text-4xl text-nesema-bark mb-2">Nesema</p>
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-10 mt-8 shadow-sm">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: "#F9F1E6" }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C27D30"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-nesema-t1 mb-3">
            We&apos;re doing some maintenance
          </h1>
          <p className="text-sm text-nesema-t2 leading-relaxed mb-2">
            Nesema is currently undergoing scheduled maintenance.
            We&apos;ll be back shortly.
          </p>
          <p className="text-sm text-nesema-t3">
            If you need urgent assistance, contact{" "}
            <a
              href="mailto:support@nesema.com"
              className="text-nesema-sage hover:underline"
            >
              support@nesema.com
            </a>
          </p>
        </div>
        <p className="mt-6 text-xs text-nesema-t3">Health, felt whole.</p>
      </div>
    </div>
  );
}
