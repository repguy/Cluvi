export default function Preview() {
  const params = new URLSearchParams(window.location.search);
  const botId = params.get("botId");
  const origin = window.location.origin;

  if (!botId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        No botId provided
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Live Preview</h1>
        <p className="text-gray-500">This is how your bot looks on a client's website. Try it out!</p>
      </div>
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-400 text-sm mb-2">Your bot will appear as a floating button in the bottom-right corner.</p>
        <p className="text-xs text-gray-300 font-mono break-all">{origin}/api/widget.js?botId={botId}</p>
      </div>
      <script
        dangerouslySetInnerHTML={{ __html: `
          (function() {
            var s = document.createElement('script');
            s.src = '/api/widget.js?botId=${botId}';
            document.body.appendChild(s);
          })();
        ` }}
      />
    </div>
  );
}
