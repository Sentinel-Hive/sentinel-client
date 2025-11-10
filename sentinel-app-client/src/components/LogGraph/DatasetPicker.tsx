import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

interface DatasetInfo {
  id: string;
  name: string;
  logCount: number;
}

interface DatasetPickerProps {
  selectedDatasets: DatasetInfo[];
  onSelectionChange: (datasets: DatasetInfo[]) => void;
}

const DatasetPicker = ({ selectedDatasets, onSelectionChange }: DatasetPickerProps) => {
  return (
    <Card className="w-full bg-neutral-900 border-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-white">Selected Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-neutral-200">
          {selectedDatasets.length === 0 ? (
            <p className="text-neutral-400">No datasets selected</p>
          ) : (
            <ul className="space-y-1">
              {selectedDatasets.map((dataset) => (
                <li key={dataset.id} className="flex justify-between items-center">
                  <span>{dataset.name}</span>
                  <span className="text-neutral-400">{dataset.logCount} logs</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DatasetPicker;