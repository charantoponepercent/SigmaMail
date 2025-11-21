export default function ThreadSkeleton() {
    return (
      <div className="space-y-8 p-10 animate-pulse">
        {/* Title */}
        <div className="h-7 w-1/2 bg-gray-200 rounded-xl"></div>
  
        {/* Divider */}
        <div className="border-b border-gray-300"></div>
  
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 shadow-sm"
          >
            {/* Avatar */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gray-300"></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer"></div>
            </div>
  
            {/* Message Skeleton */}
            <div className="flex-1 space-y-3">
              <div className="h-4 w-1/4 bg-gray-300 rounded-md"></div>
  
              <div className="space-y-2">
                <div className="h-3 w-full bg-gray-200 rounded-md"></div>
                <div className="h-3 w-5/6 bg-gray-200 rounded-md"></div>
                <div className="h-3 w-4/6 bg-gray-200 rounded-md"></div>
              </div>
            </div>
          </div>
        ))}
  
        {/* Shimmer animation */}
        <style>{`
          .animate-shimmer {
            animation: shimmer 2s infinite linear;
          }
  
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }
  