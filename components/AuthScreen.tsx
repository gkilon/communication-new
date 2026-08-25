
import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { createUserProfile, getTeams, ensureGoogleUserProfile, createOrganization, getOrganization } from '../services/firebaseService';
import { Team } from '../types';
import { ArrowLeftIcon, GoogleIcon } from './icons/Icons';
import { KilonLogo } from './brand/KilonLogo';
import { BlueprintBackground } from './brand/BlueprintBackground';

interface AuthScreenProps {
  onLoginSuccess: () => void;
  onBack?: () => void;
}

// Signup always resolves to exactly one orgId:
// - ?org=<id> in the URL (an invite link an org admin shared) -> join that org
// - otherwise -> create a brand new org and become its admin
export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onBack }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [isTeamLocked, setIsTeamLocked] = useState(false);

  const [inviteOrgId, setInviteOrgId] = useState<string | null>(null);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orgParam = urlParams.get('org');
    const teamParam = urlParams.get('team');

    if (orgParam) {
      setInviteOrgId(orgParam);
      getOrganization(orgParam).then(org => {
        if (org) setInviteOrgName(org.name);
      }).catch(e => console.error("Failed to load org name", e));
      getTeams(orgParam).then(teamsData => {
        if (teamParam) {
          const foundTeam = teamsData.find(t => t.name.toLowerCase() === teamParam.toLowerCase());
          if (foundTeam) {
            setTeams([foundTeam]);
            setSelectedTeam(foundTeam.name);
            setIsTeamLocked(true);
            return;
          }
        }
        setTeams(teamsData);
        if (teamsData.length > 0) setSelectedTeam(teamsData[0].name);
      }).catch(e => console.error("Failed to load org teams", e));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
        return;
      }

      if (!name) {
        setError("חובה למלא שם");
        setLoading(false);
        return;
      }
      if (inviteOrgId && !selectedTeam) {
        setError("חובה לבחור צוות");
        setLoading(false);
        return;
      }
      if (!inviteOrgId && !orgName.trim()) {
        setError("חובה למלא שם ארגון (או להשתמש בקישור הזמנה)");
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      if (inviteOrgId) {
        // Joining an existing org via invite link -> regular member
        await createUserProfile(userCredential.user.uid, {
          email, displayName: name, team: selectedTeam, orgId: inviteOrgId, role: 'user'
        });
      } else {
        // No invite -> this person is starting a brand new org and becomes its admin
        const newOrgId = await createOrganization(userCredential.user.uid, orgName.trim());
        await createUserProfile(userCredential.user.uid, {
          email, displayName: name, team: 'General', orgId: newOrgId, role: 'admin'
        });
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setError("שגיאה בפעולה. וודא שהפרטים תקינים והמייל לא בשימוש.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      if (!isLogin) {
        if (inviteOrgId && !selectedTeam) {
          setError("חובה לבחור צוות לפני הרשמה עם Google");
          return;
        }
        if (!inviteOrgId && !orgName.trim()) {
          setError("חובה למלא שם ארגון לפני הרשמה עם Google");
          return;
        }
      }
      setLoading(true);
      try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          if (!isLogin) {
            const orgIdToUse = inviteOrgId || await createOrganization(result.user.uid, orgName.trim());
            await ensureGoogleUserProfile(result.user, orgIdToUse, selectedTeam || 'General');
          }
          onLoginSuccess();
      } catch (err) {
          setError("שגיאה בהתחברות עם Google");
          setLoading(false);
      }
  };

  return (
    <div className="bg-kilon-card p-8 md:p-12 rounded-3xl shadow-xl text-center max-w-lg w-full mx-auto animate-fade-in-up border border-kilon-border relative overflow-hidden">
      <BlueprintBackground />
      <div className="relative z-10">

      {onBack && (
        <button onClick={onBack} className="absolute top-0 left-0 text-kilon-inkSoft hover:text-kilon-ink transition-all">
            <ArrowLeftIcon className="w-6 h-6 rotate-180" />
        </button>
      )}

      <KilonLogo className="mb-6" subtitle="Communication Platform" />

      <h2 className="text-3xl font-extrabold text-kilon-ink mb-2">
        {isLogin ? 'כניסה' : (inviteOrgId ? 'הצטרפות לצוות' : 'יצירת חשבון וארגון חדש')}
      </h2>
      <p className="text-kilon-inkSoft mb-4 font-medium">
        {isLogin ? 'ברוכים השבים! הכנסו לחשבון' : 'שלום! בוא נקים עבורך פרופיל'}
      </p>

      {!isLogin && (
        <div className={`mb-8 text-right p-4 rounded-2xl border flex items-start gap-3 ${inviteOrgId ? 'bg-kilon-slate/10 border-kilon-slate/30' : 'bg-kilon-terracotta/10 border-kilon-terracotta/30'}`}>
          <span className="text-2xl leading-none">{inviteOrgId ? '🔗' : '🆕'}</span>
          <div>
            {inviteOrgId ? (
              <>
                <p className="text-kilon-ink font-extrabold text-sm">
                  מצטרף/ת לארגון{inviteOrgName ? `: ${inviteOrgName}` : ' קיים'}
                </p>
                <p className="text-kilon-inkSoft text-xs mt-1">תהיה/י חבר/ת צוות רגיל/ה. רק מנהל הארגון קובע הרשאות.</p>
              </>
            ) : (
              <>
                <p className="text-kilon-terracottaDark font-extrabold text-sm">פותח/ת ארגון חדש</p>
                <p className="text-kilon-inkSoft text-xs mt-1">
                  תהיה/י ה<b>מנהל/ת</b> של הארגון החדש. הצטרפת בטעות? יש לך קישור הזמנה מהארגון שלך? השתמש/י בו במקום להיכנס לכתובת הזו ישירות.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {!isLogin && inviteOrgId && (
        <div className="mb-8 text-right bg-kilon-slate/10 p-5 rounded-2xl border border-kilon-slate/30">
            <label className="block text-kilon-ink text-sm mb-2 font-extrabold">הצוות שלך:</label>
            <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                disabled={isTeamLocked}
                className={`w-full bg-kilon-card border border-kilon-slate/40 rounded-xl py-4 px-4 text-kilon-ink text-lg focus:ring-4 focus:ring-kilon-slate/20 shadow-inner ${isTeamLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                {!isTeamLocked && <option value="" disabled>-- רשימת צוותים --</option>}
                {teams.map(team => <option key={team.id} value={team.name}>{team.name}</option>)}
            </select>
        </div>
      )}

      {!isLogin && !inviteOrgId && (
        <div className="mb-8 text-right bg-kilon-terracotta/10 p-5 rounded-2xl border border-kilon-terracotta/30">
            <label className="block text-kilon-ink text-sm mb-2 font-extrabold">שם הארגון שלך:</label>
            <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-kilon-card border border-kilon-terracotta/40 rounded-xl py-4 px-4 text-kilon-ink text-lg focus:ring-4 focus:ring-kilon-terracotta/20 shadow-inner"
                placeholder="לדוגמה: Kilon Consulting"
            />
            <p className="text-kilon-inkSoft text-xs mt-2">זה מה שיופיע לחברי הצוות שלך כשיצטרפו.</p>
        </div>
      )}

      <div className="space-y-4 mb-8">
          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white text-kilon-ink font-extrabold py-4 rounded-full flex items-center justify-center gap-3 shadow-md border border-kilon-border hover:bg-kilon-bg transition-all active:scale-95"
          >
              <GoogleIcon className="w-6 h-6" />
              <span>{isLogin ? 'כניסה עם Google' : 'הרשמה מהירה עם Google'}</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-px bg-kilon-border flex-1"></div>
            <span className="text-kilon-inkSoft text-[10px] font-bold uppercase tracking-widest">או ידנית</span>
            <div className="h-px bg-kilon-border flex-1"></div>
          </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {!isLogin && (
            <div className="group">
                <label className="block text-kilon-inkSoft text-xs mr-2 mb-1">שם מלא</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-kilon-bg border border-kilon-border rounded-xl py-3 px-4 text-kilon-ink focus:ring-2 focus:ring-kilon-slate/40 transition-all"
                    placeholder="ישראל ישראלי"
                />
            </div>
        )}
        <div className="group">
            <label className="block text-kilon-inkSoft text-xs mr-2 mb-1">אימייל</label>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-kilon-bg border border-kilon-border rounded-xl py-3 px-4 text-kilon-ink text-left focus:ring-2 focus:ring-kilon-slate/40 transition-all"
                placeholder="name@email.com"
                dir="ltr"
            />
        </div>
        <div className="group">
            <label className="block text-kilon-inkSoft text-xs mr-2 mb-1">סיסמה</label>
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-kilon-bg border border-kilon-border rounded-xl py-3 px-4 text-kilon-ink text-left focus:ring-2 focus:ring-kilon-slate/40 transition-all"
                placeholder="******"
                dir="ltr"
            />
        </div>
        
        {error && <p className="text-red-700 text-sm font-bold text-center bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>}
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-kilon-cta hover:opacity-90 text-white font-extrabold py-4 rounded-full text-xl shadow-lg mt-4 transition-all transform active:scale-95"
        >
          {loading ? 'מעבד...' : (isLogin ? 'התחבר עכשיו' : 'צור חשבון והתחל')}
        </button>
      </form>

      <div className="mt-10 pt-8 border-t border-kilon-border text-kilon-inkSoft">
        <p className="mb-3 text-sm">{isLogin ? 'משתמש חדש?' : 'כבר פתחת חשבון קודם?'}</p>
        <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="w-full py-3 px-4 border-2 border-kilon-slate/40 rounded-full text-kilon-ink font-extrabold hover:bg-kilon-slate/10 transition-all text-lg"
        >
            {isLogin ? 'עבור להרשמה (חדש כאן)' : 'יש לי כבר חשבון - שלח אותי לכניסה'}
        </button>
      </div>
      </div>
    </div>
  );
};
