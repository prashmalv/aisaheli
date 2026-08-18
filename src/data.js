// Static UI data: scheme cards, helplines, and lightweight i18n strings.

export const SCHEMES = {
  poshan: {
    id: 'poshan',
    icon: '🍲',
    color: '#2e9e5b',
    tint: '#e8f6ee',
    name: { en: 'Poshan Abhiyaan', hi: 'पोषण अभियान' },
    tag: { en: 'Nutrition & Maternal / Child Health', hi: 'पोषण व मातृ-शिशु स्वास्थ्य' },
    blurb: {
      en: 'Nutrition support, pregnancy & child health, Anganwadi services, PMMVY ₹5,000 benefit.',
      hi: 'पोषण सहायता, गर्भावस्था व बाल स्वास्थ्य, आंगनवाड़ी सेवाएँ, PMMVY ₹5,000 लाभ।',
    },
  },
  vatsalya: {
    id: 'vatsalya',
    icon: '🛡️',
    color: '#f08a24',
    tint: '#fdf1e3',
    name: { en: 'Mission Vatsalya', hi: 'मिशन वात्सल्य' },
    tag: { en: 'Child Protection & Welfare', hi: 'बाल संरक्षण व कल्याण' },
    blurb: {
      en: 'Child safety, CHILDLINE 1098, adoption (CARA), help for children in distress.',
      hi: 'बाल सुरक्षा, चाइल्डलाइन 1098, गोद लेना (CARA), संकटग्रस्त बच्चों की मदद।',
    },
  },
  shakti: {
    id: 'shakti',
    icon: '💪',
    color: '#b0138e',
    tint: '#fbe8f6',
    name: { en: 'Mission Shakti', hi: 'मिशन शक्ति' },
    tag: { en: "Women's Safety & Empowerment", hi: 'महिला सुरक्षा व सशक्तिकरण' },
    blurb: {
      en: 'Women Helpline 181, One Stop Centres, safety from violence, hostels & creches.',
      hi: 'महिला हेल्पलाइन 181, वन स्टॉप सेंटर, हिंसा से सुरक्षा, हॉस्टल व क्रेच।',
    },
  },
}

export const HELPLINES = [
  { num: '181', label: { en: 'Women Helpline', hi: 'महिला हेल्पलाइन' }, color: '#b0138e' },
  { num: '1098', label: { en: 'CHILDLINE (children)', hi: 'चाइल्डलाइन (बच्चे)' }, color: '#f08a24' },
  { num: '112', label: { en: 'Emergency', hi: 'आपातकाल' }, color: '#d92d20' },
  { num: '102', label: { en: 'Medical / Ambulance', hi: 'चिकित्सा / एम्बुलेंस' }, color: '#2e9e5b' },
]

