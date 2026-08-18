
import { db, auth } from '../firebaseConfig';
import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, increment } from 'firebase/firestore';
import { Scores, UserProfile, Team, BackgroundData, Organization } from '../types';
import { User } from 'firebase/auth';

// --- USERS & RESULTS ---

// שמירת תוצאות המשתמש בבסיס הנתונים
export const saveUserResults = async (scores: Scores, backgroundData?: BackgroundData) => {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  
  try {
    const payload: any = {
      scores: scores,
      completedAt: new Date().toISOString()
    };
    if (backgroundData) {
      payload.backgroundData = backgroundData;
    }
    await setDoc(userRef, payload, { merge: true });
    console.log("Results saved successfully");
  } catch (error) {
    console.error("Error saving results:", error);
    throw error;
  }
};

// עדכון צוות של משתמש קיים
export const updateUserTeam = async (uid: string, newTeamName: string) => {
  const userRef = doc(db, "users", uid);
  try {
    await updateDoc(userRef, {
      team: newTeamName
    });
    console.log(`User ${uid} moved to team ${newTeamName}`);
  } catch (error) {
    console.error("Error updating user team:", error);
    throw error;
  }
};

// יצירת משתמש חדש בבסיס הנתונים (להרשמה במייל)
// orgId is REQUIRED — every user must belong to exactly one org (tenant boundary).
export const createUserProfile = async (uid: string, data: { email: string; displayName: string; team: string; orgId: string; role?: 'user' | 'admin' }) => {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, {
    uid,
    email: data.email,
    displayName: data.displayName,
    team: data.team,
    orgId: data.orgId,
    role: data.role || 'user',
    createdAt: new Date().toISOString()
  });
};

// **חדש** - טיפול בהתחברות מגוגל
// אם המשתמש לא קיים במסד הנתונים, יוצר לו פרופיל בסיסי
export const ensureGoogleUserProfile = async (firebaseUser: User, orgId: string, teamName: string = 'General') => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        // Create new profile automatically
        await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Google User',
            team: teamName,
            orgId,
            role: 'user',
            createdAt: new Date().toISOString(),
            photoURL: firebaseUser.photoURL
        });
        return true; // Created new
    }
    return false; // Existed
};

// --- ORGANIZATIONS (tenant boundary — every admin query below is scoped to one orgId) ---

export const createOrganization = async (ownerUid: string, name: string): Promise<string> => {
  const orgsRef = collection(db, "organizations");
  const docRef = await addDoc(orgsRef, {
    name,
    ownerUid,
    plan: 'trial',
    seatLimit: 5,
    monthlyAiCallLimit: 200,
    subscriptionStatus: 'trialing',
    createdAt: new Date().toISOString()
  });
  return docRef.id;
};

export const getOrganization = async (orgId: string): Promise<Organization | null> => {
  const snap = await getDoc(doc(db, "organizations", orgId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Organization) : null;
};

// Increments this org's counter for the current UTC month. Used for plan usage limits —
// enforce the actual block server-side (see netlify/functions/gemini.ts), this is just the ledger.
export const incrementOrgAiUsage = async (orgId: string) => {
  const monthKey = new Date().toISOString().slice(0, 7); // "2026-08"
  const usageRef = doc(db, "organizations", orgId, "usage", monthKey);
  await setDoc(usageRef, { aiCalls: increment(1), month: monthKey }, { merge: true });
};

// קבלת פרופיל המשתמש הנוכחי
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
};

// (למנהלים) קבלת כל המשתמשים מצוות מסוים בתוך אותו ארגון בלבד
export const getTeamMembers = async (orgId: string, teamName: string) => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("orgId", "==", orgId), where("team", "==", teamName));

  const querySnapshot = await getDocs(q);
  const users: UserProfile[] = [];
  querySnapshot.forEach((doc) => {
    users.push(doc.data() as UserProfile);
  });
  return users;
};

// (למנהל ארגון) קבלת כל המשתמשים בארגון שלו בלבד — לעולם לא כלל המשתמשים במערכת.
// חובה לסנן לפי orgId; זה תפקידו של Firestore rules לאכוף את זה מצד השרת (ראה firestore.rules).
export const getOrgUsers = async (orgId: string) => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("orgId", "==", orgId));
    const querySnapshot = await getDocs(q);
    const users: UserProfile[] = [];
    querySnapshot.forEach((doc) => {
      users.push(doc.data() as UserProfile);
    });
    return users;
};

// --- TEAMS MANAGEMENT (scoped per organization) ---

export const createTeam = async (orgId: string, teamName: string) => {
    const teamsRef = collection(db, "teams");
    const q = query(teamsRef, where("orgId", "==", orgId), where("name", "==", teamName));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        throw new Error("שם הצוות כבר קיים בארגון הזה");
    }

    await addDoc(teamsRef, {
        name: teamName,
        orgId,
        createdAt: new Date().toISOString(),
        memberCount: 0
    });
};

export const getTeams = async (orgId: string): Promise<Team[]> => {
    const teamsRef = collection(db, "teams");
    const q = query(teamsRef, where("orgId", "==", orgId));
    const querySnapshot = await getDocs(q);
    const teams: Team[] = [];
    querySnapshot.forEach((doc) => {
        teams.push({ id: doc.id, ...(doc.data() as any) } as Team);
    });
    return teams;
};
