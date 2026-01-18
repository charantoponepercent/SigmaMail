/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Inbox,
  RefreshCw,
  Plus,
  Settings,
  LogOut,
  EllipsisVertical,
  BookOpen,
  AlertCircle,
  Clock,
  Reply,
} from "lucide-react";

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import Link from "next/link";

type Props = {
  isSyncing: boolean;
  accounts: any[];
  selectedAccount: string | null;
  setSelectedAccount: (s: string | null) => void;
  handleSyncClick: () => void;
  connectNewGmail: () => void;
  logout: () => void;
  setShowDialog: (v: boolean) => void;
  setAccountToDisconnect: (email: string | null) => void;
  onShowDigest?: () => void;
};

export default function Sidebar({
  isSyncing,
  accounts,
  selectedAccount,
  setSelectedAccount,
  handleSyncClick,
  connectNewGmail,
  logout,
  setShowDialog,
  setAccountToDisconnect,
  onShowDigest,
}: Props) {
  return (
    <aside className="w-[220px] ml-2 mt-2 mb-2 flex flex-col flex-shrink-0 overflow-hidden">
      {/* TOP LOGO */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            S
          </div>
          <h1 className="text-lg font-bold tracking-tight text-gray-800">
            <Link href="/">SIGMAMAIL</Link>
          </h1>

          <button
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="px-2 py-1 rounded-md border bg-white hover:bg-gray-100 flex items-center gap-1"
          >
            {isSyncing ? (
              <span className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></span>
            ) : (
              <RefreshCw className="h-4 w-4 text-gray-700" />
            )}
          </button>
        </div>
      </div>

      {/* INBOX SECTION */}
      <div className="px-4 mt-6 mb-2">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          Inbox
        </h3>

        <div
          onClick={() => {
            setSelectedAccount("ALL");
          }}
          className={`mt-3 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg border transition-all 
            ${
              selectedAccount === "ALL"
                ? "bg-gray-200 border-gray-100 text-black"
                : "border-transparent hover:bg-gray-100 text-gray-600"
            }`}
        >
          <Inbox className="w-4 h-4" />
          <span className="text-[13.5px] font-medium">All Inbox</span>
        </div>
      </div>
      {/* TODAY'S DECISIONS */}
      <div className="px-4 mt-6 mb-2">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          Today’s Decisions
        </h3>

        {/* Needs Reply */}
        <div
          onClick={() => setSelectedAccount("__NEEDS_REPLY__")}
          className={`mt-3 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg border transition-all
            ${
              selectedAccount === "__NEEDS_REPLY__"
                ? "bg-gray-200 border-gray-100 text-black"
                : "border-transparent hover:bg-gray-100 text-gray-600"
            }`}
        >
          <Reply className="w-4 h-4" />
          <span className="text-[13.5px] font-medium">Needs Reply</span>
        </div>

        {/* Deadlines Today */}
        <div
          onClick={() => setSelectedAccount("__DEADLINES_TODAY__")}
          className={`mt-1 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg border transition-all
            ${
              selectedAccount === "__DEADLINES_TODAY__"
                ? "bg-gray-200 border-gray-100 text-black"
                : "border-transparent hover:bg-gray-100 text-gray-600"
            }`}
        >
          <Clock className="w-4 h-4" />
          <span className="text-[13.5px] font-medium">Deadlines Today</span>
        </div>

        {/* Overdue Follow-Ups */}
        <div
          onClick={() => setSelectedAccount("__OVERDUE_FOLLOWUPS__")}
          className={`mt-1 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg border transition-all
            ${
              selectedAccount === "__OVERDUE_FOLLOWUPS__"
                ? "bg-gray-200 border-gray-100 text-black"
                : "border-transparent hover:bg-gray-100 text-gray-600"
            }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span className="text-[13.5px] font-medium">Overdue Follow‑ups</span>
        </div>
      </div>
      {/* AI SECTION */}
      <div className="px-4 mt-6 mb-2">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          AI Tools
        </h3>

        <div
          onClick={() => onShowDigest && onShowDigest()}
          className={`mt-3 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg border transition-all 
            hover:bg-gray-100 text-gray-700`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[13.5px] font-medium">AI Daily Digest</span>
        </div>
      </div>
      {/* SPACER */}
      <div className="flex-1" />

      {/* CONNECT ACCOUNT BUTTON */}
      <button
        onClick={connectNewGmail}
        className="w-[200px] ml-2 flex items-center justify-center gap-2 py-2 mb-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Connect Mail <Plus className="w-4 h-4" />
      </button>

      {/* CONNECTED ACCOUNTS */}
      <div className="px-4 pb-4">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase mb-2 tracking-widest px-1">
          Connected Accounts
        </h2>

        <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
          {accounts.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1">No accounts connected</p>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc._id}
                className={`group flex items-center justify-between px-2 py-2 rounded-lg transition-all ${
                  selectedAccount === acc.email
                    ? "bg-white shadow text-gray-900 border border-gray-200"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
              >
                {/* Account Label */}
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-6 h-5 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-gray-600 text-[10px] font-bold uppercase">
                    {acc.email[0]}
                  </div>
                  <span className="truncate text-[13px] font-medium">{acc.email}</span>
                </div>

                {/* Options Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200"
                    >
                      <EllipsisVertical className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="min-w-[140px] bg-white shadow-lg rounded-md p-1">
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountToDisconnect(acc.email);
                        setShowDialog(true);
                      }}
                      className="text-[13px] text-red-600 font-medium cursor-pointer hover:bg-red-50"
                    >
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>

        {/* SETTINGS + LOGOUT */}
        <div className="border-t border-gray-200 pt-3 space-y-1 mt-4">
          <button className="w-full flex items-center justify-between hover:bg-gray-100 px-2 py-2 rounded-md text-gray-600">
            <span className="text-[13px] font-medium">Settings</span>
            <Settings className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-between hover:bg-red-50 px-2 py-2 rounded-md text-red-600"
          >
            <span className="text-[13px] font-medium">Logout</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}