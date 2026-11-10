/* ============================================================
   Munshi AI — Awaaz Aur Home View (Roman Urdu)
   With Natural Language Parser connected directly to the Database,
   precise calculation based on database prices & quantities,
   and edge cases for items/customers not present in DB.
   ============================================================ */

// Web Speech Recognition Controller (Browser Native Free API)
let speechRecognizer = null;

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('Web Speech API is not supported in this browser.');
        return null;
    }

    const recognition = new SpeechRecognition();
    // Urdu (Pakistan) recognition natively built-in
    recognition.lang = 'ur-PK';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
        state.isRecording = true;
        const btn   = document.getElementById('home-mic-btn');
        const title = document.getElementById('voice-status-title');
        const sub   = document.getElementById('voice-status-sub');
        if (btn) {
            btn.classList.add('mic-pulse', 'bg-red-600');
            btn.classList.remove('bg-slate-900');
        }
        if (title) title.innerText = 'Suniye... Ab Urdu Mein Bolein';
        if (sub) sub.innerText   = 'Aap ki awaaz Roman Urdu mein convert ho rahi hai...';
        showToast('Mic on hai: Urdu mein bolein...');
    };

    recognition.onresult = function (event) {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }

        if (transcript.trim()) {
            // Transliterate native Urdu audio speech directly into Roman Urdu
            const romanUrdu = window.UrduTransliteration
                ? window.UrduTransliteration.toRomanUrdu(transcript)
                : transcript;

            const input = document.getElementById('ai-command-input');
            if (input) {
                input.value = romanUrdu;
            }

            const sub = document.getElementById('voice-status-sub');
            if (sub) {
                sub.innerText = `Suna gaya: "${romanUrdu}"`;
            }
        }
    };

    recognition.onerror = function (event) {
        console.error('Speech Recognition Error:', event.error);
        stopVoiceRecordingUI();
        if (event.error === 'not-allowed') {
            showToast('Microphone ki ijazat (permission) nahi mili.');
        } else if (event.error === 'no-speech') {
            showToast('Koi awaaz nahi suni gayi.');
        } else {
            showToast(`Voice error: ${event.error}`);
        }
    };

    recognition.onend = function () {
        stopVoiceRecordingUI();
        const input = document.getElementById('ai-command-input');
        if (input && input.value.trim()) {
            showToast('Awaaz kamyabi se Roman Urdu mein likh li gayi!');
            // Automatically process the transcribed Roman Urdu command into DB confirmation card
            processAICommand();
        }
    };

    return recognition;
}

function stopVoiceRecordingUI() {
    state.isRecording = false;
    const btn   = document.getElementById('home-mic-btn');
    const title = document.getElementById('voice-status-title');
    const sub   = document.getElementById('voice-status-sub');
    if (btn) {
        btn.classList.remove('mic-pulse', 'bg-red-600');
        btn.classList.add('bg-slate-900');
    }
    if (title) title.innerText = 'Bol kar hisaab darj karein';
    if (sub) sub.innerText   = '"Bhai Tariq ko 500 udhaar diya" ya "2kg cheeni naqad bechi"';
}

function toggleVoiceRecording() {
    // If browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!speechRecognizer && SpeechRecognition) {
        speechRecognizer = initSpeechRecognition();
    }

    if (speechRecognizer) {
        if (state.isRecording) {
            speechRecognizer.stop();
        } else {
            try {
                speechRecognizer.start();
            } catch (err) {
                console.warn('Recognition already started or error:', err);
                speechRecognizer.stop();
            }
        }
    } else {
        // Fallback simulation if running in an unsupported environment
        state.isRecording = !state.isRecording;
        const btn   = document.getElementById('home-mic-btn');
        const title = document.getElementById('voice-status-title');
        const sub   = document.getElementById('voice-status-sub');

        if (state.isRecording) {
            btn.classList.add('mic-pulse', 'bg-red-600');
            btn.classList.remove('bg-slate-900');
            title.innerText = 'Suniye... Ab Awaaz Mein Bolein';
            sub.innerText   = 'Awaaz suni ja rahi hai...';

            setTimeout(() => {
                if (!state.isRecording) return;
                stopVoiceRecordingUI();
                const samples = [
                    'Bhai Tariq ko 500 rupay udhaar diya',
                    'Chaudhry Bashir ne 2000 wasooli di',
                    '2 Tapal Chai aur 3kg Cheeni naqad bechi',
                    'Sabun 10 dabba naqad becha'
                ];
                const spoken = samples[Math.floor(Math.random() * samples.length)];
                document.getElementById('ai-command-input').value = spoken;
                processAICommand();
            }, 2400);
        } else {
            stopVoiceRecordingUI();
        }
    }
}

