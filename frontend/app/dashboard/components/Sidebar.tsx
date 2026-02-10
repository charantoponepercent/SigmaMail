/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import {
  Inbox,
  RefreshCw,
  BookOpen,
  Sparkles,
  FileText,
  AlertCircle,
  Clock,
  Reply,
  ChevronsUpDown,
  LogOut,
  Trash2,
  User2,
  PlusIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  onShowOrchestrator?: () => void;
  onShowThreadSummary?: () => void;
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
  onShowOrchestrator,
  onShowThreadSummary,
}: Props) {
  
  return (
    <aside className="w-[220px] ml-2 mt-2 mb-2 flex flex-col flex-shrink-0 overflow-hidden h-[calc(100vh-16px)]">
      {/* ========================================================= */}
      {/* EXISTING UI (UNCHANGED)                                   */}
      {/* ========================================================= */}
      
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
              <RefreshCw className="h-4 w-4 text-blue-600" />
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
          <Inbox className="w-4 h-4 text-gray-500" />
          <span className="text-[13.5px] font-medium">All Inbox</span>
        </div>
      </div>

      {/* TODAY'S DECISIONS */}
      <div className="px-4 mt-6 mb-2">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          Today’s Decisions
        </h3>

        <div
          onClick={() => setSelectedAccount("__NEEDS_REPLY__")}
          className={`mt-3 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg border transition-all
            ${
              selectedAccount === "__NEEDS_REPLY__"
                ? "bg-gray-200 border-gray-100 text-black"
                : "border-transparent hover:bg-gray-100 text-gray-600"
            }`}
        >
          <Reply className="w-4 h-4 text-blue-600" />
          <span className="text-[13.5px] font-medium">Needs Reply Today</span>
        </div>

        <div
          onClick={() => setSelectedAccount("__DEADLINES_TODAY__")}
          className={`mt-1 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg border transition-all
            ${
              selectedAccount === "__DEADLINES_TODAY__"
                ? "bg-gray-200 border-gray-100 text-black"
                : "border-transparent hover:bg-gray-100 text-gray-600"
            }`}
        >
          <Clock className="w-4 h-4 text-amber-600" />
          <span className="text-[13.5px] font-medium">Deadline Tagged Today</span>
        </div>

        <div
          onClick={() => setSelectedAccount("__OVERDUE_FOLLOWUPS__")}
          className={`mt-1 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg border transition-all
            ${
              selectedAccount === "__OVERDUE_FOLLOWUPS__"
                ? "bg-gray-200 border-gray-100 text-black"
                : "border-transparent hover:bg-gray-100 text-gray-600"
            }`}
        >
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-[13.5px] font-medium">Follow-ups Tagged Today</span>
        </div>
      </div>

      {/* AI SECTION */}
      <div className="px-4 mt-6 mb-2">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          AI Tools
        </h3>

        <div
          onClick={() => onShowOrchestrator && onShowOrchestrator()}
          className="mt-3 flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-gray-700 transition-all hover:bg-gray-100 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-[13.5px] font-medium">AI Orchestrator</span>
        </div>

        <div
          onClick={() => onShowDigest && onShowDigest()}
          className="mt-1 flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-gray-700 transition-all hover:bg-gray-100 cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-purple-600" />
          <span className="text-[13.5px] font-medium">AI Daily Digest</span>
        </div>

        <div
          onClick={() => onShowThreadSummary && onShowThreadSummary()}
          className="mt-1 flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-gray-700 transition-all hover:bg-gray-100 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-cyan-600" />
          <span className="text-[13.5px] font-medium">AI Thread Summary</span>
        </div>
      </div>

      {/* SPACER */}
      <div className="flex-1" />
      <div className="flex justify-center">
      <button
        onClick={connectNewGmail}
        className="
          w-[200px]
          flex items-center justify-center gap-2
          rounded-lg
          bg-blue-500
          px-3 py-2.5
          text-white
          text-[13px] font-medium
          hover:bg-blue-600
          transition
          cursor-pointer
        "
      >
        <PlusIcon className="h-4 w-4"/>
        <span>Connect Mail</span>
      </button>
    </div>


      {/* ========================================================= */}
      {/* UPDATED FOOTER                                            */}
      {/* ========================================================= */}
      
      <div className="p-3 border-t border-gray-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-between w-full px-3 py-2.5 cursor-pointer rounded-xl 
              bg-gray-50 hover:bg-gray-100 transition-all outline-none group border border-gray-200">
              
              <div className="flex items-center gap-2 leading-tight">
              <User2 className="w-4 h-4 text-gray-500" />
              <span className="text-[13.5px] font-semibold text-gray-800">
                Connected Accounts
              </span>
            </div>
              <ChevronsUpDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="right" className="w-[260px] ml-2 p-2 bg-white border-gray-100 shadow-xl rounded-xl">
            
            {/* Header */}
            <DropdownMenuLabel className="px-3 pt-2 pb-3">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                Connected Accounts
              </div>

            </DropdownMenuLabel>
            
            {/* Accounts List - Each has an inline Disconnect button */}
            <div className="flex flex-col gap-1">
              {accounts.map((acc) => (
                <DropdownMenuItem
                  key={acc._id}
                  onClick={() => setSelectedAccount(acc.email)}
                  className={`group flex items-center justify-between cursor-pointer rounded-lg px-2 py-1.5 transition-colors ${
                    selectedAccount === acc.email ? "bg-blue-50/50" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Left: Account Info */}
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                       selectedAccount === acc.email ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>
                      {acc.email[0].toUpperCase()}
                    </div>
                    <span className={`text-[13px] truncate max-w-[140px] ${selectedAccount === acc.email ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                      {acc.email}
                    </span>
                  </div>

                  {/* Right: Disconnect Button (Only visible on hover or if active) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent switching when clicking delete
                      setAccountToDisconnect(acc.email);
                      setShowDialog(true);
                    }}
                    className="cursor-pointer opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-100 transition-all"
                    title="Disconnect this account"
                  >
                    <Trash2 className="w-3.5 h-3.5 " />
                  </button>
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator className="bg-gray-100 my-3" />

            <DropdownMenuItem 
              onClick={logout}
              className="cursor-pointer flex items-center gap-2.5 text-gray-600 rounded-lg px-2 py-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-[13px] font-medium">Log out</span>
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
