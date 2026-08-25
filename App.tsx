
import React, { Component, useState, useEffect, ReactNode, ErrorInfo } from 'react';
import SimpleApp from './SimpleApp';
import { AdminDashboard } from './components/AdminDashboard';
import { auth, isFirebaseInitialized } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getUserProfile } from './services/firebaseService';

type AppView = 'simple' | 'admin' | 'loading';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Fixed ErrorBoundary component issues with state/props recognition by using Component from react
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly defining state helps TypeScript recognize it when base class inheritance is ambiguous in some environments
  public state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Component Crash:", error, errorInfo);
  }

  render() {
    // Correctly accessing state from the Component base class
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-kilon-bg text-kilon-ink p-6 text-center" dir="rtl">
          <div className="bg-kilon-card p-8 rounded-2xl border-2 border-red-400 shadow-lg max-w-md">
              <h1 className="text-3xl font-bold text-red-600 mb-4">אופס! משהו השתבש</h1>
              <p className="text-kilon-inkSoft mb-6">חלה שגיאה בטעינת האפליקציה.</p>
              <pre className="bg-kilon-bg p-4 rounded text-xs text-red-600 overflow-auto mb-6 text-left" dir="ltr">
                  {this.state.error?.message}
              </pre>
              <button 
                onClick={() => window.location.reload()} 
                className="bg-kilon-cta text-white font-bold px-8 py-3 rounded-full transition-all hover:opacity-90"
              >
                נסה לטעון מחדש
              </button>
          </div>
        </div>
      );
    }
    // Accessing children from props
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>('loading');
  const [user, setUser] = useState<any>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
     // No more offline/local-only fallback — every account needs a real org boundary now,
     // so a missing Firebase config is a hard error, not a silent downgrade to "simple mode".
     if (!isFirebaseInitialized) {
         setConfigError(true);
         setView('simple');
         return;
     }

     const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
         if (currentUser) {
             try {
                 const profile = await getUserProfile(currentUser.uid);
                 // Admin status comes ONLY from the Firestore role field (enforced server-side
                 // by firestore.rules) — no hardcoded email backdoors.
                 setOrgId(profile?.orgId || null);
                 setView(profile?.role === 'admin' ? 'admin' : 'simple');
             } catch (e) {
                 console.error("Profile load error:", e);
                 setView('simple');
             }
         } else {
            setOrgId(null);
            setView('simple');
        }
     });
     
     return () => {
       if (unsubscribe) unsubscribe();
     };
  }, []);

  const handleSignOut = async () => {
    if (auth) await signOut(auth);
    setUser(null);
    setOrgId(null);
    setView('simple');
  };

  if (configError) {
    return (
      <div className="min-h-screen bg-kilon-bg flex items-center justify-center text-kilon-ink p-6 text-center" dir="rtl">
        <div className="bg-kilon-card p-8 rounded-2xl border-2 border-red-400 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">האפליקציה לא מוגדרת</h1>
          <p className="text-kilon-inkSoft">חסרים משתני סביבה של Firebase (VITE_FIREBASE_*). אין מצב גישה ללא הגדרה תקינה בגרסה הזו.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
       {view === 'admin' && orgId ? (
         <AdminDashboard onBack={handleSignOut} orgId={orgId} />
       ) : view === 'simple' ? (
         <SimpleApp user={user} onLogout={handleSignOut} />
       ) : (
         <div className="min-h-screen bg-kilon-bg flex items-center justify-center text-kilon-ink" dir="rtl">
           <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-kilon-slate/30 border-t-kilon-terracotta rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-kilon-terracotta rounded-full animate-pulse opacity-50"></div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-kilon-ink animate-pulse mb-1">טוען מערכת...</p>
                <p className="text-sm text-kilon-inkSoft">אנחנו מכינים את הסביבה שלך</p>
              </div>
           </div>
         </div>
       )}
    </ErrorBoundary>
  );
};