function prefillAICommand(cmd) {
    document.getElementById('ai-command-input').value = cmd;
    processAICommand();
}

/**
 * Intelligent Parser connected with the Database:
 * Parses Urdu numerals & quantities, matches products in database,
 * calculates exact total based on real DB prices,
 * and handles edge case when customer/product is not found in database.
 */
function processAICommand() {
    const input = document.getElementById('ai-command-input');
    const text  = input.value.trim();
    if (!text) return;

    const lower = text.toLowerCase();

    // 1. Check for Wasooli (Payment Received)
    const isWasooli = lower.includes('wasool') || lower.includes('diya cash') || 
                      lower.includes('wapis') || lower.includes('aayi') || lower.includes('jama');

    // 2. Check for Udhaar (Credit)
    const isUdhaar = lower.includes('udhaar') || lower.includes('khata') || 
                     lower.includes('likho') || lower.includes('baqiya');

    // 3. Find Customer in Database
    let matchedCustomer = null;
    for (const c of state.customers) {
        const parts = c.name.toLowerCase().split(' ');
        for (const p of parts) {
            if (p.length > 2 && lower.includes(p)) {
                matchedCustomer = c;
                break;
            }
        }
        if (matchedCustomer) break;
    }

    // Edge Case: If Udhaar or Wasooli requested but customer not found in DB
    if ((isWasooli || isUdhaar) && !matchedCustomer) {
        // Look for candidate name after 'ko' or before 'ne'
        let candidateName = 'Naya Grahak';
        const matchName = text.match(/([a-zA-Z\s]+)\s+(ko|ne)/i);
        if (matchName && matchName[1]) {
            candidateName = matchName[1].trim();
        }

        const numMatch = text.match(/\d+/g);
        const enteredAmt = numMatch ? parseInt(numMatch[numMatch.length - 1], 10) : 0;

        state.pendingAI = {
            isEdgeCase: true,
            edgeCaseType: 'customer_not_found',
            candidateName: candidateName,
            amount: enteredAmt,
            type: isUdhaar ? 'udhaar' : 'wasooli',
            label: 'Grahak Database Mein Mojood Nahi',
            rawText: `"${text}"`,
            message: `Grahak "${candidateName}" database mein nahi mila. Pehle naya khata kholein ya sahi naam darj karein.`
        };

        input.value = '';
        renderPendingAICard();
        showToast('Grahak database mein nahi mila!');
        return;
    }

    // Handle Wasooli with matched customer
    if (isWasooli) {
        const numMatch = text.match(/\d+/g);
        const amount = numMatch ? parseInt(numMatch[numMatch.length - 1], 10) : 0;
        if (amount <= 0) {
            showToast('Bara-e-meherbani wasooli ki raqam batayein');
            return;
        }

        state.pendingAI = {
            isEdgeCase: false,
            customerId: matchedCustomer.id,
            customerName: `${matchedCustomer.name} (${matchedCustomer.role})`,
            amount: amount,
            type: 'wasooli',
            label: 'Wasooli Mili (Paisa Aaya)',
            rawText: `"${text}"`
        };
        input.value = '';
        renderPendingAICard();
        showToast(`Wasooli Rs. ${amount} tasdeeq kay liye tayyar hai`);
        return;
    }

    // Handle pure Udhaar without item listing (e.g., "Bhai Tariq ko 500 udhaar diya")
    const isDirectCashCredit = isUdhaar && (lower.includes('rupay') || lower.includes('rs') || !hasAnyProductKeywords(lower));
    if (isDirectCashCredit && matchedCustomer) {
        const numMatch = text.match(/\d+/g);
        const amount = numMatch ? parseInt(numMatch[numMatch.length - 1], 10) : 500;

        state.pendingAI = {
            isEdgeCase: false,
            customerId: matchedCustomer.id,
            customerName: `${matchedCustomer.name} (${matchedCustomer.role})`,
            amount: amount,
            type: 'udhaar',
            label: 'Naya Udhaar (Naqad/Khata)',
            rawText: `"${text}"`
        };
        input.value = '';
        renderPendingAICard();
        showToast(`Udhaar Rs. ${amount} tasdeeq kay liye tayyar hai`);
        return;
    }

    // 4. Parse Sale / Items from Database
    // Parse quantities and products
    const parsedSale = parseProductsFromText(text, lower);

    // Edge Case: No products matched in database
    if (parsedSale.items.length === 0) {
        const numMatch = text.match(/\d+/g);
        const fallbackAmt = numMatch ? parseInt(numMatch[0], 10) : 0;

        state.pendingAI = {
            isEdgeCase: true,
            edgeCaseType: 'product_not_found',
            rawQuery: text,
            amount: fallbackAmt,
            type: isUdhaar ? 'udhaar' : 'sale',
            label: 'Maal Database Mein Mojood Nahi',
            rawText: `"${text}"`,
            message: `Aap kay jumlay mein se koi bhi cheez godown database se match nahi hui. Sahi naam (Misaal: Cheeni, Chai, Ghee, Chawal) bolein ya pehle naya maal darj karein.`
        };
        input.value = '';
        renderPendingAICard();
        showToast('Maal database mein nahi mila!');
        return;
    }

    // Edge Case: Check for stock sufficiency in Database
    const outOfStockItems = [];
    for (const item of parsedSale.items) {
        if (item.product.stock < item.qty) {
            outOfStockItems.push(`${item.product.name} (Baqiya Stock: ${item.product.stock} ${item.product.unit})`);
        }
    }

    const calculatedTotal = parsedSale.total;
    const itemSummary = parsedSale.items.map(i => `${i.qty} ${i.product.unit} ${i.product.name.split('(')[0].trim()}`).join(', ');

    state.pendingAI = {
        isEdgeCase: outOfStockItems.length > 0,
        edgeCaseType: outOfStockItems.length > 0 ? 'insufficient_stock' : null,
        outOfStockMessage: outOfStockItems.join(', '),
        customerId: isUdhaar && matchedCustomer ? matchedCustomer.id : null,
        customerName: isUdhaar && matchedCustomer ? `${matchedCustomer.name} (${matchedCustomer.role})` : 'Aam Grahak (Naqad)',
        items: parsedSale.items,
        amount: calculatedTotal,
        type: isUdhaar ? 'udhaar' : 'sale',
        label: isUdhaar ? 'Udhaar Bikri' : 'Naqad Bikri (Cash Sale)',
        itemSummary: itemSummary,
        rawText: `"${text}"`
    };

    input.value = '';
    renderPendingAICard();
    showToast(`Asal Hisaab: Rs. ${calculatedTotal} (${parsedSale.items.length} cheezein)`);
}

