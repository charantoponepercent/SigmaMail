// app/dashboard/utils/mailUtils.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

export function formatDate(dateString?: string): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const options: Intl.DateTimeFormatOptions = isToday
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" };
    return date.toLocaleString("en-US", options);
  }
  
  export function cleanSubject(subject?: string): string {
    if (!subject || typeof subject !== "string") return "(No Subject)";
  
    let text = subject.trim();
  
    // Remove all quotes
    text = text.replace(/["'`“”‘’]/g, "");
  
    // Remove emojis + weird symbols EXCEPT allowed characters
    text = text.replace(/[^\p{L}\p{N}\s\-'.(),!?&:]/gu, "");
  
    // Collapse multiple spaces
    text = text.replace(/\s+/g, " ");
  
    return text.trim() || "(No Subject)";
  }
  
  export function getAvatarInitial(fromField?: string): string {
    if (!fromField || typeof fromField !== "string") return "M";
  
    // Extract name before <email>
    let name = fromField.split("<")[0].trim();
  
    // Remove quotes
    name = name.replace(/["']/g, "");
  
    // Find first alphabetical character
    const match = name.match(/[A-Za-z]/);
    if (match) return match[0].toUpperCase();
  
    // Fallback to email local-part
    const emailMatch = fromField.match(/^([^@]+)/);
    if (emailMatch && emailMatch[1]) {
      const emailInitial = emailMatch[1].match(/[A-Za-z]/);
      if (emailInitial) return emailInitial[0].toUpperCase();
    }
  
    return "M";
  }