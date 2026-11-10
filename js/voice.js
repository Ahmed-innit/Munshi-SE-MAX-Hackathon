/* ============================================================
   Munshi AI — Urdu to Roman Urdu Phonetic Transliteration Engine
   Maps Urdu Arabic script (spoken by Web Speech API) into natural
   Roman Urdu phrases tailored for Kiryana ERP transactions.
   ============================================================ */

const UrduTransliteration = {
    // Whole-word / Phrase dictionary for accurate business context
    phrases: {
        'بھائی': 'bhai',
        'طارق': 'tariq',
        'چوہدری': 'chaudhry',
        'بشیر': 'bashir',
        'راشد': 'rashid',
        'خان': 'khan',
        'ماسٹر': 'master',
        'زاہد': 'zahid',
        'حاجی': 'haji',
        'اسلم': 'aslam',
        'کو': 'ko',
        'نے': 'ne',
        'سے': 'se',
        'کا': 'ka',
        'کی': 'ki',
        'کے': 'ke',
        'پر': 'par',
        'میں': 'mein',

        // Karobari Alfaz
        'ادھار': 'udhaar',
        'قرض': 'udhaar',
        'کھاتہ': 'khata',
        'کھاتے': 'khate',
        'وصولی': 'wasooli',
        'وصول': 'wasool',
        'آئی': 'aayi',
        'آئے': 'aaye',
        'دی': 'di',
        'دیا': 'diya',
        'دیئے': 'diye',
        'لیے': 'liye',
        'لیا': 'liya',
        'بیچا': 'becha',
        'بیچی': 'bechi',
        'فروخت': 'bikri',
        'بکری': 'bikri',
        'سیل': 'sale',
        'نقد': 'naqad',
        'کیش': 'cash',
        'روپے': 'rupay',
        'روپیہ': 'rupay',
        'روپئے': 'rupay',
        'پیسے': 'paise',
        'جمع': 'jama',
        'باقی': 'baqiya',
        'بقایا': 'baqiya',

        // Aitem / Maal
        'چینی': 'cheeni',
        'شکر': 'shakar',
        'چائے': 'chai',
        'پتی': 'patti',
        'ٹیپال': 'tapal',
        'تپال': 'tapal',
        'دانےدار': 'danedar',
        'گھی': 'ghee',
        'میزان': 'mezan',
        'تیل': 'tail',
        'آئل': 'oil',
        'بناسپتی': 'banaspati',
        'چاول': 'chawal',
        'گارڈ': 'guard',
        'باسمتی': 'basmati',
        'دال': 'daal',
        'چنا': 'channa',
        'چنے': 'channay',
        'دودھ': 'doodh',
        'اولپرز': 'olpers',
        'نمک': 'namak',
        'نیشنل': 'national',
        'شان': 'shan',
        'بریانی': 'biryani',
        'مصالحہ': 'masala',
        'صابن': 'sabun',
        'سرف': 'surf',
        'لوڈ': 'load',
        'جاز': 'jazz',
        'زونگ': 'zong',
        'یوفون': 'ufone',
        'ٹیلی نار': 'telenor',
        'پیکج': 'package',
        'آفر': 'offer',

        // Paimayeish (Units)
        'کلو': 'kg',
        'گرام': 'gram',
        'بوری': 'bori',
        'پیٹی': 'peti',
        'ڈبہ': 'dabba',
        'ڈبے': 'dabbe',
        'پیکٹ': 'pack',
        'درجن': 'darjan',
        'لیٹر': 'liter',

        // Adad (Urdu Numbers to Numerals / Roman)
        'ایک': '1',
        'دو': '2',
        'تین': '3',
        'چار': '4',
        'پانچ': '5',
        'چھ': '6',
        'سات': '7',
        'آٹھ': '8',
        'نو': '9',
        'دس': '10',
        'گیارہ': '11',
        'بارہ': '12',
        'تیرہ': '13',
        'چودہ': '14',
        'پندرہ': '15',
        'سولہ': '16',
        'سترہ': '17',
        'اٹھارہ': '18',
        'انیس': '19',
        'بیس': '20',
        'پچیس': '25',
        'تیس': '30',
        'پینتیس': '35',
        'چالیس': '40',
        'پچاس': '50',
        'ساٹھ': '60',
        'ستر': '70',
        'اسی': '80',
        'نوے': '90',
        'سو': '100',
        'ڈیڑھ سو': '150',
        'دو سو': '200',
        'ڈھائی سو': '250',
        'تین سو': '300',
        'چار سو': '400',
        'پانچ سو': '500',
        'چھ سو': '600',
        'سات سو': '700',
        'آٹھ سو': '800',
        'نو سو': '900',
        'ہزار': '1000',
        'دو ہزار': '2000',
        'ڈھائی ہزار': '2500',
        'تین ہزار': '3000',
        'پانچ ہزار': '5000',
        'دس ہزار': '10000',
        'اور': 'aur'
    },

    // Character by character phonetic mapping for arbitrary words
    charMap: {
        'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
        'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
        'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
        'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
        'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o',
        'ہ': 'h', 'ھ': 'h', 'ء': '', 'ی': 'i', 'ے': 'e',
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    },

    /**
     * Converts Urdu script or English into clean Roman Urdu
     */
    toRomanUrdu(text) {
        if (!text) return '';
        let cleaned = text.trim();

        // 1. If text is already mostly Latin characters, just normalize spacing
        const hasUrdu = /[\u0600-\u06FF]/.test(cleaned);
        if (!hasUrdu) {
            return cleaned;
        }

        // 2. Replace multi-word phrases first
        for (const [urdu, roman] of Object.entries(this.phrases)) {
            const regex = new RegExp(urdu, 'g');
            cleaned = cleaned.replace(regex, ` ${roman} `);
        }

        // 3. Process remaining Urdu words token by token
        const tokens = cleaned.split(/\s+/).filter(Boolean);
        const romanizedTokens = tokens.map(token => {
            // Already translated or number
            if (/^[a-zA-Z0-9\-_.]+$/.test(token)) {
                return token;
            }

            // Check dictionary again for single word
            if (this.phrases[token]) {
                return this.phrases[token];
            }

            // Fallback: character-by-character phonetic mapping
            let word = '';
            for (let i = 0; i < token.length; i++) {
                const char = token[i];
                word += (this.charMap[char] !== undefined) ? this.charMap[char] : char;
            }
            return word;
        });

        // Clean up punctuation, spaces, and numbers
        return romanizedTokens.join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
};

window.UrduTransliteration = UrduTransliteration;