// Helper: Check if text contains product names
function hasAnyProductKeywords(lower) {
    for (const p of state.products) {
        if (lower.includes(p.name.toLowerCase().split(' ')[0])) return true;
        if (p.aliases && p.aliases.some(a => lower.includes(a))) return true;
    }
    return false;
}

// Match items from database and compute actual sum: (quantity * DB price)
function parseProductsFromText(text, lower) {
    const matched = [];
    let grandTotal = 0;

    // Word to number mapping
    const wordNums = {
        'ek': 1, 'aik': 1, 'one': 1,
        'do': 2, 'two': 2,
        'teen': 3, 'three': 3,
        'char': 4, 'chaar': 4, 'four': 4,
        'paanch': 5, 'panch': 5, 'five': 5,
        'che': 6, 'chhay': 6, 'six': 6,
        'saat': 7, 'seven': 7,
        'aath': 8, 'eight': 8,
        'nau': 9, 'nao': 9, 'nine': 9,
        'das': 10, 'ten': 10
    };

    // Sort products by longest alias first to prevent substring collision
    const sortedProducts = [...state.products].sort((a, b) => b.name.length - a.name.length);

    for (const prod of sortedProducts) {
        const searchTerms = [prod.name.toLowerCase(), ...(prod.aliases || [])];
        let foundTerm = null;

        for (const term of searchTerms) {
            if (lower.includes(term)) {
                foundTerm = term;
                break;
            }
        }

        if (foundTerm) {
            // Find quantity preceding the product term
            // e.g. "2kg cheeni", "3 tapal", "paanch dabba doodh"
            const regex = new RegExp(`(\\d+(\\.\\d+)?|ek|aik|do|teen|chaar|char|paanch|panch|che|saat|aath|das)\\s*(kg|kilo|pack|bori|peti|dabba)?\\s*${foundTerm}`, 'i');
            const match = text.match(regex);

            let qty = 1;
            if (match && match[1]) {
                const rawNum = match[1].toLowerCase();
                if (wordNums[rawNum]) {
                    qty = wordNums[rawNum];
                } else if (!isNaN(parseFloat(rawNum))) {
                    qty = parseFloat(rawNum);
                }
            } else {
                // Check if any standalone number precedes it in a 3-word window
                const words = lower.split(/\s+/);
                const termIndex = words.findIndex(w => w.includes(foundTerm));
                if (termIndex > 0) {
                    const prevWord = words[termIndex - 1];
                    if (wordNums[prevWord]) qty = wordNums[prevWord];
                    else if (!isNaN(parseFloat(prevWord))) qty = parseFloat(prevWord);
                }
            }

            const itemTotal = Math.round(qty * prod.price);
            grandTotal += itemTotal;

            matched.push({
                product: prod,
                qty: qty,
                unitPrice: prod.price,
                total: itemTotal
            });
        }
    }

    // Fallback: If no products found by name, but user explicitly wrote "500 ki bikri"
    if (matched.length === 0) {
        const numMatch = text.match(/\d+/g);
        if (numMatch && (lower.includes('bikri') || lower.includes('sale') || lower.includes('becha'))) {
            const explicitAmt = parseInt(numMatch[numMatch.length - 1], 10);
            return {
                items: [],
                total: explicitAmt
            };
        }
    }

    return {
        items: matched,
        total: grandTotal
    };
}

