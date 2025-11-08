import React, { useState, useEffect } from 'react';
import { SelectedObject, SelectedObject2D, SelectedObject3D } from '../types';
import SlidersHorizontalIcon from './icons/SlidersHorizontalIcon';

interface InspectorPanelProps {
    selectedObject: SelectedObject;
    onUpdate: (id: string, propertyPath: string, value: any) => void;
}

const is2D = (obj: SelectedObject): obj is SelectedObject2D => obj?.type === '2D';
const is3D = (obj: SelectedObject): obj is SelectedObject3D => obj?.type === '3D';

const NumberInput: React.FC<{ label: string; value: number; onChange: (val: number) => void }> = ({ label, value, onChange }) => {
    const [localValue, setLocalValue] = useState(value.toFixed(2));
    const step = 0.1;

    useEffect(() => {
        setLocalValue(value.toFixed(2));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleBlur = () => {
        const num = parseFloat(localValue);
        if (!isNaN(num)) {
            onChange(num);
        } else {
            setLocalValue(value.toFixed(2)); // Revert if invalid
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleBlur();
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(Number((value + step).toFixed(2)));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(Number((value - step).toFixed(2)));
        }
    };

    return (
        <div className="flex items-center">
            <label className="w-4 text-center text-gray-500 font-semibold text-xs">{label}</label>
            <input
                type="number"
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                step={step}
                className="flex-grow bg-gray-900/80 border border-gray-700/60 rounded-sm px-1.5 py-0.5 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-right"
            />
        </div>
    );
};

const VectorInputs: React.FC<{ label: string; value: { x: number; y: number; z?: number }; onChange: (path: string, val: number) => void }> = ({ label, value, onChange }) => (
    <div>
        <label className="text-gray-400 text-xs font-medium">{label}</label>
        <div className={`grid ${value.z !== undefined ? 'grid-cols-3' : 'grid-cols-2'} gap-1 mt-1`}>
            <NumberInput label="X" value={value.x} onChange={(v) => onChange('x', v)} />
            <NumberInput label="Y" value={value.y} onChange={(v) => onChange('y', v)} />
            {value.z !== undefined && (
                 <NumberInput label="Z" value={value.z} onChange={(v) => onChange('z', v)} />
            )}
        </div>
    </div>
);


const InspectorPanel: React.FC<InspectorPanelProps> = ({ selectedObject, onUpdate }) => {
    if (!selectedObject) {
        return null;
    }

    const radToDeg = (rad: number) => rad * (180 / Math.PI);
    const degToRad = (deg: number) => deg * (Math.PI / 180);

    const handleRotationChange = (newDeg: number) => {
        onUpdate(selectedObject.id, 'rotation', degToRad(newDeg));
    };
    
    const handle3DRotationChange = (axis: string, newDeg: number) => {
        onUpdate(selectedObject.id, `rotation.${axis}`, degToRad(newDeg));
    };

    return (
        <div className="p-2 text-sm">
            <header className="px-2 mb-2 flex-shrink-0">
                <h2 className="text-xs font-bold uppercase text-gray-500 mb-2 tracking-wider flex items-center gap-2">
                    <SlidersHorizontalIcon className="w-4 h-4" /> Inspector
                </h2>
                <div className="p-2 rounded-md bg-black/30">
                     <p className="font-medium text-gray-200 truncate" title={selectedObject.name}>
                        {selectedObject.name}
                    </p>
                    <p className="text-xs text-gray-500">ID: {selectedObject.id.substring(0, 8)}...</p>
                </div>
            </header>
            <div className="px-2 py-2 space-y-3">
                {is2D(selectedObject) && (
                    <>
                        <VectorInputs label="Position" value={{ x: selectedObject.x, y: selectedObject.y }} onChange={(axis, val) => onUpdate(selectedObject.id, axis, val)} />
                        <VectorInputs label="Size" value={{ x: selectedObject.width, y: selectedObject.height }} onChange={(axis, val) => onUpdate(selectedObject.id, axis === 'x' ? 'width' : 'height', val)} />
                        <div>
                            <label className="text-gray-400 text-xs font-medium">Rotation (°)</label>
                            <div className="mt-1">
                                <NumberInput label="°" value={radToDeg(selectedObject.rotation)} onChange={handleRotationChange} />
                            </div>
                        </div>
                         <div>
                            <label className="text-gray-400 text-xs font-medium">Alpha</label>
                            <div className="mt-1">
                                <NumberInput label="" value={selectedObject.alpha} onChange={(v) => onUpdate(selectedObject.id, 'alpha', v)} />
                            </div>
                        </div>
                    </>
                )}
                 {is3D(selectedObject) && (
                    <>
                        <VectorInputs label="Position" value={selectedObject.position} onChange={(axis, val) => onUpdate(selectedObject.id, `position.${axis}`, val)} />
                        <VectorInputs label="Scale" value={selectedObject.scale} onChange={(axis, val) => onUpdate(selectedObject.id, `scale.${axis}`, val)} />
                        <VectorInputs label="Rotation (°)" value={{ x: radToDeg(selectedObject.rotation.x), y: radToDeg(selectedObject.rotation.y), z: radToDeg(selectedObject.rotation.z)}} onChange={(axis, val) => handle3DRotationChange(axis, val)} />
                    </>
                )}
            </div>
        </div>
    );
};

export default InspectorPanel;