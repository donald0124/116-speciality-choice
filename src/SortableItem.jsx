import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical} from 'lucide-react';

export function SortableItem(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className={`pref-item ${isDragging ? 'dragging' : ''}`}>
      <div className="pref-content">
        {/* 把手：只在這裡監聽拖曳事件 */}
        <div {...attributes} {...listeners} className="drag-handle">
          <GripVertical size={20} />
        </div>

        <span className="pref-index">{props.index + 1}</span>
        
        <span style={{ fontWeight: 'bold' }}>
          {props.data.label} 
          {props.data.isBound && <span className="tag-bound">綁定</span>}
        </span>
      </div>

      {/* 刪除按鈕 */}
      <button 
        className="remove-btn" 
        onPointerDown={e => e.stopPropagation()} 
        onClick={props.onRemove}
      >
         <img 
          src="/trash-2.svg" 
          alt="刪除" 
          className="trash-icon"
        />
      </button>
    </div>
  );
}