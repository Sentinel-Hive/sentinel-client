import { RelationshipTypes } from '../../types/types';

interface RelationshipPickerProps {
  onRelationshipChange: (type: RelationshipTypes) => void;
  selectedRelationship: RelationshipTypes;
}

const RelationshipPicker = ({ onRelationshipChange, selectedRelationship }: RelationshipPickerProps) => {
  const toLabel = (type: RelationshipTypes) => {
    switch (type) {
      case RelationshipTypes.APP_EVENT:
        return 'App Type';
      case RelationshipTypes.IP_CONNECTION:
        return 'Request/Response';
      case RelationshipTypes.USER_EVENT:
        return 'Same User';
      case RelationshipTypes.HOST_EVENT:
        return 'Same Host';
      case RelationshipTypes.SEVERITY_LEVEL:
        return 'Severity Level';
      default:
        return String(type);
    }
  };

  const relationships = Object.values(RelationshipTypes).map(type => ({
    value: type,
    label: toLabel(type)
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