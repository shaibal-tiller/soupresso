// Bilingual UI strings. Keys are the exact English source string used in JSX.
// translate('en', k) === k always; translate('bn', k) looks k up in BN and
// falls back to k if absent, so wrapping a string is always safe.

export const LANGS = ['en', 'bn'];
export const DEFAULT_LANG = 'en';
export const LANG_STORAGE_KEY = 'soupresso_lang';

export const BN = {
  // ---- Shell / nav (app/AppShell.js) ----
  'Daily Entry': 'দৈনিক হিসাব',
  'Receipts': 'রসিদ',
  'Dashboard': 'ড্যাশবোর্ড',
  'Products': 'পণ্য',
  'Log out': 'লগ আউট',

  // ---- Login (app/login/page.js) ----
  'Cash register — sign in to continue': 'ক্যাশ রেজিস্টার — চালিয়ে যেতে সাইন ইন করুন',
  'Email': 'ইমেইল',
  'Password': 'পাসওয়ার্ড',
  'Login failed.': 'লগইন ব্যর্থ হয়েছে।',
  'Could not reach the server. Check your connection and try again.':
    'সার্ভারে পৌঁছানো যায়নি। আপনার সংযোগ দেখে আবার চেষ্টা করুন।',
  'Signing in…': 'সাইন ইন হচ্ছে…',
  'Sign in': 'সাইন ইন',

  // ---- Shared ----
  'Loading…': 'লোড হচ্ছে…',
  'Cancel': 'বাতিল',
  'Save failed.': 'সংরক্ষণ ব্যর্থ হয়েছে।',
  'Saving…': 'সংরক্ষণ হচ্ছে…',
  'Bhangti in box': 'বাক্সে ভাংতি',
  'Note (optional)': 'নোট (ঐচ্ছিক)',
  'Notes (optional)': 'নোট (ঐচ্ছিক)',
  'Download': 'ডাউনলোড',
  'Preparing…': 'প্রস্তুত হচ্ছে…',
  'Edit': 'সম্পাদনা',

  // ---- Daily Entry (app/entry/page.js) ----
  'Count box': 'বাক্স গণনা',
  'Sales': 'বিক্রয়',
  'Bazar': 'বাজার',
  'Tomorrow': 'আগামীকাল',
  'Review': 'পর্যালোচনা',
  'Could not load this day.': 'এই দিনটি লোড করা যায়নি।',
  'Carried forward from': 'যেখান থেকে আনা হয়েছে',
  'Saved successfully!': 'সফলভাবে সংরক্ষিত হয়েছে!',
  'Could not reach the server.': 'সার্ভারে পৌঁছানো যায়নি।',
  'Shop was closed': 'দোকান বন্ধ ছিল',
  'Edit this day': 'এই দিনটি সম্পাদনা করুন',
  'Saved entry': 'সংরক্ষিত হিসাব',
  'Total sales': 'মোট বিক্রয়',
  'Expense (bazar)': 'খরচ (বাজার)',
  'Bazar advance (tomorrow)': 'বাজার অগ্রিম (আগামীকাল)',
  'Cash taken home': 'বাসায় নেওয়া নগদ',
  'Edit this entry': 'এই হিসাবটি সম্পাদনা করুন',
  'No entry yet': 'এখনও কোনো হিসাব নেই',
  'Start entry': 'হিসাব শুরু করুন',
  'Mark off day': 'ছুটির দিন চিহ্নিত করুন',
  'Shop closed': 'দোকান বন্ধ',
  'This day will be marked as an off day — no sales recorded.':
    'এই দিনটি ছুটির দিন হিসেবে চিহ্নিত হবে — কোনো বিক্রয় লেখা হবে না।',
  'e.g. Holiday, rain, personal day': 'যেমন ছুটি, বৃষ্টি, ব্যক্তিগত দিন',
  "Count today's box": 'আজকের বাক্স গণনা করুন',
  'By denomination': 'নোট অনুযায়ী',
  'Enter total': 'মোট লিখুন',
  'Total amount in box (৳)': 'বাক্সে মোট টাকা (৳)',
  'e.g. 10000': 'যেমন ১০০০০',
  'Total counted': 'মোট গণনা',
  "Today's total sales": 'আজকের মোট বিক্রয়',
  'How much bhangti (loose change) was already in the box from yesterday?':
    'গতকাল থেকে বাক্সে কত ভাংতি ছিল?',
  'Opening bhangti (৳)': 'শুরুর ভাংতি (৳)',
  '− Opening bhangti': '− শুরুর ভাংতি',
  "Today's sales": 'আজকের বিক্রয়',
  "Settle yesterday's bazar": 'গতকালের বাজার মেলান',
  "Bazar advance received (for today's shopping)": 'বাজার অগ্রিম পাওয়া গেছে (আজকের বাজারের জন্য)',
  'Actual bazar cost today': 'আজকের প্রকৃত বাজার খরচ',
  'Chef returns:': 'বাবুর্চি ফেরত দেবে:',
  'Exact — no variance': 'ঠিক আছে — কোনো পার্থক্য নেই',
  'How much of that did the chef already take from the box?': 'এর কতটা বাবুর্চি বাক্স থেকে ইতিমধ্যে নিয়েছেন?',
  "Leave at ৳0 if he paid it from his own pocket — you'll pay him back from the box at Review.":
    'যদি তিনি নিজের পকেট থেকে দিয়ে থাকেন তবে ৳০ রাখুন — পর্যালোচনায় বাক্স থেকে তাকে ফেরত দেবেন।',
  'Reimburse chef from box:': 'বাক্স থেকে বাবুর্চিকে ফেরত দিন:',
  'Already settled — nothing more to pay': 'ইতিমধ্যে মিটমাট হয়েছে — আর কিছু দিতে হবে না',
  'Reimbursed to chef (from box)': 'বাবুর্চিকে ফেরত দেওয়া হয়েছে (বাক্স থেকে)',
  "Correct yesterday's plan to what was actually bought — adjust quantities and prices, remove what wasn't bought, add anything extra.":
    'গতকালের পরিকল্পনা প্রকৃত কেনাকাটার সাথে মিলিয়ে সংশোধন করুন — পরিমাণ ও দাম ঠিক করুন, যা কেনা হয়নি তা বাদ দিন, অতিরিক্ত কিছু কিনলে যোগ করুন।',
  'Search items...': 'আইটেম খুঁজুন...',
  'All': 'সব',
  'Add another item...': 'আরেকটি আইটেম যোগ করুন...',
  'Add': 'যোগ করুন',
  'Price': 'দাম',
  'Remove': 'সরান',
  'Items total': 'আইটেম মোট',
  'Adjustment (+/-)': 'সমন্বয় (+/-)',
  'Set aside for tomorrow': 'আগামীকালের জন্য আলাদা রাখুন',
  'Bazar advance to give chef now (৳)': 'এখন বাবুর্চিকে দেওয়া বাজার অগ্রিম (৳)',
  'Bhangti to keep in the box (৳)': 'বাক্সে রাখা ভাংতি (৳)',
  'Review & save': 'পর্যালোচনা ও সংরক্ষণ',
  'Bazar variance': 'বাজার পার্থক্য',
  "Tomorrow's bazar": 'আগামীকালের বাজার',
  "Tomorrow's bhangti": 'আগামীকালের ভাংতি',
  'Box is short.': 'বাক্সে টাকা কম পড়েছে।',
  "Not enough to cover tomorrow's advance and bhangti.":
    'আগামীকালের অগ্রিম ও ভাংতির জন্য যথেষ্ট নয়।',
  'Anything to remember': 'মনে রাখার মতো কিছু',
  '✕ Cancel': '✕ বাতিল',
  '← Back': '← পেছনে',
  'Next →': 'পরবর্তী →',
  '✓ Update': '✓ হালনাগাদ',
  '✓ Save': '✓ সংরক্ষণ',
  '✓ Mark off day': '✓ ছুটির দিন চিহ্নিত করুন',
  'Mark as off day?': 'ছুটির দিন হিসেবে চিহ্নিত করবেন?',
  'Update this entry?': 'এই হিসাবটি হালনাগাদ করবেন?',
  'Save this entry?': 'এই হিসাবটি সংরক্ষণ করবেন?',
  'Yes, mark off': 'হ্যাঁ, চিহ্নিত করুন',
  'Yes, update': 'হ্যাঁ, হালনাগাদ করুন',
  'Yes, save': 'হ্যাঁ, সংরক্ষণ করুন',
  'Previous version will be kept in the audit log.': 'আগের সংস্করণ অডিট লগে সংরক্ষিত থাকবে।',

  // ---- Receipts (app/history/page.js) ----
  'No entry for this day yet.': 'এই দিনের জন্য এখনও কোনো হিসাব নেই।',
  'Go to Daily Entry': 'দৈনিক হিসাবে যান',
  'Daily Cash Receipt': 'দৈনিক নগদ রসিদ',
  'Shop Closed': 'দোকান বন্ধ',
  'Total Sales': 'মোট বিক্রয়',
  'Expense (Bazar)': 'খরচ (বাজার)',
  'Next day bazar advance': 'পরদিনের বাজার অগ্রিম',
  'Cash Taken Home': 'বাসায় নেওয়া নগদ',

  // ---- Dashboard (app/dashboard/page.js) ----
  '7 days': '৭ দিন',
  '14 days': '১৪ দিন',
  '30 days': '৩০ দিন',
  'This month': 'এই মাস',
  'All time': 'সর্বকাল',
  'Day': 'দিন',
  'Week': 'সপ্তাহ',
  'Month': 'মাস',
  'Avg daily': 'দৈনিক গড়',
  'Total expense': 'মোট খরচ',
  'Taken home': 'বাসায় নেওয়া',
  'Days recorded': 'লেখা দিন',
  'Best day': 'সেরা দিন',
  'Last recorded': 'সর্বশেষ লেখা',
  'sales': 'বিক্রয়',
  'No data for this range yet.': 'এই সময়ের জন্য এখনও কোনো তথ্য নেই।',
  'Days': 'দিন',
  'Expense': 'খরচ',
  'Net': 'নিট',
  // dashboard API `range` labels, translated client-side:
  'Last 7 days': 'গত ৭ দিন',
  'Last 14 days': 'গত ১৪ দিন',
  'Last 30 days': 'গত ৩০ দিন',

  // ---- Products (app/products/page.js) ----
  'Daily quantities': 'দৈনিক পরিমাণ',
  'Manage menu': 'মেনু পরিচালনা',
  'How many sold today': 'আজ কতটি বিক্রি হয়েছে',
  'No menu items yet — add some under "Manage menu".':
    'এখনও কোনো মেনু আইটেম নেই — "মেনু পরিচালনা" থেকে যোগ করুন।',
  'Item': 'আইটেম',
  'Qty': 'পরিমাণ',
  'Value': 'মূল্য',
  'Total units sold': 'মোট বিক্রীত একক',
  'Menu value': 'মেনু মূল্য',
  'Saved.': 'সংরক্ষিত হয়েছে।',
  'Save quantities': 'পরিমাণ সংরক্ষণ করুন',
  'Menu items': 'মেনু আইটেম',
  'Price (৳)': 'দাম (৳)',
  'Active': 'সক্রিয়',
  'Hide': 'লুকান',
  'Show': 'দেখান',
  'Edit a price and click away from the field to save it.':
    'দাম পরিবর্তন করে ঘরের বাইরে ক্লিক করলে তা সংরক্ষিত হবে।',
  'Add a new item': 'নতুন আইটেম যোগ করুন',
  'Name': 'নাম',
  'e.g. Chicken Roll': 'যেমন চিকেন রোল',
  'e.g. 50': 'যেমন ৫০',
  'Add item': 'আইটেম যোগ করুন',
  '/unit': '/একক',

  // ---- Sales-calc fix / closer names / bhangti denomination picker (deliverable 2) ----
  'Total': 'মোট',
  "Who's closing today?": 'আজ কে হিসাব বন্ধ করছেন?',

  // ---- Investments (app/investments/page.js) ----
  'Investments': 'বিনিয়োগ',
  'Grand total': 'সর্বমোট',
  'All categories': 'সব বিভাগ',
  'No investment entries yet.': 'এখনও কোনো বিনিয়োগ এন্ট্রি নেই।',
  'Add entry': 'এন্ট্রি যোগ করুন',
  'New entry': 'নতুন এন্ট্রি',
  'Edit entry': 'এন্ট্রি সম্পাদনা',
  'Date': 'তারিখ',
  'Category': 'বিভাগ',
  'Description': 'বিবরণ',
  'Amount (৳)': 'পরিমাণ (৳)',
  'Save': 'সংরক্ষণ করুন',
  'Update': 'হালনাগাদ করুন',
  'e.g. Food Cart, Gas, Others': 'যেমন ফুড কার্ট, গ্যাস, অন্যান্য',
  'e.g. Gas cylinder': 'যেমন গ্যাস সিলিন্ডার',
};

export function translate(lang, key) {
  if (lang !== 'bn') return key;
  return BN[key] ?? key;
}
