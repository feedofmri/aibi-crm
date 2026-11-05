// Imported (not read from disk) so the bundled production server carries the data with it.
import sampleData from "../../data/sample-enquiries.json" with { type: "json" };

export const samples = sampleData;
// Human-reviewed interpretations of the supplied fictional messages, not model predictions.
const decisions = [
  ["Bootcamp", "Sales", "Banglish", "Price and payment enquiry."],
  ["Fellowship", "Sales", "Bangla", "Asks about enrolment and start date."],
  [
    "Corporate training",
    "Sales",
    "English",
    "40-person textile company; requests a call this week.",
  ],
  [
    "Unspecified",
    "Sales",
    "Banglish",
    "Asks about live classes and recordings; programme not stated.",
  ],
  [
    "Unspecified",
    "Sales",
    "English",
    "Student discount; caller said she would call tomorrow after 5 PM.",
  ],
  [
    "Unspecified",
    "Sales",
    "Banglish",
    "Asks about job outcomes; do not promise employment.",
  ],
  [
    "Unspecified",
    "Support",
    "Bangla",
    "Payment reportedly made on 25 October via bKash; confirmation missing. Verify payment manually.",
  ],
  [
    "Unspecified",
    "Sales",
    "English",
    "Refund policy enquiry; no cancellation or payment confirmed.",
  ],
  [
    "Unspecified",
    "Sales",
    "Banglish",
    "Asks about offline location; do not assume Mirpur is confirmed.",
  ],
  [
    "Corporate training",
    "Sales",
    "English",
    "Bank HR requests a quote for 120 employees; online or onsite.",
  ],
  [
    "Unspecified",
    "Spam",
    "English",
    "Unsolicited crypto promotion. Quarantine; do not reply.",
  ],
  ["Bootcamp", "Sales", "Banglish", "Repeat bootcamp price enquiry from Rafi."],
  [
    "Unspecified",
    "Sales",
    "Bangla",
    "Class 9 student asks about a free masterclass. Check eligibility; masterclass is not one of the three supplied programmes.",
  ],
  [
    "Fellowship",
    "Sales",
    "English",
    "Non-technical marketing manager; eight years of experience.",
  ],
  [
    "Unspecified",
    "Sales",
    "Banglish",
    "Asks about add-on and lifetime access; programme unclear.",
  ],
  [
    "Unspecified",
    "Support",
    "English",
    "Urgent cancellation and refund complaint; needs a human response. Do not promise a refund.",
  ],
  [
    "Unspecified",
    "Sales",
    "Banglish",
    "Asks whether certification is government approved. Verify before claiming approval.",
  ],
  [
    "Corporate training",
    "Sales",
    "Bangla",
    "Garment factory owner asks about a group discount for 15 employees.",
  ],
  [
    "Fellowship",
    "Sales",
    "English",
    "Asks whether two instalments are possible. Verify payment policy.",
  ],
  [
    "Unspecified",
    "Careers",
    "English",
    "AI internship applicant; keep outside the sales pipeline.",
  ],
];
const questions = {
  1: "Bootcamp er current price ar payment process team theke confirm kore janabo. Apni kon batch e interested?",
  2: "ফেলোশিপের শুরুর তারিখ ও ভর্তি প্রক্রিয়া টিমের সঙ্গে নিশ্চিত করে জানাব। আপনার সঙ্গে যোগাযোগের নম্বরটি দেবেন?",
  3: "Thank you for reaching out about training your team. What time this week would suit a call, and which skills would you like the team to learn?",
  4: "Apni kon programme er class niye jante chacchen? Live class ar recording er details team theke confirm kore janabo.",
  5: "Thank you for asking. Which programme are you interested in? We will check whether a student discount is available.",
  6: "Course korlei job guarantee deya jabe na. Apnar background ar learning goal bolle team suitable programme suggest korte parbe.",
  7: "কনফার্মেশন না পাওয়ার বিষয়টি সাপোর্ট টিমের কাছে পাঠাচ্ছি। অনুগ্রহ করে বিকাশ ট্রানজ্যাকশন আইডিটি দিন, যাতে টিম পেমেন্ট যাচাই করতে পারে।",
  8: "Thank you for checking before enrolling. Which programme are you considering? Our team will confirm the applicable refund policy.",
  9: "Apni kon programme er offline class niye jante chacchen? Venue team theke confirm kore janabo.",
  10: "Thank you for your interest in training 120 employees. What topics and timeframe do you have in mind? Our team can then prepare a suitable quote.",
  12: "Price er jonno abar message korar jonno dhonnobad. Current bootcamp fee team theke confirm kore janabo. Kon batch e interested?",
  13: "মাস্টারক্লাসে আগ্রহের জন্য ধন্যবাদ। ক্লাস ৯-এর শিক্ষার্থী হিসেবে যোগদানের শর্ত টিমের সঙ্গে যাচাই করে জানাব।",
  14: "Thank you for sharing your background. What would you like to achieve with AI in your marketing work? Our team will check the fellowship prerequisites with you.",
  15: "Apni kon programme er add-on niye bolchen? Access er duration ar ki included, team theke confirm kore janabo.",
  16: "I understand this has been frustrating. I am flagging your cancellation and refund request for urgent human review. Please share your enrolment reference so the team can check your case.",
  17: "Certificate er approval status team theke verify kore janabo. Apni kon programme er certificate niye jante chacchen?",
  18: "আপনার ১৫ জন কর্মীর প্রশিক্ষণের জন্য ধন্যবাদ। কোন বিষয়ে প্রশিক্ষণ চান এবং কবে করতে চান? গ্রুপ মূল্য টিমের সঙ্গে যাচাই করে জানাব।",
  19: "Thank you for your interest in the fellowship. Our team will confirm whether two instalments are available for your intended batch.",
  20: "Thank you for your interest in an AI internship. I will flag your enquiry for the recruitment team to confirm the application process.",
};
export function sampleAnalysis(row) {
  const [program, route, language, reason] = decisions[Number(row.id) - 1];
  return {
    name: row["sender name"],
    phone: row.phone,
    program,
    route,
    language,
    reason,
    reply: questions[row.id] || "",
    mode: "sample",
  };
}
export function matchSample(message) {
  return samples.find((s) => s.message.trim() === message.trim());
}
