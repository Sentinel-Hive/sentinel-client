import { useState } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, X } from 'lucide-react';

export interface EventColor {
  eventType: string; // The raw value (event_type, severity, etc.) being colored
  color: string;     // CSS color string
}

export type ColorCriteria = 
  | "event_type"  // HTTP Auth Login, HTTP Failure, etc.
  | "severity"    // Info, Warning, Error, etc.
  | "app_type"    // Application name/type
  | "src_ip"      // Source IP
  | "dest_ip"     // Destination IP
  | "user";       // User principal / name

export interface AvailableValues {
  event_type: string[];
  severity: string[];
  app_type: string[];
  src_ip: string[];
  dest_ip: string[];
  user: string[];
}

interface ColorPickerProps {
  colors: EventColor[];
  onColorChange: (value: string, color: string) => void;
  onRemoveColor: (value: string) => void;
  onAddColor: (value: string, color: string) => void;
  availableValues: AvailableValues;
  selectedCriteria: ColorCriteria; // lifted state from parent
  onCriteriaChange: (criteria: ColorCriteria) => void; // notify parent
}

// Generate highly distinct colors optimized for large sets
const generateDistinctColors = (count: number): string[] => {
  const colors: string[] = [];
  
  // Start with a mix of dark and vibrant primary colors
  colors.push(
    'hsl(0, 90%, 45%)',     // Deep Red
    'hsl(210, 90%, 30%)',   // Dark Blue
    'hsl(120, 85%, 35%)'    // Dark Green
  );

  // Add vibrant secondary colors
  colors.push(
    'hsl(45, 95%, 60%)',    // Bright Yellow
    'hsl(280, 85%, 40%)',   // Deep Purple
    'hsl(170, 85%, 45%)'    // Turquoise
  );

  // Add pastel colors
  colors.push(
    'hsl(350, 70%, 85%)',   // Pastel Pink
    'hsl(190, 60%, 80%)',   // Pastel Blue
    'hsl(90, 50%, 80%)'     // Pastel Green
  );

  // Add just two grayscale colors
  colors.push(
    'hsl(0, 0%, 20%)',      // Dark Gray
    'hsl(0, 0%, 60%)'       // Light Gray
  );

  // If we need more colors, generate them with varied combinations
  if (count > colors.length) {
    const remaining = count - colors.length;
    const goldenRatio = 0.618033988749895;
    let hue = Math.random();

    // Pre-defined combinations covering the full spectrum of possibilities
    const combinations = [
      { s: 90, l: 25 },   // Very Dark
      { s: 85, l: 40 },   // Dark but saturated
      { s: 95, l: 60 },   // Vibrant
      { s: 70, l: 75 },   // Light but clear
      { s: 45, l: 85 },   // Pastel
      { s: 100, l: 45 },  // Deep and rich
      { s: 60, l: 95 }    // Very light
    ];

    for (let i = 0; i < remaining; i++) {
      hue = (hue + goldenRatio) % 1;
      const h = Math.floor(hue * 360);
      const { s, l } = combinations[i % combinations.length];
      
      // Only every eighth color is grayscale
      if (i % 8 === 7) {
        colors.push(`hsl(0, 0%, ${30 + Math.floor(Math.random() * 40)}%)`); // Grays between 30% and 70% lightness
      } else {
        colors.push(`hsl(${h}, ${s}%, ${l}%)`);
      }
    }
  }

  // Shuffle the colors to avoid predictable patterns
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  return colors;
};

// Convert HSL to hex
const hslToHex = (color: string): string => {
  if (!color) return '#000000';
  if (color.startsWith('#')) return color;
  
  const match = color.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
  if (!match) return '#000000';

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  let r, g, b;
  if (s === 0) {
    r = g = b = Math.round(l * 255);
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    g = Math.round(hue2rgb(p, q, h) * 255);
    b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Start with black as default
const predefinedColors = ["#000000"];

const criteriaTitles: Record<ColorCriteria | "select", string> = {
  select: "Select Criteria",
  event_type: "Event Type",
  severity: "Severity Level",
  app_type: "Application Type",
  src_ip: "Source IP",
  dest_ip: "Destination IP",
  user: "User"
};

const ColorPicker = ({ colors, onColorChange, onRemoveColor, onAddColor, availableValues, selectedCriteria, onCriteriaChange }: ColorPickerProps) => {

  // When criteria changes, automatically add all values with predefined colors
  const handleCriteriaChange = (value: string) => {
    const newCriteria = value as ColorCriteria;
    onCriteriaChange(newCriteria);
    const values = availableValues[newCriteria];
    const distinctColors = generateDistinctColors(values.length);
    // Pre-populate colors for new criteria values without overwriting existing mapping for other criteria.
    values.forEach((val, index) => {
      if (!colors.some(c => c.eventType === val)) {
        onAddColor(val, distinctColors[index]);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Criteria selector */}
      <div className="space-y-4">
        {/* Select Criteria label and dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-white mb-1">Select Criteria</label>
          <Select 
            value={selectedCriteria} 
            onValueChange={handleCriteriaChange}>
            <SelectTrigger className="w-[250px] bg-neutral-800 border-neutral-700 [&>span]:text-white">
            </SelectTrigger>
            <SelectContent>
              {Object.entries(criteriaTitles)
                .filter(([key]) => key !== "select")
                .map(([key, title]) => (
                  <SelectItem key={key} value={key}>
                    {title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Generate Colors button */}
        <div className="flex flex-col gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const values = availableValues[selectedCriteria];
              const distinctColors = generateDistinctColors(values.length);
              values.forEach((value, index) => {
                if (colors.some(c => c.eventType === value)) {
                  onColorChange(value, distinctColors[index]);
                } else {
                  onAddColor(value, distinctColors[index]);
                }
              });
            }}
            className="mt-2 w-[250px] bg-neutral-800 hover:bg-neutral-700 text-yellow-400"
          >
            Generate Colors
          </Button>
        </div>
      </div>

      {/* Color tags - all values are shown */}
      <div className="flex flex-wrap gap-2">
        {availableValues[selectedCriteria].map((value) => {
          const existingColor = colors.find(c => c.eventType === value);
          const isAssigned = !!existingColor;
          
          return (
            <div
              key={value}
              className="group flex items-center gap-2 px-2 py-1 bg-neutral-800 rounded border border-neutral-700"
            >
              <span className="text-sm">{value}</span>
              <div
                className="w-8 h-6 rounded overflow-hidden relative cursor-pointer border border-neutral-700"
                style={{ backgroundColor: existingColor?.color || predefinedColors[0] }}
              >
                <input
                  type="color"
                  value={hslToHex(existingColor?.color || predefinedColors[0])}
                  onChange={(e) => {
                    if (isAssigned) {
                      onColorChange(value, e.target.value);
                    } else {
                      onAddColor(value, e.target.value);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '150%',
                    height: '150%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ColorPicker;