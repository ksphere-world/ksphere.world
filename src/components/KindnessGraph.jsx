// frontend/src/components/KindnessGraph.jsx
import { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const drawShape = (ctx, x, y, r, shape) => {
  ctx.beginPath();
  if (shape === 'square') {
    ctx.roundRect(x - r, y - r, r * 2, r * 2, 4);
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6; 
      const hx = x + (r * 1.1) * Math.cos(angle);
      const hy = y + (r * 1.1) * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
  } else {
    ctx.arc(x, y, r, 0, 2 * Math.PI, false);
  }
};

export default function KindnessGraph({ data, onNodeClick, onLinkClick, onBackgroundClick }) {
  const containerRef = useRef(null);
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [processedData, setProcessedData] = useState(null); // Safely holds memory

  // NEW: Listens for the Refresh button click to re-warm physics and zoom perfectly to fit the map
  useEffect(() => {
    const handleRecenter = () => {
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
        fgRef.current.zoomToFit(600, 50); // 600ms animation, 50px padding
      }
    };
    window.addEventListener('recenter-graph', handleRecenter);
    return () => window.removeEventListener('recenter-graph', handleRecenter);
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!data) return;
    
    // Using setTimeout makes this update asynchronous, safely bypassing React's strict cascading render warnings!
    const timer = setTimeout(() => {
      setProcessedData(prev => {
        const helpCount = {};
        data.nodes.forEach(n => helpCount[n.id] = 0);
        
        const linkPairs = new Set();
        data.links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        linkPairs.add(`${s}|${t}`);
        if (helpCount[s] !== undefined) helpCount[s] += 1;
      });

      const links = data.links.map(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        const hasReverse = linkPairs.has(`${t}|${s}`);
        return { ...l, curvature: hasReverse ? 0.25 : 0 };
      });

      // Map out the previous coordinates safely
      const oldNodeMap = new Map();
      if (prev && prev.nodes) {
        prev.nodes.forEach(n => oldNodeMap.set(n.id, n));
      }

      // 3. PREVENT SCATTER! Apply previous physics state (x,y,vx,vy)
      const nodes = data.nodes.map(n => {
        const oldNode = oldNodeMap.get(n.id);
        const newNode = { ...n, impactCount: helpCount[n.id] || 0 };
        
        if (oldNode) {
          if (oldNode.x !== undefined) newNode.x = oldNode.x;
          if (oldNode.y !== undefined) newNode.y = oldNode.y;
          if (oldNode.vx !== undefined) newNode.vx = oldNode.vx;
          if (oldNode.vy !== undefined) newNode.vy = oldNode.vy;
        }
        return newNode;
      });

      return { nodes, links };
    });
    }, 0); // End of setTimeout

    return () => clearTimeout(timer); // Clean up the timer
  }, [data]);

  useEffect(() => {
    if (fgRef.current) {
      // FIX: Removed dagMode and vastly increased repulsion so different chains push away from each other
      fgRef.current.d3Force('charge').strength(-1000).distanceMax(600); 
      fgRef.current.d3Force('link').distance(120); // Made links slightly longer to give nodes breathing room
    }
  }, [processedData]);

  return (
    <div ref={containerRef} className="w-full h-full rounded-3xl flex items-center justify-center bg-transparent">
      {processedData ? (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={processedData}
          onNodeClick={(node, event) => onNodeClick && onNodeClick(node, event)}
          onLinkClick={(link, event) => onLinkClick && onLinkClick(link, event)}
          onBackgroundClick={(event) => onBackgroundClick && onBackgroundClick(event)}
          // dagMode has been REMOVED here to allow multiple independent networks to float freely!
          backgroundColor="transparent"
          
          linkColor={(link) => link.customColor || '#000000'}
          linkWidth={3} 
          linkDirectionalArrowLength={12}
          linkDirectionalArrowRelPos={0.75} /* Shifted arrow head towards target so it doesn't overlap the middle label! */
          linkDirectionalArrowColor={(link) => link.customColor || '#000000'}
          linkCurvature={(link) => link.curvature || 0}
          
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx) => {
            if (link.helpsCount > 1) {
              const start = link.source;
              const end = link.target;
              // Wait until coordinates are calculated by the physics engine
              if (typeof start !== 'object' || typeof end !== 'object') return;
              
              const dx = end.x - start.x;
              const dy = end.y - start.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              
              // Calculate straight midpoint
              let textPos = {
                x: start.x + dx / 2,
                y: start.y + dy / 2
              };

              // If the arrow is curved, push the badge perfectly to the curve's apex using normal vector math!
              if (link.curvature) {
                const nx = -dy / distance; 
                const ny = dx / distance;
                const offset = (distance * link.curvature) / 2;
                textPos.x += nx * offset;
                textPos.y += ny * offset;
              }

              const label = `${link.helpsCount}x`;
              const fontSize = 10;
              ctx.font = `900 ${fontSize}px "Inter", sans-serif`;
              
              const textWidth = ctx.measureText(label).width;
              const bgWidth = textWidth + 8;
              const bgHeight = fontSize + 6;
              
              // Draw Yellow Pill Background
              ctx.fillStyle = '#facc15';
              ctx.beginPath();
              ctx.roundRect(textPos.x - bgWidth/2, textPos.y - bgHeight/2, bgWidth, bgHeight, 6);
              ctx.fill();
              
              // Draw Pill Border
              ctx.lineWidth = 1.5;
              ctx.strokeStyle = '#000000';
              ctx.stroke();

              // Draw Text
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#000000';
              ctx.fillText(label, textPos.x, textPos.y + 0.5); // +0.5 fixes canvas vertical alignment
            }
          }}

          d3VelocityDecay={0.8}
          warmupTicks={100}
          cooldownTicks={50}
          enableZoom={true}
          
          nodeCanvasObject={(node, ctx) => {
            const isGhost = node.ghost;
            const nodeRadius = isGhost ? 6 : 14 + (node.impactCount * 3);
            const shape = node.shape || 'circle';
            const type = node.type || 'color'; 
            const value = node.value || '#10b981'; 

            ctx.save();
            if (!isGhost) {
              ctx.shadowColor = '#000000';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 4;
              ctx.shadowOffsetY = 4;
            }
            
            drawShape(ctx, node.x, node.y, nodeRadius, shape);
            
            if (isGhost) {
              ctx.fillStyle = '#e2e8f0';
              ctx.fill();
            } else if (type === 'color') {
              ctx.fillStyle = value;
              ctx.fill();
            } else if (type === 'emoji') {
              ctx.fillStyle = '#ffffff'; 
              ctx.fill();
            } else if (type === 'image') {
              ctx.fillStyle = '#ffffff';
              ctx.fill(); 
              ctx.save();
              ctx.clip(); 
              
              if (!node.imgCache) {
                const img = new Image();
                img.src = value;
                img.crossOrigin = "Anonymous";
                node.imgCache = img;
              }
              if (node.imgCache.complete) {
                ctx.drawImage(node.imgCache, node.x - nodeRadius, node.y - nodeRadius, nodeRadius * 2, nodeRadius * 2);
              }
              ctx.restore();
            }

            // Clear the shadow before stroking so it doesn't bleed into and cover the node's background color
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowColor = 'rgba(0,0,0,0)';

            const isUnclaimed = node.is_claimed === false;
            drawShape(ctx, node.x, node.y, nodeRadius, shape);
            ctx.lineWidth = isGhost ? 1 : isUnclaimed ? 2 : 1.5;
            
            if (isUnclaimed) {
              ctx.setLineDash([4, 4]); // Dashed line for unclaimed nodes
              ctx.strokeStyle = '#f59e0b'; // Amber outline
            } else {
              ctx.setLineDash([]); // Solid line for claimed
              ctx.strokeStyle = isGhost ? '#94a3b8' : '#000000';
            }
            
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash
            ctx.restore(); 

            if (!isGhost && type === 'emoji') {
              ctx.font = `${nodeRadius * 1.2}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(value, node.x, node.y + 1);
            }

            const label = node.id;
            const fontSize = isGhost ? 10 : 12;
            ctx.font = `900 ${fontSize}px "Inter", sans-serif`;
            const textWidth = ctx.measureText(label).width;
            const badgeWidth = textWidth + 16;
            const badgeHeight = fontSize + 10;
            const badgeY = node.y + nodeRadius + 8;
            
            if (!isGhost) {
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.roundRect((node.x - badgeWidth / 2) + 2, badgeY + 2, badgeWidth, badgeHeight, 6);
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.roundRect(node.x - badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 6);
              ctx.fill();
              
              ctx.lineWidth = 1; // Thinner minimal badge border
              ctx.strokeStyle = '#000000';
              ctx.stroke();
            }

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isGhost ? '#94a3b8' : '#000000';
            ctx.fillText(label, node.x, badgeY + badgeHeight / 2 + 1); 
          }}
        />
      ) : (
        <p className="text-slate-400 font-medium">Loading network...</p>
      )}
    </div>
  );
}