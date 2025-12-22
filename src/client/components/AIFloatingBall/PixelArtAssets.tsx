import React from 'react'

// 基础像素块大小
const P = 4 

interface SpriteProps {
  state: 'SLEEPING' | 'WAKING' | 'MOVING_TO_TREE' | 'EATING' | 'RETURNING'
}

export const MonkeySprite: React.FC<SpriteProps> = ({ state }) => {
  const C = {
    brn: '#8D6E63', // 毛色
    dbr: '#5D4037', // 阴影/轮廓
    face: '#FFECB3', // 脸/皮肤
    eye: '#3E2723',
    ear: '#A1887F'  // 耳朵色
  }

  // 1. 睡觉姿态 (重绘：蜷缩成一团)
  if (state === 'SLEEPING') {
    return (
      <svg width={32*P} height={22*P} viewBox="0 0 32 22" shapeRendering="crispEdges">
        {/* --- 身体主体 (蜷缩的圆形) --- */}
        <path d="M10 8 h12 v2 h2 v2 h2 v6 h-2 v2 h-14 v-2 h-2 v-6 h2 v-2 z" fill={C.brn} />
        
        {/* --- 脸部 (埋在下面) --- */}
        <rect x="8" y="14" width="6" height="4" fill={C.face} />
        <rect x="9" y="15" width="2" height="1" fill={C.eye} opacity="0.5" /> {/* 闭眼 */}
        
        {/* --- 耳朵 (突出特征) --- */}
        <rect x="8" y="9" width="4" height="3" fill={C.brn} />
        <rect x="9" y="10" width="2" height="1" fill={C.face} />
        
        {/* --- 手臂 (抱着头) --- */}
        <rect x="6" y="16" width="6" height="4" fill={C.brn} />
        <rect x="6" y="18" width="4" height="2" fill={C.face} />

        {/* --- 尾巴 (卷在身前) --- */}
        <path d="M26 14 h2 v4 h-2 v2 h-4 v-2 h4 v-2 h-4" fill={C.dbr} />
        
        {/* --- 呼吸起伏动画 (CSS类) --- */}
        <g className="breathe-anim">
           <rect x="12" y="10" width="8" height="6" fill={C.brn} opacity="0.3" /> 
        </g>
      </svg>
    )
  }

  // 2. 走路姿态
  if (state === 'MOVING_TO_TREE' || state === 'RETURNING') {
    return (
      <svg width={24*P} height={24*P} viewBox="0 0 24 24" shapeRendering="crispEdges" className="walk-anim">
        {/* 身体 */}
        <rect x="8" y="9" width="9" height="9" fill={C.brn} />
        {/* 头 */}
        <rect x="5" y="4" width="10" height="7" fill={C.brn} />
        <rect x="13" y="5" width="3" height="3" fill={C.brn} /> {/* 耳朵 */}
        <rect x="5" y="5" width="8" height="5" fill={C.face} />
        <rect x="6" y="6" width="2" height="2" fill={C.eye} />
        {/* 手脚 */}
        <rect x="8" y="18" width="3" height="3" fill={C.face} />
        <rect x="15" y="18" width="3" height="3" fill={C.face} />
        {/* 尾巴 (翘起来) */}
        <path d="M17 12 h2 v-2 h2 v-2 h-2" fill="none" stroke={C.brn} strokeWidth="2" />
      </svg>
    )
  }

  // 3. 吃/坐着
  return (
    <svg width={24*P} height={24*P} viewBox="0 0 24 24" shapeRendering="crispEdges">
      {/* 身体 */}
      <rect x="7" y="11" width="10" height="9" fill={C.brn} />
      <rect x="8" y="13" width="8" height="5" fill="#795548" /> {/* 浅色肚子 */}
      
      {/* 头 */}
      <rect x="5" y="3" width="14" height="9" fill={C.brn} />
      <rect x="4" y="5" width="2" height="3" fill={C.brn} /> {/* 耳朵L */}
      <rect x="19" y="5" width="2" height="3" fill={C.brn} /> {/* 耳朵R */}
      
      <rect x="6" y="4" width="12" height="7" fill={C.face} />
      <rect x="8" y="6" width="2" height="2" fill={C.eye} />
      <rect x="14" y="6" width="2" height="2" fill={C.eye} />

      {state === 'EATING' ? (
        <>
           {/* 咀嚼动画 */}
           <rect x="10" y="9" width="4" height="2" fill="#3E2723">
             <animate attributeName="height" values="2;1;2" dur="0.25s" repeatCount="indefinite" />
           </rect>
           {/* 香蕉 */}
           <path d="M5 14 h2 v2 h2 v2 h-2 v-2 h-2 z" fill="#FFEB3B" />
           <path d="M17 14 h-2 v2 h-2 v2 h2 v-2 h2 z" fill="#FFEB3B" />
        </>
      ) : (
         <rect x="10" y="9" width="4" height="1" fill={C.eye} />
      )}
      
      {/* 脚 */}
      <rect x="7" y="20" width="4" height="2" fill={C.face} />
      <rect x="13" y="20" width="4" height="2" fill={C.face} />
    </svg>
  )
}

export const BananaTree: React.FC<{ hasBananas: boolean }> = ({ hasBananas }) => {
  return (
    <svg width={60} height={80} viewBox="0 0 30 40" shapeRendering="crispEdges">
      <rect x="12" y="20" width="6" height="20" fill="#795548" />
      <rect x="6" y="10" width="18" height="12" fill="#2E7D32" />
      <rect x="10" y="6" width="10" height="6" fill="#388E3C" />
      
      {hasBananas && (
        <g>
          <rect x="10" y="22" width="2" height="4" fill="#FDD835" />
          <rect x="13" y="24" width="2" height="5" fill="#FDD835" />
          <rect x="16" y="22" width="2" height="4" fill="#FDD835" />
          <rect x="18" y="20" width="2" height="3" fill="#FDD835" />
        </g>
      )}
    </svg>
  )
}

export const ZzzIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 20 20" className="zzz-anim">
    <text x="0" y="15" fill="#90A4AE" fontFamily="monospace" fontSize="14" fontWeight="bold">Z</text>
    <text x="8" y="8" fill="#CFD8DC" fontFamily="monospace" fontSize="10" fontWeight="bold">z</text>
  </svg>
)

export const EmoteIcon: React.FC<{ type: 'alert' | 'heart' }> = ({ type }) => (
  <svg width="20" height="20" viewBox="0 0 10 10" shapeRendering="crispEdges" className="pop-anim">
    {type === 'alert' && (
      <>
        <rect x="4" y="1" width="2" height="5" fill="#EF4444" />
        <rect x="4" y="7" width="2" height="2" fill="#EF4444" />
      </>
    )}
    {type === 'heart' && (
       <path d="M2 3 h2 v-1 h2 v1 h2 v2 h-2 v2 h-2 v2 h-2 v-2 h-2 v-2 h2 z" fill="#EC4899" />
    )}
  </svg>
)