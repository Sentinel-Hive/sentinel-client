import { RelationshipTypes } from '../../types/types';

interface RelationshipPickerProps {
  onRelationshipChange: (type: RelationshipTypes) => void;
  selectedRelationship: RelationshipTypes;
}

const RelationshipPicker = ({ onRelationshipChange, selectedRelationship }: RelationshipPickerProps) => {
  const relationships = Object.values(RelationshipTypes).map(type => ({
    value: type,
    label: type
  }));

  return (
    <select
      value={selectedRelationship}
      onChange={(e) => onRelationshipChange(e.target.value as RelationshipTypes)}
      className="w-full rounded p-2 bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
    >
      {relationships.map((rel) => (
        <option key={rel.value} value={rel.value} className="bg-neutral-800">
          {rel.label}
        </option>
      ))}
    </select>
  );
};

export default RelationshipPicker;