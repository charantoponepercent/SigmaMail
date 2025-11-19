export default function extractQuotedSections(html: string) {
    if (!html) return { clean: "", quotes: [] as string[] };
  
    let working = html;
    const quotes: string[] = [];
  
    // 1) Gmail quoted wrapper
    const gmailQuoteRegex =
      /<div[^>]*class=["'][^"'>]*gmail_quote[^"'>]*["'][^>]*>[\s\S]*?<\/div>/gi;
  
    working = working.replace(gmailQuoteRegex, (match) => {
      quotes.push(match);
      return "";
    });
  
    // 2) Extract blockquotes (Outlook, replies)
    const blockquoteRegex = /<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi;
  
    working = working.replace(blockquoteRegex, (match) => {
      quotes.push(match);
      return "";
    });
  
    // 3) Detect “On DATE, X wrote:” forwarded blocks
    const onWroteRegex = /On\s.+?wrote:([\s\S]*)/gi;
  
    working = working.replace(onWroteRegex, (match, capture) => {
      quotes.push(capture || match);
      return "";
    });
  
    // 4) Remove >
    working = working.replace(/(^|\n)[ \t]*>[^\n]*/g, "");
  
    return {
      clean: working.trim(),
      quotes,
    };
  }