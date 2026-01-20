// backend/classification/categorizationRules.js
export const CATEGORIZATION_RULES = {
  CATEGORY_LIST: [
    "Work",
    "Finance",
    "Bills",
    "Personal",
    "Travel",
    "Promotions",
    "Subscriptions",
    "Social",
    "Shopping",
    "Priority",
    "Spam",
    "General",
  ],

  // L1: High-Signal Keywords (single tokens / short tokens)
  KEYWORD_RULES_L1: {
    Work: [
      "jira","confluence","sla","okr","fyi","agenda","sprint","roadmap","client","deliverable",
      "syncup","hr","payroll","project","task","report","review","meeting","deadline"
    ],
    Finance: [
      "statement","credit","debit","balance","loan","tax","portfolio","deposit","withdrawal",
      "mutual fund","nps","fd","upi","transaction","account","security alert","refund"
    ],
    Bills: [
      "invoice","due","utility","ebill","electricity","water bill","phone bill","renewal",
      "autodebit","payment reminder","paid successfully","bill"
    ],
    Personal: [
      "wedding","birthday","photos","family","friends","get together","checking in","catch up",
      "how are you","miss you"
    ],
    Travel: [
      "flight","booking","pnr","boarding pass","itinerary","visa","ticket","hotel","cancellation",
      "check-in","gate","e-ticket","train","boarding"
    ],
    Promotions: [
      "sale","offer","discount","coupon","limited time","exclusive","flash sale","deal","free gift"
    ],
    Subscriptions: [
      "renewal","membership","subscription","saas","trial expired","new feature","release notes","version"
    ],
    Social: [
      "followed you","tagged you","commented","friend request","connection","likes","dm","notification"
    ],
    Shopping: [
      "order","delivery","shipment","tracking","return","refund processed","cart","checkout","placed"
    ],
    Priority: [
      "urgent","action required","immediately","otp","2fa","unauthorized login","password reset","security breach"
    ],
    Spam: [
      "claim now","lottery","prize","guaranteed","free money","100% free","adult","viagra","click here"
    ],
  },

  // L2: Contextual phrase rules — multi-token phrases with higher signal
  KEYWORD_RULES_L2_PHRASES: {
    Work: ["out of office","meeting minutes","q1 goals","next steps on","please provide feedback","attached document"],
    Finance: ["credit card statement","current balance is","your statement date","kyc update","asset management"],
    Bills: ["payment for your last order","last day to pay","your invoice number","auto debit success"],
    Travel: ["travel insurance document","e-ticket number","baggage policy","airport transfer","check-in opens"],
    Shopping: ["out for delivery","your order has shipped","track your package","view your receipt","click to review"],
    Priority: ["your account has been locked","change in terms of service","high priority request","suspicious activity"],
  },

  // L3: Sender/Domain rules (high-confidence)
  SENDER_RULES: {
    Work: ["@corp.com", "@enterprise.net", "@mycompany.io", "@slack.com", "@microsoft.com", "@salesforce.com"],
    Finance: ["@rbi.org.in", "@sebi.gov.in", "@zerodha.com", "@etmoney.com", "@cred.com", "@upstox.com", "@hdfcbank.com", "@sbi.co.in"],
    Bills: ["@jio.com", "@airtel.in", "@bsnl.co.in", "@paytm.com", "@google.com", "@utilityprovider.com", "@zomato.com", "@swiggy.in"],
    Travel: ["@booking.com", "@expedia.com", "@makemytrip.com", "@goibibo.com", "@redbus.in", "@airbnb.com", "@uber.com", "@ola.com"],
    Social: ["@linkedin.com", "@pinterest.com", "@redditmail.com", "@whatsapp.net", "@telegram.org", "@facebookmail.com"],
    Promotions: ["@newsletter.com", "@promo.net", "@deals.in", "@marketing.co", "@ads.com", "@offers.com"],
    Subscriptions: ["@spotify.com", "@netflix.com", "@hotstar.com", "@zoom.us", "@canva.com", "@substack.com", "@adobe.com"],
    Shopping: ["@amazon.in", "@flipkart.com", "@myntra.com", "@bigbasket.com", "@zara.com", "@ajio.com", "@nykaa.com"],
  },

  // L4: Exclusion / spam / disguise rules
  EXCLUSION_RULES_L4: {
    Promotional_Disguise: [
      "congratulations you've won","limited time offer just for you","click here to redeem your prize",
      "free trial ends soon","you have been selected","money-back guarantee","act now before it's gone"
    ],
    Spam_Signals: [
      "excessive use of all caps","mismatched sender display name","bit.ly","tinyurl","goo.gl","image-only email"
    ],
    Cross_Category_Conflict: [
      "join my network","see who viewed your profile","download our free ebook","refer a friend and get 10%"
    ]
  }
};

export default CATEGORIZATION_RULES;