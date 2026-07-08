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
  const [hoverNode, setHoverNode] = useState(null); // NEW: Tracks hovered profile
  const [hoverLink, setHoverLink] = useState(null); // NEW: Tracks hovered arrow

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
          
          // FIX: Add the actual number of helps to the impact count, not just 1!
          if (helpCount[s] !== undefined) helpCount[s] += (l.helpsCount || 1); 
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
          
          linkHoverPrecision={15} // 🔥 MASSIVELY expands the invisible clicking area of thin lines!
          onNodeHover={setHoverNode}
          onLinkHover={setHoverLink}
          
          linkColor={(link) => link === hoverLink ? '#f472b6' : (link.customColor || '#000000')}
          linkWidth={(link) => link === hoverLink ? 6 : 3} 
          linkDirectionalArrowLength={(link) => link === hoverLink ? 16 : 12}
          linkDirectionalArrowRelPos={0.75} /* Shifted arrow head towards target so it doesn't overlap the middle label! */
          linkDirectionalArrowColor={(link) => link === hoverLink ? '#f472b6' : (link.customColor || '#000000')}
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
              const isHovered = link === hoverLink;
              
              // Draw Pill Background
              ctx.fillStyle = isHovered ? '#f472b6' : '#facc15'; // Turns Pink on Hover
              ctx.beginPath();
              
              if (isHovered) {
                // Popped up slightly bigger
                ctx.roundRect(textPos.x - (bgWidth*1.2)/2, textPos.y - (bgHeight*1.2)/2, bgWidth*1.2, bgHeight*1.2, 8);
                ctx.shadowColor = '#f472b6';
                ctx.shadowBlur = 10;
              } else {
                ctx.roundRect(textPos.x - bgWidth/2, textPos.y - bgHeight/2, bgWidth, bgHeight, 6);
              }
              ctx.fill();
              ctx.shadowBlur = 0; // Reset shadow so it doesn't bleed
              
              // Draw Pill Border
              ctx.lineWidth = isHovered ? 2.5 : 1.5;
              ctx.strokeStyle = '#000000';
              ctx.stroke();

              // Draw Text
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = isHovered ? '#ffffff' : '#000000';
              if (isHovered) ctx.font = `900 ${fontSize + 2}px "Inter", sans-serif`; // Bolder text
              ctx.fillText(label, textPos.x, textPos.y + 0.5); // +0.5 fixes canvas vertical alignment
            }
          }}

          d3VelocityDecay={0.8}
          warmupTicks={100}
          cooldownTicks={50}
          enableZoom={true}
          
          // 🔥 FAT HITBOXES: Makes the entire Name Badge AND Profile highly clickable!
          nodePointerAreaPaint={(node, color, ctx) => {
            const isGhost = node.ghost;
            const nodeRadius = isGhost ? 6 : 14 + (node.impactCount * 3);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius + 15, 0, 2 * Math.PI, false); // Fatter circle hitbox
            ctx.fill();
            
            const fontSize = isGhost ? 10 : 12;
            ctx.font = `900 ${fontSize}px "Inter", sans-serif`;
            const textWidth = ctx.measureText(node.id).width;
            const badgeWidth = textWidth + 16;
            const badgeHeight = fontSize + 10;
            const badgeY = node.y + nodeRadius + 8;
            ctx.fillRect((node.x - badgeWidth / 2) - 5, badgeY - 5, badgeWidth + 10, badgeHeight + 10); // Fatter badge hitbox
          }}
          
          nodeCanvasObject={(node, ctx) => {
            const isGhost = node.ghost;
            const isHovered = node === hoverNode;
            const nodeRadius = isGhost ? 6 : 14 + (node.impactCount * 3);
            const shape = node.shape || 'circle';
            const type = node.type || 'color'; 
            const value = node.value || '#10b981'; 

            ctx.save();
            
            // ✨ HOVER POP ANIMATION ✨
            if (isHovered && !isGhost) {
              ctx.translate(node.x, node.y);
              ctx.scale(1.25, 1.25); // Scale up 125% when mouse enters
              ctx.translate(-node.x, -node.y);
              
              ctx.shadowColor = '#f472b6'; // Glowing pink aura
              ctx.shadowBlur = 20;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
            } else if (!isGhost) {
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