// Render dynamic AI Card with Edge Case badges
function renderPendingAICard() {
    const container = document.getElementById('ai-pending-container');
    if (!state.pendingAI) { container.innerHTML = ''; return; }

    const p = state.pendingAI;

    // Edge Case: When Customer or Product was NOT found in Database
    if (p.isEdgeCase) {
        container.innerHTML = `
            <div class="bg-amber-950/90 text-amber-100 border border-amber-500/50 rounded-2xl p-5 shadow-lg flex flex-col gap-3 slide-up">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full">
                        Database Alert (Edge Case)
                    </span>
                    <span class="text-xs text-amber-300 italic truncate max-w-[160px]">${p.rawText}</span>
                </div>
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-amber-400 text-2xl shrink-0 mt-0.5">warning</span>
                    <div>
                        <p class="font-bold text-sm text-white">${p.label}</p>
                        <p class="text-xs text-amber-200/90 mt-1 leading-relaxed">${p.message || p.outOfStockMessage}</p>
                    </div>
                </div>
                <div class="flex gap-2 pt-2">
                    ${p.edgeCaseType === 'customer_not_found' ? `
                        <button onclick="openNewCustomerModal(); dismissPendingAI();" class="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all">
                            + Naya Khata Banayein
                        </button>
                    ` : ''}
                    ${p.edgeCaseType === 'product_not_found' ? `
                        <button onclick="openNewProductModal(); dismissPendingAI();" class="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all">
                            + Godown Mein Maal Daalein
                        </button>
                    ` : ''}
                    <button onclick="dismissPendingAI()" class="px-4 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl font-medium text-xs active:scale-95 transition-all">
                        Khatam Karein
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const badgeColor = p.type === 'udhaar' ? 'text-red-400' : 'text-emerald-400';

    container.innerHTML = `
        <div class="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col gap-4 slide-up">
            <div class="flex justify-between items-center">
                <span class="text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-slate-300 px-2.5 py-1 rounded-full">
                    Database Se Asal Rate Tasdeeq
                </span>
                <span class="text-xs text-slate-400 italic truncate max-w-[160px]">${p.rawText}</span>
            </div>
            <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3.5">
                    <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-white text-xl">database</span>
                    </div>
                    <div>
                        <p class="font-semibold text-base leading-snug">${p.customerName || p.itemSummary || 'Naqad Bikri'}</p>
                        <p class="text-xs ${badgeColor} font-medium mt-0.5">${p.label}</p>
                        ${p.items && p.items.length > 0 ? `
                            <p class="text-[11px] text-slate-400 mt-1">
                                ${p.items.map(i => `${i.qty}x ${i.product.name.split('(')[0]} @ Rs.${i.unitPrice}`).join(' + ')}
                            </p>
                        ` : ''}
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <span class="text-[10px] text-slate-400 block uppercase">Kul Hisaab</span>
                    <p class="text-xl font-bold tracking-tight text-emerald-400">Rs. ${p.amount.toLocaleString()}</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-1">
                <button onclick="confirmPendingAI()"
                    class="col-span-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1 shadow-md">
                    <span class="material-symbols-outlined text-[16px]">check</span> Database Mein Darj Karein
                </button>
                <button onclick="dismissPendingAI()"
                    class="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-medium text-xs active:scale-95 transition-all">
                    Khatam Karein
                </button>
            </div>
        </div>
    `;
}

function confirmPendingAI() {
    if (!state.pendingAI || state.pendingAI.isEdgeCase) return;
    const p = state.pendingAI;
    const c = state.customers.find(x => x.id === p.customerId);

    // If sale items are present, deduct real inventory from Database
    if (p.items && p.items.length > 0) {
        for (const item of p.items) {
            const dbProduct = state.products.find(x => x.id === item.product.id);
            if (dbProduct) {
                dbProduct.stock = Math.max(0, +(dbProduct.stock - item.qty).toFixed(1));
            }
        }
    }

    if (p.type === 'udhaar') {
        state.nayaUdhaarToday += p.amount;
        if (c) c.balance += p.amount;
        state.transactions.unshift({ 
            id: Date.now(), 
            title: p.itemSummary ? `${c ? c.name : 'Grahak'} — ${p.itemSummary}` : p.customerName, 
            subtitle: 'AI Udhaar Darj • Abhi abhi', 
            amount: p.amount, 
            type: 'udhaar'  
        });
    } else if (p.type === 'wasooli') {
        state.wasooliToday += p.amount;
        if (c) c.balance = Math.max(0, c.balance - p.amount);
        state.transactions.unshift({ 
            id: Date.now(), 
            title: p.customerName, 
            subtitle: 'AI Wasooli Mili • Abhi abhi', 
            amount: p.amount, 
            type: 'wasooli' 
        });
    } else {
        state.cashSalesToday += p.amount;
        state.transactions.unshift({ 
            id: Date.now(), 
            title: p.itemSummary || 'Naqad Maal Becha', 
            subtitle: 'AI Naqad Bikri • Abhi abhi', 
            amount: p.amount, 
            type: 'sale' 
        });
    }

    state.pendingAI = null;
    persistDB(); // Persist directly to Database
    renderAll();
    showToast('Database Mein Kamiyabi Se Mahfooz Ho Gaya!');
}

function dismissPendingAI() {
    state.pendingAI = null;
    renderPendingAICard();
}

function setHomeTxFilter(filter) {
    state.homeTxFilter = filter;
    document.querySelectorAll('.home-filter-pill').forEach(btn => {
        btn.className = btn.dataset.filter === filter
            ? 'home-filter-pill text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-900 text-white'
            : 'home-filter-pill text-[11px] font-medium px-2.5 py-1 rounded-full text-slate-500 hover:text-slate-900';
    });
    renderHomeTransactions();
}

function renderHomeTransactions() {
    const list = document.getElementById('home-tx-list');
    const filtered = state.transactions.filter(t =>
        state.homeTxFilter === 'all' || t.type === state.homeTxFilter
    );

    list.innerHTML = filtered.slice(0, 6).map(t => {
        const isUdhaar = t.type === 'udhaar';
        const icon     = t.type === 'sale' ? 'shopping_basket' : (t.type === 'wasooli' ? 'account_balance' : 'edit_note');
        const amtColor = isUdhaar ? 'text-red-500' : 'text-slate-900';
        const sign     = isUdhaar ? '-' : '+';
        return `
            <div class="soft-card p-3.5 rounded-2xl flex justify-between items-center slide-up">
                <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <span class="material-symbols-outlined text-[20px]">${icon}</span>
                    </div>
                    <div class="min-w-0">
                        <p class="font-semibold text-sm text-slate-900 truncate">${t.title}</p>
                        <p class="text-xs text-slate-400 truncate">${t.subtitle}</p>
                    </div>
                </div>
                <p class="font-semibold text-sm ${amtColor} shrink-0 pl-2">${sign}Rs. ${t.amount.toLocaleString()}</p>
            </div>
        `;
    }).join('');
}

function goToLowStock() {
    switchTab('stock');
    setStockCategory('low');
}
