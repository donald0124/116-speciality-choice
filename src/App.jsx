import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, LogOut, CheckCircle, XCircle, PlusCircle, AlertTriangle } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem'; // 確保這裡正確引入
import './App.css';

// 您的新 GAS 網址
const API_URL = import.meta.env.VITE_GAS_API_URL;

const calculateAllocations = (users, config) => {
  const capacity = {};
  config.forEach(c => {
    capacity[`${c.label}-regular`] = c.regular;
    capacity[`${c.label}-bound`] = c.bound;
  });
  const sortedUsers = [...users].sort((a, b) => Number(a.rank) - Number(b.rank));
  const allocations = {};
  sortedUsers.forEach(user => {
    let assigned = null;
    if (user.preferences && Array.isArray(user.preferences)) {
      for (let pref of user.preferences) {
        const key = `${pref.label}-${pref.isBound ? 'bound' : 'regular'}`;
        if (capacity[key] > 0) {
          assigned = pref;
          capacity[key]--;
          break;
        }
      }
    }
    allocations[user.name] = assigned;
  });
  return { allocations, capacity };
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser_v3');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginName, setLoginName] = useState('');
  const [loginPwd, setLoginPwd] = useState('');

  const [config, setConfig] = useState([]);
  const [roster, setRoster] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrefs, setEditingPrefs] = useState([]);

  // 1. 設定拖曳感應器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setIsSyncing(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data.config) setConfig(data.config);
      if (data.users) {
        const cleanedUsers = data.users.map(u => ({
          ...u,
          preferences: Array.isArray(u.preferences) ? u.preferences : []
        }));
        setRoster(cleanedUsers);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      if (showLoading) alert("連線失敗");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 3000);
    return () => clearInterval(interval);
  }, []);

  const { allocations } = useMemo(() => calculateAllocations(roster, config), [roster, config]);

  const handleLogin = () => {
    if (!roster.length) { alert("讀取中..."); return; }
    const foundUser = roster.find(u => u.name === loginName);
    if (!foundUser) { alert("查無此人"); return; }
    const userObj = { name: loginName, password: loginPwd, rank: foundUser.rank };
    setCurrentUser(userObj);
    localStorage.setItem('currentUser_v3', JSON.stringify(userObj));
    fetchData();
  };
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser_v3');
    setLoginName(''); setLoginPwd('');
  };

  const openModal = () => {
    const myData = roster.find(u => u.name === currentUser.name);
    // 2. 確保每個項目都有 ID (dnd-kit 需要)
    const prefsWithId = (myData?.preferences || []).map(p => ({
      ...p, 
      id: `${p.label}-${p.isBound ? 'b' : 'r'}`
    }));
    setEditingPrefs(prefsWithId);
    setIsModalOpen(true);
  };

  const addToPrefs = (label, isBound) => {
    const exists = editingPrefs.some(p => p.label === label && p.isBound === isBound);
    if (exists) return;
    setEditingPrefs([...editingPrefs, { 
      label, isBound, id: `${label}-${isBound ? 'b' : 'r'}` // 產生 ID
    }]);
  };

  const removeFromPrefs = (idToRemove) => {
    setEditingPrefs(items => items.filter(item => item.id !== idToRemove));
  };

  // 3. 處理拖曳結束
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      setEditingPrefs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const savePreferences = async () => {
    if (editingPrefs.length === 0) {
      if(!confirm("確定要清空所有志願嗎？")) return;
    }
    // 儲存前移除 ID (只存資料)
    const cleanPrefs = editingPrefs.map(({id, ...rest}) => rest);

    const newRoster = roster.map(u => u.name === currentUser.name ? { ...u, preferences: cleanPrefs } : u);
    setRoster(newRoster);
    setIsModalOpen(false);

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          name: currentUser.name, password: currentUser.password, preferences: cleanPrefs
        })
      });
      fetchData();
    } catch (e) {
      alert("儲存失敗");
      fetchData();
    }
  };

  if (!currentUser) return (
    <div className="full-screen">
      <div className="card">
        <h2 style={{textAlign:'center', marginBottom:30, fontWeight:900, color:'var(--primary-dark)'}}>醫院科別分發系統</h2>
        <div className="input-group">
           <label className="input-label">姓名</label>
           <input className="input-field" value={loginName} onChange={e=>setLoginName(e.target.value)} placeholder="全名"/>
        </div>
        <div className="input-group">
           <label className="input-label">驗證碼</label>
           <input type="password" className="input-field" value={loginPwd} onChange={e=>setLoginPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        </div>
        <button onClick={handleLogin} disabled={isLoading} className="btn-primary">{isLoading?"連線中...":"登入"}</button>
      </div>
    </div>
  );

  const myAllocated = allocations[currentUser.name];
  const myData = roster.find(u => u.name === currentUser.name);

  return (
    <div className="container">
      <div className="header">
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div className="rank-badge">{myData?.rank}</div>
          <div>
            <div style={{fontWeight:900}}>{currentUser.name}</div>
            <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>
              {isSyncing ? '同步中...' : `更新 ${lastUpdated?.toLocaleTimeString()}`}
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{background:'none', border:'none'}}><LogOut size={20} color="#64748b"/></button>
      </div>

      <div className="content-scroll-area">
        <div className="status-section">
          <div className="section-title">分發結果</div>
          <div className="result-card" onClick={openModal}>
            {myAllocated ? (
              <>
                <div className="result-label">
                  {myAllocated.label}
                  {myAllocated.isBound && <span className="tag-bound" style={{fontSize:'1rem', verticalAlign:'middle', marginLeft:5}}>綁定</span>}
                </div>
                <div className="result-sub">點擊修改志願 (已填 {myData?.preferences?.length||0} 個)</div>
              </>
            ) : (
              <div style={{color:'var(--text-muted)', fontWeight:'bold'}}>
                  {(!myData?.preferences || myData.preferences.length===0) ? (
                    <>
                      <PlusCircle size={40} style={{marginBottom:10, opacity:0.5}} />
                      <div>尚未填寫志願</div>
                    </>
                  ):(
                    <div className="result-warning">
                      <AlertTriangle size={24} style={{margin:'0 auto 5px auto'}}/>
                      志願皆已額滿，請增加更多選擇
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        <div className="status-section">
          <div className="section-title">全體狀況</div>
          <div className="roster-list">
            {roster.sort((a,b)=>Number(a.rank)-Number(b.rank)).map(u => (
              <div key={u.name} className={`roster-row ${u.name===currentUser.name?'me':''}`}>
                <div className="col-rank">{u.rank}</div>
                <div className="col-name">{u.name}</div>
                <div className="col-res">
                  {allocations[u.name] ? (
                    <span>{allocations[u.name].label}{allocations[u.name].isBound && '*'}</span>
                  ) : <span style={{color:'#cbd5e1'}}>-</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>編輯志願序 (拖曳排序)</span>
              <button onClick={() => setIsModalOpen(false)} style={{background:'none', border:'none'}}><XCircle size={24}/></button>
            </div>
            
            <div className="modal-body">
              {/* 4. Drag & Drop Context */}
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={editingPrefs} strategy={verticalListSortingStrategy}>
                  <div className="pref-list">
                    {editingPrefs.length === 0 && <div style={{textAlign:'center', color:'#94a3b8', padding:10}}>請由下方點選加入志願</div>}
                    
                    {editingPrefs.map((pref, idx) => (
                      <SortableItem 
                        key={pref.id} 
                        id={pref.id} 
                        data={pref} 
                        index={idx} 
                        onRemove={() => removeFromPrefs(pref.id)} 
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div style={{borderTop:'1px solid #e2e8f0', margin:'10px 0'}}></div>

              <div style={{fontSize:'0.9rem', fontWeight:'bold', marginBottom:8, color:'var(--text-muted)'}}>點擊加入志願：</div>
              <div className="options-grid">
                {config.map(dept => {
                   const renderBtn = (isBound) => {
                     const isSelected = editingPrefs.some(p => p.label === dept.label && p.isBound === isBound);
                     return (
                       <button 
                         key={`${dept.label}-${isBound}`}
                         onClick={() => addToPrefs(dept.label, isBound)}
                         disabled={isSelected}
                         className={`opt-btn ${isSelected ? 'selected' : ''}`}
                       >
                         <div>{dept.label}</div>
                         {isBound && <div className="tag-bound">綁定</div>}
                       </button>
                     );
                   };
                   return [dept.regular > 0 && renderBtn(false), dept.bound > 0 && renderBtn(true)].filter(Boolean);
                })}
              </div>
            </div>

            <div style={{padding:16, borderTop:'1px solid #f1f5f9'}}>
               <button className="btn-primary" onClick={savePreferences}>儲存志願序</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}