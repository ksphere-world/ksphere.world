// frontend/src/components/KindnessGraph.jsx
import { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const drawShape = (ctx, x, y, r, shape) => {
  ctx.beginPath();
  if (shape === 'square') {
    ctx.roundRect(x - r, y - r, r * 2, r * 2, 4);
  } else if (shape === 'star') {
    // Designer Math Map Poly Structure Generating Precision Custom Shapes 
    const points = 5; const outerR = r * 1.35; const innerR = r * 0.6; const rot = Math.PI / 2 * 3;
    ctx.moveTo(x, y - outerR);
    for (let i = 0; i < points; i++) {
        ctx.lineTo(x + Math.cos(rot + i*Math.PI*2/points) * outerR, y + Math.sin(rot + i*Math.PI*2/points) * outerR);
        ctx.lineTo(x + Math.cos(rot + i*Math.PI*2/points + Math.PI/points) * innerR, y + Math.sin(rot + i*Math.PI*2/points + Math.PI/points) * innerR);
    }
    ctx.closePath();
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

      // Map out the previous coordinates safely
      const oldNodeMap = new Map();
      const oldLinkMap = new Map(); 
      
      if (prev && prev.nodes) {
        prev.nodes.forEach(n => oldNodeMap.set(n.id, n));
      }
      if (prev && prev.links) {
        prev.links.forEach(l => {
           const sId = typeof l.source === 'object' ? l.source.id : l.source;
           const tId = typeof l.target === 'object' ? l.target.id : l.target;
           oldLinkMap.set(`${sId}|${tId}`, l); // Safe pointer reference stored
        });
      }

      // 3. SECURE THE PHYSICS POINTERS! 
      // Do NOT create new memory objects. We will surgically reuse the exact engine memory and just inject updated values!
      const nodes = data.nodes.map(n => {
        const oldNode = oldNodeMap.get(n.id);
        
        if (oldNode) {
          // Keep identical invisible D3 coordinates internally, but rewrite visual properties to the existing object.
          oldNode.reactions = n.reactions;
          oldNode.socials = n.socials;
          oldNode.shape = n.shape;
          oldNode.type = n.type;
          oldNode.value = n.value;
          oldNode.rank = n.rank; // Safe Syncs
          oldNode.followersCount = n.followersCount; // Explicitly locked dynamic Fan variable property!
          oldNode.isFollowedByMe = n.isFollowedByMe; // Logic control layout constraint active variable retained accurately permanently preventing memory loop failure syncs drops 
          oldNode.is_claimed = n.is_claimed;
          oldNode.impactCount = helpCount[n.id] || 0;
          return oldNode; // Returned pure Engine Memory perfectly untouched 
        }
        
        // The Engine generates physics states only if a strictly brand new one spawned right now 
        return { ...n, impactCount: helpCount[n.id] || 0 };
      });

      const links = data.links.map(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        const oldLink = oldLinkMap.get(`${sId}|${tId}`);
        const hasReverse = linkPairs.has(`${tId}|${sId}`);
        
        // If engine memory is there safely swap cosmetic fields flawlessly
        if (oldLink) {
           oldLink.reactions = l.reactions; 
           oldLink.comment = l.comment;
           oldLink.helpsCount = l.helpsCount || 1;
           oldLink.curvature = hasReverse ? 0.25 : 0; 
           return oldLink;
        }

        // Safe Engine Entry Memory Initializer Hook Phase Drop for completely unheard nodes spawning
        return { ...l, curvature: hasReverse ? 0.25 : 0 };
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
          
          linkColor={(link) => {
              if (link === hoverLink) return '#f472b6';
              // Check cosmetic beam styling modifications cleanly via source mapped attributes universally globally  
              return link.arrowStyle === 'electric' ? '#60a5fa' : (link.customColor || '#000000');
          }}
          // Hooking Width properties and Dashing physics natively allowing beautiful styling mapping without blowing up renderer 
          linkWidth={(link) => {
              if (link === hoverLink) return 6;
              return link.arrowStyle === 'electric' ? 5 : 3;
          }} 
          linkDirectionalArrowLength={(link) => link === hoverLink ? 16 : 12}
          linkDirectionalArrowRelPos={0.75} /* Shifted arrow head towards target so it doesn't overlap the middle label! */
          linkDirectionalArrowColor={(link) => link === hoverLink ? '#f472b6' : (link.arrowStyle === 'electric' ? '#2563eb' : (link.customColor || '#000000'))}
          linkCurvature={(link) => link.curvature || 0}
          linkLineDash={(link) => link.arrowStyle === 'dashed' ? [6, 6] : null} // NATIVELY PUSHES GLOWING/DASHED PARTICLES OVER ARROW PHYSICS SMOOTHLY
          
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx) => {
            const isHovered = link === hoverLink;
            const totalReacts = link.reactions ? Object.values(link.reactions).reduce((a, b) => a + b, 0) : 0;
            const hasLabel = link.helpsCount > 1;

            // FIX: Check applies ANY time reaction logic > 0 exist OR helps count > 1 threshold pops (Solves Emojis Missing on Refresh/Curved arrows forever)
            if (hasLabel || totalReacts > 0) {
              const start = link.source;
              const end = link.target;
              // Wait until coordinates are calculated by the physics engine
              if (typeof start !== 'object' || typeof end !== 'object') return;
              
              const dx = end.x - start.x;
              const dy = end.y - start.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              
              // Calculate straight midpoint base tracking geometry logic standard layout scaling UI elements onto DOM overlay
              let textPos = {
                x: start.x + dx / 2,
                y: start.y + dy / 2
              };

              // If arrow relies curve geometry offsets strictly recalculating logic relative normal matrix alignment scaling curve offset apex values specifically (Correct curve tracking mathematical vectors vs 2D standard forcegraph) 
              if (link.curvature) {
                const curveApex = distance * link.curvature; 
                textPos.x += (-dy / distance) * curveApex; 
                textPos.y += (dx / distance) * curveApex;
              }

              let drawReactionX = textPos.x;
              let drawReactionY = textPos.y;
              
              // DRAW HELP BADGE CONDITIONAL LOOP PROCESSING EXPLICITLY INDEPENDENT! 
              if (hasLabel) {
                  const label = `${link.helpsCount}x`;
                  const fontSize = 10;
                  ctx.font = `900 ${isHovered ? fontSize + 2 : fontSize}px "Inter", sans-serif`;
                  
                  const textWidth = ctx.measureText(label).width;
                  const bgWidth = textWidth + 8;
                  const bgHeight = fontSize + 6;
                  
                  ctx.fillStyle = isHovered ? '#f472b6' : '#facc15'; // Turns Pink on Hover UI POP!
                  ctx.beginPath();
                  if (isHovered) {
                    // Popped slightly larger bounding radius scaled offsets
                    ctx.roundRect(textPos.x - (bgWidth*1.2)/2, textPos.y - (bgHeight*1.2)/2, bgWidth*1.2, bgHeight*1.2, 8);
                    ctx.shadowColor = '#f472b6';
                    ctx.shadowBlur = 10;
                  } else {
                    ctx.roundRect(textPos.x - bgWidth/2, textPos.y - bgHeight/2, bgWidth, bgHeight, 6);
                  }
                  ctx.fill();
                  ctx.shadowBlur = 0; 
                  
                  ctx.lineWidth = isHovered ? 2.5 : 1.5;
                  ctx.strokeStyle = '#000000';
                  ctx.stroke();

                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = isHovered ? '#ffffff' : '#000000';
                  ctx.fillText(label, textPos.x, textPos.y + 0.5); 
                  
                  // Scale emojis upwards properly relative to parent offset pills for dynamic mapping stacking! 
                  drawReactionX = textPos.x + bgWidth/2 - 4; 
                  drawReactionY = textPos.y - bgHeight - 4;
              }

              // ✨ EXPLICITLY FORCES CURVES / ARROWS REGARDLESS TO DROP REACTION TRACKER ANCHORS! ✨
              if (totalReacts > 0) {
                  const topEmoji = Object.entries(link.reactions).sort((a,b)=>b[1]-a[1])[0][0];
                  
                  ctx.fillStyle = '#ffffff';
                  ctx.beginPath();
                  ctx.roundRect(drawReactionX - 10, drawReactionY - 10, 20, 20, 5); // Clean square 
                  ctx.fill();
                  ctx.lineWidth = 1;
                  ctx.strokeStyle = '#000000';
                  ctx.stroke();

                  ctx.font = '12px Arial'; // Enhanced rendering 
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#000000';
                  // Placed squarely anchored centered!
                  ctx.fillText(topEmoji, drawReactionX, drawReactionY + 1.5);
              }
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
            const eff = node.cosmetics?.effect || 'none'; // GRABS K-SHOP AURA LAYER INSTANTLY GLOBALLY OVER OVERRIDES

            ctx.save();
            
            // WARDROBE AURA MATHEMATICAL PAINT PROCESSING VISUAL OVERRIDE BLEND COMPOSITION NATIVELY!
            if (!isGhost && eff !== 'none' && !isHovered) {
               ctx.beginPath();
               if (eff === 'fire') {
                   // Blinking animated chaotic hellfire
                   const randoFlare = (Date.now() % 500) / 100; // Fast time math flickering rendering limits properly bouncing
                   drawShape(ctx, node.x, node.y, nodeRadius + 4 + (randoFlare), shape);
                   ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
                   ctx.shadowColor = '#f97316';
                   ctx.shadowBlur = 35;
               } else if (eff === 'neon') {
                   // Pulsing elegant static clean pink cyberpunk neon bounds overlapping 
                   drawShape(ctx, node.x, node.y, nodeRadius + 3, shape);
                   ctx.fillStyle = "rgba(217, 70, 239, 0.5)";
                   ctx.shadowColor = '#ec4899';
                   ctx.shadowBlur = 18;
               } else if (eff === 'holy') {
                   // Static Golden massive peaceful aura overlay overlapping boundaries extending completely universally! 
                   drawShape(ctx, node.x, node.y, nodeRadius + 5, shape);
                   ctx.fillStyle = "rgba(252, 211, 77, 0.3)";
                   ctx.shadowColor = '#fcd34d';
                   ctx.shadowBlur = 20;
               }
               ctx.fill();
               // Strip overlapping paint shadow bleeds instantly universally clearing logic bounds tracking globally rendering limits!
               ctx.shadowBlur = 0; 
               ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; 
            }

            // ✨ GOLDEN HALO QUEST TRACKING SHINE OVERRIDES DEFAULTS !
            if (node.glowingQuestHalo && !isGhost && !isHovered) {
                ctx.beginPath();
                drawShape(ctx, node.x, node.y, nodeRadius + 6, shape);
                ctx.fillStyle = "rgba(250, 204, 21, 0.5)"; 
                ctx.shadowColor = '#fbbf24';  
                ctx.shadowBlur = 25; 
                ctx.fill();
            }

            // ✨ HOVER POP ANIMATION ✨
            if (isHovered && !isGhost) {
              ctx.translate(node.x, node.y);
              ctx.scale(1.25, 1.25); 
              ctx.translate(-node.x, -node.y);
              ctx.shadowColor = '#f472b6'; 
              ctx.shadowBlur = 20;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
            } else if (!isGhost && eff === 'none' && !node.glowingQuestHalo) {
              ctx.shadowColor = '#000000';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 4;
              ctx.shadowOffsetY = 4;
            } else {
              ctx.shadowColor = '#000000';
              ctx.shadowOffsetX = 2; 
              ctx.shadowOffsetY = 2;
              ctx.shadowBlur = 0;
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

            // ✨ RENDER REACTIONS ORBITING THE USER ✨
            if (node.reactions) {
              const entries = Object.entries(node.reactions).sort((a,b)=>b[1]-a[1]);
              let ringOffset = 0; // Stack multiple reactions dynamically around them!

              entries.forEach(([emoji, count], idx) => {
                 if (idx > 1) return; // To keep map clean, max 2 emoji types can be seen globally
                 
                 const popX = (node.x + nodeRadius) + 2; 
                 const popY = (node.y - nodeRadius) + (ringOffset * 15) - 2;
                 
                 // Reaction Bubble Background (with count)
                 const eFont = 10;
                 ctx.font = `800 ${eFont - 2}px "Inter", sans-serif`;
                 const textPadding = 12; // Adjust for emoji width and count
                 const width = count > 1 ? textPadding + 8 : textPadding; 
                 
                 ctx.fillStyle = '#ffffff';
                 ctx.beginPath();
                 ctx.roundRect(popX - width/2, popY - eFont, width + 4, eFont + 6, 6);
                 ctx.fill();
                 ctx.lineWidth = 1.5;
                 ctx.strokeStyle = '#000000';
                 ctx.stroke();

                 // Draw the Reaction text
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 const bubbleText = count > 1 ? `${emoji} ${count}` : emoji;
                 ctx.fillStyle = '#000';
                 ctx.fillText(bubbleText, popX + 2, popY - 2);
                 
                 ringOffset++;
              });
            }

          }}
        />
      ) : (
        <p className="text-slate-400 font-medium">Loading network...</p>
      )}
    </div>
  );
}