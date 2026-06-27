/* ============================================
   USSD Quick Pay - Application Logic
   ============================================ */

(function () {
    'use strict';

    // ─── State ───
    const state = {
        provider: null,   // 'jawwal' | 'palpay'
        action: null,     // 'friend' | 'merchant' | 'balance'
        mobile: '',
        amount: '',
        message: '',
    };

    // ─── DOM References ───
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const app = $('.app');
    const providerCards = $$('.provider-card');
    const actionBtns = $$('.action-btn');
    const actionSection = $('#action-section');
    const balanceBtn = $('#balance-btn');
    const inputSection = $('#input-section');
    const mobileInput = $('#mobile-input');
    const amountInput = $('#amount-input');
    const messageInput = $('#message-input');
    const mobileGroup = $('#mobile-group');
    const amountGroup = $('#amount-group');
    const messageGroup = $('#message-group');
    const mobileError = $('#mobile-error');
    const amountError = $('#amount-error');
    const messageError = $('#message-error');
    const generateWrapper = $('#generate-wrapper');
    const generateBtn = $('#generate-btn');
    const resultSection = $('#result-section');
    const ussdCode = $('#ussd-code');
    const callBtn = $('#call-btn');
    const copyBtn = $('#copy-btn');
    const resetBtn = $('#reset-btn');
    const resultProviderTag = $('#result-provider-tag');
    const toast = $('#toast');
    const installBanner = $('#install-banner');
    const installBtn = $('#install-btn');
    const dismissInstall = $('#dismiss-install');

    const pinModal = $('#pin-modal');
    const pinModalClose = $('#pin-modal-close');
    const pinSettingsTrigger = $('#pin-settings-trigger');
    const pinInputJawwal = $('#pin-input-jawwal');
    const pinSaveJawwal = $('#pin-save-jawwal');
    const pinDeleteJawwal = $('#pin-delete-jawwal');
    const pinStatusJawwal = $('#pin-status-jawwal');
    const pinInputPalpay = $('#pin-input-palpay');
    const pinSavePalpay = $('#pin-save-palpay');
    const pinDeletePalpay = $('#pin-delete-palpay');
    const pinStatusPalpay = $('#pin-status-palpay');

    const PIN_KEYS = {
        jawwal: 'ussd_pay_pin_jawwal',
        palpay: 'ussd_pay_pin_palpay',
    };

    // ─── USSD Code Templates ───
    const USSD_TEMPLATES = {
        jawwal: {
            friend:   (mobile, amount) => `*268*1*${mobile}*${amount}#`,
            merchant: (mobile, amount) => `*268*2*${mobile}*${amount}#`,
            balance:  ()               => `*268*3#`,
        },
        palpay: {
            friend:   (mobile, amount) => `*370*1*1*${mobile}*${amount}#`,
            merchant: (mobile, amount) => `*370*1*2*${mobile}*${amount}#`,
        },
    };

    // ─── Helpers ───
    function vibrate(ms = 15) {
        if (navigator.vibrate) navigator.vibrate(ms);
    }

    function showToast(message, duration = 2500) {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => toast.classList.remove('show'), duration);
    }

    function showSection(section) {
        // Small delay for staggered animation
        requestAnimationFrame(() => {
            section.classList.add('visible');
        });
    }

    function hideSection(section) {
        section.classList.remove('visible');
    }

    function scrollToElement(el, delay = 350) {
        setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, delay);
    }

    // ─── Provider Selection ───
    providerCards.forEach((card) => {
        card.addEventListener('click', () => {
            const provider = card.dataset.provider;
            if (state.provider === provider) return;

            vibrate();
            state.provider = provider;
            state.action = null;

            // Update provider card visuals
            providerCards.forEach((c) => {
                c.classList.remove('selected', 'dimmed');
                if (c.dataset.provider !== provider) {
                    c.classList.add('dimmed');
                }
            });
            card.classList.add('selected');

            // Update app theme class
            app.classList.remove('jawwal-active', 'palpay-active');
            app.classList.add(`${provider}-active`);

            // Reset action selection
            actionBtns.forEach((b) => b.classList.remove('selected', 'dimmed'));

            // Show/hide balance button (only for Jawwal)
            if (provider === 'jawwal') {
                balanceBtn.classList.add('show');
            } else {
                balanceBtn.classList.remove('show');
            }

            // Show action section
            showSection(actionSection);
            scrollToElement(actionSection);

            // Hide downstream sections
            hideSection(inputSection);
            hideSection(generateWrapper);
            hideSection(resultSection);

            // Clear inputs
            clearInputs();
        });
    });

    // ─── Action Selection ───
    actionBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (!state.provider) return;

            const action = btn.dataset.action;
            if (state.action === action) return;

            vibrate();
            state.action = action;

            // Update action button visuals
            actionBtns.forEach((b) => {
                b.classList.remove('selected', 'dimmed');
                if (b !== btn && b.classList.contains('show') || (b !== btn && !b.classList.contains('balance-action'))) {
                    b.classList.add('dimmed');
                }
            });
            btn.classList.add('selected');
            
            // Dim unselected visible buttons
            actionBtns.forEach((b) => {
                if (b !== btn) {
                    const isBalance = b.classList.contains('balance-action');
                    const isVisible = isBalance ? b.classList.contains('show') : true;
                    if (isVisible) b.classList.add('dimmed');
                }
            });

            // Hide result section
            hideSection(resultSection);

            if (action === 'balance') {
                // Balance check doesn't need inputs
                hideSection(inputSection);
                hideSection(generateWrapper);

                // Generate the USSD code and call immediately
                const code = USSD_TEMPLATES.jawwal.balance();
                displayResult(code, true);
                triggerCall(code);
            } else {
                // Show input fields
                showSection(inputSection);
                showSection(generateWrapper);
                scrollToElement(inputSection);
                clearInputs();
            }
        });
    });

    // ─── Input Handling ───
    mobileInput.addEventListener('input', () => {
        state.mobile = mobileInput.value.trim();
        clearError(mobileGroup, mobileError);
    });

    amountInput.addEventListener('input', () => {
        state.amount = amountInput.value.trim();
        clearError(amountGroup, amountError);
    });

    messageInput.addEventListener('input', () => {
        state.message = messageInput.value.trim();
        clearError(messageGroup, messageError);
    });

    function clearError(group, errorEl) {
        group.classList.remove('error');
        errorEl.textContent = '';
        errorEl.classList.remove('show');
    }

    function setError(group, errorEl, message) {
        group.classList.add('error');
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }

    function clearInputs() {
        mobileInput.value = '';
        amountInput.value = '';
        messageInput.value = '';
        state.mobile = '';
        state.amount = '';
        state.message = '';
        clearError(mobileGroup, mobileError);
        clearError(amountGroup, amountError);
        clearError(messageGroup, messageError);
    }

    function validateInputs() {
        let valid = true;

        // Validate mobile number
        const mobile = state.mobile.replace(/\s/g, '');
        if (!mobile) {
            setError(mobileGroup, mobileError, 'الرجاء إدخال رقم الجوال');
            valid = false;
        } else if (!/^0[0-9]{8,9}$/.test(mobile)) {
            setError(mobileGroup, mobileError, 'رقم الجوال غير صحيح');
            valid = false;
        }

        // Validate amount
        const amount = parseFloat(state.amount);
        if (!state.amount) {
            setError(amountGroup, amountError, 'الرجاء إدخال المبلغ');
            valid = false;
        } else if (isNaN(amount) || amount <= 0) {
            setError(amountGroup, amountError, 'المبلغ غير صحيح');
            valid = false;
        }

        return valid;
    }

    // ─── Trigger a tel: call ───
    function triggerCall(code) {
        const encodedCode = code.replace(/#/g, '%23');
        window.location.href = `tel:${encodedCode}`;
    }

    // ─── Generate USSD Code & Call Immediately ───
    generateBtn.addEventListener('click', () => {
        vibrate(20);

        if (!state.provider || !state.action) {
            showToast('الرجاء اختيار مزود الخدمة ونوع العملية');
            return;
        }

        if (!validateInputs()) {
            vibrate([20, 50, 20]);
            return;
        }

        const mobile = state.mobile.replace(/\s/g, '');
        const amount = state.amount;
        const template = USSD_TEMPLATES[state.provider][state.action];
        let code = template(mobile, amount);

        // Apply saved PIN if available and not checking balance (disabled for palpay)
        const pin = state.provider === 'jawwal' ? localStorage.getItem(PIN_KEYS.jawwal) : null;
        if (pin && state.action !== 'balance') {
            if (code.endsWith('#')) {
                code = code.slice(0, -1) + `*${pin}#`;
            }
        }

        displayResult(code, false);
        triggerCall(code);
        addToHistory(state.provider, state.action, mobile, amount, code, state.message);
    });

    // ─── Display Result ───
    function displayResult(code, isBalance) {
        ussdCode.textContent = code;
        ussdCode.classList.remove('animate');
        void ussdCode.offsetWidth; // trigger reflow
        ussdCode.classList.add('animate');

        // Set call link
        const encodedCode = code.replace(/#/g, '%23');
        callBtn.href = `tel:${encodedCode}`;
        callBtn.classList.toggle('balance-call', isBalance);

        // Set provider tag
        const providerNames = { jawwal: 'جوال باي', palpay: 'بال باي' };
        resultProviderTag.textContent = providerNames[state.provider];
        resultProviderTag.className = `result-provider-tag ${state.provider}-tag`;

        // Show result section
        hideSection(generateWrapper);
        showSection(resultSection);
        scrollToElement(resultSection, 200);

        vibrate(30);
    }

    // ─── Copy USSD Code ───
    copyBtn.addEventListener('click', () => {
        vibrate();
        const code = ussdCode.textContent;
        if (!code) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                copyBtn.classList.add('copied');
                showToast('تم نسخ الكود ✓');
                setTimeout(() => copyBtn.classList.remove('copied'), 2000);
            }).catch(() => {
                fallbackCopy(code);
            });
        } else {
            fallbackCopy(code);
        }
    });

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            copyBtn.classList.add('copied');
            showToast('تم نسخ الكود ✓');
            setTimeout(() => copyBtn.classList.remove('copied'), 2000);
        } catch (e) {
            showToast('فشل النسخ');
        }
        document.body.removeChild(textarea);
    }

    // ─── Reset ───
    resetBtn.addEventListener('click', () => {
        vibrate();
        resetApp();
    });

    function resetApp() {
        state.provider = null;
        state.action = null;
        state.mobile = '';
        state.amount = '';

        // Reset provider cards
        providerCards.forEach((c) => c.classList.remove('selected', 'dimmed'));

        // Reset action buttons
        actionBtns.forEach((b) => {
            b.classList.remove('selected', 'dimmed');
        });
        balanceBtn.classList.remove('show');

        // Remove theme classes
        app.classList.remove('jawwal-active', 'palpay-active');

        // Hide sections
        hideSection(actionSection);
        hideSection(inputSection);
        hideSection(generateWrapper);
        hideSection(resultSection);

        // Clear inputs
        clearInputs();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ─── Payment History ───
    const HISTORY_KEY = 'ussd_pay_history';
    const MAX_HISTORY = 20;
    const historySection = $('#history-section');
    const historyList = $('#history-list');
    const clearHistoryBtn = $('#clear-history-btn');

    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveHistory(history) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function addToHistory(provider, action, mobile, amount, code, message) {
        const history = getHistory();
        const entry = {
            id: Date.now(),
            provider,
            action,
            mobile: mobile || '',
            amount: amount || '',
            code,
            message: message || '',
            timestamp: new Date().toISOString(),
        };
        history.unshift(entry);
        if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
        saveHistory(history);
        renderHistory();
    }

    function removeFromHistory(id) {
        const item = historyList.querySelector(`[data-history-id="${id}"]`);
        if (item) {
            item.classList.add('removing');
            setTimeout(() => {
                const history = getHistory().filter(e => e.id !== id);
                saveHistory(history);
                renderHistory();
            }, 300);
        }
    }

    function clearHistory() {
        saveHistory([]);
        renderHistory();
        showToast('تم مسح السجل ✓');
    }

    function formatTime(isoStr) {
        try {
            const d = new Date(isoStr);
            const now = new Date();
            const diffMs = now - d;
            const diffMin = Math.floor(diffMs / 60000);
            const diffHr = Math.floor(diffMs / 3600000);
            const diffDay = Math.floor(diffMs / 86400000);

            if (diffMin < 1) return 'الآن';
            if (diffMin < 60) return `منذ ${diffMin} د`;
            if (diffHr < 24) return `منذ ${diffHr} س`;
            if (diffDay < 7) return `منذ ${diffDay} ي`;
            return d.toLocaleDateString('ar-PS', { day: 'numeric', month: 'short' });
        } catch {
            return '';
        }
    }

    function getActionLabel(action) {
        const labels = {
            friend: 'دفع لصديق',
            merchant: 'دفع لتاجر',
            balance: 'استعلام رصيد',
        };
        return labels[action] || action;
    }

    function getProviderLabel(provider) {
        return provider === 'jawwal' ? 'J' : 'P';
    }

    function renderHistory() {
        const history = getHistory();

        if (history.length === 0) {
            historySection.style.display = 'none';
            const divider = document.querySelector('.history-divider');
            if (divider) divider.style.display = 'none';
            return;
        }

        historySection.style.display = '';
        const divider = document.querySelector('.history-divider');
        if (divider) divider.style.display = '';

        historyList.innerHTML = history.map(entry => {
            return `
                <div class="history-item" data-history-id="${entry.id}">
                    <div class="history-provider-dot ${entry.provider}-dot">
                        ${getProviderLabel(entry.provider)}
                    </div>
                    <div class="history-info">
                        <div class="history-top-row">
                            <span class="history-action-label">${getActionLabel(entry.action)}</span>
                            ${entry.mobile ? `<span class="history-mobile">(${entry.mobile})</span>` : ''}
                        </div>
                        <div class="history-bottom-row">
                            ${entry.message ? `
                                <span class="history-message" title="${entry.message}">${entry.message}</span>
                                <span class="history-bullet">•</span>
                            ` : ''}
                            <span class="history-time">${formatTime(entry.timestamp)}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        ${entry.amount ? `<span class="history-amount">₪${entry.amount}</span>` : ''}
                        <button class="history-delete-btn" data-delete-id="${entry.id}" aria-label="حذف">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function loadTransaction(id) {
        const history = getHistory();
        const entry = history.find(e => e.id === id);
        if (!entry) return;

        vibrate(15);

        // Set provider
        state.provider = entry.provider;
        // Update provider card visuals
        providerCards.forEach((c) => {
            c.classList.remove('selected', 'dimmed');
            if (c.dataset.provider !== entry.provider) {
                c.classList.add('dimmed');
            } else {
                c.classList.add('selected');
            }
        });
        
        // Update app theme class
        app.classList.remove('jawwal-active', 'palpay-active');
        app.classList.add(`${entry.provider}-active`);

        // Show/hide balance button (only for Jawwal)
        if (entry.provider === 'jawwal') {
            balanceBtn.classList.add('show');
        } else {
            balanceBtn.classList.remove('show');
        }

        // Show action section
        showSection(actionSection);

        // Set action
        state.action = entry.action;
        // Update action button visuals
        actionBtns.forEach((b) => {
            b.classList.remove('selected', 'dimmed');
            const btnAction = b.dataset.action;
            if (btnAction === entry.action) {
                b.classList.add('selected');
            } else {
                const isBalance = b.classList.contains('balance-action');
                const isVisible = isBalance ? b.classList.contains('show') : true;
                if (isVisible) b.classList.add('dimmed');
            }
        });

        // Hide result section
        hideSection(resultSection);

        if (entry.action === 'balance') {
            hideSection(inputSection);
            hideSection(generateWrapper);
            clearInputs();
        } else {
            // Show input fields
            showSection(inputSection);
            showSection(generateWrapper);
            
            // Populate inputs
            mobileInput.value = entry.mobile || '';
            amountInput.value = entry.amount || '';
            messageInput.value = entry.message || '';
            
            state.mobile = entry.mobile || '';
            state.amount = entry.amount || '';
            state.message = entry.message || '';

            // Clear errors
            clearError(mobileGroup, mobileError);
            clearError(amountGroup, amountError);
            clearError(messageGroup, messageError);
        }

        // Scroll to action or input section
        scrollToElement(inputSection, 150);

        showToast('تم تحميل بيانات العملية ✓');
    }

    // Event delegation for history actions
    historyList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.history-delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            vibrate();
            const id = parseInt(deleteBtn.dataset.deleteId, 10);
            removeFromHistory(id);
            return;
        }

        const historyItem = e.target.closest('.history-item');
        if (historyItem) {
            const id = parseInt(historyItem.dataset.historyId, 10);
            loadTransaction(id);
        }
    });

    clearHistoryBtn.addEventListener('click', () => {
        vibrate(20);
        clearHistory();
    });

    // Initial render
    renderHistory();

    // ─── PWA Install Prompt ───
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show install banner after a short delay
        setTimeout(() => {
            if (!localStorage.getItem('installDismissed')) {
                installBanner.classList.add('show');
            }
        }, 3000);
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                showToast('تم تثبيت التطبيق ✓');
            }
            deferredPrompt = null;
            installBanner.classList.remove('show');
        });
    }

    if (dismissInstall) {
        dismissInstall.addEventListener('click', () => {
            installBanner.classList.remove('show');
            localStorage.setItem('installDismissed', '1');
        });
    }

    // ─── Service Worker Registration ───
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then((reg) => {
                console.log('SW registered:', reg.scope);
            }).catch((err) => {
                console.warn('SW registration failed:', err);
            });
        });
    }

    // ─── Prevent pull-to-refresh on mobile ───
    document.body.addEventListener('touchmove', (e) => {
        if (document.scrollingElement.scrollTop <= 0 && e.touches[0].clientY > 0) {
            // Allow normal scrolling
        }
    }, { passive: true });

    // ─── PIN Handling ───
    function loadSavedPins() {
        // Jawwal Pay
        const jawwalPin = localStorage.getItem(PIN_KEYS.jawwal) || '';
        pinInputJawwal.value = jawwalPin;
        pinInputJawwal.type = 'password';
        updateModalEyeIcon(pinInputJawwal, false);
        if (jawwalPin) {
            pinDeleteJawwal.style.display = 'inline-flex';
            pinStatusJawwal.textContent = 'تم حفظ رمز PIN لـ جوال باي';
            pinStatusJawwal.className = 'pin-status-msg saved';
        } else {
            pinDeleteJawwal.style.display = 'none';
            pinStatusJawwal.textContent = 'لا يوجد رمز PIN لـ جوال باي.';
            pinStatusJawwal.className = 'pin-status-msg empty';
        }

        // PalPay (Disabled)
        localStorage.removeItem(PIN_KEYS.palpay);
        pinInputPalpay.value = '';
        pinInputPalpay.disabled = true;
        pinInputPalpay.type = 'password';
        updateModalEyeIcon(pinInputPalpay, false);
        pinSavePalpay.disabled = true;
        pinDeletePalpay.style.display = 'none';
        pinStatusPalpay.textContent = 'ميزة رمز PIN لـ بال باي معطلة حالياً.';
        pinStatusPalpay.className = 'pin-status-msg disabled';
    }

    function updateModalEyeIcon(inputEl, visible) {
        const toggleBtn = inputEl.parentElement.querySelector('.pin-toggle-btn');
        if (!toggleBtn) return;
        if (visible) {
            toggleBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
            `;
        } else {
            toggleBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            `;
        }
    }

    // Modal controls
    pinSettingsTrigger.addEventListener('click', () => {
        vibrate();
        loadSavedPins();
        pinModal.classList.add('show');
        document.body.style.overflow = 'hidden'; // prevent scroll
    });

    function closePinModal() {
        vibrate();
        pinModal.classList.remove('show');
        document.body.style.overflow = '';
    }

    pinModalClose.addEventListener('click', closePinModal);

    // Close modal on click outside modal card
    pinModal.addEventListener('click', (e) => {
        if (e.target === pinModal) {
            closePinModal();
        }
    });

    // Close on escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pinModal.classList.contains('show')) {
            closePinModal();
        }
    });

    // Eye toggle buttons click
    $$('.pin-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            vibrate();
            const targetId = btn.dataset.target;
            const inputEl = $(`#${targetId}`);
            if (!inputEl) return;
            const isPassword = inputEl.type === 'password';
            inputEl.type = isPassword ? 'text' : 'password';
            updateModalEyeIcon(inputEl, isPassword);
        });
    });

    // Limit inputs to numbers
    [pinInputJawwal, pinInputPalpay].forEach(input => {
        input.addEventListener('input', () => {
            input.value = input.value.replace(/[^0-9]/g, '');
        });
    });

    // Save Jawwal PIN
    pinSaveJawwal.addEventListener('click', () => {
        vibrate(20);
        const val = pinInputJawwal.value.trim();
        if (!val) {
            pinStatusJawwal.textContent = 'الرجاء إدخال رمز PIN أولاً';
            pinStatusJawwal.className = 'pin-status-msg error';
            vibrate([20, 50, 20]);
            return;
        }
        if (!/^[0-9]{4,8}$/.test(val)) {
            pinStatusJawwal.textContent = 'يجب أن يتكون رمز PIN من 4 إلى 8 أرقام';
            pinStatusJawwal.className = 'pin-status-msg error';
            vibrate([20, 50, 20]);
            return;
        }
        localStorage.setItem(PIN_KEYS.jawwal, val);
        showToast('تم حفظ رمز PIN لـ جوال باي بنجاح ✓');
        loadSavedPins();
    });

    // Delete Jawwal PIN
    pinDeleteJawwal.addEventListener('click', () => {
        vibrate(20);
        localStorage.removeItem(PIN_KEYS.jawwal);
        pinInputJawwal.value = '';
        showToast('تم إزالة رمز PIN لـ جوال باي');
        loadSavedPins();
    });

    // Save PalPay PIN (Disabled)
    pinSavePalpay.addEventListener('click', () => {
        vibrate(20);
        showToast('عذراً، ميزة رمز PIN لـ بال باي معطلة حالياً');
    });

    // Delete PalPay PIN (Disabled)
    pinDeletePalpay.addEventListener('click', () => {
        vibrate(20);
        localStorage.removeItem(PIN_KEYS.palpay);
        loadSavedPins();
    });

    pinInputJawwal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            pinSaveJawwal.click();
        }
    });

    pinInputPalpay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            pinSavePalpay.click();
        }
    });

    // ─── Keyboard handling (Enter to generate) ───
    [mobileInput, amountInput, messageInput].forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                generateBtn.click();
            }
        });
    });

})();
