"use client";

import ThreadViewer from "@/components/ThreadViewer";
import ThreadSkeleton from "@/app/dashboard/ThreadSkeleton";

type Props = {
  loadingThread: boolean;
  selectedMessage: any;
  selectedThreadId: string | null;
  goPrevThread: () => void;
  goNextThread: () => void;
  onClose: () => void;
};

export default function ThreadPanel({
  loadingThread,
  selectedMessage,
  selectedThreadId,
  goPrevThread,
  goNextThread,
  onClose,
}: Props) {
  return (
    <section
      className={`bg-white mt-1 mb-3 rounded-xl border border-gray-100 overflow-hidden transition-all duration-300 ease-in-out w-[880px]`}
    >
      <div className="h-full overflow-y-auto">
        {loadingThread ? (
          <ThreadSkeleton />
        ) : selectedMessage ? (
          <ThreadViewer
            thread={selectedMessage}
            onClose={onClose}
            onPrev={goPrevThread}
            onNext={goNextThread}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6">
            {/* Your existing empty-state illustration */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 200 200"
              className="w-40 h-40 text-blue-600"
            >
              <circle cx="100" cy="100" r="80" fill="#f8f9fa" />
              <ellipse cx="100" cy="145" rx="40" ry="10" fill="#e9ecef" />
              <rect
                x="65"
                y="55"
                width="70"
                height="90"
                rx="10"
                fill="#f1f3f5"
                transform="rotate(-6 100 100)"
              />
              <rect
                x="60"
                y="50"
                width="80"
                height="100"
                rx="12"
                fill="white"
                stroke="#dcdde1"
                strokeWidth="1.5"
                transform="rotate(6 100 100)"
              />
              <path
                d="M75 70h30v20l-15 10-15-10z"
                fill="none"
                stroke="#adb5bd"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="75" y="100" width="50" height="6" rx="3" fill="#e9ecef" />
              <rect x="75" y="112" width="40" height="6" rx="3" fill="#e9ecef" />
              <rect x="75" y="124" width="30" height="6" rx="3" fill="#e9ecef" />
            </svg>
            <div className="text-xl font-semibold mb-2">It&apos;s empty here</div>
            <div className="text-sm">Choose an email to view details</div>
          </div>
        )}
      </div>
    </section>
  );
}