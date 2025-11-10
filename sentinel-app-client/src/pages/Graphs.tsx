import { useState, useEffect, useRef, useMemo } from "react";
import AnalyticsHeader from "../components/AnalyticsHeader";
import ColorPicker, { EventColor } from "../components/LogGraph/ColorPicker";
import DatasetPicker from "../components/LogGraph/DatasetPicker";
import ObsidianGraph from "../components/LogGraph/ObsidianGraph";
import GraphControls from "../components/LogGraph/GraphControls";
import LogUploader from "../components/LogGraph/LogUploader";
import { ChevronsLeft, ChevronsRight, PanelTopClose } from "lucide-react";
import { Progress } from "../components/ui/progress";
import { RelationshipTypes } from "../types/types";

interface GraphOption {
  id: string;
  name: string;
  enabled: boolean;
  height: number;
}

const defaultGraphOptions: GraphOption[] = [
  { id: 'obsidian', name: 'Node Graph', enabled: true, height: 400 },
  { id: 'geomap', name: 'Geographic Map', enabled: false, height: 300 },
  { id: 'error', name: 'Error Graph', enabled: false, height: 300 }
];

const DEFAULT_SIDEBAR_WIDTH = 300; // Match analytics page width

const Graphs = () => {
  const [eventColors, setEventColors] = useState<EventColor[]>([]);
  const [selectedRelationship, setSelectedRelationship] = useState(RelationshipTypes.IP_CONNECTION);
  const [currentDataset, setCurrentDataset] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [graphOptions, setGraphOptions] = useState<GraphOption[]>(defaultGraphOptions);
  const [isResizingGraph, setIsResizingGraph] = useState<string | null>(null);
  
  const handleColorChange = (eventType: string, color: string) => {
    setEventColors(colors =>
      colors.map(c =>
        c.eventType === eventType ? { ...c, color } : c
      )
    );
  };

  const handleRemoveColor = (eventType: string) => {
    setEventColors(colors => colors.filter(c => c.eventType !== eventType));
  };

  const handleAddColor = (eventType: string, color: string) => {
    setEventColors(colors => [...colors, { eventType, color }]);
  };

  // Get available values for each criteria type from selected datasets
  const availableValues = useMemo(() => {
    const values = {
      event_type: new Set<string>(),
      severity: new Set<string>(),
      app_type: new Set<string>(),
      src_ip: new Set<string>(),
      dest_ip: new Set<string>()
    };
    
    logs.forEach(log => {
      // Event types
      if (log.type) values.event_type.add(log.type);
      if (log.event_type) values.event_type.add(log.event_type);
      
      // Severity levels
      if (log.severity) values.severity.add(log.severity);
      
      // Application types
      if (log.appDisplayName) values.app_type.add(log.appDisplayName);
      if (log.resourceDisplayName) values.app_type.add(log.resourceDisplayName);
      
      // IP addresses
      if (log.src_ip) values.src_ip.add(log.src_ip);
      if (log.dest_ip) values.dest_ip.add(log.dest_ip);
    });

    return {
      event_type: Array.from(values.event_type),
      severity: Array.from(values.severity),
      app_type: Array.from(values.app_type),
      src_ip: Array.from(values.src_ip),
      dest_ip: Array.from(values.dest_ip)
    };
  }, [logs]);

  // Sidebar resize handler
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingSidebar || sidebarCollapsed) return;
      const min = 220; // Match analytics page minimum width
      const max = window.innerWidth - 100;
      const w = Math.min(Math.max(e.clientX, min), max);
      setSidebarWidth(w);
    };
    const onUp = () => setIsResizingSidebar(false);
    
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingSidebar, sidebarCollapsed]);

  // Graph height resize handler
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingGraph) return;
      
      const rect = document.getElementById(isResizingGraph)?.getBoundingClientRect();
      if (!rect) return;
      
      setGraphOptions(prev => {
        const enabledGraphs = prev.filter(g => g.enabled);
        if (enabledGraphs.length <= 1) return prev;
        
        return prev.map(graph => {
          if (graph.id === isResizingGraph) {
            const newHeight = Math.max(200, e.clientY - rect.top);
            return {
              ...graph,
              height: newHeight
            };
          }
          return graph;
        });
      });
    };
    
    const onUp = () => setIsResizingGraph(null);
    
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingGraph]);

  const handleToggleSidebar = () => setSidebarCollapsed(prev => !prev);
  
  const handleToggleGraph = (graphId: string) => {
    setGraphOptions(prev => prev.map(graph => 
      graph.id === graphId ? { ...graph, enabled: !graph.enabled } : graph
    ));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="fixed top-[61px] inset-x-0 bg-neutral-900 z-10">
        <AnalyticsHeader />
      </div>
      <div className="flex-1 bg-black pt-10">
        <div className="fixed inset-x-0 top-24 bottom-0 bg-black text-white flex">
          {/* Left Panel - Completely Separate */}
          <div 
            className="h-full bg-neutral-800"
            style={{ 
              width: sidebarCollapsed ? '0' : `${sidebarWidth}px`,
              transition: isResizingSidebar ? 'none' : 'width 200ms ease-out'
            }}
          >
            <div className="h-full overflow-y-auto" style={{ width: `${sidebarWidth}px` }}>
              <div className="p-3 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-yellow-400 mb-2">Graph Views</h3>
                  {graphOptions.map(graph => (
                    <div key={graph.id} className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={graph.enabled}
                          onChange={() => handleToggleGraph(graph.id)}
                          className="rounded border-neutral-700 bg-neutral-800 text-yellow-400 focus:ring-yellow-400/30"
                        />
                        {graph.name}
                      </label>
                      {graph.enabled && graphOptions.filter(g => g.enabled).length > 1 && (
                        <div className="ml-6 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setGraphOptions(prev => prev.map(g => 
                                g.id === graph.id ? {...g, height: window.innerHeight - 200} : g
                              ));
                            }}
                            className="text-xs px-2 py-1 rounded bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-yellow-400"
                          >
                            Maximize Height
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-neutral-700">
                  <h3 className="text-sm font-medium text-yellow-400 mb-2">Selected Data</h3>
                  <div className="space-y-2">
                    <LogUploader
                      uploading={uploading}
                      uploadProgress={uploadProgress}
                      onUploadStart={() => {
                        setUploading(true);
                        setUploadProgress(0);
                        setLogs([]);
                      }}
                      onUploadProgress={setUploadProgress}
                      onUploadComplete={() => setUploading(false)}
                      onLogsProcessed={(processedLogs, fileName) => {
                        setLogs(processedLogs);
                        setCurrentDataset(fileName);
                      }}
                    />
                    {uploading && (
                      <div className="space-y-1">
                        <div className="text-xs text-neutral-400">Uploading...</div>
                        <Progress value={uploadProgress} className="h-1" />
                      </div>
                    )}
                    {currentDataset && (
                      <div className="rounded bg-neutral-900 border border-neutral-700 px-3 py-2">
                        <div className="text-sm text-neutral-200">{currentDataset}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-700">
                  <h3 className="text-sm font-medium text-yellow-400 mb-2">Log Colors</h3>
                  <div className="space-y-1">
                    <ColorPicker
                      colors={eventColors}
                      onColorChange={handleColorChange}
                      onRemoveColor={handleRemoveColor}
                      onAddColor={handleAddColor}
                      availableValues={availableValues}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-700">
                  <h3 className="text-sm font-medium text-yellow-400 mb-2">Set Node Graph Relationship</h3>
                  <div className="space-y-1">
                    <GraphControls
                      selectedRelationship={selectedRelationship}
                      onRelationshipChange={setSelectedRelationship}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resize Handle */}
          <div 
            className="w-1 h-full bg-neutral-700 hover:bg-yellow-400 cursor-col-resize transition-colors"
            onMouseDown={() => setIsResizingSidebar(true)}
          />

          {/* Main Content Area */}
          <div className="flex-1 h-full flex flex-col">
            {/* Graph Header */}
            <div className="px-4 py-2 border-b border-neutral-800">
              <div className="flex items-center gap-x-4">
                <button
                  type="button"
                  onClick={handleToggleSidebar}
                  className="h-8 px-3 rounded bg-neutral-900 border border-neutral-700 flex items-center gap-2"
                >
                  {sidebarCollapsed ? (
                    <>
                      <ChevronsRight className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-yellow-400">Show panel</span>
                    </>
                  ) : (
                    <>
                      <ChevronsLeft className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-yellow-400">Hide panel</span>
                    </>
                  )}
                </button>
                <span className="text-sm text-neutral-400">
                  {logs.length} logs loaded
                </span>
              </div>
            </div>

            {/* Graphs Area */}
            <div className="flex-1 overflow-y-auto">
              <div className={`${graphOptions.filter(g => g.enabled).length > 1 ? 'pb-96' : ''} h-full space-y-1 p-1`}>
                {graphOptions.filter(graph => graph.enabled).map((graph, index, enabledGraphs) => (
                  <div 
                    key={graph.id}
                    id={graph.id}
                    className="relative bg-neutral-900 rounded-lg border border-neutral-700"
                    style={{ 
                      height: enabledGraphs.length === 1 ? '100%' : `${graph.height}px`,
                      minHeight: enabledGraphs.length > 1 ? '200px' : '100%'
                    }}
                  >
                    {/* Placeholder content for each graph type */}
                    {graph.id === 'obsidian' && (
                      <ObsidianGraph
                        logs={logs.map((log, index) => ({
                          ...log,
                          id: log.id || `log-${index}`, // Ensure each log has an ID
                          type: log.type || log.event_type || 'unknown',
                          dataset: currentDataset || 'unknown'
                        }))}
                        selectedRelationship={selectedRelationship}
                        colors={Object.fromEntries(eventColors.map(c => [c.eventType, c.color]))}
                        shapes={{
                          'azure-ad': 'circle',
                          'windows-security': 'square',
                          'aws-cloudwatch': 'triangle',
                          'linux-syslog': 'diamond',
                          'default': 'circle'
                        }}
                        onNodeClick={(node) => console.log('Node clicked:', node)}
                      />
                    )}
                    {graph.id === 'geomap' && (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400">
                        Geographic Map Placeholder
                      </div>
                    )}
                    {graph.id === 'error' && (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400">
                        Error Graph Placeholder
                      </div>
                    )}
                    
                    {/* Resize handle - show for all graphs when multiple are present */}
                    {enabledGraphs.length > 1 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-700 hover:bg-yellow-400 cursor-row-resize"
                        onMouseDown={() => setIsResizingGraph(graph.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Graphs;
