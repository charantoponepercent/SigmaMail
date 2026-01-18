import * as chrono from 'chrono-node'; 
// Make sure to: npm install chrono-node

// --- IMPORT THE FUNCTIONS ---
// (Paste the evaluateNeedsReply function from above here, 
//  and the evaluateDeadline function from my previous response here)
// For brevity, I will simulate the imports assuming you have the files.
import { evaluateDeadline } from './deadlines.js';
import { evaluateNeedsReply } from './needsReply.js';

// --- YOUR EXACT EMAIL DATA ---
const realEmail = {
  subject: "Re: Urgent: Q3 Design Assets & Final Invoice",
  // Note: I cleaned the newlines slightly to match how an API would deliver it
  text: `Hi Team, Thanks for the meeting on Jan 12th, it was very productive. 
  Two quick updates: 
  1. I've attached the assets in prev mail created since the start of the project. 
  2. The final invoice is due by EOD next Tuesday. Please ensure this is processed. 
  
  Also, regarding the new timeline: Can you confirm if the budget was approved? 
  We cannot proceed without that confirmation. Let me know your thoughts. 
  Best, Alex`,
  
  // CRITICAL FLAG:
  isIncoming: true, 
  date: new Date() // Simulating 'Now'
};

const threadState = {
  lastMessageFrom: "them" // They sent the last message, so I might need to reply
};

console.log("------------------------------------------------");
console.log("1. TESTING DEADLINE (Target: Next Tuesday)");
const deadlineResult = evaluateDeadline(realEmail);
console.log("Result:", deadlineResult.hasDeadline ? "✅ DEADLINE FOUND" : "❌ FAILED");
console.log("Date Found:", deadlineResult.deadlineAt);
console.log("Snippet:", deadlineResult.extractedSnippet);
console.log("Score:", deadlineResult.deadlineConfidence);

console.log("\n------------------------------------------------");
console.log("2. TESTING NEEDS REPLY (Target: True)");
const replyResult = evaluateNeedsReply(realEmail, threadState);
console.log("Result:", replyResult.needsReply ? "✅ NEEDS REPLY" : "❌ FAILED");
console.log("Score:", replyResult.needsReplyScore);
console.log("Reason:", replyResult.needsReplyReason);
console.log("------------------------------------------------");