import RelationshipPicker from "./RelationshipPicker";
import { RelationshipTypes } from "../../types/types";

interface GraphControlsProps {
    selectedRelationship: RelationshipTypes;
    onRelationshipChange: (type: RelationshipTypes) => void;
}

const GraphControls = ({ selectedRelationship, onRelationshipChange }: GraphControlsProps) => {
    return (
        <div className="space-y-2">
            <RelationshipPicker
                selectedRelationship={selectedRelationship}
                onRelationshipChange={onRelationshipChange}
            />
        </div>
    );
};

export default GraphControls;
