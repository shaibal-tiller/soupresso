// Lightweight bilingual support (English / বাংলা). Rather than restructure
// every component around translation keys, `t()` looks a literal English
// source string up in the Bangla dictionary and falls back to the English
// string unchanged if it isn't there yet — safe to wrap incrementally.

export type Lang = "en" | "bn";
export const LANG_COOKIE = "soupresso_lang";

const BN: Record<string, string> = {
  // Nav
  Dashboard: "ড্যাশবোর্ড",
  Entries: "এন্ট্রি",
  "Daily Sales": "দৈনিক বিক্রয়",
  Sales: "বিক্রয়",
  "Cash & Bank": "ক্যাশ ও ব্যাংক",
  Cash: "ক্যাশ",
  Menu: "মেনু",
  "Chart of Accounts": "হিসাবের তালিকা",
  "Partners & Equity": "অংশীদার ও মূলধন",
  Reports: "রিপোর্ট",
  "Audit Log": "অডিট লগ",
  More: "আরও",

  // Common actions
  Save: "সংরক্ষণ করুন",
  "Saving...": "সংরক্ষণ হচ্ছে...",
  Cancel: "বাতিল",
  Delete: "মুছুন",
  Edit: "সম্পাদনা",
  Apply: "প্রয়োগ করুন",
  Transfer: "স্থানান্তর",
  Close: "বন্ধ করুন",

  // Common fields
  Date: "তারিখ",
  "Amount (৳)": "পরিমাণ (৳)",
  Amount: "পরিমাণ",
  Description: "বিবরণ",
  "Vendor / Payee (optional)": "বিক্রেতা (ঐচ্ছিক)",
  "Vendor (optional)": "বিক্রেতা (ঐচ্ছিক)",
  "Quantity (optional)": "পরিমাণ (ঐচ্ছিক)",
  Quantity: "পরিমাণ",
  "Unit (optional)": "একক (ঐচ্ছিক)",
  Unit: "একক",
  Category: "বিভাগ",
  "Payment Method": "পেমেন্ট পদ্ধতি",
  "Pay from account": "অ্যাকাউন্ট থেকে পরিশোধ",
  "On Credit (unpaid)": "বাকিতে (অপরিশোধিত)",
  "Multiple accounts": "একাধিক অ্যাকাউন্ট",
  "Cash / Bank Account": "ক্যাশ/ব্যাংক অ্যাকাউন্ট",
  "Select account": "অ্যাকাউন্ট বেছে নিন",
  Partner: "অংশীদার",
  "Select partner": "অংশীদার বেছে নিন",
  Name: "নাম",
  "Your Name": "আপনার নাম",

  // Entries / Quick Purchase
  Entry: "এন্ট্রি",
  "New Entry": "নতুন এন্ট্রি",
  "Add Entry": "এন্ট্রি যোগ করুন",
  "Quick Purchase": "দ্রুত ক্রয়",
  "Manual Entry": "ম্যানুয়াল এন্ট্রি",
  "Manage items": "আইটেম পরিচালনা",
  "Add Item": "আইটেম যোগ করুন",
  "Tap what you bought today": "আজ যা কিনেছেন তাতে ট্যাপ করুন",
  "Search items...": "আইটেম খুঁজুন...",
  All: "সব",
  "Today's Basket": "আজকের ঝুড়ি",
  "No items yet — tap something above.": "এখনও কোনো আইটেম নেই — উপরে থেকে বেছে নিন।",
  "No items match your search.": "আপনার অনুসন্ধানের সাথে কোনো আইটেম মেলেনি।",

  // Daily Sales / Quick Sale
  "Full Day Entry": "সম্পূর্ণ দিনের এন্ট্রি",
  "Record Today's Sales": "আজকের বিক্রয় লিখুন",
  "Today's sales so far": "আজকের এ পর্যন্ত বিক্রয়",
  "Tap an item to add it to the order": "অর্ডারে যোগ করতে আইটেমে ট্যাপ করুন",
  "Current Order": "বর্তমান অর্ডার",
  "No items yet — tap something above.\n": "এখনও কোনো আইটেম নেই — উপরে থেকে বেছে নিন।",
  "Customer paid with": "ক্রেতা পরিশোধ করেছেন",
  "Notes (optional)": "নোট (ঐচ্ছিক)",
  "Sales History": "বিক্রয়ের ইতিহাস",

  // Dashboard
  "Total Liquid Funds": "মোট নগদ তহবিল",
  "Today's Sales": "আজকের বিক্রয়",
  "Month-to-Date Sales": "চলতি মাসের বিক্রয়",
  "Total Assets": "মোট সম্পদ",
  "Total Liabilities": "মোট দায়",
  "Total Equity": "মোট মূলধন",
  "Net Profit (all-time)": "নিট মুনাফা (সর্বমোট)",
  "Accounts Payable": "প্রদেয় হিসাব",
  "Accounts Receivable": "পাওনা হিসাব",
  "Loans Payable": "প্রদেয় ঋণ",
  "Fixed Assets": "স্থায়ী সম্পদ",

  // Cash & Bank
  "Cash in Hand": "হাতে নগদ",
  "Bank Account": "ব্যাংক অ্যাকাউন্ট",
  "Add Account": "অ্যাকাউন্ট যোগ করুন",
  "Total Liquid Funds ": "মোট নগদ তহবিল",
  "Balance Adjustment": "ব্যালেন্স সমন্বয়",

  // Menu
  "Add Menu Item": "মেনু আইটেম যোগ করুন",

  // Partners
  "Add Partner": "অংশীদার যোগ করুন",

  // Entry categories
  "Partner Investment": "অংশীদারের বিনিয়োগ",
  "Asset Purchase": "সম্পদ ক্রয়",
  "Raw Material / Ingredients": "কাঁচামাল / উপকরণ",
  "Packaging & Supplies": "প্যাকেজিং ও সরঞ্জাম",
  "Chef Salary": "বাবুর্চির বেতন",
  "House Rent": "বাসা ভাড়া",
  Utility: "ইউটিলিটি",
  "Cleaning & Maintenance": "পরিষ্কার ও রক্ষণাবেক্ষণ",
  "Other Expense": "অন্যান্য ব্যয়",
  "Loan Received": "ঋণ গ্রহণ",
  "Loan Repayment": "ঋণ পরিশোধ",
  "Payable Settlement": "বাকি পরিশোধ",
  "Receivable Collection": "পাওনা আদায়",
  "Partner Withdrawal": "অংশীদারের উত্তোলন",
  "Manual Adjustment": "ম্যানুয়াল সমন্বয়",

  // Reports / accounting terms
  "Balance Sheet": "ব্যালান্স শীট",
  "Income Statement": "আয়-ব্যয় বিবরণী",
  Assets: "সম্পদ",
  Liabilities: "দায়",
  Equity: "মূলধন",
  Income: "আয়",
  Expenses: "ব্যয়",
  "Net Profit": "নিট মুনাফা",
  Who: "কে",
  Action: "কার্যক্রম",
  Type: "ধরন",
  Summary: "সারাংশ",

  // Actor / language
  "Who's using this device?": "এই ডিভাইসটি কে ব্যবহার করছেন?",
  "Set your name": "আপনার নাম দিন",

  // Dashboard subtitle + hints
  "Soupresso cart business — real-time ledger summary.": "সুপ্রেসো কার্ট ব্যবসা — রিয়েল-টাইম হিসাবের সারসংক্ষেপ।",
  "Across all cash/bank accounts": "সব ক্যাশ/ব্যাংক অ্যাকাউন্ট মিলিয়ে",
  "What we owe": "আমরা যা পরিশোধ করব",
  "What's owed to us": "আমাদের যা পাওনা",
  "Cart, equipment, furniture": "কার্ট, সরঞ্জাম, আসবাবপত্র",
  "Daily Sales — Last 30 Days": "দৈনিক বিক্রয় — গত ৩০ দিন",
  "Total collected per day.": "প্রতিদিনের মোট আদায়।",
  "Monthly Sales vs. Expenses": "মাসিক বিক্রয় বনাম ব্যয়",
  "Last 6 months.": "গত ৬ মাস।",
  "Balance by account.": "প্রতিটি অ্যাকাউন্টের ব্যালেন্স।",
  "Expense Breakdown (all-time)": "ব্যয়ের বিভাজন (সর্বমোট)",
  "Where the money is going, by category.": "বিভাগ অনুযায়ী টাকা কোথায় যাচ্ছে।",
  "Top Selling Items": "সর্বাধিক বিক্রিত আইটেম",
  "By revenue, last 30 days (approximate).": "আয় অনুযায়ী, গত ৩০ দিন (আনুমানিক)।",
  "Business Health Summary": "ব্যবসার সার্বিক অবস্থা",
  "Quick equity and profit picture.": "মূলধন ও মুনাফার সংক্ষিপ্ত চিত্র।",
  "No daily sales recorded yet.": "এখনও কোনো দৈনিক বিক্রয় লেখা হয়নি।",
  "No cash/bank accounts yet.": "এখনও কোনো ক্যাশ/ব্যাংক অ্যাকাউন্ট নেই।",
  "No expenses recorded yet.": "এখনও কোনো ব্যয় লেখা হয়নি।",
  "No itemized sales recorded yet.": "এখনও কোনো আইটেম ধরে বিক্রয় লেখা হয়নি।",
  "Contributed capital (partner investments)": "প্রদত্ত মূলধন (অংশীদারদের বিনিয়োগ)",
  "Retained earnings (cumulative profit)": "সঞ্চিত আয় (সর্বমোট মুনাফা)",
  "This month's expenses": "এই মাসের ব্যয়",
  "All-time income": "সর্বমোট আয়",

  // Entries page
  "Tap what you bought today, or use manual entry for investments, loans, and other one-offs.":
    "আজ যা কিনেছেন তাতে ট্যাপ করুন, অথবা বিনিয়োগ, ঋণ ও অন্যান্য একবারের কাজের জন্য ম্যানুয়াল এন্ট্রি ব্যবহার করুন।",
  "For investments, loans, settlements, asset purchases, or anything not on the quick-purchase list.":
    "বিনিয়োগ, ঋণ, বাকি পরিশোধ, সম্পদ ক্রয়, বা দ্রুত-ক্রয় তালিকায় নেই এমন যেকোনো কিছুর জন্য।",
  "Recent Entries": "সাম্প্রতিক এন্ট্রি",
  "Latest 200 entries, newest first.": "সর্বশেষ ২০০টি এন্ট্রি, নতুনগুলো আগে।",

  // Daily Sales page
  "Record a sale the moment a customer orders, or close out the whole day in one go.":
    "ক্রেতা অর্ডার করার সাথে সাথে বিক্রয় লিখুন, অথবা পুরো দিন একসাথে হিসাব করুন।",
  "Enter the whole day's total at once — useful for a quiet day, or backfilling a day you didn't log live. This creates the day's record; if it already exists (e.g. from Quick Sale), delete it first.":
    "পুরো দিনের মোট একসাথে লিখুন — কম ব্যস্ত দিনের জন্য বা লাইভে না লেখা দিনের জন্য উপযোগী। এটি দিনের রেকর্ড তৈরি করে; আগে থেকে থাকলে (যেমন দ্রুত বিক্রয় থেকে), প্রথমে সেটি মুছে ফেলুন।",
  "Last 90 days.": "গত ৯০ দিন।",

  // Cash & Bank page
  "Every place money physically sits — cash box, bank accounts, mobile banking. Add as many as you use.":
    "যেখানেই টাকা শারীরিকভাবে থাকে — ক্যাশ বাক্স, ব্যাংক অ্যাকাউন্ট, মোবাইল ব্যাংকিং। যতগুলো ব্যবহার করেন তত যোগ করুন।",
  "Sum of all active cash/bank accounts": "সব সক্রিয় ক্যাশ/ব্যাংক অ্যাকাউন্টের সমষ্টি",
  "Transfers & Balance Adjustments": "স্থানান্তর ও ব্যালেন্স সমন্বয়",
  "Money moved between accounts, and manual balance corrections.": "অ্যাকাউন্টের মধ্যে স্থানান্তরিত টাকা এবং ম্যানুয়াল ব্যালেন্স সংশোধন।",

  // Menu page
  "Customize prices and items used on the Daily Sales page.": "দৈনিক বিক্রয় পাতায় ব্যবহৃত দাম ও আইটেম পরিবর্তন করুন।",
  "Menu Items": "মেনু আইটেম",
  "Toggle items off instead of deleting to keep them out of the Daily Sales picker.":
    "মুছে ফেলার বদলে বন্ধ করুন, যাতে সেগুলো দৈনিক বিক্রয় তালিকা থেকে বাদ থাকে।",

  // Accounts page
  "Every entry posts to two accounts here automatically. Core accounts are protected; add custom ones for manual adjustments.":
    "প্রতিটি এন্ট্রি স্বয়ংক্রিয়ভাবে দুটি অ্যাকাউন্টে যুক্ত হয়। মূল অ্যাকাউন্টগুলো সুরক্ষিত; ম্যানুয়াল সমন্বয়ের জন্য নতুন অ্যাকাউন্ট যোগ করুন।",

  // Partners page
  "Each partner's capital account tracks investments in and withdrawals out, recorded from the Entries page.":
    "প্রতিটি অংশীদারের মূলধন হিসাব এন্ট্রি পাতা থেকে লেখা বিনিয়োগ ও উত্তোলনের হিসাব রাখে।",
  "All Partners": "সব অংশীদার",

  // Reports page
  "Balance sheet, profit & loss, and outstanding balances.": "ব্যালান্স শীট, লাভ-ক্ষতি, এবং অপরিশোধিত হিসাব।",
  "As of": "তারিখ অনুযায়ী",
  "Retained Earnings (cumulative profit)": "সঞ্চিত আয় (সর্বমোট মুনাফা)",
  "Total Liabilities + Equity": "মোট দায় + মূলধন",
  "This month vs. all-time.": "এই মাস বনাম সর্বমোট।",
  Account: "হিসাব",
  "This Month": "এই মাস",
  "All-Time": "সর্বমোট",
  "What the business owes, itemized.": "ব্যবসা যা পরিশোধ করবে, আইটেম ধরে।",
  "What's owed to the business, itemized.": "ব্যবসার যা পাওনা, আইটেম ধরে।",
  Owed: "পাওনা",
  Paid: "পরিশোধিত",
  "Owed to us": "আমাদের পাওনা",
  Collected: "আদায়কৃত",
  "Nothing outstanding.": "কোনো অপরিশোধিত হিসাব নেই।",
  "Partner Equity Summary": "অংশীদার মূলধন সারসংক্ষেপ",
  "Contributions minus withdrawals, per partner.": "প্রতিটি অংশীদারের বিনিয়োগ বিয়োগ উত্তোলন।",
  Balance: "ব্যালেন্স",

  // Audit log page
  "A permanent record of every financial action — who did what, and when. Nothing here can be edited or deleted.":
    "প্রতিটি আর্থিক কার্যক্রমের স্থায়ী রেকর্ড — কে কী করেছে, কখন। এখানে কিছু সম্পাদনা বা মুছে ফেলা যায় না।",
  Filters: "ফিল্টার",
  "Last 7 days": "গত ৭ দিন",
  "Last 30 days": "গত ৩০ দিন",
  "Last 90 days": "গত ৯০ দিন",
  "All time": "সর্বমোট সময়",
  "All actions": "সব কার্যক্রম",
  "All record types": "সব ধরনের রেকর্ড",
  Activity: "কার্যক্রম",
  "No activity in this range.": "এই সময়সীমায় কোনো কার্যক্রম নেই।",
  When: "কখন",
  "Amount ": "পরিমাণ",

  // Quick Purchase panel
  "Clear search": 'অনুসন্ধান মুছুন',
  'No purchase items yet — add some from "Manage items".': "এখনও কোনো ক্রয় আইটেম নেই — \"আইটেম পরিচালনা\" থেকে যোগ করুন।",
  "Add an amount for at least one item": "অন্তত একটি আইটেমের জন্য পরিমাণ লিখুন",
  "Choose which cash/bank account this uses": "কোন ক্যাশ/ব্যাংক অ্যাকাউন্ট থেকে খরচ হবে বেছে নিন",
  Select: "বেছে নিন",
  "Select category": "বিভাগ বেছে নিন",
  "Select payment method": "পেমেন্ট পদ্ধতি বেছে নিন",
  "e.g. Karwan Bazar": "যেমন কারওয়ান বাজার",
  Purchase: "ক্রয়",
  Purchases: "ক্রয়সমূহ",

  // Manage Items sheet / Purchase Item dialog
  "Manage Purchase Items": "ক্রয় আইটেম পরিচালনা",
  "Add, rename, or hide items from the Quick Purchase list.": "দ্রুত ক্রয় তালিকা থেকে আইটেম যোগ, পুনঃনামকরণ বা লুকান।",
  Active: "সক্রিয়",
  Hidden: "লুকানো",
  "Item Name": "আইটেমের নাম",
  "e.g. Chicken, Onion, Cooking Oil": "যেমন মুরগি, পেঁয়াজ, রান্নার তেল",

  // Entry Table / form extras
  "No entries yet.": "এখনও কোনো এন্ট্রি নেই।",
  Vendor: "বিক্রেতা",

  // Manage Items sheet
  "Remove this item from the picker?": "এই আইটেমটি তালিকা থেকে সরিয়ে দিতে চান?",
  "Item removed": "আইটেম সরানো হয়েছে",
  "Purchase Items": "ক্রয় আইটেম",
  "The tap-to-add shortlist on the Entries page. Toggle off instead of deleting to keep history intact.":
    "এন্ট্রি পাতার ট্যাপ-করে-যোগ তালিকা। ইতিহাস অক্ষত রাখতে মুছে ফেলার বদলে বন্ধ করুন।",

  // Purchase Item dialog
  "Edit item": "আইটেম সম্পাদনা",
  "Edit Item": "আইটেম সম্পাদনা",
  "Add Purchase Item": "ক্রয় আইটেম যোগ করুন",
  "Shows up as a tap-to-add tile on the Entries page. Prices aren't stored here since they vary each trip.":
    "এন্ট্রি পাতায় একটি ট্যাপ-করে-যোগ টাইল হিসেবে দেখা যাবে। দাম এখানে সংরক্ষণ করা হয় না কারণ প্রতিবার তা পরিবর্তিত হয়।",
  "e.g. Chicken": "যেমন মুরগি",
  "kg, pc, litre...": "কেজি, পিস, লিটার...",

  // Manual Entry form
  "Recurring Expenses": "নিয়মিত ব্যয়",
  "Equity & Loans": "মূলধন ও ঋণ",
  Settlements: "নিষ্পত্তি",
  Advanced: "উন্নত",
  "Asset Purchase (cart, fridge, blender...)": "সম্পদ ক্রয় (কার্ট, ফ্রিজ, ব্লেন্ডার...)",
  "Partner Investment (money in)": "অংশীদারের বিনিয়োগ (টাকা প্রবেশ)",
  "Partner Withdrawal (money out)": "অংশীদারের উত্তোলন (টাকা বাহির)",
  "Settle a Payable (pay off what we owed)": "বাকি পরিশোধ (যা পাওনা ছিল তা মেটানো)",
  "Collect a Receivable (someone paid us back)": "পাওনা আদায় (কেউ আমাদের ফেরত দিয়েছে)",
  "Manual Adjustment (advanced)": "ম্যানুয়াল সমন্বয় (উন্নত)",
  "e.g. Onions, chicken, spices from Karwan Bazar": "যেমন কারওয়ান বাজার থেকে পেঁয়াজ, মুরগি, মসলা",
  "e.g. 5": "যেমন ৫",
  "kg, pcs, litre...": "কেজি, পিস, লিটার...",
  "e.g. Karwan Bazar vendor": "যেমন কারওয়ান বাজার বিক্রেতা",
  "No cash/bank accounts yet — add one on the Cash & Bank page.": "এখনও কোনো ক্যাশ/ব্যাংক অ্যাকাউন্ট নেই — ক্যাশ ও ব্যাংক পাতায় একটি যোগ করুন।",
  "Debit Account": "ডেবিট হিসাব",
  "Credit Account": "ক্রেডিট হিসাব",

  // Entry Table
  "Delete this entry? This cannot be undone.": "এই এন্ট্রিটি মুছে ফেলবেন? এটি পূর্বাবস্থায় ফেরানো যাবে না।",
  "Entry deleted": "এন্ট্রি মুছে ফেলা হয়েছে",
  "No entries yet. Add your first entry above.": "এখনও কোনো এন্ট্রি নেই। উপরে আপনার প্রথম এন্ট্রি যোগ করুন।",
  Flow: "প্রবাহ",
  Payment: "পেমেন্ট",
  "Delete entry": "এন্ট্রি মুছুন",

  // Quick Sale panel
  "Add at least one item": "অন্তত একটি আইটেম যোগ করুন",
  "Choose how the customer paid": "ক্রেতা কীভাবে পরিশোধ করেছেন বেছে নিন",
  Parcel: "পার্সেল",
  "(parcel)": "(পার্সেল)",
  "Recording...": "লেখা হচ্ছে...",
  "Record Order": "অর্ডার লিখুন",

  // Menu item dialog / card grid
  "Edit Menu Item": "মেনু আইটেম সম্পাদনা",
  "Prices are used only for the Daily Sales item breakdown.": "দাম শুধু দৈনিক বিক্রয়ের আইটেম বিভাজনের জন্য ব্যবহৃত হয়।",
  "Price (৳)": "দাম (৳)",
  "Parcel Price (optional)": "পার্সেল দাম (ঐচ্ছিক)",
  "Remove this menu item?": "এই মেনু আইটেমটি সরিয়ে দিতে চান?",
  "No menu items yet. Add your first one above.": "এখনও কোনো মেনু আইটেম নেই। উপরে আপনার প্রথমটি যোগ করুন।",
  parcel: "পার্সেল",
  Soup: "স্যুপ",
  Main: "মেইন",
  Snack: "স্ন্যাক",
  Drink: "পানীয়",
  Other: "অন্যান্য",

  // Actor badge
  "Your name is attached to every entry, edit, and deletion you make, so the audit log stays accountable.":
    "আপনার নাম প্রতিটি এন্ট্রি, সম্পাদনা ও মুছে ফেলার সাথে যুক্ত থাকে, যাতে অডিট লগ জবাবদিহিমূলক থাকে।",
  "e.g. Rahim": "যেমন রহিম",

  // Cash & Bank dialogs
  "Add Cash / Bank Account": "ক্যাশ/ব্যাংক অ্যাকাউন্ট যোগ করুন",
  "For a physical cash box, a bank account, or a mobile banking wallet (bKash, Nagad, Rocket...).":
    "একটি প্রকৃত ক্যাশ বাক্স, ব্যাংক অ্যাকাউন্ট, বা মোবাইল ব্যাংকিং ওয়ালেট (বিকাশ, নগদ, রকেট...) এর জন্য।",
  "e.g. bKash, City Bank - 4521": "যেমন বিকাশ, সিটি ব্যাংক - ৪৫২১",
  "Starting Balance (৳)": "শুরুর ব্যালেন্স (৳)",
  "As Of": "তারিখ অনুযায়ী",
  "If this account already has money in it, enter the current balance — it's posted against a Balance Adjustments account so your books stay correct without touching profit.":
    "এই অ্যাকাউন্টে যদি ইতিমধ্যে টাকা থাকে, বর্তমান ব্যালেন্স লিখুন — এটি একটি ব্যালেন্স সমন্বয় হিসাবে যুক্ত হয় যাতে মুনাফায় প্রভাব না ফেলে হিসাব সঠিক থাকে।",
  "Edit account": "অ্যাকাউন্ট সম্পাদনা",
  "Edit Account": "অ্যাকাউন্ট সম্পাদনা",
  "Renaming doesn't affect its balance or history.": "নাম পরিবর্তনে ব্যালেন্স বা ইতিহাসে কোনো প্রভাব পড়ে না।",
  "Description (optional)": "বিবরণ (ঐচ্ছিক)",
  "Adjust balance": "ব্যালেন্স সমন্বয়",
  "Adjust Balance": "ব্যালেন্স সমন্বয়",
  "Current ledger balance:": "বর্তমান খাতা ব্যালেন্স:",
  "Enter what it should actually be (e.g. after counting the cash box) and a correction entry is posted for the difference.":
    "এটি প্রকৃতপক্ষে কত হওয়া উচিত তা লিখুন (যেমন ক্যাশ গুনে দেখার পর) এবং পার্থক্যের জন্য একটি সংশোধনী এন্ট্রি যুক্ত হবে।",
  "Correct Balance (৳)": "সঠিক ব্যালেন্স (৳)",
  "Note (optional)": "নোট (ঐচ্ছিক)",
  "e.g. Cash count on 16 Aug": "যেমন ১৬ আগস্ট ক্যাশ গণনা",
  "Save Correction": "সংশোধনী সংরক্ষণ",
  "Transfer Between Accounts": "অ্যাকাউন্টের মধ্যে স্থানান্তর",
  "e.g. depositing today's cash into the bank, or moving bKash to the bank.":
    "যেমন আজকের ক্যাশ ব্যাংকে জমা দেওয়া, বা বিকাশ থেকে ব্যাংকে স্থানান্তর।",
  From: "থেকে",
  To: "প্রতি",
  "e.g. Bank deposit": "যেমন ব্যাংক জমা",
  "No cash/bank accounts yet. Add one above.": "এখনও কোনো ক্যাশ/ব্যাংক অ্যাকাউন্ট নেই। উপরে একটি যোগ করুন।",

  // Partner dialog / table
  "Edit partner": "অংশীদার সম্পাদনা",
  "Edit Partner": "অংশীদার সম্পাদনা",
  "A dedicated equity account is created automatically for each partner.": "প্রতিটি অংশীদারের জন্য স্বয়ংক্রিয়ভাবে একটি নিজস্ব মূলধন হিসাব তৈরি হয়।",
  "Phone (optional)": "ফোন (ঐচ্ছিক)",
  "Share % (optional)": "অংশ % (ঐচ্ছিক)",
  Phone: "ফোন",
  "Share %": "অংশ %",
  "Equity Balance": "মূলধন ব্যালেন্স",

  // Account dialog / table
  "This is a core account used by the posting engine — only its name and description can change.":
    "এটি পোস্টিং ইঞ্জিন কর্তৃক ব্যবহৃত একটি মূল অ্যাকাউন্ট — শুধু এর নাম ও বিবরণ পরিবর্তনযোগ্য।",
  "Custom accounts can be used with the Manual Adjustment entry category.": "নতুন অ্যাকাউন্ট ম্যানুয়াল সমন্বয় এন্ট্রি বিভাগে ব্যবহার করা যায়।",
  Code: "কোড",
  Asset: "সম্পদ",
  Liability: "দায়",
  Expense: "ব্যয়",
  Core: "মূল",

  // Full Day Entry form
  "Anything worth noting about today's sales": "আজকের বিক্রয় সম্পর্কে উল্লেখযোগ্য কিছু থাকলে লিখুন",
  "Amount collected, by account": "অ্যাকাউন্ট অনুযায়ী আদায়কৃত পরিমাণ",
  "Item breakdown (optional, approximate)": "আইটেম বিভাজন (ঐচ্ছিক, আনুমানিক)",
  "Items subtotal:": "আইটেম উপমোট:",
  Item: "আইটেম",
  "Regular Qty": "নিয়মিত পরিমাণ",
  "Parcel Qty": "পার্সেল পরিমাণ",
  "Heads up: item subtotal differs from the amount collected by": "লক্ষ্য করুন: আইটেম উপমোট এবং আদায়কৃত পরিমাণের মধ্যে পার্থক্য",
  "That's fine — item breakdown is approximate.": "এটি স্বাভাবিক — আইটেম বিভাজন আনুমানিক।",
  "Record Daily Sales": "দৈনিক বিক্রয় লিখুন",
  "Delete this daily sales record? This cannot be undone.": "এই দৈনিক বিক্রয় রেকর্ডটি মুছে ফেলবেন? এটি পূর্বাবস্থায় ফেরানো যাবে না।",
  "Daily sales record deleted": "দৈনিক বিক্রয় রেকর্ড মুছে ফেলা হয়েছে",
  Sources: "উৎস",
  Total: "মোট",
  Items: "আইটেম",
};

export function t(lang: Lang, en: string): string {
  if (lang !== "bn") return en;
  return BN[en] ?? en;
}
