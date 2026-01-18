/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
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
  const [showAccounts, setShowAccounts] = React.useState(false);
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
          Connected Account
        </h2>

        {/* Active Account Card */}
        {accounts.length > 0 && (
          <div
            onClick={() => setShowAccounts((v) => !v)}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl border bg-white hover:bg-gray-50 cursor-pointer transition"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[11px] font-bold uppercase shadow-sm">
                {accounts.find((a) => a.email === selectedAccount)?.email?.[0] ||
                  accounts[0].email[0]}
              </div>
              <div className="truncate">
                <p className="text-[13px] font-medium truncate">
                  {selectedAccount || accounts[0].email}
                </p>
                <p className="text-[11px] text-gray-400">
                  {accounts.length} account{accounts.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <EllipsisVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* Account Switcher Panel */}
        {showAccounts && (
          <div className="mt-2 rounded-xl border bg-white shadow-lg max-h-[220px] overflow-y-auto custom-scrollbar">
            {accounts.map((acc) => (
              <div
                key={acc._id}
                onClick={() => {
                  setSelectedAccount(acc.email);
                  setShowAccounts(false);
                }}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition
                  ${
                    selectedAccount === acc.email
                      ? "bg-blue-50 text-blue-900"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
              >
                <span className="text-[13px] truncate">{acc.email}</span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAccountToDisconnect(acc.email);
                    setShowDialog(true);
                  }}
                  className="text-[11px] text-red-500 hover:text-red-600"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Settings + Logout */}
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