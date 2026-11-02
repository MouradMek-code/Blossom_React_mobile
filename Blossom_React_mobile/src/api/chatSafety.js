// The safety warning in a chat: words scammers use to move someone off
// Blossom or towards money, in the four languages. The check runs on this
// device only - no message is sent anywhere for it, and the other person
// doesn't know. Same file on the website and in the app.

const RISKY = new RegExp(
  [
    // Moving to another app
    "\\bwhats\\s?app\\b", "\\bwa\\.me\\b", "\\btelegram\\b", "\\bt\\.me\\b", "\\bwechat\\b", "\\bviber\\b",
    "微信", "واتساب", "واتس اب", "تيليجرام", "تليجرام", "تلغرام",
    // Crypto and "investments"
    "\\bcrypto", "\\bbitcoin", "\\bbtc\\b", "\\busdt\\b", "\\bethereum\\b", "\\bbinance\\b", "\\bforex\\b",
    "\\btrading\\b", "\\binvest(ing|ment|ments|ir|issement|issements)?\\b",
    "比特币", "加密货币", "虚拟货币", "投资", "理财",
    "بيتكوين", "عملات رقمية", "استثمار",
    // Sending money
    "\\bgift\\s?cards?\\b", "\\bcartes?\\s+cadeaux?\\b", "\\bwestern\\s?union\\b", "\\bmoney\\s?gram\\b",
    "\\bwire\\s+transfer\\b", "\\bvirement\\b", "\\bpaypal\\b", "\\bcash\\s?app\\b", "\\bvenmo\\b", "\\biban\\b",
    "\\bsend\\s+(me\\s+)?money\\b", "\\bneed\\s+money\\b", "\\blend\\s+me\\b", "\\bloan\\b", "\\bbank\\s+account\\b",
    "\\bcompte\\s+bancaire\\b", "\\bbesoin\\s+d['’]argent\\b", "\\benvoie[sz]?[-\\s]moi\\s+de\\s+l['’]argent\\b",
    "\\bm['’]envoyer\\s+de\\s+l['’]argent\\b", "\\bpr[êe]te[rz]?[-\\s]moi\\b",
    "转账", "汇款", "礼品卡", "借钱",
    "حوالة", "تحويل مال", "تحويل أموال", "بطاقة هدية", "قرض", "أرسل لي مال",
    // Codes
    "\\bverification\\s+code\\b", "\\bcode\\s+de\\s+v[ée]rification\\b", "验证码", "رمز التحقق",
  ].join("|"),
  "iu",
);

// A phone number: 9 digits or more, spaces and dashes allowed between them.
const PHONE = /(?:\+?\d[\s.\-()]*){9,}/;

export function isRiskyMessage(text) {
  return Boolean(text) && (RISKY.test(text) || PHONE.test(text));
}

// The first message from the other person that looks risky (the warning shows
// once in a conversation, under that message), or null.
export function firstRiskyMessageId(messages, myProfileId) {
  if (!myProfileId) return null;
  const risky = messages.find(
    (m) => !m.date_spot && Number(m.sender_profile_id) !== Number(myProfileId) && isRiskyMessage(m.content),
  );
  return risky ? risky.id : null;
}
