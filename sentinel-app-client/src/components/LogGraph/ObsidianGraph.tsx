import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Log, NodeData, LinkData, RelationshipTypes } from '../../types/types';

type SimulationNode = d3.SimulationNodeDatum & NodeData;
type SimulationLink = d3.SimulationLinkDatum<SimulationNode> & LinkData;

interface DragEvent {
  active: boolean;
  subject: SimulationNode;
  x: number;
  y: number;
  sourceEvent: MouseEvent | TouchEvent;
}

type Simulation = d3.Simulation<SimulationNode, SimulationLink>;

interface ObsidianGraphProps {
  logs: Log[];
  selectedRelationship: RelationshipTypes;
  colors: { [key: string]: string };
  shapes: { [key: string]: string };
  onNodeClick?: (node: NodeData) => void;
  onLinkClick?: (link: LinkData) => void;
}

type DragBehavior = d3.DragBehavior<any, any, any>;

const ObsidianGraph = ({ logs, selectedRelationship, colors, shapes, onNodeClick, onLinkClick }: ObsidianGraphProps) => {
  // Always define hooks at the top level in the same order
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [links, setLinks] = useState<LinkData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Effect to handle dimension updates
  useEffect(() => {
    if (svgRef.current) {
      const width = svgRef.current.getBoundingClientRect().width || 800;
      const height = svgRef.current.getBoundingClientRect().height || 600;
      setDimensions({ width, height });
    }
  }, []);

  // Add window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const width = svgRef.current.getBoundingClientRect().width || 800;
        const height = svgRef.current.getBoundingClientRect().height || 600;
        setDimensions({ width, height });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Create nodes and links based on logs and relationship type
  // Process logs into nodes and links
  useEffect(() => {
    console.log('Processing logs:', logs?.length);
    if (!logs || logs.length === 0) {
      setNodes([]);
      setLinks([]);
      return;
    }
    try {
      // Create nodes from logs with unique IDs for potential entities
      const entityNodesMap = new Map<string, NodeData>();
      
      // Function to safely get a node ID
      const getNodeId = (value: string, type: string) => `${type}-${value}`;
      
      // Function to get relationship source and target for a log
      const getRelationshipPair = (log: Log): { sourceId: string | null, targetId: string | null, sourceValue: string | null, targetValue: string | null } => {
        switch (selectedRelationship) {
          case RelationshipTypes.IP_CONNECTION:
            return {
              sourceId: log.src_ip ? getNodeId(log.src_ip, 'ip') : null,
              targetId: log.dest_ip ? getNodeId(log.dest_ip, 'ip') : null,
              sourceValue: log.src_ip || null,
              targetValue: log.dest_ip || null
            };
          case RelationshipTypes.USER_EVENT:
            return {
              sourceId: log.user ? getNodeId(log.user, 'user') : null,
              targetId: log.event_type ? getNodeId(log.event_type, 'event') : null,
              sourceValue: log.user || null,
              targetValue: log.event_type || null
            };
          case RelationshipTypes.APP_EVENT:
            return {
              sourceId: log.app ? getNodeId(log.app, 'app') : null,
              targetId: log.event_type ? getNodeId(log.event_type, 'event') : null,
              sourceValue: log.app || null,
              targetValue: log.event_type || null
            };
          case RelationshipTypes.HOST_EVENT:
            return {
              sourceId: log.host ? getNodeId(log.host, 'host') : null,
              targetId: log.event_type ? getNodeId(log.event_type, 'event') : null,
              sourceValue: log.host || null,
              targetValue: log.event_type || null
            };
          case RelationshipTypes.THREAT_INDICATOR:
            return {
              sourceId: log.threatIndicator ? getNodeId(log.threatIndicator, 'threat') : null,
              targetId: log.event_type ? getNodeId(log.event_type, 'event') : null,
              sourceValue: log.threatIndicator || null,
              targetValue: log.event_type || null
            };
          default:
            return { sourceId: null, targetId: null, sourceValue: null, targetValue: null };
        }
      };

    // Create nodes and links
    logs.forEach((log) => {
      const { sourceId, targetId, sourceValue, targetValue } = getRelationshipPair(log);
      
      // Add source node if it exists and is unique
      if (sourceId && sourceValue) {
        if (!entityNodesMap.has(sourceId)) {
          entityNodesMap.set(sourceId, {
            id: sourceId,
            type: log.type || 'unknown',
            value: sourceValue,
            dataset: log.type || 'unknown',
            details: log
          });
        }
      }
      
      // Add target node if it exists and is unique
      if (targetId && targetValue) {
        if (!entityNodesMap.has(targetId)) {
          entityNodesMap.set(targetId, {
            id: targetId,
            type: log.type || 'unknown',
            value: targetValue,
            dataset: log.type || 'unknown',
            details: log
          });
        }
      }
    });

    // Convert nodes map to array
    const newNodes = Array.from(entityNodesMap.values());

    // Create links between related nodes
    const newLinks: LinkData[] = [];
    logs.forEach((log) => {
      const { sourceId, targetId } = getRelationshipPair(log);
      if (sourceId && targetId) {
        newLinks.push({
          source: sourceId,
          target: targetId,
          type: selectedRelationship
        });
      }
    });

    // Deduplicate links
    const uniqueLinks = newLinks.filter((link, index, self) => 
      index === self.findIndex((l) => 
        (l.source === link.source && l.target === link.target) ||
        (l.source === link.target && l.target === link.source)
      )
    );

    setNodes(newNodes);
    setLinks(uniqueLinks);
  } catch (err) {
    console.error('Error processing logs:', err);
    setNodes([]);
    setLinks([]);
  }
  }, [logs, selectedRelationship]);

  // Initialize D3 visualization when ready
  useEffect(() => {
    if (!isReady || nodes.length === 0) {
      console.log('Not ready for D3 init');
      return undefined;
    }

    let cleanup: (() => void) | undefined;

    // Wait for next frame to ensure DOM is ready
    const frameId = requestAnimationFrame(() => {
      try {
        const svgElement = svgRef.current;
        if (!svgElement) {
          console.error('SVG ref not available when trying to initialize D3');
          setIsReady(false);
          return;
        }

      const svgDimensions = svgElement.getBoundingClientRect();
      if (svgDimensions.width === 0 || svgDimensions.height === 0) {
        console.error('SVG has zero dimensions, will retry');
        setIsReady(false);
        return;
      }        console.log('SVG dimensions confirmed:', svgDimensions);
        
        // Set initial dimensions
        const width = svgDimensions.width;
        const height = svgDimensions.height;
        
        // Update dimensions state
        setDimensions({ width, height });

        // Set up the SVG container
        const svg = d3.select(svgElement);
        svg.selectAll("*").remove();
        svg.attr("width", width)
           .attr("height", height);

        const g = svg.append("g");

        // Create tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'absolute pointer-events-none opacity-0 z-50')
          .style('position', 'absolute')
          .style('z-index', '10');

        // Create force simulation
        console.log('Starting D3 simulation with:', { nodeCount: nodes.length, linkCount: links.length });
        
        const newSimulation = d3.forceSimulation<SimulationNode>(nodes)
          .force('link', d3.forceLink<SimulationNode, SimulationLink>(links)
            .id(d => d.id))
          .force('charge', d3.forceManyBody<SimulationNode>().strength(-100))
          .force('center', d3.forceCenter<SimulationNode>(width / 2, height / 2)) as Simulation;

        setSimulation(newSimulation);

        // Create links
        const link = g.append('g')
          .attr('class', 'links')
          .selectAll('line')
          .data(links)
          .join('line')
          .attr('stroke', '#666')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6);

        // Create nodes with different shapes
        const node = g.append('g')
          .attr('class', 'nodes')
          .selectAll('g')
          .data(nodes)
          .join('g')
          .call(drag(newSimulation) as any);

        // Add shapes based on node type
        node.each(function(d: any) {
          const shape = shapes[d.dataset] || shapes['Default'];
          const element = d3.select(this);
          
          const nodeColor = colors[d.dataset] || '#999';
          
          switch (shape) {
            case 'circle':
              element.append('circle')
                .attr('r', 8)
                .attr('fill', nodeColor);
              break;
            case 'square':
              element.append('rect')
                .attr('x', -6)
                .attr('y', -6)
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', nodeColor);
              break;
            case 'triangle':
              element.append('path')
                .attr('d', d3.symbol().type(d3.symbolTriangle).size(100))
                .attr('fill', nodeColor);
              break;
            case 'diamond':
              element.append('path')
                .attr('d', d3.symbol().type(d3.symbolDiamond).size(100))
                .attr('fill', nodeColor);
              break;
            case 'pentagon':
              element.append('path')
                .attr('d', d3.symbol().type(d3.symbolTriangle).size(100))
                .attr('fill', nodeColor);
              break;
          }
        });

        // Add hover and click effects
        node.on('mouseover', function(event, d: any) {
          const nodeElement = d3.select(this);
          nodeElement.select('circle, rect, path')
            .transition()
            .duration(200)
            .attr('transform', 'scale(1.2)');
          
          tooltip.transition()
            .duration(200)
            .style('opacity', .9);
          tooltip.html(`
            <div class="bg-neutral-800 p-2 rounded text-xs">
              <div>Type: ${d.type}</div>
              <div>Value: ${d.value}</div>
              <div>Dataset: ${d.dataset}</div>
              ${d.details.timestamp ? `<div>Time: ${new Date(d.details.timestamp).toLocaleString()}</div>` : ''}
              ${d.details.src_ip ? `<div>Source IP: ${d.details.src_ip}</div>` : ''}
              ${d.details.dest_ip ? `<div>Dest IP: ${d.details.dest_ip}</div>` : ''}
              ${d.details.user ? `<div>User: ${d.details.user}</div>` : ''}
              ${d.details.app ? `<div>App: ${d.details.app}</div>` : ''}
              ${d.details.host ? `<div>Host: ${d.details.host}</div>` : ''}
              ${d.details.threatIndicator ? `<div>Threat: ${d.details.threatIndicator}</div>` : ''}
            </div>
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).select('circle, rect, path')
            .transition()
            .duration(200)
            .attr('transform', 'scale(1)');
          
          tooltip.transition()
            .duration(500)
            .style('opacity', 0);
        })
        .on('click', function(event, d: any) {
          if (onNodeClick) onNodeClick(d);
        });

        // Update positions on each tick
        newSimulation.on('tick', () => {
          link
            .attr('x1', (d: any) => d.source.x)
            .attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => d.target.x)
            .attr('y2', (d: any) => d.target.y);

          node
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
        });

        setInitialized(true);

        // Set up cleanup function
        cleanup = () => {
          newSimulation.stop();
          setInitialized(false);
          setSimulation(null);
          tooltip.remove();
        };
      } catch (err) {
        console.error('Error initializing graph:', err);
        setError('Failed to initialize graph visualization');
        setInitialized(false);
      }
    });

    // Return cleanup function
    return () => {
      cancelAnimationFrame(frameId);
      if (cleanup) cleanup();
    };
  }, [isReady, nodes, links, colors, shapes, onNodeClick]);  // Include all required dependencies

  // Drag behavior
  const drag = (simulation: Simulation) => {
    function dragstarted(event: DragEvent) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: DragEvent) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: DragEvent) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  };

  // Effect to handle initialization
  useEffect(() => {
    if (!isReady || !svgRef.current) return;
    
    // Small delay to ensure DOM is fully ready
    const timer = setTimeout(() => {
      const svgElement = svgRef.current;
      if (svgElement && nodes.length > 0) {
        const svgDimensions = svgElement.getBoundingClientRect();
        if (svgDimensions.width > 0 && svgDimensions.height > 0) {
          setInitialized(false); // Reset initialization to trigger visualization
        }
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isReady, nodes.length]);

  // Reset ready state when data changes
  useEffect(() => {
    setIsReady(false);
    setInitialized(false);
  }, [logs, selectedRelationship]);

  // Always render based on state
  if (!logs || logs.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-400">
        Upload a dataset file to visualize relationships
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  if (nodes.length === 0 && logs.length > 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-400">
        Processing {logs.length} logs...
      </div>
    );
  }

  if (!initialized && isReady) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-400">
        Initializing graph visualization...
      </div>
    );
  }



  return (
    <div className="w-full h-full relative">
      <div className="w-full h-full">
        <svg ref={svgRef} className="w-full h-full bg-neutral-900" />
      </div>
      {!isReady && nodes.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <button
            onClick={() => {
              if (svgRef.current) {
                console.log('Generate button clicked, svg ref exists');
                console.log('SVG dimensions:', {
                  width: svgRef.current.getBoundingClientRect().width,
                  height: svgRef.current.getBoundingClientRect().height
                });
                setIsReady(true);
              } else {
                console.error('SVG ref not available');
              }
            }}
            className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-700 transition-colors"
          >
            Generate Graph ({nodes.length} nodes)
          </button>
        </div>
      )}
    </div>
  );
};

export default ObsidianGraph;