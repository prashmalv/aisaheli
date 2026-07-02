// Scripted fallback used when no ANTHROPIC_API_KEY is configured (or the API
// call fails). Keeps the live demo working offline with curated, safe answers.
// Very lightweight keyword matching over the three demo schemes, bilingual.

const RESPONSES = [
  {
    keys: ['181', 'unsafe', 'asuraksit', 'असुरक्षित', 'सुरक्षित नहीं', 'घर में', 'domestic', 'हिंसा', 'violence', 'beaten', 'beats me', 'pati', 'husband beat', 'maar', 'मार', 'डर लग', 'threat'],
    en: `I'm here with you. If you are in danger right now, please call the **Women Helpline 181** (24x7) or **Emergency 112**.\n\nYou can also go to a **One Stop Centre (Sakhi)** — it gives free medical help, legal aid, police assistance, counselling and a safe place to stay, all in one place.\n\nWould you like me to explain what the One Stop Centre provides, or how to file a complaint safely?`,
    hi: `मैं आपके साथ हूँ। अगर आप अभी ख़तरे में हैं, तो कृपया **महिला हेल्पलाइन 181** (24x7) या **आपातकाल 112** पर कॉल करें।\n\nआप **वन स्टॉप सेंटर (सखी)** भी जा सकती हैं — यहाँ एक ही जगह पर मुफ़्त चिकित्सा मदद, कानूनी सहायता, पुलिस सहायता, काउंसलिंग और सुरक्षित आश्रय मिलता है।\n\nक्या मैं बताऊँ कि वन स्टॉप सेंटर में क्या-क्या मिलता है, या शिकायत सुरक्षित तरीके से कैसे दर्ज करें?`,
  },
  {
    keys: ['one stop', 'sakhi', 'सखी', 'वन स्टॉप'],
    en: `A **One Stop Centre (Sakhi)** supports any woman affected by violence — under Mission Shakti. In one place you get:\n\n• Medical aid\n• Police help & FIR support\n• Free legal counselling\n• Psychological counselling\n• Temporary shelter (up to 5 days)\n\nTo reach one, call **181** and ask for your nearest One Stop Centre, or dial **112** in an emergency.`,
    hi: `**वन स्टॉप सेंटर (सखी)** मिशन शक्ति के तहत हिंसा से पीड़ित किसी भी महिला की मदद करता है। एक ही जगह पर मिलता है:\n\n• चिकित्सा सहायता\n• पुलिस मदद व FIR सहायता\n• मुफ़्त कानूनी सलाह\n• मनोवैज्ञानिक काउंसलिंग\n• अस्थायी आश्रय (5 दिन तक)\n\nनज़दीकी सेंटर के लिए **181** पर कॉल करें, या आपात स्थिति में **112** डायल करें।`,
  },
  {
    keys: ['pregnan', 'garbh', 'गर्भ', 'pmmvy', 'matru', '5000', '5,000', 'maternity', 'मातृत्व'],
    en: `Congratulations! As a pregnant woman you can get several benefits:\n\n• **PMMVY** — ₹5,000 cash benefit for your first child (in instalments), given for pregnancy registration, an antenatal check-up, and your baby's birth registration + first vaccines.\n• **Poshan Abhiyaan** — free Take-Home Ration, growth monitoring and nutrition counselling at your **Anganwadi Centre**.\n• Free antenatal check-ups and immunisation.\n\nTo start: register your pregnancy at your nearest **Anganwadi Centre** with your Aadhaar and a bank account linked to Aadhaar. Shall I tell you what nutrition to focus on during pregnancy?`,
    hi: `बधाई हो! गर्भवती महिला के रूप में आपको कई लाभ मिल सकते हैं:\n\n• **PMMVY** — पहले बच्चे के लिए ₹5,000 की नकद सहायता (किश्तों में), गर्भावस्था पंजीकरण, एक जाँच, और बच्चे के जन्म पंजीकरण व पहले टीके पर।\n• **पोषण अभियान** — आपके **आंगनवाड़ी केंद्र** पर मुफ़्त टेक-होम राशन, वज़न की निगरानी और पोषण सलाह।\n• मुफ़्त प्रसवपूर्व जाँच और टीकाकरण।\n\nशुरू करने के लिए: अपने नज़दीकी **आंगनवाड़ी केंद्र** पर आधार और आधार से जुड़े बैंक खाते के साथ गर्भावस्था पंजीकरण कराएँ। क्या मैं बताऊँ कि गर्भावस्था में किन पोषक चीज़ों पर ध्यान दें?`,
  },
  {
    keys: ['anganwadi', 'आंगनवाड़ी', 'आंगनवाडी', 'nearest', 'nazdiki', 'नज़दीकी'],
    en: `Your **Anganwadi Centre (AWC)** is the local hub for Poshan Abhiyaan services — nutrition, Take-Home Ration, child weighing, immunisation days and counselling.\n\nTo find yours:\n• Ask your local **ASHA or Anganwadi worker** — every village/ward has one.\n• Call **Women Helpline 181** and ask for your area's AWC.\n• Visit the Panchayat/ward office.\n\nTell me your district and I can guide you on what services to ask for there.`,
    hi: `आपका **आंगनवाड़ी केंद्र (AWC)** पोषण अभियान सेवाओं का स्थानीय केंद्र है — पोषण, टेक-होम राशन, बच्चों का वज़न, टीकाकरण दिवस और सलाह।\n\nअपना केंद्र ढूँढने के लिए:\n• अपनी **आशा या आंगनवाड़ी कार्यकर्ता** से पूछें — हर गाँव/वार्ड में एक होती हैं।\n• **महिला हेल्पलाइन 181** पर कॉल करके अपने क्षेत्र का AWC पूछें।\n• पंचायत/वार्ड कार्यालय जाएँ।\n\nअपना ज़िला बताइए, मैं मार्गदर्शन कर सकती हूँ कि वहाँ कौन-सी सेवाएँ माँगें।`,
  },
  {
    keys: ['weight', 'vazan', 'वज़न', 'malnutri', 'kuposhan', 'कुपोषण', 'growth', 'milestone', 'stunt', 'not eating', 'thin'],
    en: `Thank you for looking out for your child. Slow weight gain can be a sign of undernutrition, so let's act early:\n\n• Take your child to the **Anganwadi Centre** for weighing and growth check (on the Poshan Tracker).\n• Ask for **Take-Home Ration** and nutrition counselling.\n• Offer frequent, energy-rich meals — dal, khichdi with ghee, seasonal vegetables, eggs/milk if you can, and keep breastfeeding under 2 years.\n• Meet the **ANM/ASHA** worker if your child is often ill.\n\nWould you like simple, low-cost meal ideas for your child's age?`,
    hi: `अपने बच्चे का ध्यान रखने के लिए धन्यवाद। धीमा वज़न बढ़ना कुपोषण का संकेत हो सकता है, तो जल्दी कदम उठाएँ:\n\n• बच्चे को वज़न और ग्रोथ जाँच के लिए **आंगनवाड़ी केंद्र** ले जाएँ (पोषण ट्रैकर पर)।\n• **टेक-होम राशन** और पोषण सलाह माँगें।\n• बार-बार ऊर्जा से भरपूर भोजन दें — दाल, घी वाली खिचड़ी, मौसमी सब्ज़ियाँ, हो सके तो अंडा/दूध, और 2 साल तक स्तनपान जारी रखें।\n• बच्चा बार-बार बीमार हो तो **ANM/आशा** कार्यकर्ता से मिलें।\n\nक्या मैं आपके बच्चे की उम्र के अनुसार सरल, कम-खर्च वाले भोजन के सुझाव दूँ?`,
  },
  {
    keys: ['1098', 'childline', 'child in', 'missing child', 'child abus', 'abus', 'being hurt', 'in danger', 'बच्चा', 'बच्चे', 'बाल', 'child labour', 'labor', 'trafficking'],
    en: `For any child in distress — lost, being harmed, working, begging, or in danger — call **CHILDLINE 1098** (free, 24x7). Trained people will respond quickly.\n\nUnder **Mission Vatsalya**, children also get shelter, counselling, and protection through the **District Child Protection Unit (DCPU)** and **Child Welfare Committee (CWC)**.\n\nIf it is an emergency right now, also call **112**. Would you like me to explain how the child protection process works after you call?`,
    hi: `किसी भी संकटग्रस्त बच्चे के लिए — खोया हुआ, नुकसान पहुँचाया जा रहा, काम कर रहा, भीख माँग रहा, या ख़तरे में — **चाइल्डलाइन 1098** पर कॉल करें (मुफ़्त, 24x7)। प्रशिक्षित लोग तुरंत मदद करेंगे।\n\n**मिशन वात्सल्य** के तहत बच्चों को **ज़िला बाल संरक्षण इकाई (DCPU)** और **बाल कल्याण समिति (CWC)** के ज़रिए आश्रय, काउंसलिंग और सुरक्षा भी मिलती है।\n\nअगर अभी आपात स्थिति है तो **112** पर भी कॉल करें। क्या मैं बताऊँ कि कॉल के बाद बाल संरक्षण प्रक्रिया कैसे चलती है?`,
  },
  {
    keys: ['adopt', 'gaod', 'गोद', 'cara', 'carings'],
    en: `Legal adoption in India is done ONLY through **CARA (Central Adoption Resource Authority)** — please avoid any informal or paid adoption, which is illegal and unsafe.\n\nSteps:\n1. Register as a Prospective Adoptive Parent on the **CARINGS** portal (cara.wcd.gov.in).\n2. Upload documents and complete a Home Study Report.\n3. You are referred a child as per your eligibility, then complete legal formalities in court.\n\nThis falls under **Mission Vatsalya**. Want me to list the documents you'll need?`,
    hi: `भारत में कानूनी रूप से गोद लेना केवल **CARA (केंद्रीय दत्तक ग्रहण संसाधन प्राधिकरण)** के माध्यम से होता है — कृपया किसी भी अनौपचारिक या पैसे लेकर गोद देने से बचें, यह अवैध और असुरक्षित है।\n\nचरण:\n1. **CARINGS** पोर्टल (cara.wcd.gov.in) पर संभावित दत्तक माता-पिता के रूप में पंजीकरण करें।\n2. दस्तावेज़ अपलोड करें और होम स्टडी रिपोर्ट पूरी कराएँ।\n3. पात्रता अनुसार बच्चा संदर्भित किया जाता है, फिर अदालत में कानूनी प्रक्रिया पूरी होती है।\n\nयह **मिशन वात्सल्य** के अंतर्गत आता है। क्या मैं ज़रूरी दस्तावेज़ों की सूची बताऊँ?`,
  },
  {
    keys: ['hostel', 'creche', 'crèche', 'palna', 'पालना', 'working women', 'kaamkaji', 'कामकाजी', 'job', 'skill', 'rozgar', 'रोज़गार'],
    en: `Under **Mission Shakti (Samarthya)** there is support for working women:\n\n• **Sakhi Niwas** — safe, affordable working women's hostels.\n• **Palna** creches (National Creche Scheme) — day-care for children 6 months–6 years so mothers can work.\n• **Hub for Empowerment of Women (HEW)** — helps you connect to skilling and other schemes.\n\nCall **181** to ask what is available in your district. Which one do you need — a hostel, a creche, or skilling help?`,
    hi: `**मिशन शक्ति (सामर्थ्य)** के तहत कामकाजी महिलाओं के लिए सहायता है:\n\n• **सखी निवास** — सुरक्षित, किफ़ायती कामकाजी महिला हॉस्टल।\n• **पालना** क्रेच (राष्ट्रीय क्रेच योजना) — 6 माह–6 वर्ष के बच्चों की देखभाल ताकि माताएँ काम कर सकें।\n• **महिला सशक्तिकरण हब (HEW)** — कौशल प्रशिक्षण व अन्य योजनाओं से जोड़ता है।\n\nअपने ज़िले में क्या उपलब्ध है, यह जानने के लिए **181** पर कॉल करें। आपको क्या चाहिए — हॉस्टल, क्रेच, या कौशल प्रशिक्षण?`,
  },
]

