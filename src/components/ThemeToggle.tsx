"use client";

import { useEffect, useState } from "react";
import { Icone } from "./Icone";

export function useTema() {
  const [escuro, setEscuro] = useState(false);
  
  useEffect(() => {
    setEscuro(document.documentElement.getAttribute("data-tema") === "escuro");
  }, []);

  const alternar = (e?: React.MouseEvent) => {
    const novo = !escuro;
    
    const applyTheme = () => {
      setEscuro(novo);
      document.documentElement.setAttribute("data-tema", novo ? "escuro" : "claro");
      try {
        localStorage.setItem("ciclo-tema", novo ? "escuro" : "claro");
      } catch {}
    };

    if (!document.startViewTransition || !e) {
      applyTheme();
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const safeRadius = (endRadius / 0.95) + 2; // Ensures the lowest point of the wave covers the screen corners

    const getWavyPolygon = (x: number, y: number, radius: number, phase: number) => {
      const points = [];
      const steps = 360;
      const numWaves = 18; 
      const waveDepth = radius * 0.05; 
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const currentRadius = Math.max(0, radius + Math.sin((angle * numWaves) + phase) * waveDepth);
        const px = (currentRadius * Math.cos(angle)) + x;
        const py = (currentRadius * Math.sin(angle)) + y;
        points.push(`${px.toFixed(1)}px ${py.toFixed(1)}px`);
      }
      return `polygon(${points.join(', ')})`;
    };

    document.documentElement.classList.add("theme-transition");

    const transition = document.startViewTransition(applyTheme);

    transition.ready.then(() => {
      const keyframes = [];
      const numFrames = 60;
      for (let i = 0; i <= numFrames; i++) {
        const progress = i / numFrames;
        const currentRadius = safeRadius * progress;
        const phase = progress * Math.PI * 12; // 6 full wobbles during the expansion
        
        keyframes.push({
          clipPath: getWavyPolygon(x, y, currentRadius, phase)
        });
      }

      document.documentElement.animate(keyframes, {
        duration: 2200,
        easing: "ease-out",
        pseudoElement: "::view-transition-new(root)",
      });
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove("theme-transition");
    });
  };
  
  return { escuro, alternar };
}

export function ThemeToggleButton({ style }: { style?: React.CSSProperties }) {
  const { escuro, alternar } = useTema();
  return (
    <>
      <style>{`
        html.theme-transition::view-transition-old(root),
        html.theme-transition::view-transition-new(root) {
          animation: none;
          mix-blend-mode: normal;
        }
        html.theme-transition::view-transition-old(root) {
          z-index: 1;
        }
        html.theme-transition::view-transition-new(root) {
          z-index: 9999;
        }
      `}</style>
      <button 
        className="btn btn-secondary btn-icon" 
        onClick={alternar} 
        aria-label="Alternar tema" 
        style={style}
      >
        <Icone nome={escuro ? "sol" : "lua"} />
      </button>
    </>
  );
}
