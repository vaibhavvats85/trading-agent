export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-gray-700" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-spin" />
      </div>
      <h3 className="text-xl font-semibold text-gray-300 mb-2">
        Loading Portfolio...
      </h3>
      <p className="text-gray-400">
        Fetching holdings, positions, and market data
      </p>
    </div>
  );
}
