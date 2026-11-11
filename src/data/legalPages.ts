export interface LegalPageDef {
  slug: string;
  category: 'about' | 'legal' | 'editorial';
  titleEn: string;
  titleUr: string;
  seoTitleEn: string;
  seoTitleUr: string;
  metaDescEn: string;
  metaDescUr: string;
  effectiveDate: string;
  sectionsEn: { heading: string; body: string }[];
  sectionsUr: { heading: string; body: string }[];
}

export const LEGAL_PAGES: LegalPageDef[] = [
  {
    slug: 'about',
    category: 'about',
    titleEn: 'About Us',
    titleUr: 'ہمارے بارے میں',
    seoTitleEn: 'About Us | 360Khabarnama',
    seoTitleUr: 'ہمارے بارے میں | 360 خبرنامہ',
    metaDescEn: 'Learn about 360Khabarnama, our bilingual English and Urdu news coverage, live market data, weather, cricket, education results, and editorial standards.',
    metaDescUr: '360 خبرنامہ، ہماری دو لسانی انگریزی اور اردو خبروں، لائیو مارکیٹ ڈیٹا، موسم، کرکٹ، تعلیمی نتائج اور ادارتی معیارات کے بارے میں جانیں۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Our Purpose',
        body: '360Khabarnama (https://360khabarnama.com) is a bilingual digital news and information portal serving readers in English and Urdu. Our goal is to provide timely news, verified public data, and practical everyday tools in one accessible platform.'
      },
      {
        heading: 'What We Cover',
        body: 'We publish national and international news alongside live financial and market rates (gold, currency exchange, PSX, fuel prices), city-level weather forecasts, cricket scores, BISE education results, Islamic resources, and daily utility calculators.'
      },
      {
        heading: 'Editorial Standards & Verified Sources',
        body: 'We rely on official government announcements, institutional publications, and verified data APIs. Where AI tools assist with translation, summarization, or metadata formatting, automated outputs are subject to our AI Content Policy and editorial review.'
      }
    ],
    sectionsUr: [
      {
        heading: 'ہمارا مقصد',
        body: '360 خبرنامہ (https://360khabarnama.com) ایک دو لسانی ڈیجیٹل نیوز اور انفارمیشن پورٹل ہے جو انگریزی اور اردو دونوں زبانوں میں قارئین کو بروقت خبریں، تصدیق شدہ عوامی معلومات اور روزمرہ کے مفید ٹولز فراہم کرتا ہے۔'
      },
      {
        heading: 'ہماری خدمات',
        body: 'ہم ملکی و بین الاقوامی خبروں کے ساتھ سونے اور کرنسی کے ریٹس، پیٹرول کی قیمتیں، موسم کی صورتحال، کرکٹ اسکور، تعلیمی بورڈ کے نتائج، اسلامی معلومات اور آن لائن کیلکولیٹرز فراہم کرتے ہیں۔'
      },
      {
        heading: 'ادارتی معیار اور مصدقہ ذرائع',
        body: 'ہم سرکاری اعلانات، ادارہ جاتی رپورٹس اور مستند ڈیٹا ذرائع پر انحصار کرتے ہیں۔ جہاں ترجمہ یا خلاصہ نگاری میں اے آئی کی مدد لی جاتی ہے، وہاں ہماری اے آئی پالیسی اور ادارتی اصولوں کی پابندی کی جاتی ہے۔'
      }
    ]
  },
  {
    slug: 'contact',
    category: 'about',
    titleEn: 'Contact Us',
    titleUr: 'ہم سے رابطہ کریں',
    seoTitleEn: 'Contact Us | 360Khabarnama',
    seoTitleUr: 'ہم سے رابطہ کریں | 360 خبرنامہ',
    metaDescEn: 'Contact 360Khabarnama for general enquiries, editorial feedback, news corrections, copyright complaints, or advertising enquiries.',
    metaDescUr: 'عمومی معلومات، ادارتی رائے، خبروں کی تصحیح، کاپی رائٹ شکایات یا اشتہارات کے لیے 360 خبرنامہ سے رابطہ کریں۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Get in Touch',
        body: 'Use the contact form below to reach the 360Khabarnama team for general enquiries, editorial questions, news corrections, copyright complaints, advertising enquiries, or technical feedback. All submissions are stored securely for review by our team.'
      }
    ],
    sectionsUr: [
      {
        heading: 'رابطہ کی تفصیلات',
        body: 'عمومی سوالات، ادارتی معاملات، خبروں کی تصحیح، کاپی رائٹ شکایات، اشتہارات یا تکنیکی رائے کے لیے نیچے دیا گیا فارم پُر کریں۔ آپ کا پیغام محفوظ طریقے سے ہماری ٹیم کو موصول ہو جائے گا۔'
      }
    ]
  },
  {
    slug: 'privacy-policy',
    category: 'legal',
    titleEn: 'Privacy Policy',
    titleUr: 'رازداری کی پالیسی',
    seoTitleEn: 'Privacy Policy | 360Khabarnama',
    seoTitleUr: 'رازداری کی پالیسی | 360 خبرنامہ',
    metaDescEn: 'Read the 360Khabarnama Privacy Policy explaining how we handle contact submissions, analytics, cookies, and third-party advertising.',
    metaDescUr: '360 خبرنامہ کی رازداری کی پالیسی پڑھیں جس میں ڈیٹا، کوکیز، اینالیٹکس اور اشتہارات سے متعلق معلومات شامل ہیں۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: '1. Information We Collect',
        body: '360Khabarnama collects information you voluntarily provide through our contact, correction, copyright, advertising, and newsletter forms (such as your name, email address, and message). We also process standard technical data such as IP addresses, browser type, and device identifiers for security and analytics.'
      },
      {
        heading: '2. Cookies, Analytics & Third-Party Advertising',
        body: 'We use essential storage for language and consent preferences. When enabled and consented, third-party services such as Google Analytics and Google AdSense may use cookies, web beacons, IP addresses, or similar identifiers to measure traffic and serve ads. Learn how Google uses data when you use our site at https://policies.google.com/technologies/partner-sites and manage your ad preferences at https://myadcenter.google.com/.'
      },
      {
        heading: '3. Data Retention, Security & Your Rights',
        body: 'We retain submitted enquiries only as long as necessary to respond and maintain editorial or legal records. You may withdraw cookie consent at any time via Privacy Choices in the footer or contact us to request access or deletion of your submitted data.'
      },
      {
        heading: '4. Children’s Privacy & Policy Updates',
        body: '360Khabarnama is not directed at children under 13. We may update this Privacy Policy periodically, and changes will be reflected with an updated effective date.'
      }
    ],
    sectionsUr: [
      {
        heading: '1. معلومات کا حصول',
        body: '360 خبرنامہ وہ معلومات جمع کرتا ہے جو آپ رابطہ فارم، تصحیح، کاپی رائٹ، اشتہارات یا نیوز لیٹر کے ذریعے فراہم کرتے ہیں (جیسے نام، ای میل اور پیغام)۔ سیکیورٹی اور تجزیات کے لیے آئی پی ایڈریس اور براؤزر کی معلومات بھی پروسیس ہو سکتی ہیں۔'
      },
      {
        heading: '2. کوکیز، اینالیٹکس اور اشتہارات',
        body: 'ہم زبان اور رضامندی کی ترجیحات کے لیے ضروری اسٹوریج استعمال کرتے ہیں۔ رضامندی کی صورت میں Google Analytics اور Google AdSense جیسی خدمات کوکیز یا ویب بیکنز استعمال کر سکتی ہیں۔ گوگل کے ڈیٹا استعمال کے بارے میں https://policies.google.com/technologies/partner-sites پر جانیں اور https://myadcenter.google.com/ پر اشتہاری ترجیحات منظم کریں۔'
      },
      {
        heading: '3. ڈیٹا کا تحفظ اور آپ کے حقوق',
        body: 'ہم موصول ہونے والی درخواستوں کو صرف ضروری مدت تک محفوظ رکھتے ہیں۔ آپ فوٹر میں موجود پرائیویسی چوائسز کے ذریعے اپنی رضامندی تبدیل کر سکتے ہیں۔'
      }
    ]
  },
  {
    slug: 'terms',
    category: 'legal',
    titleEn: 'Terms and Conditions',
    titleUr: 'شرائط و ضوابط',
    seoTitleEn: 'Terms and Conditions | 360Khabarnama',
    seoTitleUr: 'شرائط و ضوابط | 360 خبرنامہ',
    metaDescEn: 'Terms and Conditions governing the use of 360Khabarnama news, tools, and information services.',
    metaDescUr: '360 خبرنامہ کی ویب سائٹ، خبروں اور آن لائن ٹولز کے استعمال کے قواعد و ضوابط۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Acceptance & Permitted Use',
        body: 'By accessing https://360khabarnama.com, you agree to use the website lawfully and for personal, non-commercial informational purposes unless otherwise authorized.'
      },
      {
        heading: 'Intellectual Property & External Links',
        body: 'Original content, branding, and layout on 360Khabarnama are protected by applicable intellectual property laws. External links are provided for reference; we are not responsible for third-party websites.'
      },
      {
        heading: 'Limitation of Liability',
        body: 'Information, market rates, weather forecasts, and calculators are provided on an "as-is" basis for general informational purposes without warranties of any kind.'
      }
    ],
    sectionsUr: [
      {
        heading: 'شرائط کی منظوری',
        body: 'https://360khabarnama.com استعمال کرنے کا مطلب ہے کہ آپ ان شرائط و ضوابط سے اتفاق کرتے ہیں۔ ویب سائٹ کا استعمال صرف قانونی اور معلوماتی مقاصد کے لیے ہونا چاہیے۔'
      },
      {
        heading: 'دانشورانہ ملکیت اور بیرونی لنکس',
        body: '360 خبرنامہ کا اصل مواد اور برانڈنگ کاپی رائٹ قوانین کے تحت محفوظ ہے۔ بیرونی ویب سائٹس کے مواد کی ذمہ داری ہم پر عائد نہیں ہوتی۔'
      }
    ]
  },
  {
    slug: 'disclaimer',
    category: 'legal',
    titleEn: 'Disclaimer',
    titleUr: 'دستبرداری (ڈسکلیمر)',
    seoTitleEn: 'Disclaimer | 360Khabarnama',
    seoTitleUr: 'دستبرداری | 360 خبرنامہ',
    metaDescEn: 'General disclaimer regarding news, market rates, weather, sports, and informational tools on 360Khabarnama.',
    metaDescUr: '360 خبرنامہ پر شائع ہونے والی خبروں، مارکیٹ ریٹس، موسم اور ٹولز سے متعلق عمومی دستبرداری۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Informational Purpose Only',
        body: 'All content published on 360Khabarnama is for general informational purposes. While we strive for accuracy using verified sources, we do not guarantee completeness or real-time perfection across third-party data feeds.'
      },
      {
        heading: 'Weather, Sports & Third-Party Feeds',
        body: 'Weather forecasts and live sports scores depend on external data providers and may experience update delays or forecast uncertainty.'
      }
    ],
    sectionsUr: [
      {
        heading: 'صرف معلوماتی مقصد',
        body: '360 خبرنامہ پر شائع تمام مواد صرف عمومی معلومات کے لیے ہے۔ ہم مصدقہ ذرائع سے درست معلومات فراہم کرنے کی کوشش کرتے ہیں، تاہم بیرونی ڈیٹا فیڈز میں تاخیر یا تبدیلی ممکن ہے۔'
      }
    ]
  },
  {
    slug: 'cookie-policy',
    category: 'legal',
    titleEn: 'Cookie Policy',
    titleUr: 'کوکی پالیسی',
    seoTitleEn: 'Cookie Policy | 360Khabarnama',
    seoTitleUr: 'کوکی پالیسی | 360 خبرنامہ',
    metaDescEn: 'Details on essential, analytics, and advertising cookies used by 360Khabarnama and how to manage your consent.',
    metaDescUr: '360 خبرنامہ پر استعمال ہونے والی ضروری، اینالیٹکس اور اشتہاری کوکیز اور رضامندی منظم کرنے کا طریقہ۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Types of Cookies We Use',
        body: 'Essential cookies/local storage remember your language (English/Urdu) and privacy consent settings. Analytics and advertising cookies are only activated in accordance with your consent choices.'
      },
      {
        heading: 'Managing Your Consent',
        body: 'You can update or withdraw your consent preferences at any time using the "Privacy Choices" link in the website footer or through your browser settings.'
      }
    ],
    sectionsUr: [
      {
        heading: 'کوکیز کی اقسام',
        body: 'ضروری کوکیز آپ کی زبان (انگریزی/اردو) اور رازداری کی ترجیحات کو یاد رکھتی ہیں۔ اینالیٹکس اور اشتہاری کوکیز صرف آپ کی رضامندی کے مطابق فعال ہوتی ہیں۔'
      },
      {
        heading: 'رضامندی کا انتظام',
        body: 'آپ فوٹر میں موجود "پرائیویسی چوائسز" لنک یا اپنے براؤزر کی سیٹنگز کے ذریعے کسی بھی وقت اپنی رضامندی تبدیل کر سکتے ہیں۔'
      }
    ]
  },
  {
    slug: 'editorial-policy',
    category: 'editorial',
    titleEn: 'Editorial Policy',
    titleUr: 'ادارتی پالیسی',
    seoTitleEn: 'Editorial Policy | 360Khabarnama',
    seoTitleUr: 'ادارتی پالیسی | 360 خبرنامہ',
    metaDescEn: 'Editorial independence, source verification, news vs. opinion separation, and accountability standards at 360Khabarnama.',
    metaDescUr: '360 خبرنامہ کی ادارتی آزادی، ذرائع کی تصدیق اور صحافتی معیارات۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Editorial Independence & Accuracy',
        body: '360Khabarnama maintains editorial independence from advertisers and external sponsors. News reporting is separated from opinion and sponsored content.'
      },
      {
        heading: 'Sourcing & Accountability',
        body: 'We attribute official statements, institutional data, and syndicated sources clearly. Errors brought to our attention are reviewed and corrected transparently.'
      }
    ],
    sectionsUr: [
      {
        heading: 'ادارتی آزادی اور درستگی',
        body: '360 خبرنامہ اشتہاری دباؤ سے آزاد ادارتی پالیسی پر عمل پیرا ہے۔ خبروں، تجزیوں اور اسپانسرڈ مواد کو واضح طور پر الگ رکھا جاتا ہے۔'
      }
    ]
  },
  {
    slug: 'corrections-policy',
    category: 'editorial',
    titleEn: 'Corrections Policy',
    titleUr: 'تصحیح کی پالیسی',
    seoTitleEn: 'Corrections Policy | 360Khabarnama',
    seoTitleUr: 'تصحیح کی پالیسی | 360 خبرنامہ',
    metaDescEn: 'How 360Khabarnama handles factual corrections, article updates, and reader correction requests.',
    metaDescUr: '360 خبرنامہ پر خبروں کی تصحیح، اپ ڈیٹس اور قارئین کی درخواستوں کا طریقہ کار۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Our Commitment to Corrections',
        body: 'When a factual error is identified in any published article, we investigate the evidence and update the article promptly with a clear correction notice and audit trail.'
      }
    ],
    sectionsUr: [
      {
        heading: 'تصحیح کا عزم',
        body: 'اگر کسی شائع شدہ خبر میں کوئی حقائق پر مبنی غلطی پائی جائے تو ہم شواہد کا جائزہ لے کر فوری تصحیح کرتے ہیں اور اپ ڈیٹ کا ریکارڈ برقرار رکھتے ہیں۔'
      }
    ]
  },
  {
    slug: 'fact-checking-policy',
    category: 'editorial',
    titleEn: 'Fact-Checking Policy',
    titleUr: 'حقائق کی جانچ کی پالیسی',
    seoTitleEn: 'Fact-Checking Policy | 360Khabarnama',
    seoTitleUr: 'حقائق کی جانچ کی پالیسی | 360 خبرنامہ',
    metaDescEn: 'Fact-checking methodology and source verification practices at 360Khabarnama.',
    metaDescUr: '360 خبرنامہ پر خبروں اور معلومات کی تصدیق کا طریقہ کار۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Verification Methodology',
        body: 'Claims, statistics, and public announcements are checked against primary official sources, government portals, and established news agencies before publication.'
      }
    ],
    sectionsUr: [
      {
        heading: 'تصدیق کا طریقہ کار',
        body: 'اشاعت سے قبل دعوؤں، اعدادوشمار اور سرکاری اعلانات کی جانچ بنیادی سرکاری ذرائع اور مستند خبر رساں اداروں سے کی جاتی ہے۔'
      }
    ]
  },
  {
    slug: 'ai-content-policy',
    category: 'editorial',
    titleEn: 'AI Content Policy',
    titleUr: 'اے آئی مواد کی پالیسی',
    seoTitleEn: 'AI Content Policy | 360Khabarnama',
    seoTitleUr: 'اے آئی مواد کی پالیسی | 360 خبرنامہ',
    metaDescEn: 'Transparent disclosure of how 360Khabarnama uses Gemini AI for translation, summarization, and SEO metadata.',
    metaDescUr: '360 خبرنامہ پر ترجمہ، خلاصہ نگاری اور ایس ای او میٹا ڈیٹا میں اے آئی کے شفاف استعمال کی پالیسی۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'How We Use AI',
        body: '360Khabarnama uses Gemini AI to assist with English-Urdu translation, article summarization, and SEO metadata generation. Automated summaries are never presented as first-hand reporting, and source attribution is preserved.'
      }
    ],
    sectionsUr: [
      {
        heading: 'اے آئی کا استعمال',
        body: '360 خبرنامہ انگریزی اور اردو ترجمے، خلاصہ نگاری اور ایس ای او میٹا ڈیٹا کے لیے جیمنائی اے آئی کی مدد لیتا ہے۔ خودکار خلاصوں کو کبھی براہِ راست رپورٹنگ کے طور پر پیش نہیں کیا جاتا۔'
      }
    ]
  },
  {
    slug: 'copyright-policy',
    category: 'legal',
    titleEn: 'Copyright & Content Removal Policy',
    titleUr: 'کاپی رائٹ اور مواد ہٹانے کی پالیسی',
    seoTitleEn: 'Copyright & Content Removal Policy | 360Khabarnama',
    seoTitleUr: 'کاپی رائٹ پالیسی | 360 خبرنامہ',
    metaDescEn: 'Submit a copyright or content removal request to 360Khabarnama.',
    metaDescUr: '360 خبرنامہ پر کاپی رائٹ شکایت یا مواد ہٹانے کی درخواست جمع کروائیں۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Copyright & Attribution',
        body: '360Khabarnama respects intellectual property rights. If you believe any content or image infringes your copyright, please submit a detailed removal request using the form below.'
      }
    ],
    sectionsUr: [
      {
        heading: 'کاپی رائٹ اور ملکیت',
        body: '360 خبرنامہ دانشورانہ ملکیت کے حقوق کا احترام کرتا ہے۔ اگر آپ کو لگتا ہے کہ کسی مواد یا تصویر سے آپ کے کاپی رائٹ کی خلاف ورزی ہوئی ہے تو نیچے دیے گئے فارم کے ذریعے درخواست جمع کروائیں۔'
      }
    ]
  },
  {
    slug: 'advertising-policy',
    category: 'legal',
    titleEn: 'Advertising Policy',
    titleUr: 'اشتہارات کی پالیسی',
    seoTitleEn: 'Advertising Policy | 360Khabarnama',
    seoTitleUr: 'اشتہارات کی پالیسی | 360 خبرنامہ',
    metaDescEn: '360Khabarnama advertising standards, Google AdSense, sponsored content labels, and editorial independence.',
    metaDescUr: '360 خبرنامہ کے اشتہاری معیارات، گوگل ایڈسینس اور اسپانسرڈ مواد کی پالیسی۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Advertising Standards',
        body: 'All advertisements and sponsored content on 360Khabarnama are clearly labeled and visually separated from editorial news. We do not allow deceptive ads or misleading click prompts.'
      }
    ],
    sectionsUr: [
      {
        heading: 'اشتہاری معیارات',
        body: '360 خبرنامہ پر تمام اشتہارات اور اسپانسرڈ مواد کو واضح طور پر نشان زد کیا جاتا ہے اور انہیں خبروں سے الگ رکھا جاتا ہے۔'
      }
    ]
  },
  {
    slug: 'advertise',
    category: 'about',
    titleEn: 'Advertise With Us',
    titleUr: 'ہمارے ساتھ اشتہار دیں',
    seoTitleEn: 'Advertise With Us | 360Khabarnama',
    seoTitleUr: 'ہمارے ساتھ اشتہار دیں | 360 خبرنامہ',
    metaDescEn: 'Partner with 360Khabarnama for display advertising and sponsored campaigns.',
    metaDescUr: '360 خبرنامہ پر ڈسپلے اشتہارات اور اسپانسرڈ مہمات کے لیے رابطہ کریں۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Advertising Enquiries',
        body: 'Reach our bilingual English and Urdu audience across news, finance, sports, and utility pages. Submit your campaign enquiry using the form below.'
      }
    ],
    sectionsUr: [
      {
        heading: 'اشتہاری رابطہ',
        body: 'انگریزی اور اردو قارئین تک رسائی کے لیے نیچے دیے گئے فارم کے ذریعے اپنی اشتہاری درخواست جمع کروائیں۔'
      }
    ]
  },
  {
    slug: 'ownership-funding',
    category: 'about',
    titleEn: 'Ownership and Funding',
    titleUr: 'ملکیت اور فنڈنگ',
    seoTitleEn: 'Ownership and Funding | 360Khabarnama',
    seoTitleUr: 'ملکیت اور فنڈنگ | 360 خبرنامہ',
    metaDescEn: 'Transparency regarding 360Khabarnama ownership, funding model, and advertising support.',
    metaDescUr: '360 خبرنامہ کی ملکیت، فنڈنگ اور اشتہاری ماڈل سے متعلق شفاف معلومات۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Ownership & Business Model',
        body: '360Khabarnama is an independent digital news and information portal supported by digital advertising and direct sponsorships. Editorial decisions remain independent of commercial partnerships.'
      }
    ],
    sectionsUr: [
      {
        heading: 'ملکیت اور کاروباری ماڈل',
        body: '360 خبرنامہ ایک آزاد ڈیجیٹل نیوز اور انفارمیشن پورٹل ہے جو ڈیجیٹل اشتہارات کے ذریعے چلایا جاتا ہے۔ ادارتی فیصلے تجارتی شراکت داری سے آزاد ہیں۔'
      }
    ]
  },
  {
    slug: 'team',
    category: 'about',
    titleEn: 'Our Team',
    titleUr: 'ہماری ٹیم',
    seoTitleEn: 'Our Team | 360Khabarnama',
    seoTitleUr: 'ہماری ٹیم | 360 خبرنامہ',
    metaDescEn: 'Meet the editorial and technical team behind 360Khabarnama.',
    metaDescUr: '360 خبرنامہ کی ادارتی اور تکنیکی ٹیم کے بارے میں جانیں۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Editorial & Technical Operations',
        body: '360Khabarnama is operated by a dedicated editorial, content verification, and engineering team managing bilingual publishing, live data integrations, and platform reliability.'
      }
    ],
    sectionsUr: [
      {
        heading: 'ادارتی اور تکنیکی ٹیم',
        body: '360 خبرنامہ کی ادارتی اور تکنیکی ٹیم دو لسانی خبروں کی اشاعت، لائیو ڈیٹا انٹیگریشن اور ویب سائٹ کی کارکردگی کی نگرانی کرتی ہے۔'
      }
    ]
  },
  {
    slug: 'sources-methodology',
    category: 'editorial',
    titleEn: 'Sources and Methodology',
    titleUr: 'ذرائع اور طریقہ کار',
    seoTitleEn: 'Sources and Methodology | 360Khabarnama',
    seoTitleUr: 'ذرائع اور طریقہ کار | 360 خبرنامہ',
    metaDescEn: 'Data sources and methodology for finance, weather, cricket, education results, and news on 360Khabarnama.',
    metaDescUr: '360 خبرنامہ پر مالیاتی، موسمی، کرکٹ اور تعلیمی ڈیٹا کے ذرائع اور طریقہ کار۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Verified Data Sources',
        body: 'Financial rates, weather forecasts, cricket scores, and education board updates are sourced from official institutional releases and verified third-party APIs.'
      }
    ],
    sectionsUr: [
      {
        heading: 'مصدقہ ڈیٹا ذرائع',
        body: 'مالیاتی ریٹس، موسم کی پیشگوئی، کرکٹ اسکور اور تعلیمی بورڈز کی معلومات سرکاری اعلانات اور مستند اے پی آئیز سے حاصل کی جاتی ہیں۔'
      }
    ]
  },
  {
    slug: 'financial-disclaimer',
    category: 'legal',
    titleEn: 'Financial Disclaimer',
    titleUr: 'مالیاتی دستبرداری',
    seoTitleEn: 'Financial Disclaimer | 360Khabarnama',
    seoTitleUr: 'مالیاتی دستبرداری | 360 خبرنامہ',
    metaDescEn: 'Financial disclaimer for gold prices, currency rates, PSX, crypto, petrol prices, and calculators on 360Khabarnama.',
    metaDescUr: 'سونے کی قیمت، کرنسی ریٹس، اسٹاک مارکیٹ اور مالیاتی کیلکولیٹرز سے متعلق دستبرداری۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Not Financial Advice',
        body: 'Gold rates, currency exchange rates, stock-market figures, cryptocurrency prices, fuel prices, and financial calculators on 360Khabarnama are provided strictly for informational purposes and do not constitute financial or investment advice.'
      }
    ],
    sectionsUr: [
      {
        heading: 'مالیاتی مشورہ نہیں',
        body: '360 خبرنامہ پر سونے، کرنسی، اسٹاک مارکیٹ، کرپٹو، پیٹرول کی قیمتیں اور کیلکولیٹرز صرف معلومات کے لیے ہیں اور انہیں سرمایہ کاری کا مشورہ نہ سمجھا جائے۔'
      }
    ]
  },
  {
    slug: 'health-disclaimer',
    category: 'legal',
    titleEn: 'Health Disclaimer',
    titleUr: 'صحت سے متعلق دستبرداری',
    seoTitleEn: 'Health Disclaimer | 360Khabarnama',
    seoTitleUr: 'صحت سے متعلق دستبرداری | 360 خبرنامہ',
    metaDescEn: 'Medical and health information disclaimer for 360Khabarnama.',
    metaDescUr: '360 خبرنامہ پر صحت سے متعلق مضامین اور ٹولز کی دستبرداری۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Not Medical Advice',
        body: 'Health articles and wellness tools on 360Khabarnama are for general educational purposes only and are not a substitute for professional medical diagnosis, advice, or treatment.'
      }
    ],
    sectionsUr: [
      {
        heading: 'طبی مشورہ نہیں',
        body: '360 خبرنامہ پر صحت سے متعلق مضامین اور ٹولز صرف عمومی آگاہی کے لیے ہیں اور کسی مستند ڈاکٹر کے مشورے کا متبادل نہیں ہیں۔'
      }
    ]
  },
  {
    slug: 'accessibility',
    category: 'about',
    titleEn: 'Accessibility Statement',
    titleUr: 'رسائی کا بیان',
    seoTitleEn: 'Accessibility Statement | 360Khabarnama',
    seoTitleUr: 'رسائی کا بیان | 360 خبرنامہ',
    metaDescEn: '360Khabarnama commitment to web accessibility in English and Urdu.',
    metaDescUr: 'انگریزی اور اردو میں ویب سائٹ تک آسان رسائی کے لیے 360 خبرنامہ کا عزم۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Accessibility Commitment',
        body: 'We strive to ensure 360Khabarnama is accessible to all users, including clear typography, RTL Urdu support, keyboard navigation, and descriptive alt text.'
      }
    ],
    sectionsUr: [
      {
        heading: 'آسان رسائی کا عزم',
        body: 'ہم اس بات کو یقینی بنانے کی کوشش کرتے ہیں کہ 360 خبرنامہ تمام صارفین کے لیے قابلِ رسائی ہو، بشمول واضح فونٹ، اردو آر ٹی ایل سپورٹ اور کی بورڈ نیویگیشن۔'
      }
    ]
  },
  {
    slug: 'sitemap',
    category: 'about',
    titleEn: 'HTML Sitemap',
    titleUr: 'ایچ ٹی ایم ایل سائٹ میپ',
    seoTitleEn: 'HTML Sitemap | 360Khabarnama',
    seoTitleUr: 'ایچ ٹی ایم ایل سائٹ میپ | 360 خبرنامہ',
    metaDescEn: 'Browse all news categories, services, tools, and legal pages on 360Khabarnama.',
    metaDescUr: '360 خبرنامہ کے تمام خبری زمرے، خدمات، ٹولز اور قانونی صفحات دیکھیں۔',
    effectiveDate: '2026-11-10',
    sectionsEn: [
      {
        heading: 'Website Directory',
        body: 'Explore all public sections, live data hubs, and policy pages of 360Khabarnama below.'
      }
    ],
    sectionsUr: [
      {
        heading: 'ویب سائٹ ڈائریکٹری',
        body: 'ذیل میں 360 خبرنامہ کے تمام عوامی صفحات، لائیو ڈیٹا سیکشنز اور پالیسی صفحات دیکھیں۔'
      }
    ]
  }
];

export const LEGAL_PAGE_SLUGS = new Set(LEGAL_PAGES.map((p) => p.slug));
