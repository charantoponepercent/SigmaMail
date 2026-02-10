import { evaluateActions } from "./index.js";

const now = Date.now();
const seventyTwoHours = 72 * 60 * 60 * 1000;

const inboundDeadlineEmail = {
  id: "msg-deadline-1",
  subject: "Data room access window closes COB Wednesday",
  text: `Hi Liam,
The diligence partners opened the data room today, but they'll revoke access at close of business on Wednesday.
Please upload the revised cash-flow workbook before they lock it down; otherwise we miss the committee readout.
Let me know if Box permissions give you trouble.`,
  isIncoming: true,
  timestamp: now,
};

const deadlineThread = {
  messages: [
    {
      id: "msg-out-earlier",
      subject: "Re: Data room access window closes COB Wednesday",
      text: "Thanks for the heads up—I'll verify the workbook once finance signs off.",
      isIncoming: false,
      timestamp: now - (24 * 60 * 60 * 1000),
    },
  ],
  lastMessageFrom: "them",
  lastMessageAt: now,
};

const followUpEmail = {
  id: "msg-out-followup",
  subject: "Re: Status of Sapphire refund approvals",
  text: `Hi Dana,
Circling back on the Sapphire refunds—did finance push the batch through yet?
Once you hear from Treasury, could you send a quick note so we know when to notify customers?
We can't close the incident report until you confirm.`,
  isIncoming: false,
  timestamp: now - seventyTwoHours,
};

const followUpThread = {
  messages: [
    {
      id: "msg-in-older",
      subject: "Status of Sapphire refund approvals",
      text: "Thanks, we'll sync with Treasury and get back to you.",
      isIncoming: true,
      timestamp: now - (5 * 24 * 60 * 60 * 1000),
    },
    followUpEmail,
  ],
  lastMessageFrom: "me",
  lastMessageAt: followUpEmail.timestamp,
};

function runScenario(label, email, thread) {
  // console.log(`\n=== ${label} ===`);
  // console.log(evaluateActions(email, thread));
}

runScenario("Deadline detection", inboundDeadlineEmail, deadlineThread);
runScenario("Follow-up detection", followUpEmail, followUpThread);
