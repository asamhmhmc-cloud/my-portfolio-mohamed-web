import React, { useState, useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
  doc, setDoc, getDoc, updateDoc, where 
} from 'firebase/firestore';
import { 
  getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Send, User, Phone, Video, Search, MoreVertical, CheckCheck, MessageCircle, 
  Users, ArrowRight, Shield, Clock, Camera, Plus, Trash2, Smartphone, 
  ChevronDown, Loader2, ShieldCheck, AlertCircle, LogOut
} from 'lucide-react';

// --- إعدادات Firebase ---
// ملاحظة: سيتم تعبئة هذه القيم تلقائياً من بيئة التشغيل
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'chat-pro-t-ultimate';

// --- قائمة الدول العربية ---
const countries = [
  { name: "اليمن", code: "+967", flag: "🇾🇪" },
  { name: "السعودية", code: "+966", flag: "🇸🇦" },
  { name: "مصر", code: "+20", flag: "🇪🇬" },
  { name: "الإمارات", code: "+971", flag: "🇦🇪" },
  { name: "الكويت", code: "+965", flag: "🇰🇼" },
  { name: "الأردن", code: "+962", flag: "🇯🇴" },
  { name: "العراق", code: "+964", flag: "🇮🇶" },
  { name: "المغرب", code: "+212", flag: "🇲🇦" },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [step, setStep] = useState('auth-phone'); // auth-phone, auth-otp, auth-profile, chat
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // بيانات الدخول
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationId, setVerificationId] = useState(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [showCountryList, setShowCountryList] = useState(false);

  // بيانات الدردشة
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);

  // --- التأثيرات الأولية ---
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'info');
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          setUserProfile(snap.data());
          setStep('chat');
        } else {
          setStep('auth-profile');
        }
      } else {
        setStep('auth-phone');
      }
    });
    return () => unsubscribe();
  }, []);

  // --- نظام التحقق (OTP) ---
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  };

  const handlePhoneSubmit = async () => {
    if (phoneNumber.length < 7) {
      setError("يرجى إدخال رقم هاتف صحيح");
      return;
    }
    setLoading(true);
    setError("");
    setupRecaptcha();
    const fullNumber = selectedCountry.code + phoneNumber;
    try {
      const confirmation = await signInWithPhoneNumber(auth, fullNumber, window.recaptchaVerifier);
      setVerificationId(confirmation);
      setStep('auth-otp');
    } catch (err) {
      setError("فشل إرسال الكود. تأكد من إعدادات Firebase");
      console.error(err);
    }
    setLoading(false);
  };

  const handleOtpVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) return;
    setLoading(true);
    setError("");
    try {
      await verificationId.confirm(code);
    } catch (err) {
      setError("الكود غير صحيح");
    }
    setLoading(false);
  };

  const handleCompleteProfile = async (name) => {
    if (!name.trim()) return;
    setLoading(true);
    const profile = { 
      uid: auth.currentUser.uid, 
      displayName: name, 
      phone: selectedCountry.code + phoneNumber,
      lastSeen: serverTimestamp(),
      avatarColor: 'bg-emerald-600'
    };
    await setDoc(doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'profile', 'info'), profile);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'users_list', auth.currentUser.uid), profile);
    setUserProfile(profile);
    setStep('chat');
    setLoading(false);
  };

  // --- نظام الدردشة ---
  useEffect(() => {
    if (step === 'chat') {
      const q = query(collection(db, 'artifacts', appId, 'public', 'users_list'));
      return onSnapshot(q, (snap) => {
        setAllUsers(snap.docs.map(d => d.data()).filter(u => u.uid !== auth.currentUser?.uid));
      });
    }
  }, [step]);

  useEffect(() => {
    if (selectedUser && user) {
      const roomId = [user.uid, selectedUser.uid].sort().join('_');
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', roomId, 'messages'), orderBy('timestamp', 'asc'));
      return onSnapshot(q, (snap) => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [selectedUser, user]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;
    const roomId = [user.uid, selectedUser.uid].sort().join('_');
    const msg = inputValue;
    setInputValue("");
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', roomId, 'messages'), {
      text: msg,
      senderId: user.uid,
      timestamp: serverTimestamp()
    });
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- الواجهات ---
  
  // 1. شاشة الترحيب
  if (showSplash) {
    return (
      <>
        <div className="h-screen w-full bg-[#0b141a] flex flex-col items-center justify-center text-white font-sans overflow-hidden">
        <div className="w-24 h-24 bg-emerald-500 rounded-[2.2rem] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)] animate-bounce border-4 border-[#111b21]">
          <span className="text-6xl font-black">T</span>
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-tight">Chat Pro T</h1>
        <div className="mt-12 flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-emerald-500" />
          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={14} /> End-to-End Encrypted
          </span>
        </div>
      </div>
      <Analytics />
    </>
    );
  }

  // 2. واجهات المصادقة
  if (step.startsWith('auth')) {
    return (
      <>
        <div className="h-screen w-full bg-[#0b141a] flex flex-col items-center justify-center p-6 text-white font-sans" dir="rtl">
        <div id="recaptcha-container"></div>
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3">
              <span className="text-4xl font-black">T</span>
            </div>
            <h1 className="text-2xl font-black">شات برو T</h1>
          </div>

          <div className="bg-[#111b21] p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl space-y-6">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-xs flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}

            {step === 'auth-phone' && (
              <>
                <h2 className="text-lg font-bold text-center">سجل دخولك برقم هاتفك</h2>
                <div className="space-y-4">
                  <div className="relative">
                    <button onClick={() => setShowCountryList(!showCountryList)} className="w-full bg-[#2a3942] p-4 rounded-2xl flex justify-between items-center">
                      <div className="flex items-center gap-3"><span>{selectedCountry.flag}</span><span className="font-bold">{selectedCountry.name}</span></div>
                      <div className="flex items-center gap-1"><span className="text-emerald-500" dir="ltr">{selectedCountry.code}</span><ChevronDown size={16}/></div>
                    </button>
                    {showCountryList && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#2a3942] rounded-xl overflow-hidden z-50 shadow-2xl border border-gray-700 max-h-48 overflow-y-auto">
                        {countries.map(c => (
                          <div key={c.code} onClick={() => { setSelectedCountry(c); setShowCountryList(false); }} className="p-4 hover:bg-emerald-500/20 flex justify-between text-sm border-b border-gray-700/50">
                            <span>{c.flag} {c.name}</span><span dir="ltr">{c.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="رقم الهاتف" className="w-full bg-[#2a3942] p-4 rounded-2xl outline-none text-left font-mono text-xl focus:ring-2 ring-emerald-500 transition-all" dir="ltr" />
                  <button onClick={handlePhoneSubmit} disabled={loading} className="w-full bg-emerald-600 py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin"/> : "إرسال رمز التأكيد"}
                  </button>
                </div>
              </>
            )}

            {step === 'auth-otp' && (
              <div className="text-center space-y-6">
                <h2 className="text-lg font-bold text-center">أدخل الرمز</h2>
                <p className="text-gray-500 text-xs">تم إرسال الكود لـ {selectedCountry.code} {phoneNumber}</p>
                <div className="flex justify-between gap-2" dir="ltr">
                  {otp.map((d, i) => (
                    <input key={i} id={`otp-${i}`} maxLength="1" value={d} onChange={e => {
                      const newOtp = [...otp]; newOtp[i] = e.target.value.slice(-1); setOtp(newOtp);
                      if (e.target.value && i < 5) document.getElementById(`otp-${i+1}`).focus();
                    }} className="w-12 h-14 bg-[#2a3942] rounded-xl text-center text-xl font-bold text-emerald-500 outline-none" />
                  ))}
                </div>
                <button onClick={handleOtpVerify} disabled={loading} className="w-full bg-emerald-600 py-4 rounded-2xl font-bold">
                  {loading ? <Loader2 className="animate-spin mx-auto"/> : "تأكيد الرمز"}
                </button>
                <button onClick={() => setStep('auth-phone')} className="text-emerald-500 text-xs font-bold underline">تعديل الرقم</button>
              </div>
            )}

            {step === 'auth-profile' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-center">إعداد الحساب</h2>
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500"><User size={40}/></div>
                <input id="name-input" placeholder="اكتب اسمك المستعار" className="w-full bg-[#2a3942] p-4 rounded-2xl outline-none text-center font-bold" />
                <button onClick={() => handleCompleteProfile(document.getElementById('name-input').value)} disabled={loading} className="w-full bg-emerald-600 py-4 rounded-2xl font-bold">
                  بدء الدردشة الآن
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Analytics />
    </>
    );
  }

  // 3. الواجهة الرئيسية للدردشة
  return (
    <>
      <div className="flex h-screen bg-[#0b141a] text-[#e9edef] overflow-hidden font-sans" dir="rtl">
      {/* القائمة الجانبية */}
      <aside className={`w-full md:w-[420px] flex flex-col border-l border-[#222d34] ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <header className="h-[65px] bg-[#202c33] flex items-center px-4 justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg rotate-3 text-lg">T</div>
             <div className="flex flex-col">
               <span className="font-bold text-sm">شات برو T</span>
               <span className="text-[10px] text-emerald-500">متصل الآن</span>
             </div>
          </div>
          <div className="flex items-center gap-4 text-[#aebac1]">
            <button onClick={() => auth.signOut()} className="hover:text-red-500 transition-colors"><LogOut size={20}/></button>
            <MoreVertical size={20}/>
          </div>
        </header>

        <div className="p-4">
          <div className="bg-[#202c33] rounded-2xl flex items-center px-4 py-2.5 shadow-inner border border-gray-800">
            <Search size={18} className="ml-3 text-gray-500"/>
            <input placeholder="ابحث عن أصدقاء..." className="bg-transparent w-full outline-none text-sm"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">المحادثات</div>
          {allUsers.length === 0 ? (
            <div className="p-10 text-center opacity-30 text-xs">لا يوجد مستخدمون متاحون حالياً</div>
          ) : (
            allUsers.map(u => (
              <div key={u.uid} onClick={() => setSelectedUser(u)} className={`flex items-center p-4 cursor-pointer hover:bg-[#202c33] transition-colors border-b border-gray-800/20 ${selectedUser?.uid === u.uid ? 'bg-[#2a3942]' : ''}`}>
                <div className={`w-12 h-12 ${u.avatarColor || 'bg-slate-700'} rounded-2xl flex items-center justify-center text-white font-bold ml-4 shadow-lg text-xl`}>
                  {u.displayName[0]}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-sm">{u.displayName}</h3>
                    <span className="text-[10px] text-gray-500">منذ قليل</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{u.phone}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* منطقة المحادثة */}
      <main className={`flex-1 flex flex-col relative bg-[#0b141a] ${!selectedUser ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {selectedUser ? (
          <>
            <header className="h-[65px] bg-[#202c33] flex items-center px-4 shadow-xl z-20 border-b border-gray-800">
              <button onClick={() => setSelectedUser(null)} className="md:hidden ml-4 text-emerald-500"><ArrowRight/></button>
              <div className={`w-10 h-10 ${selectedUser.avatarColor || 'bg-slate-700'} rounded-xl flex items-center justify-center font-bold ml-4 text-white`}>
                {selectedUser.displayName[0]}
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">{selectedUser.displayName}</div>
                <div className="text-[10px] text-emerald-500">نشط الآن</div>
              </div>
              <div className="flex gap-5 text-[#aebac1]">
                <Video size={20} className="cursor-pointer hover:text-white"/>
                <Phone size={20} className="cursor-pointer hover:text-white"/>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-fixed opacity-95">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === user.uid ? 'justify-start' : 'justify-end'}`}>
                  <div className={`p-3 rounded-2xl max-w-[85%] shadow-md animate-in slide-in-from-bottom-2 ${m.senderId === user.uid ? 'bg-[#005c4b] rounded-tr-none' : 'bg-[#202c33] rounded-tl-none'}`}>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <div className="flex justify-end gap-1 mt-1 opacity-50 text-[9px]">
                      {m.timestamp?.toDate().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                      {m.senderId === user.uid && <CheckCheck size={12}/>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef}/>
            </div>

            <footer className="p-4 bg-[#202c33] border-t border-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-[#2a3942] rounded-2xl flex items-center px-4 py-1 shadow-inner">
                  <input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="اكتب رسالة..." className="bg-transparent flex-1 py-3 outline-none text-sm"/>
                </div>
                <button onClick={sendMessage} className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform">
                  <Send size={22} className="-rotate-45 ml-1"/>
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="text-center space-y-6 animate-pulse">
            <div className="w-32 h-32 bg-emerald-500/5 rounded-[3rem] flex items-center justify-center mx-auto border-2 border-emerald-500/10">
              <MessageCircle size={64} className="text-emerald-500/20" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-700">شات برو T</h2>
              <p className="text-gray-600 text-sm mt-2">اختر صديقاً لبدء المحادثة المشفرة</p>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2a3942; border-radius: 10px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
    <Analytics />
    </>
  );
}