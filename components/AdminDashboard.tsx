
import React, { useEffect, useState } from 'react';
import { getOrgUsers, createTeam, getTeams, updateUserTeam, getOrganization } from '../services/firebaseService';
import { UserProfile, Team, Scores, Organization } from '../types';
import { ArrowLeftIcon } from './icons/Icons';
import { TeamAiCoach } from './TeamAiCoach';

interface AdminDashboardProps {
  onBack: () => void;
  orgId: string; // The admin's own organization — every query below is scoped to this. Never global.
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, orgId }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [filterTeam, setFilterTeam] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [createTeamStatus, setCreateTeamStatus] = useState<{msg: string, type: 'success' | 'error' | ''}>({msg:'', type:''});
  
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, teamsData, orgData] = await Promise.all([
        getOrgUsers(orgId),
        getTeams(orgId),
        getOrganization(orgId)
      ]);
      setUsers(usersData);
      setTeams(teamsData);
      setOrg(orgData);
    } catch (err: any) {
      console.error("Failed to load admin data", err);
      if (err.code === 'permission-denied' || err.message?.includes('permission-denied')) {
          setError('PERMISSION_DENIED');
      } else {
          setError(err.message || 'שגיאה לא ידועה בטעינת נתונים');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
      if (!newTeamName.trim()) return;
      if (org && teams.length >= org.seatLimit) {
          setCreateTeamStatus({msg: 'הגעת למגבלת המנוי שלך. שדרג תוכנית כדי להוסיף עוד.', type: 'error'});
          return;
      }
      setCreateTeamStatus({msg: 'יוצר...', type: ''});
      try {
          await createTeam(orgId, newTeamName.trim());
          setNewTeamName('');
          setCreateTeamStatus({msg: 'הצוות נוצר בהצלחה!', type: 'success'});
          loadData(); 
          setTimeout(() => setCreateTeamStatus({msg: '', type: ''}), 3000);
      } catch (e: any) {
          setCreateTeamStatus({msg: e.message || 'שגיאה ביצירת הצוות', type: 'error'});
          if (e.code === 'permission-denied') setError('PERMISSION_DENIED');
      }
  };

  const handleMoveUser = async (userId: string, newTeam: string) => {
      if (!window.confirm(`האם להעביר את המשתמש לצוות "${newTeam}"?`)) return;
      
      setUpdatingUserId(userId);
      try {
          await updateUserTeam(userId, newTeam);
          setUsers(prev => prev.map(u => u.uid === userId ? { ...u, team: newTeam } : u));
      } catch (e) {
          alert("שגיאה בהעברת המשתמש");
      } finally {
          setUpdatingUserId(null);
      }
  };

  const getDominantColorInfo = (scores?: Scores) => {
    if (!scores) return null;
    const { a, b, c, d } = scores;
    const results = [
        { color: 'אדום', val: (a || 0) + (c || 0), code: 'bg-rose-500', border: 'border-rose-300' },
        { color: 'צהוב', val: (a || 0) + (d || 0), code: 'bg-yellow-400', border: 'border-yellow-200' },
        { color: 'ירוק', val: (b || 0) + (d || 0), code: 'bg-green-500', border: 'border-green-300' },
        { color: 'כחול', val: (b || 0) + (c || 0), code: 'bg-indigo-500', border: 'border-indigo-300' }
    ];
    results.sort((x, y) => y.val - x.val);
    return results[0];
  };

  const renderDominantColorBadge = (scores?: any) => {
      const info = getDominantColorInfo(scores);
      if (!info) return <span className="text-gray-600 italic">לא נקבע</span>;
      return (
        <span className={`px-2 py-1 rounded text-xs text-white font-bold ${info.code}`}>
            {info.color}
        </span>
    );
  };

  const filteredUsers = filterTeam ? users.filter(u => u.team === filterTeam) : users;

  if (error === 'PERMISSION_DENIED') {
      return (
        <div className="min-h-screen bg-gray-900 text-white p-6 dir-rtl">
            <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-lg shadow-2xl border-2 border-red-500 text-center">
                <div className="flex flex-col items-center gap-4 mb-6">
                    <span className="text-6xl">🛑</span>
                    <h1 className="text-3xl font-bold text-red-500">מסד הנתונים נעול</h1>
                </div>
                <p className="text-lg mb-6">הצלחת להתחבר כמנהל, אך אין לך הרשאה לקרוא את הנתונים ב-Firebase. בדוק את ה-Rules בקונסול.</p>
                <button onClick={loadData} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-4 px-6 rounded-xl mb-4 transition-all">נסה שוב ↻</button>
                <button onClick={onBack} className="text-gray-400 hover:text-white underline text-sm block">יציאה מהמערכת</button>
            </div>
        </div>
      );
  }

  const TeamMap = () => {
      if (!filterTeam || filteredUsers.length === 0) return null;

      return (
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 mb-8 animate-fade-in-up">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-cyan-300">מפה דינמית: {filterTeam}</h3>
                  <div className="text-xs sm:text-sm text-gray-400 flex flex-wrap gap-3">
                       <div className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-500 rounded-full"></span> כחול</div>
                       <div className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-500 rounded-full"></span> אדום</div>
                       <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> ירוק</div>
                       <div className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded-full"></span> צהוב</div>
                  </div>
              </div>

              <div className="relative w-full max-w-lg mx-auto aspect-square bg-gray-900 rounded-xl overflow-hidden border-2 border-gray-600 shadow-2xl" dir="ltr">
                  <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-indigo-900/10 border-b border-l border-gray-700/50"></div>
                  <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-rose-900/10 border-b border-gray-700/50"></div>
                  <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-green-900/10 border-l border-gray-700/50"></div>
                  <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-yellow-900/10"></div>
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-500/60 transform -translate-x-1/2"></div>
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-500/60 transform -translate-y-1/2"></div>

                  {filteredUsers.map((u) => {
                      if (!u.scores) return null;
                      const { a, b, c, d } = u.scores;
                      const totalX = (a + b) || 1;
                      const totalY = (c + d) || 1;
                      const xPos = (a / totalX) * 100;
                      const yPos = (d / totalY) * 100;
                      const clampedX = Math.max(5, Math.min(95, xPos));
                      const clampedY = Math.max(5, Math.min(95, yPos));
                      const domInfo = getDominantColorInfo(u.scores);
                      const dotColor = domInfo ? domInfo.code : 'bg-gray-400';
                      const borderColor = domInfo ? domInfo.border : 'border-white';

                      return (
                          <div 
                            key={u.uid}
                            className={`absolute w-5 h-5 rounded-full border-2 ${borderColor} shadow-lg transform translate-x-1/2 -translate-y-1/2 group cursor-pointer ${dotColor} hover:scale-150 transition-all z-10`}
                            style={{ right: `${clampedX}%`, top: `${clampedY}%` }}
                          >
                              <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap shadow-xl border border-gray-600 z-50">
                                  {u.displayName}
                              </div>
                          </div>
                      );
                  })}
              </div>
              <TeamAiCoach users={filteredUsers} teamName={filterTeam} />
          </div>
      )
  };

  return (
    <div className="bg-gray-900 p-4 sm:p-8 min-h-screen animate-fade-in dir-rtl text-right">
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-cyan-300">לוח בקרה מנהלים</h2>
                    <p className="text-gray-400 text-sm mt-1 italic">ניהול משתתפים, צוותים והגדרות מערכת</p>
                </div>
                <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white border border-gray-600 px-4 py-2 rounded-lg text-sm bg-gray-800">
                    <ArrowLeftIcon className="w-4 h-4 rotate-180" />
                    <span>יציאה למסך ראשי</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {/* Org plan & usage summary */}
                <div className="lg:col-span-1 bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span>💳</span> תוכנית וארגון
                    </h3>
                    {org ? (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-gray-300">
                                <span>תוכנית</span>
                                <span className="font-bold text-cyan-400">{org.plan}</span>
                            </div>
                            <div className="flex justify-between text-gray-300">
                                <span>סטטוס מנוי</span>
                                <span className="font-bold">{org.subscriptionStatus || '—'}</span>
                            </div>
                            <div className="flex justify-between text-gray-300">
                                <span>מגבלת מושבים</span>
                                <span className="font-bold">{org.seatLimit}</span>
                            </div>
                            <div className="flex justify-between text-gray-300">
                                <span>מגבלת קריאות AI חודשית</span>
                                <span className="font-bold">{org.monthlyAiCallLimit}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">טוען נתוני ארגון...</p>
                    )}
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border-r-4 border-cyan-500">
                        <div className="text-gray-400 text-sm mb-1">סה"כ רשומים</div>
                        <div className="text-4xl font-black text-white">{loading ? '...' : users.length}</div>
                    </div>
                    <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border-r-4 border-purple-500">
                        <div className="text-gray-400 text-sm mb-1">סיימו שאלון</div>
                        <div className="text-4xl font-black text-white">{loading ? '...' : users.filter(u => u.scores).length}</div>
                    </div>
                    <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border-r-4 border-green-500">
                        <div className="text-gray-400 text-sm mb-1">צוותים פעילים</div>
                        <div className="text-4xl font-black text-white">{loading ? '...' : teams.length}</div>
                    </div>
                </div>
            </div>

            {/* Create Team Section */}
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg mb-8 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">פתיחת צוות / סדנה חדשה</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <input 
                        type="text" 
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="שם הצוות (לדוגמה: הנהלה בכירה)"
                        className="flex-1 bg-gray-900 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button 
                        onClick={handleCreateTeam}
                        disabled={!newTeamName.trim() || loading}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 px-8 rounded-xl disabled:opacity-50 transition-all shadow-lg"
                    >
                        צור צוות
                    </button>
                </div>
                {createTeamStatus.msg && (
                    <p className={`mt-3 text-sm font-bold ${createTeamStatus.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                        {createTeamStatus.msg}
                    </p>
                )}
            </div>

            {/* Teams Management & Links Section */}
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg mb-8 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span>🔗</span> ניהול צוותים וקישורי הרשמה
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(team => (
                        <div key={team.id} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex items-center justify-between group hover:border-cyan-500/50 transition-all">
                            <div className="overflow-hidden">
                                <div className="text-white font-bold truncate">{team.name}</div>
                                <div className="text-[10px] text-gray-500 truncate">ID: {team.id}</div>
                            </div>
                            <button 
                                onClick={() => {
                                    const url = `${window.location.origin}/?team=${encodeURIComponent(team.name)}`;
                                    navigator.clipboard.writeText(url);
                                    alert(`הקישור לצוות "${team.name}" הועתק ללוח!`);
                                }}
                                className="bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white p-2 rounded-lg transition-all text-xs font-bold border border-cyan-600/30"
                                title="העתק קישור ייעודי"
                            >
                                העתק קישור
                            </button>
                        </div>
                    ))}
                    {teams.length === 0 && <p className="text-gray-500 text-sm italic">טרם נוצרו צוותים.</p>}
                </div>
            </div>

            {/* Data Table & Map */}
            <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
                <div className="p-6 border-b border-gray-700 flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-750">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-white">סינון וניתוח:</h3>
                        <select 
                            value={filterTeam} 
                            onChange={(e) => { setFilterTeam(e.target.value); setShowMap(!!e.target.value); }}
                            className="bg-gray-900 text-white border border-gray-600 rounded-xl px-4 py-2 focus:outline-none focus:border-cyan-500 font-medium"
                        >
                            <option value="">-- כל המשתמשים --</option>
                            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    </div>
                    {filterTeam && (
                        <button 
                            onClick={() => setShowMap(!showMap)}
                            className={`px-6 py-2 rounded-full font-bold transition-all text-sm shadow-md ${showMap ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-cyan-400 hover:bg-gray-600'}`}
                        >
                            {showMap ? 'הצג רשימת שמות' : 'הצג מפת צוות'}
                        </button>
                    )}
                </div>
                
                <div className="p-0">
                    {loading ? (
                        <div className="text-center py-20 text-gray-500 animate-pulse font-bold text-xl">טוען נתונים...</div>
                    ) : showMap && filterTeam ? (
                        <div className="p-6"><TeamMap /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-gray-900/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="py-4 px-6">שם המשתתף</th>
                                        <th className="py-4 px-6">צוות נוכחי</th>
                                        <th className="py-4 px-6">סטטוס שאלון</th>
                                        <th className="py-4 px-6">תוצאה דומיננטית</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/50">
                                    {filteredUsers.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-12 text-gray-500 font-medium">לא נמצאו משתמשים התואמים לסינון</td></tr>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr key={user.uid} className="hover:bg-gray-700/30 transition-colors group">
                                                <td className="py-4 px-6">
                                                    <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">{user.displayName || 'משתמש ללא שם'}</div>
                                                    <div className="text-[10px] text-gray-500 dir-ltr text-right">{user.email}</div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={user.team}
                                                            onChange={(e) => handleMoveUser(user.uid, e.target.value)}
                                                            disabled={updatingUserId === user.uid}
                                                            className={`bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-cyan-500 transition-all text-cyan-200 ${updatingUserId === user.uid ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}`}
                                                        >
                                                            {teams.map(t => (
                                                                <option key={t.id} value={t.name}>{t.name}</option>
                                                            ))}
                                                            {teams.every(t => t.name !== user.team) && (
                                                                <option value={user.team}>{user.team}</option>
                                                            )}
                                                        </select>
                                                        {updatingUserId === user.uid && (
                                                            <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {user.scores ? 
                                                        <span className="text-green-400 text-[10px] bg-green-900/20 px-2 py-1 rounded-full border border-green-800/50 font-bold uppercase tracking-tight">בוצע</span> : 
                                                        <span className="text-gray-500 text-[10px] bg-gray-900/50 px-2 py-1 rounded-full border border-gray-700 font-medium uppercase tracking-tight">טרם מולא</span>
                                                    }
                                                </td>
                                                <td className="py-4 px-6">
                                                    {renderDominantColorBadge(user.scores)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
