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
      "sale","offer","discount","coupon","limited time","exclusive","flash sale","deal","free gift",
      "bogo","clearance","cyber","promo code","bundle"
    ],
    Subscriptions: [
      "renewal","membership","subscription","saas","trial expired","new feature","release notes","version",
      "newsletter","digest","roundup","weekly update","product updates","changelog"
    ],
    Social: [
      "followed you","tagged you","commented","friend request","connection","likes","dm","notification",
      "mentioned you","channel","workspace","thread reply","reacted"
    ],
    Shopping: [
      "order","delivery","shipment","tracking","return","refund processed","cart","checkout","placed"
    ],
    Priority: [
      "urgent","action required","immediately","otp","2fa","unauthorized login","password reset","security breach"
    ],
    Spam: [
      "claim now","lottery","prize","guaranteed","free money","100% free","adult","viagra","click here",
      "wire transfer","forex","crypto giveaway","easy approval","risk free","double your","miracle"
    ],
  },

  // L2: Contextual phrase rules — multi-token phrases with higher signal
  KEYWORD_RULES_L2_PHRASES: {
    Work: ["out of office","meeting minutes","q1 goals","next steps on","please provide feedback","attached document"],
    Finance: ["credit card statement","current balance is","your statement date","kyc update","asset management"],
    Bills: ["payment for your last order","last day to pay","your invoice number","auto debit success","plan renews on","auto-charged to your card","invoice ready","billing cycle"],
    Travel: ["travel insurance document","e-ticket number","baggage policy","airport transfer","check-in opens"],
    Shopping: ["out for delivery","your order has shipped","track your package","view your receipt","click to review"],
    Priority: ["your account has been locked","change in terms of service","high priority request","suspicious activity"],
    Subscriptions: ["you are receiving this email","manage your preferences","update subscription settings","view this email in your browser"],
    Social: ["mentioned you in","posted in #","new message in","left a comment on your post"],
    Spam: ["act now before it expires","100% satisfaction guaranteed","make money fast","work from home opportunity"]
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
    Social: ["@linkedin.com", "@pinterest.com", "@redditmail.com", "@whatsapp.net", "@telegram.org", "@facebookmail.com", "@slack.com", "@slackmail.com", "@slackhq.com"],
  },

  // L4: Exclusion / spam / disguise rules
  EXCLUSION_RULES_L4: {
    Promotional_Disguise: [
      "congratulations you've won","limited time offer just for you","click here to redeem your prize",
      "free trial ends soon","you have been selected","money-back guarantee","act now before it's gone"
    ],
    Spam_Signals: [
      "excessive use of all caps","mismatched sender display name","bit.ly","tinyurl","goo.gl","image-only email",
      "shortened tracking link","text hidden below images","zero unsubscribe option"
    ],
    Cross_Category_Conflict: [
      "join my network","see who viewed your profile","download our free ebook","refer a friend and get 10%"
    ]
  },

  STRUCTURAL_SIGNALS: {
    NEWSLETTER_FOOTERS: [
      "unsubscribe","update your preferences","manage preferences","manage subscription","view this email in your browser",
      "update profile","email preferences","stop receiving these emails","sent with mailchimp","powered by sendgrid",
      "mailing address is","why did you get this","too many emails?"
    ],
    MARKETING_PLATFORM_MENTIONS: [
      "mailchimp","campaign monitor","constant contact","convertkit","mailerlite","substack","sendinblue",
      "marketo","braze","klaviyo","hubspot"
    ],
    LINK_SHORTENERS: ["bit.ly","tinyurl","goo.gl","ow.ly","buff.ly","t.co","is.gd","cutt.ly"],
    SUSPICIOUS_SENDER_TLDS: [".xyz",".top",".click",".loan",".mom",".club",".zip",".gq",".cf",".ml",".work"],
    NEWSLETTER_SUBJECT_HINTS: ["newsletter","digest","roundup","recap","daily update","weekly update","edition"],
    NO_REPLY_IDENTIFIERS: ["no-reply@","noreply@","do-not-reply","donotreply","bounce@"],
    EXCESSIVE_PUNCTUATION: ["!!!","???","***","$$$"],
    ATTENTION_PHRASES: ["act now","don't miss out","last chance","final notice","risk-free","incredible opportunity"],
    STEALTH_NEWSLETTER_HINTS: [
      "browser version","view plain text","sent to your workspace","member-only access","secure token inside",
      "in case you missed the drop","private preview","seat expires soon","remind you before access closes"
    ],
    BULK_SENDER_LOCALPARTS: ["updates","newsletter","team","hello","marketing","mailer","notices","news","alerts","hello"],
    TRACKING_PARAMS: ["utm_source","utm_campaign","utm_medium","utm_term","utm_content","mc_cid","mc_eid","trk","mkt_tok"],
    TEMPLATE_TOKENS: ["{{first_name}}","{{ subscriber.email }}","[[firstname]]","%FIRSTNAME%","<%user%>","##firstname##"],
    REDIRECT_DOMAINS: ["sendgrid","mailchimp.","trk.","click.","eml.","email.link","lnk.","links."],
    HIDDEN_PIXEL_HINTS: ["width=\"1\"","height=\"1\"","1x1","trackingpixel","pixel.gif","style=\"display:none","font-size:0px"],
    HTML_HEAVY_MARKERS: ["<table","<td","<tr","<center","mso-","<!--[if gte mso","@media screen"],
    STEALTH_CALL_TO_ACTIONS: ["reserve your seat","secure your spot","claim access","confirm attendance","lock in your place"],
    PROMO_STEALTH_HINTS: ["private preview","early access drop","secure link below","limited cohort","exclusive window","heads up before it opens","waitlist cleared"],
    BILLING_KEYWORDS: ["auto-charged","renewal date","invoice available","plan renews","billing period","charged to your card","transaction receipt"],
    SOCIAL_SYSTEM_HINTS: ["posted in #","channel","workspace","mentioned you"],
    THRESHOLDS: {
      LINK_HEAVY: 5,
      TABLE_HEAVY: 3
    }
  }
};

export default CATEGORIZATION_RULES;