export const T = {
  appName: { en: 'AI Saheli', hi: 'एआई सहेली' },
  appSub: { en: 'Ministry of Women & Child Development', hi: 'महिला एवं बाल विकास मंत्रालय' },
  greetTitle: { en: 'Namaste 🙏', hi: 'नमस्ते 🙏' },
  greetBody: {
    en: 'I am your Saheli. Ask me anything about women & child welfare schemes — in your own language.',
    hi: 'मैं आपकी सहेली हूँ। महिला व बाल कल्याण योजनाओं के बारे में अपनी भाषा में कुछ भी पूछें।',
  },
  chooseHelp: { en: 'What do you need help with?', hi: 'आपको किसमें मदद चाहिए?' },
  helplines: { en: 'Quick helplines', hi: 'तुरंत हेल्पलाइन' },
  askSaheli: { en: 'Ask Saheli', hi: 'सहेली से पूछें' },
  tabHome: { en: 'Home', hi: 'होम' },
  tabChat: { en: 'Chat', hi: 'चैट' },
  tabVoice: { en: 'Talk', hi: 'बात करें' },
  tabDash: { en: 'Ministry', hi: 'मंत्रालय' },

  // --- Voice / avatar screen ---
  voiceName: { en: 'Saheli', hi: 'सहेली' },
  voiceIntro: {
    en: 'Namaste! Tap the button and talk to me — I will listen and reply in your language.',
    hi: 'नमस्ते! बटन दबाकर मुझसे बात करें — मैं सुनूँगी और आपकी भाषा में जवाब दूँगी।',
  },
  voiceGreetSpoken: {
    en: 'Namaste, I am Saheli. How can I help you today?',
    hi: 'नमस्ते, मैं सहेली हूँ। मैं आपकी क्या मदद कर सकती हूँ?',
  },
  vTapToSpeak: { en: 'Tap to speak', hi: 'बोलने के लिए दबाएँ' },
  vListening: { en: 'Listening…', hi: 'सुन रही हूँ…' },
  vThinking: { en: 'Thinking…', hi: 'सोच रही हूँ…' },
  vSpeaking: { en: 'Speaking…', hi: 'बोल रही हूँ…' },
  vTapToStop: { en: 'Tap to stop', hi: 'रोकने के लिए दबाएँ' },
  vHandsFree: { en: 'Hands-free', hi: 'हैंड्स-फ़्री' },
  vYouSaid: { en: 'You said', hi: 'आपने कहा' },
  vReplay: { en: 'Replay', hi: 'फिर सुनें' },
  vAskMore: { en: 'Ask more', hi: 'और पूछें' },
  vClear: { en: 'Clear', hi: 'साफ़ करें' },
  vUnsupported: {
    en: 'Voice needs Chrome or Edge. You can still use the Chat tab to type.',
    hi: 'आवाज़ के लिए Chrome या Edge चाहिए। आप चैट टैब में टाइप कर सकती हैं।',
  },
  vPrivacy: {
    en: '🔒 Speech is processed only to answer you.',
    hi: '🔒 आवाज़ केवल आपको उत्तर देने के लिए उपयोग होती है।',
  },
  inputPlaceholder: { en: 'Type your question…', hi: 'अपना सवाल लिखें…' },
  listening: { en: 'Listening…', hi: 'सुन रही हूँ…' },
  suggested: { en: 'Try asking', hi: 'यह पूछकर देखें' },
  chatIntro: {
    en: "Hello! I'm AI Saheli 🤝 Ask me about Poshan, Vatsalya or Mission Shakti — in any language. Tap the mic to speak.",
    hi: 'नमस्ते! मैं एआई सहेली हूँ 🤝 पोषण, वात्सल्य या मिशन शक्ति के बारे में किसी भी भाषा में पूछें। बोलने के लिए माइक दबाएँ।',
  },
  // --- Login ---
  loginTagline: {
    en: 'Your friendly guide to women & child welfare',
    hi: 'महिला एवं बाल कल्याण में आपकी मददगार',
  },
  roleCitizen: { en: 'Citizen', hi: 'नागरिक' },
  roleOfficer: { en: 'Ministry / Officer', hi: 'मंत्रालय / अधिकारी' },
  mobileLabel: { en: 'Mobile number', hi: 'मोबाइल नंबर' },
  mobilePlaceholder: { en: '10-digit mobile number', hi: '10 अंकों का मोबाइल नंबर' },
  getOtp: { en: 'Get OTP', hi: 'OTP भेजें' },
  otpLabel: { en: 'Enter OTP', hi: 'OTP दर्ज करें' },
  otpPlaceholder: { en: 'Enter the 4-digit OTP', hi: '4 अंकों का OTP दर्ज करें' },
  verify: { en: 'Verify & Continue', hi: 'सत्यापित कर आगे बढ़ें' },
  changeNumber: { en: 'Change number', hi: 'नंबर बदलें' },
  emailLabel: { en: 'Official email', hi: 'आधिकारिक ईमेल' },
  emailPlaceholder: { en: 'name@gov.in', hi: 'name@gov.in' },
  passwordLabel: { en: 'Password', hi: 'पासवर्ड' },
  passwordPlaceholder: { en: 'Enter password', hi: 'पासवर्ड दर्ज करें' },
  signIn: { en: 'Sign in', hi: 'साइन इन करें' },
  demoOtpHint: { en: 'Demo: enter any 4 digits (e.g. 1234)', hi: 'डेमो: कोई भी 4 अंक डालें (जैसे 1234)' },
  demoOfficerHint: { en: 'Demo: any official email & password works', hi: 'डेमो: कोई भी आधिकारिक ईमेल व पासवर्ड चलेगा' },
  errMobile: { en: 'Please enter a valid 10-digit mobile number.', hi: 'कृपया मान्य 10 अंकों का मोबाइल नंबर डालें।' },
  errOtp: { en: 'Please enter the 4-digit OTP.', hi: 'कृपया 4 अंकों का OTP डालें।' },
  errEmail: { en: 'Please enter a valid email address.', hi: 'कृपया मान्य ईमेल पता डालें।' },
  errPassword: { en: 'Please enter your password.', hi: 'कृपया पासवर्ड डालें।' },
  otpSentTo: { en: 'OTP sent to', hi: 'OTP भेजा गया' },
  consent: {
    en: 'By continuing you agree to use this service for welfare information.',
    hi: 'आगे बढ़कर आप कल्याण संबंधी जानकारी हेतु इस सेवा के उपयोग से सहमत हैं।',
  },
  logout: { en: 'Logout', hi: 'लॉगआउट' },

  dashTitle: { en: 'MoWCD Insights', hi: 'MoWCD इनसाइट्स' },
  dashSub: {
    en: 'Real-time view of citizen interactions across schemes',
    hi: 'योजनाओं में नागरिक संवाद का रीयल-टाइम दृश्य',
  },
  poweredLive: { en: 'Powered by Claude', hi: 'Claude द्वारा संचालित' },
  poweredScripted: { en: 'Demo mode (offline)', hi: 'डेमो मोड (ऑफ़लाइन)' },
}

