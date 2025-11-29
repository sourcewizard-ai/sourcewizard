"use client";

import { useState, useRef, useEffect, ReactNode } from 'react';
import { fonts } from '../lib/fonts';

interface DraggableWindowProps {
  title: ReactNode;
  onClose: () => void;
  zIndex: number;
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  resizable?: boolean;
  onFocus?: () => void;
  width?: number;
  height?: number;
}

export default function DraggableWindow({
  title,
  onClose,
  zIndex,
  children,
  initialWidth = 600,
  initialHeight = 400,
  initialX,
  initialY,
  resizable = true,
  onFocus,
  width,
  height,
}: DraggableWindowProps) {
  const [isClosePressed, setIsClosePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    initialX !== undefined && initialY !== undefined
      ? { x: initialX, y: initialY }
      : null
  );

  // Check if mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Set centered position after mount
  useEffect(() => {
    if (position === null && typeof window !== 'undefined') {
      setPosition({
        x: window.innerWidth / 2 - initialWidth / 2,
        y: window.innerHeight / 2 - initialHeight / 2,
      });
    }
  }, [position, initialWidth, initialHeight]);

  const [size, setSize] = useState({
    width: width || initialWidth,
    height: height || initialHeight
  });

  // Track previous size to detect changes
  const prevSizeRef = useRef({ width: initialWidth, height: initialHeight });

  // Update size when width/height props change
  useEffect(() => {
    if (width !== undefined || height !== undefined) {
      const newWidth = width !== undefined ? width : size.width;
      const newHeight = height !== undefined ? height : size.height;

      // Only adjust position if size is actually increasing and window has been positioned
      if (position && windowRef.current) {
        const widthIncrease = newWidth - prevSizeRef.current.width;
        const heightIncrease = newHeight - prevSizeRef.current.height;

        if (widthIncrease > 0 || heightIncrease > 0) {
          // Move left/up by half the size increase to keep it more centered
          setPosition(prevPos => {
            if (!prevPos) return prevPos;

            const newX = prevPos.x - widthIncrease / 2;
            const newY = prevPos.y - heightIncrease / 4; // Move less vertically (1/4 instead of 1/2)

            // Ensure window doesn't go off-screen
            const maxX = typeof window !== 'undefined' ? window.innerWidth - newWidth : 0;
            const maxY = typeof window !== 'undefined' ? window.innerHeight - newHeight : 0;

            return {
              x: Math.max(0, Math.min(newX, maxX)),
              y: Math.max(0, Math.min(newY, maxY))
            };
          });
        }
      }

      // Update size
      setSize({
        width: newWidth,
        height: newHeight
      });

      // Update previous size ref
      prevSizeRef.current = { width: newWidth, height: newHeight };
    }
  }, [width, height]);

  const windowRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef(position || { x: 0, y: 0 });
  const resizeStartRef = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const currentSizeRef = useRef(size);

  useEffect(() => {
    if (position) {
      currentPosRef.current = position;
    }
  }, [position]);

  useEffect(() => {
    currentSizeRef.current = size;
  }, [size]);

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    if (onFocus) {
      onFocus();
    }
    dragStartRef.current = {
      x: e.clientX - currentPosRef.current.x,
      y: e.clientY - currentPosRef.current.y,
    };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    if (onFocus) {
      onFocus();
    }
    resizeStartRef.current = {
      width: currentSizeRef.current.width,
      height: currentSizeRef.current.height,
      x: e.clientX,
      y: e.clientY,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;

      currentPosRef.current = { x: newX, y: newY };

      if (windowRef.current) {
        windowRef.current.style.left = `${newX}px`;
        windowRef.current.style.top = `${newY}px`;
      }
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      setPosition(currentPosRef.current);
    };

    window.addEventListener('mousemove', handleDragMove, { passive: true });
    window.addEventListener('mouseup', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isResizing) return;

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    const handleResizeMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;

      const newWidth = Math.max(300, resizeStartRef.current.width + deltaX);
      const newHeight = Math.max(200, resizeStartRef.current.height + deltaY);

      currentSizeRef.current = { width: newWidth, height: newHeight };

      if (windowRef.current) {
        windowRef.current.style.width = `${newWidth}px`;
        windowRef.current.style.height = `${newHeight}px`;
      }
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      setSize(currentSizeRef.current);
      // Re-enable text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };

    window.addEventListener('mousemove', handleResizeMove, { passive: true });
    window.addEventListener('mouseup', handleResizeEnd);

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      // Re-enable text selection on cleanup
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [isResizing]);

  return (
    <div
      ref={windowRef}
      className="fixed bg-gray-50 text-black flex flex-col"
      style={{
        fontFamily: fonts.mono,
        fontSize: isMobile ? "12px" : "14px",
        width: isMobile ? '100vw' : `${size.width}px`,
        height: isMobile ? 'calc(100vh - 80px)' : `${size.height}px`,
        top: isMobile ? '80px' : (position ? `${position.y}px` : '50%'),
        left: isMobile ? '0' : (position ? `${position.x}px` : '50%'),
        transform: isMobile ? 'none' : (position ? 'none' : 'translate(-50%, -50%)'),
        boxShadow: isMobile ? 'none' : "4px 4px 0 rgba(0, 0, 0, 0.5)",
        border: isMobile ? 'none' : "2px solid #808080",
        zIndex,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onClick={onFocus}
    >
      {/* Title Bar */}
      <div
        className="bg-gray-200 text-black border-b-2 border-gray-400 pl-3 pr-2 py-2 flex items-center justify-between select-none"
        style={{
          fontFamily: fonts.mono,
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: isMobile ? 'default' : 'grab',
        }}
        onMouseDown={isMobile ? undefined : handleDragStart}
      >
        <div className="flex items-center">
          {typeof title === 'string' ? (
            <span className="text-sm font-bold text-black">{title}</span>
          ) : (
            title
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="bg-gray-300 text-black text-xs font-bold flex items-center justify-center cursor-pointer px-1 py-0.5"
          style={{
            fontFamily: fonts.mono,
            border: "1px solid #808080",
            boxShadow: isClosePressed ? "none" : "1px 1px 0 #000000",
            transform: isClosePressed ? "translate(1px, 1px)" : "none",
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsClosePressed(true);
          }}
          onMouseUp={() => setIsClosePressed(false)}
          onMouseLeave={() => setIsClosePressed(false)}
        >
          [X]
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>

      {/* Resize Handle - hidden on mobile */}
      {resizable && !isMobile && (
        <div
          className="absolute bottom-0 right-0 w-2 h-2 cursor-se-resize"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, #808080 50%)',
          }}
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
}
