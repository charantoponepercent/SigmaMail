"use client";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();

  return (
    <nav className="bg-white shadow-sm border-b p-3 flex justify-between items-center">
      <h1
        className="text-lg font-semibold cursor-pointer"
        onClick={() => router.push("/")}
      >
        Universal Email Aggregator
      </h1>
      <div className="space-x-4">
        <button
          onClick={() => router.push("/login")}
          className="text-blue-600 hover:underline"
        >
          Login
        </button>
        <button
          onClick={() => router.push("/register")}
          className="text-blue-600 hover:underline"
        >
          Register
        </button>
      </div>
    </nav>
  );
}