// Location scopes for grounded retrieval (matches backend state codes).
export const LOCATIONS = [
  { code: 'all', en: 'All India', hi: 'पूरा भारत' },
  { code: 'delhi', en: 'Delhi', hi: 'दिल्ली' },
]

Object.assign(T, {
  locLabel: { en: 'Location', hi: 'स्थान' },
  generic: { en: 'General', hi: 'सामान्य' },
  sourcesLabel: { en: 'Sources (exact passages)', hi: 'स्रोत (सटीक अंश)' },
  jumpToText: { en: 'Jump to text', hi: 'सटीक स्थान खोलें' },
  openPage: { en: 'Open page', hi: 'पेज खोलें' },
  openPdf: { en: 'Open PDF', hi: 'PDF खोलें' },
  openPdfPage: { en: 'Open PDF at page', hi: 'PDF खोलें, पृष्ठ' },
  pageLabel: { en: 'p.', hi: 'पृष्ठ' },
  showDetails: { en: 'Show details', hi: 'विवरण दिखाएँ' },
  hideDetails: { en: 'Hide details', hi: 'विवरण छिपाएँ' },
  matchLabel: { en: 'match', hi: 'मिलान' },
  verifyLabel: { en: 'Verify', hi: 'सत्यापित करें' },
  verifiedBadge: { en: 'Answers from official WCD sources', hi: 'उत्तर आधिकारिक WCD स्रोतों से' },
  // Government / admin console
  adminSub: { en: 'Government Console · source audit', hi: 'सरकारी कंसोल · स्रोत ऑडिट' },
  tabAssistant: { en: 'Assistant', hi: 'सहायक' },
  tabAudit: { en: 'Audit', hi: 'ऑडिट' },
  auditTitle: { en: 'Answer & Source Audit', hi: 'उत्तर व स्रोत ऑडिट' },
  auditSub: {
    en: 'Recent citizen answers with the official sources that backed them.',
    hi: 'हाल के नागरिक उत्तर और उन्हें समर्थित करने वाले आधिकारिक स्रोत।',
  },
  auditEmpty: { en: 'No interactions yet. Ask something in Assistant, or wait for citizen queries.', hi: 'अभी कोई संवाद नहीं। सहायक में कुछ पूछें, या नागरिक प्रश्नों की प्रतीक्षा करें।' },
  auditQ: { en: 'Question', hi: 'प्रश्न' },
  auditA: { en: 'Answer', hi: 'उत्तर' },
  auditNoCite: { en: 'No official source matched (answer withheld / not found).', hi: 'कोई आधिकारिक स्रोत नहीं मिला।' },
  srcRegister: { en: 'Official sources indexed', hi: 'सूचीबद्ध आधिकारिक स्रोत' },
  srcDownload: { en: 'Download CSV', hi: 'CSV डाउनलोड करें' },
  coversLabel: { en: 'This assistant covers', hi: 'यह सहायक इनमें मदद करता है' },
})

export function tr(node, lang) {
  if (!node) return ''
  return node[lang] || node.en || ''
}
