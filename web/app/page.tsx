export default function Home() {
  return (
    <main className="page-container">
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold text-amber-500 mb-4">Lesezeichnen</h1>
        <p className="text-gray-400 text-lg mb-8">
          Your personal reading archive with hand-drawn bookmarks
        </p>
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p className="text-gray-500">
            Use the <code className="bg-gray-800 px-2 py-1 rounded">/bookmarks</code> skill to create and view your collection.
          </p>
        </div>
      </div>
    </main>
  );
}
