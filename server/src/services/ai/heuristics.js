/**
 * Rule-based fallback: deterministic extraction and template replies used when
 * no live AI is configured or the provider fails. Always labelled "heuristic".
 */
import { normalizePhone, validPhone } from "../../domain/lead.js";

export function detectLanguage(text = "") {
  if (/[\u0980-\u09FF]/.test(text)) return "Bangla";
  if (
    /\b(vai|bhai|apnader|apnar|koto|kobe|kibhabe|hobe|korle|pabo|kothay|shuru|borti|parbo|achi|janiye|bolen|dite|taka|bikashe|amader|amar|naam|ei|gula|naki|jonno|korte|lagbe|korbo)\b/i.test(
      text,
    )
  )
    return "Banglish";
  return "English";
}

export function extractPhone(text = "", fallbackPhone = "") {
  if (fallbackPhone && validPhone(fallbackPhone))
    return normalizePhone(fallbackPhone);
  const normalized = text.replace(/[০-৯]/g, (c) =>
    String("০১২৩৪৫৬৭৮৯".indexOf(c)),
  );
  const match = normalized.match(/(?:\+?880|0)?(1[3-9]\d{8})\b/);
  return match ? "0" + match[1] : normalizePhone(fallbackPhone || "");
}

export function extractName(text = "", fallbackName = "") {
  if (fallbackName && fallbackName !== "Unknown") return fallbackName.trim();
  const banglaMatch = text.match(/(?:আমার নাম|আমি)\s+([^\n,\.?!]+)/i);
  if (banglaMatch && banglaMatch[1].trim().length < 50)
    return banglaMatch[1].trim();
  const engMatch = text.match(
    /(?:my name is|i am|ami|amar naam)\s+([a-zA-Z\s]+)/i,
  );
  if (engMatch && engMatch[1].trim().length < 50) return engMatch[1].trim();
  const signMatch = text.match(/\n[-—~]\s*([a-zA-Z\u0980-\u09FF\s]+)$/);
  if (signMatch && signMatch[1].trim().length < 50) return signMatch[1].trim();
  return "Unknown";
}

export function detectProgram(text = "") {
  if (/bootcamp|বুটক্যাম্প|3.?day/i.test(text)) return "Bootcamp";
  if (/fellowship|ফেলোশিপ/i.test(text)) return "Fellowship";
  if (
    /corporate|training for our team|textile company|bank.*training|group discount|employees|কর্মীদের|company/i.test(
      text,
    )
  )
    return "Corporate training";
  return "Unspecified";
}

export function detectRoute(text = "") {
  if (/crypto|earn.*usd|bitcoin|casino|loan.*offer|bit\.ly/i.test(text))
    return "Spam";
  if (/job|cv|intern|vacancy|resume|apply|recruitment|ক্যারিয়ার|চাকরি/i.test(text))
    return "Careers";
  if (
    /cancell?ation|cancel|money back|refund|upset|payment.*not|পেমেন্ট করেছি.*কনফার্মেশন পাইনি|বিকাশে দিয়েছি/i.test(
      text,
    )
  )
    return "Support";
  return "Sales";
}