const GREETING = {
  keys: ['hello', 'hi', 'namaste', 'namaskar', 'नमस्ते', 'नमस्कार', 'hey', 'help', 'madad', 'मदद'],
  en: `Namaste! I'm **AI Saheli**, your friendly guide to women & child welfare schemes. 🤝\n\nI can help you with:\n• **Poshan** — nutrition, pregnancy & child health, PMMVY, Anganwadi\n• **Vatsalya** — child protection, CHILDLINE 1098, adoption\n• **Mission Shakti** — women's safety, Helpline 181, One Stop Centres\n\nWhat would you like help with today?`,
  hi: `नमस्ते! मैं **एआई सहेली** हूँ, महिला एवं बाल कल्याण योजनाओं में आपकी मददगार। 🤝\n\nमैं इनमें मदद कर सकती हूँ:\n• **पोषण** — पोषण, गर्भावस्था व बाल स्वास्थ्य, PMMVY, आंगनवाड़ी\n• **वात्सल्य** — बाल संरक्षण, चाइल्डलाइन 1098, गोद लेना\n• **मिशन शक्ति** — महिला सुरक्षा, हेल्पलाइन 181, वन स्टॉप सेंटर\n\nआज आप किस विषय में मदद चाहती हैं?`,
}

const DEFAULT = {
  en: `I can help with three areas: **Poshan** (nutrition & maternal/child health), **Mission Vatsalya** (child protection & adoption), and **Mission Shakti** (women's safety & empowerment).\n\nTell me a little about your situation — for example "I'm pregnant", "a child needs help", or "I feel unsafe" — and I'll guide you to the right support and helpline. Quick numbers to remember: **181** (women), **1098** (children), **112** (emergency).`,
  hi: `मैं तीन क्षेत्रों में मदद कर सकती हूँ: **पोषण** (पोषण व मातृ/बाल स्वास्थ्य), **मिशन वात्सल्य** (बाल संरक्षण व गोद लेना), और **मिशन शक्ति** (महिला सुरक्षा व सशक्तिकरण)।\n\nअपनी स्थिति थोड़ी बताइए — जैसे "मैं गर्भवती हूँ", "एक बच्चे को मदद चाहिए", या "मैं सुरक्षित महसूस नहीं करती" — और मैं सही सहायता व हेल्पलाइन बताऊँगी। ज़रूरी नंबर: **181** (महिला), **1098** (बच्चे), **112** (आपातकाल)।`,
}

// Detect whether the text is (mostly) Devanagari to choose reply language.
function isHindi(text) {
  const devanagari = (text.match(/[ऀ-ॿ]/g) || []).length
  return devanagari >= 2
}

export function scriptedReply(userText = '') {
  const text = userText.toLowerCase()
  const hi = isHindi(userText)
  const pick = (r) => (hi ? r.hi : r.en)

  for (const r of RESPONSES) {
    if (r.keys.some((k) => text.includes(k.toLowerCase()))) return pick(r)
  }
  // Greeting: match whole words only (so "hi" won't match inside "child").
  const tokens = text.split(/[^a-zऀ-ॿ]+/i).filter(Boolean)
  if (GREETING.keys.some((k) => tokens.includes(k.toLowerCase())) && text.length < 40) {
    return pick(GREETING)
  }
  return pick(DEFAULT)
}