export function generateHeuristicReply(
  message,
  language,
  program,
  route,
  name,
  phone,
) {
  if (route === "Spam") return "";
  if (route === "Careers") {
    if (language === "Bangla")
      return "ধন্যবাদ আপনার আগ্রহের জন্য। আমাদের বর্তমান ওপেনিংস সম্পর্কে জানতে recruitment@biai.com.bd এ যোগাযোগ করুন। আমাদের টিম আপনার আবেদন যাচাই করবে।";
    if (language === "Banglish")
      return "Interest er jonno dhonnobad! Amader current openings and application details er jonno recruitment@biai.com.bd te email korun. Team apnar sathe contact korbe.";
    return "Thank you for your interest in joining BIAI! Please reach out to our recruitment team at recruitment@biai.com.bd with your details. Our team will get back to you.";
  }
  if (route === "Support") {
    if (language === "Bangla")
      return "আপনার বার্তার জন্য ধন্যবাদ। বিষয়টি আমাদের সাপোর্ট টিম গুরুত্বের সাথে দেখছে। আপনার পেমেন্ট বা সমস্যাটি দ্রুত যাচাই করে আমাদের প্রতিনিধি আপনার সাথে যোগাযোগ করবেন।";
    if (language === "Banglish")
      return "Apnar message er jonno dhonnobad. Amader support team issue ti check korche. Khub druto amader representative apnar shathe contact korbe.";
    return "Thank you for reaching out to BIAI Support. We have logged your request and our team is actively reviewing it. A representative will contact you shortly.";
  }
  if (program === "Bootcamp") {
    if (language === "Bangla")
      return `সালাম! আমাদের এআই বুটক্যাম্পে আগ্রহের জন্য ধন্যবাদ। কোর্স ফি ও পরবর্তী ব্যাচের শিডিউল আমাদের টিম কনফার্ম করবে। ${phone ? "আমাদের প্রতিনিধি শীঘ্রই কল করবেন।" : "বিস্তারিত জানাতে আপনার ফোন নম্বরটি শেয়ার করতে পারেন?"}`;
    if (language === "Banglish")
      return `Assalamualaikum! Bootcamp e interest thakar jonno dhonnobad. Price ebong upcoming batch date amader admissions team confirm korbe. ${phone ? "Amader team apnake call korbe." : "Details pathanor jonno apnar contact number ta share korben?"}`;
    return `Thank you for your interest in the AI Bootcamp! Our admissions team will confirm the schedule and fee structure. ${phone ? "Our team will reach out to you shortly." : "Could you please share your contact number for further details?"}`;
  }
  if (program === "Fellowship") {
    if (language === "Bangla")
      return `সালাম! আমাদের ফেলোশিপ প্রোগ্রামে আগ্রহের জন্য ধন্যবাদ। পরবর্তী সেশনের ভর্তি প্রক্রিয়া ও যোগ্যতার বিস্তারিত আমাদের টিম জানিয়ে দেবে। ${phone ? "শীঘ্রই যোগাযোগ করা হবে।" : "আপনার ফোন নম্বরটি দেওয়া সম্ভব?"}`;
    if (language === "Banglish")
      return `Fellowship programme niye janar jonno dhonnobad! Admission criteria ar start date amader team confirm korbe. ${phone ? "Amader team druto jogajog korbe." : "Apnar phone number ta share korle details janiye debo."}`;
    return `Thank you for your interest in the BIAI Fellowship! Our admissions team will share the curriculum, admission dates, and eligibility details. ${phone ? "We will get in touch with you shortly." : "Could you please provide your phone number so we can assist you?"}`;
  }
  if (program === "Corporate training") {
    if (language === "Bangla")
      return `ধন্যবাদ আপনার প্রতিষ্ঠানের জন্য ট্রেনিংয়ে আগ্রহ প্রকাশের জন্য। আমাদের করপোরেট টিম আপনার সাথে আলোচনা করে কাস্টমাইজড প্রপোজাল তৈরি করবে। ${phone ? "আমরা এই সপ্তাহেই কল করছি।" : "অনুগ্রহ করে আপনার যোগাযোগের নম্বরটি দিন।"}`;
    if (language === "Banglish")
      return `Dhonnobad team training er jonno reach out korar jonno! Amader corporate training advisor apnar requirement bujhe customized quote pathabe. ${phone ? "Amra ei week ei contact korchi." : "Kindly apnar phone number ta share korun."}`;
    return `Thank you for contacting BIAI regarding corporate team training! Our enterprise advisor will prepare a tailored proposal for your organization. ${phone ? "We will reach out to you this week." : "Please share a contact phone number so we can arrange a call."}`;
  }
  if (language === "Bangla")
    return `ধন্যবাদ আপনার বার্তার জন্য। আপনার প্রশ্নের ব্যাপারে আমাদের টিম বিস্তারিত তথ্য নিশ্চিত করবে। আপনি কি বুটক্যাম্প, ফেলোশিপ নাকি করপোরেট ট্রেনিংয়ে আগ্রহী? ${phone ? "" : "যোগাযোগের জন্য আপনার নম্বরটি শেয়ার করতে পারেন।"}`;
  if (language === "Banglish")
    return `Message er jonno dhonnobad! Amader team info confirm korbe. Apni ki Bootcamp, Fellowship naki Corporate training niye jan-te agrohi? ${phone ? "" : "Jogajoger jonno phone number ta share korben?"}`;
  return `Thank you for reaching out to BIAI! Our team will confirm the details for your inquiry. Are you interested in our Bootcamp, Fellowship, or Corporate training? ${phone ? "" : "Please share your contact number so we can assist you."}`;
}

export function heuristicAnalyze(input) {
  const language = detectLanguage(input.message);
  const phone = extractPhone(input.message, input.phone);
  const name = extractName(input.message, input.name);
  const program = detectProgram(input.message);
  const route = detectRoute(input.message);
  const reply = generateHeuristicReply(
    input.message,
    language,
    program,
    route,
    name,
    phone,
  );
  return {
    name,
    phone,
    program,
    route,
    language,
    reason: `Rule-based classification: ${language} language, ${program === "Unspecified" ? "programme not identified" : program + " programme"}, routed to ${route}. Check every field.`,
    reply,
    urgent: route === "Support",
    confidence: "low",
    nextAction: defaultNextAction(route, program, phone),
    mode: "heuristic",
  };
}

/**
 * Rule-based weekly priorities, used when no live AI is configured or the
 * live call fails. Every statement is derived from the period data.
 */
export function rulePriorities(input) {
  if (!input.count)
    return [
      "No enquiries were received in this period.",
      `${input.overdue} current contact${input.overdue === 1 ? "" : "s"} need follow-up. Start with the Follow-ups view.`,
    ];
  const notes = Array.isArray(input.notes) ? input.notes : [];
  const unspecified = notes.filter((n) => n.route === "Sales" && n.program === "Unspecified").length;
  const supportNames = notes.filter((n) => n.route === "Support").map((n) => n.name);
  return [
    `Work the ${input.overdue} overdue follow-up${input.overdue === 1 ? "" : "s"}, starting with urgent cases.`,
    supportNames.length
      ? `Verify the payment or cancellation claims from ${supportNames.join(" and ")} with a person before changing any stage.`
      : "No support cases came in this period.",
    unspecified
      ? `Ask ${unspecified} sales contact${unspecified === 1 ? "" : "s"} which programme they mean before quoting details.`
      : "Every sales contact has a confirmed programme of interest.",
  ];
}

/** A short, concrete next step for the team. */
export function defaultNextAction(route, program = "Unspecified", phone = "") {
  if (route === "Spam") return "No action: quarantined";
  if (route === "Careers") return "Forward to recruitment";
  if (route === "Support") return "Verify the case and call back";
  if (!phone) return "Ask for a contact number";
  if (program === "Unspecified") return "Confirm which programme they want";
  return `Call about the ${program.toLowerCase()}`;
}
